import {
  MarketplaceResolverError,
  type InstallSkillIntent,
  type MarketplaceFetch,
  type ResolvedSkillSnapshot,
  type RepositoryInspection,
  type ResolvedMarketplaceEntry,
  type SkillDescriptor,
  type SnapshotResolver
} from "./types.js";
import { createGitHubBundleFetcher, type GitHubBundle } from "./github-bundle.js";
import { createGitHubRepositoryInspector } from "./github-inspector.js";
import { createGitHubSnapshotCache, type GitHubSnapshotCache } from "./github-snapshot-cache.js";

export interface GitHubSnapshotResolverOptions {
  fetch?: MarketplaceFetch;
  timeoutMs?: number;
  now?: () => Date;
  cacheRoot?: string;
  snapshotCache?: GitHubSnapshotCache;
  refreshCommit?: boolean;
}

export function createGitHubSnapshotResolver(
  options: GitHubSnapshotResolverOptions = {}
): SnapshotResolver {
  const snapshotCache = options.snapshotCache ?? createGitHubSnapshotCache(options);
  const freshInspector = createGitHubRepositoryInspector({
    ...options,
    snapshotCache,
    refreshCommit: true
  });
  const cachedInspector = createGitHubRepositoryInspector({
    ...options,
    snapshotCache,
    refreshCommit: false
  });
  const bundleFetcher = createGitHubBundleFetcher({ ...options, snapshotCache });
  return {
    async resolveSkillSnapshot(intent, request = {}) {
      assertIntent(intent);
      const resolution = await this.resolveRepositorySnapshots?.({
        repository: intent.repository,
        skillPaths: [intent.skillPath]
      }, request);
      if (resolution === undefined) {
        throw new MarketplaceResolverError("GITHUB_SKILL_NOT_FOUND", "Batch snapshot resolution is unavailable.");
      }
      const failure = resolution.failures.find((item) => item.skillPath === intent.skillPath);
      if (failure !== undefined) {
        throw new MarketplaceResolverError("GITHUB_SKILL_NOT_FOUND", failure.message);
      }
      const snapshot = resolution.snapshots.find((item) => item.skill.path === intent.skillPath);
      if (snapshot === undefined) {
        throw new MarketplaceResolverError(
          "GITHUB_SKILL_NOT_FOUND",
          `GitHub repository does not contain an installable Skill at ${intent.skillPath}.`
        );
      }
      return snapshot;
    },
    async resolveRepositorySnapshots(intent, request = {}) {
      const requestedPaths = intent.skillPaths === undefined
        ? undefined
        : [...new Set(intent.skillPaths)];
      if (requestedPaths === undefined) {
        assertIntent({ repository: intent.repository, skillPath: "." });
      } else {
        for (const skillPath of requestedPaths) {
          assertIntent({ repository: intent.repository, skillPath });
        }
      }
      const refreshCommit = request.refreshCommit ?? options.refreshCommit ?? true;
      const inspection = await (refreshCommit ? freshInspector : cachedInspector).inspectRepository({
        repository: intent.repository,
        ...(request.signal === undefined ? {} : { signal: request.signal })
      });
      const selected = requestedPaths === undefined
        ? inspection.skills
        : inspection.skills.filter((skill) => requestedPaths.includes(skill.path));
      const snapshots: ResolvedSkillSnapshot[] = [];
      const failures: Array<{ skillPath: string; code: string; message: string }> = [];
      if (requestedPaths !== undefined) {
        for (const skillPath of requestedPaths) {
          if (!inspection.skills.some((skill) => skill.path === skillPath)) {
            failures.push({
              skillPath,
              code: "GITHUB_SKILL_NOT_FOUND",
              message: `GitHub repository does not contain a Skill at ${skillPath}.`
            });
          }
        }
      }
      for (const descriptor of selected) {
        if (!descriptor.installable) {
          failures.push({ skillPath: descriptor.path, code: "GITHUB_SKILL_NOT_INSTALLABLE", message: descriptor.warnings.join(" ") || `Skill ${descriptor.path} is not installable.` });
          continue;
        }
        try {
          const entry = toResolvedEntry(inspection, descriptor);
          const bundle = await bundleFetcher.fetchBundle(entry, request);
          snapshots.push(toResolvedSnapshot(inspection, descriptor, bundle));
        } catch (error) {
          failures.push({
            skillPath: descriptor.path,
            code: error instanceof MarketplaceResolverError ? error.code : "GITHUB_SNAPSHOT_FAILED",
            message: error instanceof Error ? error.message : "Skill snapshot resolution failed."
          });
        }
      }
      return { inspection, snapshots, failures };
    }
  };
}

function toResolvedSnapshot(
  inspection: RepositoryInspection,
  skill: SkillDescriptor,
  bundle: GitHubBundle
): ResolvedSkillSnapshot {
  return {
    repository: inspection.repository,
    skill,
    snapshot: {
      snapshotKey: `${skill.skillKey}@${inspection.inspectionCommit}`,
      repository: {
        owner: inspection.repository.owner,
        name: inspection.repository.name
      },
      skillPath: skill.path,
      commitSha: inspection.inspectionCommit,
      skillDocumentBlobSha: skill.skillDocumentBlobSha,
      files: bundle.files.map((file) => ({
        path: file.path,
        blobSha: file.blobSha,
        size: file.size,
        mode: file.mode
      })),
      bundleHash: bundle.bundleHash,
      integrity: {
        commitPinned: true,
        pathsSafe: true,
        frontmatterValid: true,
        symlinksRejected: true,
        submodulesRejected: true
      }
    },
    files: bundle.files.map((file) => ({ path: file.path, content: file.content }))
  };
}

function toResolvedEntry(
  inspection: RepositoryInspection,
  skill: SkillDescriptor
): ResolvedMarketplaceEntry {
  const { owner, name: repositoryName } = inspection.repository;
  const repository = `${owner}/${repositoryName}`;
  const url = `https://github.com/${repository}`;
  return {
    id: `${repository}/${skill.name}`,
    source: "github",
    catalogs: ["github"],
    name: skill.name,
    description: skill.description,
    publisher: { name: owner, url: `https://github.com/${owner}` },
    author: skill.author,
    repository: {
      host: "github",
      id: inspection.repository.repositoryId,
      nodeId: inspection.repository.nodeId,
      owner,
      name: repositoryName,
      path: skill.path,
      url
    },
    skillUrl: skill.path === "."
      ? `${url}/blob/${inspection.inspectionCommit}/SKILL.md`
      : `${url}/tree/${inspection.inspectionCommit}/${skill.path}`,
    install: {
      kind: "github",
      repository,
      skill: skill.name,
      path: skill.path
    },
    metrics: {
      installs: null,
      stars: { value: inspection.repository.stars, source: "github", scope: "repository" },
      downloads: null
    },
    cover: { kind: "generated", seed: `${repository}#${skill.path}` },
    snapshot: {
      commitSha: inspection.inspectionCommit,
      blobSha: skill.skillDocumentBlobSha,
      fetchedAt: inspection.inspectedAt,
      ...(skill.manifestFiles.length === 0 ? {} : { manifestFiles: skill.manifestFiles })
    }
  };
}

function assertIntent(intent: InstallSkillIntent): void {
  if (!/^[A-Za-z0-9_.-]+$/u.test(intent.repository.owner)
    || !/^[A-Za-z0-9_.-]+$/u.test(intent.repository.name)
    || !isSafeSkillPath(intent.skillPath)) {
    throw new MarketplaceResolverError(
      "INVALID_MARKETPLACE_ENTRY",
      "Skill installation intent is invalid."
    );
  }
}

function isSafeSkillPath(path: string): boolean {
  return path === "." || (
    !path.startsWith("/")
    && !path.includes("\\")
    && !path.includes("\0")
    && path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}
