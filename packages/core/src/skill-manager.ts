import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  copyFile,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { join, resolve } from "node:path";

import { parse, stringify } from "yaml";

import { SkillManagerError } from "./skill-manager-error.js";
import {
  fingerprintSkillDirectory,
  fingerprintSkillFiles,
  type SkillIdentityFingerprint
} from "./skill-fingerprint.js";
import type { GitHubSkillObservation } from "./github-skill-index.js";
import {
  createGitHubBundleFetcher,
  createGitHubUpdateChecker,
  type GitHubBundleFile
} from "./marketplace/github-bundle.js";
import { MarketplaceResolverError } from "./marketplace/types.js";
import type {
  CreateSkillRequest,
  CheckUpdatesRequest,
  DeleteSkillRequest,
  DeletedSkill,
  DiscoverExternalSkillsRequest,
  ExternalSkillCandidate,
  ExternalSkillTarget,
  ImportSkillRequest,
  InstallMarketplaceSkillRequest,
  InstallSkillSnapshotRequest,
  ListSkillBackupsRequest,
  ListTargetStatesRequest,
  ManagedSkill,
  RollbackSkillRequest,
  RestoreTrashRequest,
  SetTargetEnabledRequest,
  SkillBackup,
  SkillBackupReason,
  GitHubSkillSource,
  SkillManager,
  SkillManagerOptions,
  SkillMutationResult,
  SkillProvenanceHint,
  SkillTargetState,
  SkillUpdateCheck,
  StoredSkill,
  TrashedSkill,
  UpdateSkillRequest,
  VerifyMarketplaceProvenanceRequest
} from "./types.js";
import type { ResolvedMarketplaceEntry, ResolvedSkillSnapshot } from "./marketplace/types.js";

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REGISTRY_VERSION = 1;
const DEFAULT_BODY = "Describe how this Skill should guide the agent.\n";
const DEFAULT_MARKETPLACE_TIMEOUT_MS = 10_000;
const PROVENANCE_TIMEOUT_MS = 30_000;
const PROVENANCE_CONCURRENCY = 2;
const UPDATE_CONCURRENCY = 4;
const BACKUP_VERSION = 1;
const TRASH_VERSION = 1;
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_SNAPSHOT_FILE_COUNT = 512;
const MAX_SNAPSHOT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SNAPSHOT_BUNDLE_BYTES = 25 * 1024 * 1024;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RegistrySkill extends ManagedSkill {
  relativePath: string;
}

interface RegistryFile {
  version: typeof REGISTRY_VERSION;
  skills: Record<string, RegistrySkill>;
}

interface StoredBackupFile {
  version: typeof BACKUP_VERSION;
  backup: SkillBackup;
  skill: RegistrySkill;
}

interface StoredTrashFile {
  version: typeof TRASH_VERSION;
  trashId: string;
  deletedAt: string;
  skill: RegistrySkill;
  archivedContentHash: string;
}

interface ReplacementJournal {
  version: 1;
  id: string;
  name: string;
  currentHash: string;
  replacementHash: string;
  displacedName: string;
  replacementName: string;
  backupId: string;
  previousRegistry: RegistryFile;
}

export function createSkillManager(options: SkillManagerOptions): SkillManager {
  const root = resolve(options.root);
  const libraryRoot = join(root, "library");
  const activeRoot = resolve(options.dshRoot ?? join(root, "active"));
  const targetRoots = resolveTargetRoots(options.targetRoots);
  const backupRoot = join(root, "backups");
  const trashRoot = join(root, "trash");
  const registryPath = join(root, "registry.json");
  const now = options.now ?? (() => new Date());
  let recovery: Promise<void> | undefined;
  const ensureRecovered = async () => {
    recovery ??= recoverInterruptedReplacements(root, libraryRoot, registryPath);
    await recovery;
    await purgeExpiredTrash(trashRoot, now);
  };

  return {
    async createSkill(request) {
      await ensureRecovered();
      validateCreateRequest(request);
      await mkdir(libraryRoot, { recursive: true });

      const destination = join(libraryRoot, request.name);
      if (await pathExists(destination)) {
        throw new SkillManagerError(
          "SKILL_ALREADY_EXISTS",
          `Skill "${request.name}" already exists.`
        );
      }

      const temporary = join(libraryRoot, `.create-${request.name}-${randomUUID()}`);
      const body = `# ${request.name}\n\n${DEFAULT_BODY}`;
      const document = renderSkillDocument(request, body);
      const now = new Date().toISOString();
      const skill: RegistrySkill = {
        name: request.name,
        description: request.description.trim(),
        origin: "self",
        enabledTargets: [],
        createdAt: now,
        updatedAt: now,
        contentHash: "",
        relativePath: join("library", request.name)
      };

      await mkdir(temporary, { recursive: false });
      try {
        await writeFile(join(temporary, "SKILL.md"), document, "utf8");
        skill.contentHash = await hashSkillBundle(temporary);
        await rename(temporary, destination);

        const registry = await readRegistry(registryPath);
        registry.skills[request.name] = skill;
        try {
          await writeRegistry(root, registryPath, registry);
        } catch (error) {
          await rm(destination, { force: true, recursive: true });
          throw error;
        }
      } catch (error) {
        await rm(temporary, { force: true, recursive: true });
        throw error;
      }

      return toManagedSkill(skill);
    },

    async getSkill(name) {
      await ensureRecovered();
      if (!SKILL_NAME.test(name)) return undefined;
      const registry = await readRegistry(registryPath);
      const entry = registry.skills[name];
      if (entry === undefined) return undefined;

      const document = await readFile(join(root, entry.relativePath, "SKILL.md"), "utf8");
      const parsed = parseSkillDocument(document);
      return {
        ...toManagedSkill(entry),
        description: parsed.description,
        content: parsed.content
      };
    },

    async listSkills() {
      await ensureRecovered();
      const registry = await readRegistry(registryPath);
      return Object.values(registry.skills)
        .map(toManagedSkill)
        .sort((left, right) => left.name.localeCompare(right.name));
    },

    async discoverExternalSkills(request = {}) {
      await ensureRecovered();
      return discoverExternalSkills(targetRoots, request);
    },

    async importSkill(request) {
      await ensureRecovered();
      validateExternalSkillName(request.name);
      const sourceRoot = requireTargetRoot(targetRoots, request.target);
      const sourcePath = join(sourceRoot, request.name);
      await assertDirectExternalSkillDirectory(sourcePath, request.name);
      const sourceDocument = await readFile(join(sourcePath, "SKILL.md"), "utf8").catch((error: unknown) => {
        throw new SkillManagerError(
          "SKILL_SOURCE_INVALID",
          `Skill "${request.name}" was not found in the configured ${request.target} root.`,
          { cause: error }
        );
      });
      const parsed = parseExternalSkillDocument(sourceDocument, request.name);
      validateCreateRequest({ name: parsed.name, description: parsed.description });
      if (parsed.name !== request.name) {
        throw new SkillManagerError(
          "SKILL_SOURCE_INVALID",
          `Skill directory "${request.name}" declares the different name "${parsed.name}".`
        );
      }

      await mkdir(libraryRoot, { recursive: true });
      const destination = join(libraryRoot, parsed.name);
      if (await pathExists(destination)) {
        throw new SkillManagerError(
          "SKILL_ALREADY_EXISTS",
          `Skill "${parsed.name}" already exists.`
        );
      }

      const temporary = join(libraryRoot, `.import-${parsed.name}-${randomUUID()}`);
      await mkdir(temporary, { recursive: false });
      try {
        await copySkillBundle(sourcePath, temporary);
        const staged = parseExternalSkillDocument(
          await readFile(join(temporary, "SKILL.md"), "utf8"),
          request.name
        );
        validateCreateRequest({ name: staged.name, description: staged.description });
        if (staged.name !== parsed.name || staged.description !== parsed.description) {
          throw new SkillManagerError(
            "SKILL_SOURCE_INVALID",
            `External Skill "${request.name}" changed during import.`
          );
        }
        const now = new Date().toISOString();
        const skill: RegistrySkill = {
          name: staged.name,
          description: staged.description,
          origin: "self",
          enabledTargets: [],
          createdAt: now,
          updatedAt: now,
          contentHash: await hashSkillBundle(temporary),
          relativePath: join("library", staged.name),
          source: {
            kind: "local-import",
            name: request.name,
            target: request.target
          }
        };

        await rename(temporary, destination);
        const registry = await readRegistry(registryPath);
        registry.skills[parsed.name] = skill;
        try {
          await writeRegistry(root, registryPath, registry);
        } catch (error) {
          await rm(destination, { force: true, recursive: true });
          throw error;
        }
        return toManagedSkill(skill);
      } catch (error) {
        await rm(temporary, { force: true, recursive: true });
        throw error;
      }
    },

    async installMarketplaceSkill(request: InstallMarketplaceSkillRequest) {
      await ensureRecovered();
      const name = request.entry.install.skill;
      const destination = join(libraryRoot, name);
      if (await pathExists(destination)) {
        throw new SkillManagerError("SKILL_ALREADY_EXISTS", `Skill "${name}" already exists.`);
      }

      const bundle = await createGitHubBundleFetcher({
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        ...(options.snapshotCache === undefined ? {} : { snapshotCache: options.snapshotCache }),
        ...(options.marketplaceTimeoutMs === undefined
          ? {}
          : { timeoutMs: options.marketplaceTimeoutMs })
      }).fetchBundle(request.entry, {
        ...(request.signal === undefined ? {} : { signal: request.signal })
      });
      await mkdir(libraryRoot, { recursive: true });
      if (await pathExists(destination)) {
        throw new SkillManagerError("SKILL_ALREADY_EXISTS", `Skill "${name}" already exists.`);
      }

      const temporary = join(libraryRoot, `.market-${name}-${randomUUID()}`);
      await mkdir(temporary, { recursive: false });
      try {
        await writeBundleFiles(temporary, bundle.files);
        const document = await readFile(join(temporary, "SKILL.md"), "utf8");
        const parsed = parseSkillDocument(document);
        validateCreateRequest({ name: parsed.name, description: parsed.description });
        if (parsed.name !== name || parsed.description !== request.entry.description) {
          throw new SkillManagerError(
            "INVALID_MARKETPLACE_INSTALL",
            "Downloaded SKILL.md metadata does not match the resolved marketplace entry."
          );
        }

        const timestamp = now().toISOString();
        const identityFingerprint = fingerprintSkillFiles(bundle.files);
        const skill: RegistrySkill = {
          name,
          description: parsed.description,
          origin: "github",
          enabledTargets: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          contentHash: await hashSkillBundle(temporary),
          relativePath: join("library", name),
          source: {
            kind: "github",
            repository: request.entry.install.repository,
            path: request.entry.install.path,
            commitSha: request.entry.snapshot.commitSha,
            blobSha: request.entry.snapshot.blobSha,
            bundleHash: bundle.bundleHash,
            ...(request.entry.snapshot.manifestFiles === undefined
              ? {}
              : { manifestFiles: request.entry.snapshot.manifestFiles }),
            catalog: request.entry.source,
            url: request.entry.repository.url,
            repositoryId: request.entry.repository.id,
            nodeId: request.entry.repository.nodeId,
            matchMethod: "install",
            matchedAt: timestamp,
            identityFingerprint,
            discoverySources: [...(request.entry.catalogs ?? [request.entry.source])]
          }
        };

        await rename(temporary, destination);
        const registry = await readRegistry(registryPath);
        registry.skills[name] = skill;
        try {
          await writeRegistry(root, registryPath, registry);
          await recordGitHubObservation(options, observationFromEntry(
            request.entry,
            bundle.bundleHash,
            identityFingerprint,
            timestamp
          ));
        } catch (error) {
          await rm(destination, { force: true, recursive: true });
          throw error;
        }
        return toManagedSkill(skill);
      } catch (error) {
        await rm(temporary, { force: true, recursive: true });
        throw error;
      }
    },

    async installSkillSnapshot(request: InstallSkillSnapshotRequest) {
      await ensureRecovered();
      const { repository, skill, snapshot } = request.resolved;
      const files = validateResolvedSkillSnapshot(request.resolved);
      const name = skill.name;
      const destination = join(libraryRoot, name);
      if (await pathExists(destination)) {
        throw new SkillManagerError("SKILL_ALREADY_EXISTS", `Skill "${name}" already exists.`);
      }
      await mkdir(libraryRoot, { recursive: true });
      if (await pathExists(destination)) {
        throw new SkillManagerError("SKILL_ALREADY_EXISTS", `Skill "${name}" already exists.`);
      }

      const temporary = join(libraryRoot, `.market-${name}-${randomUUID()}`);
      await mkdir(temporary, { recursive: false });
      try {
        await writeBundleFiles(temporary, files);
        const document = await readFile(join(temporary, "SKILL.md"), "utf8");
        const parsed = parseSkillDocument(document);
        validateCreateRequest({ name: parsed.name, description: parsed.description });
        if (parsed.name !== name || parsed.description !== skill.description) {
          throw new SkillManagerError(
            "INVALID_MARKETPLACE_INSTALL",
            "Downloaded SKILL.md metadata does not match the resolved Skill snapshot."
          );
        }

        const timestamp = now().toISOString();
        const identityFingerprint = fingerprintSkillFiles(files);
        const registrySkill: RegistrySkill = {
          name,
          description: parsed.description,
          origin: "github",
          enabledTargets: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          contentHash: await hashSkillBundle(temporary),
          relativePath: join("library", name),
          source: {
            kind: "github",
            repository: `${repository.owner}/${repository.name}`,
            path: skill.path,
            commitSha: snapshot.commitSha,
            blobSha: snapshot.skillDocumentBlobSha,
            bundleHash: snapshot.bundleHash,
            ...(skill.manifestFiles.length === 0 ? {} : { manifestFiles: skill.manifestFiles }),
            catalog: "github",
            url: repository.url,
            repositoryId: repository.repositoryId,
            nodeId: repository.nodeId,
            matchMethod: "install",
            matchedAt: timestamp,
            identityFingerprint,
            discoverySources: ["github"]
          }
        };

        await rename(temporary, destination);
        const registry = await readRegistry(registryPath);
        registry.skills[name] = registrySkill;
        try {
          await writeRegistry(root, registryPath, registry);
          await recordGitHubObservation(options, observationFromResolvedSnapshot(
            request.resolved,
            identityFingerprint,
            timestamp
          ));
        } catch (error) {
          await rm(destination, { force: true, recursive: true });
          throw error;
        }
        return toManagedSkill(registrySkill);
      } catch (error) {
        await rm(temporary, { force: true, recursive: true });
        throw error;
      }
    },

    async getProvenanceHints(name: string) {
      await ensureRecovered();
      validateManagedName(name);
      const registry = await readRegistry(registryPath);
      const skill = registry.skills[name];
      if (skill === undefined) {
        throw new SkillManagerError("SKILL_NOT_FOUND", `Skill "${name}" was not found.`);
      }
      return parseProvenanceHints(await readFile(join(root, skill.relativePath, "SKILL.md"), "utf8"));
    },

    async verifyMarketplaceProvenance(request: VerifyMarketplaceProvenanceRequest) {
      await ensureRecovered();
      validateManagedName(request.name);
      if (request.entries.length > 20) {
        throw new SkillManagerError(
          "INVALID_PROVENANCE_CANDIDATES",
          "Automatic provenance verification accepts at most 20 candidate Skill paths."
        );
      }
      const initialRegistry = await readRegistry(registryPath);
      const initialSkill = initialRegistry.skills[request.name];
      if (initialSkill === undefined) {
        throw new SkillManagerError("SKILL_NOT_FOUND", `Skill "${request.name}" was not found.`);
      }
      if (initialSkill.source?.kind === "github") {
        if (options.snapshotResolver !== undefined) {
          const resolved = await resolveManagedSkillSnapshot(
            options,
            request.name,
            initialSkill.source,
            request.signal
          );
          validateResolvedSkillSnapshot(resolved);
          initialSkill.source = {
            ...initialSkill.source,
            repository: `${resolved.repository.owner}/${resolved.repository.name}`,
            repositoryId: resolved.repository.repositoryId,
            nodeId: resolved.repository.nodeId,
            url: resolved.repository.url,
            path: resolved.skill.path
          };
          await writeRegistry(root, registryPath, initialRegistry);
          await recordGitHubObservation(options, observationFromResolvedSnapshot(
            resolved,
            fingerprintSkillFiles(resolved.files),
            now().toISOString()
          ));
        }
        return { name: request.name, status: "matched", skill: toManagedSkill(initialSkill) };
      }
      const sourcePath = join(root, initialSkill.relativePath);
      if (await hashSkillBundle(sourcePath) !== initialSkill.contentHash) {
        initialSkill.provenanceCheck = { status: "ineligible", checkedAt: now().toISOString() };
        await writeRegistry(root, registryPath, initialRegistry);
        return { name: request.name, status: "ineligible", skill: toManagedSkill(initialSkill) };
      }

      const identityFingerprint = await fingerprintSkillDirectory(sourcePath);
      const indexed = options.githubSkillIndex === undefined
        ? []
        : await options.githubSkillIndex.findByFingerprint(identityFingerprint);
      const candidates = limitProvenanceCandidates(deduplicateProvenanceEntries([
        ...indexed.map(entryFromObservation),
        ...request.entries
      ]));
      const fetcher = createGitHubBundleFetcher({
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        ...(options.snapshotCache === undefined ? {} : { snapshotCache: options.snapshotCache }),
        ...(options.marketplaceTimeoutMs === undefined ? {} : { timeoutMs: options.marketplaceTimeoutMs })
      });
      const matches: Array<{
        entry: ResolvedMarketplaceEntry;
        bundleHash: string;
        identityFingerprint: SkillIdentityFingerprint;
      }> = [];
      const provenanceController = new AbortController();
      let timedOut = false;
      const cancelFromCaller = () => provenanceController.abort(request.signal?.reason);
      request.signal?.addEventListener("abort", cancelFromCaller, { once: true });
      const provenanceTimer = setTimeout(() => {
        timedOut = true;
        provenanceController.abort();
      }, PROVENANCE_TIMEOUT_MS);
      let nextCandidate = 0;
      const worker = async () => {
        while (!provenanceController.signal.aborted) {
          const entry = candidates[nextCandidate++];
          if (entry === undefined) return;
          try {
            const bundle = await fetcher.fetchBundle(entry, { signal: provenanceController.signal });
            const remoteFingerprint = fingerprintSkillFiles(bundle.files);
            await recordGitHubObservation(options, observationFromEntry(
              entry,
              bundle.bundleHash,
              remoteFingerprint,
              now().toISOString()
            ));
            if (remoteFingerprint.hash === identityFingerprint.hash) {
              matches.push({ entry, bundleHash: bundle.bundleHash, identityFingerprint: remoteFingerprint });
            }
          } catch (error) {
            if (provenanceController.signal.aborted) throw error;
          }
        }
      };
      try {
        await Promise.all(Array.from(
          { length: Math.min(PROVENANCE_CONCURRENCY, candidates.length) },
          () => worker()
        ));
      } catch (error) {
        if (timedOut) {
          throw new MarketplaceResolverError(
            "MARKETPLACE_RESOLUTION_TIMEOUT",
            `GitHub provenance verification exceeded ${PROVENANCE_TIMEOUT_MS} ms.`,
            { cause: error }
          );
        }
        if (request.signal?.aborted) {
          throw new MarketplaceResolverError(
            "MARKETPLACE_RESOLUTION_ABORTED",
            "GitHub provenance verification was cancelled.",
            { cause: error }
          );
        }
        throw error;
      } finally {
        clearTimeout(provenanceTimer);
        request.signal?.removeEventListener("abort", cancelFromCaller);
      }
      if (provenanceController.signal.aborted) {
        throw new MarketplaceResolverError(
          timedOut ? "MARKETPLACE_RESOLUTION_TIMEOUT" : "MARKETPLACE_RESOLUTION_ABORTED",
          timedOut
            ? `GitHub provenance verification exceeded ${PROVENANCE_TIMEOUT_MS} ms.`
            : "GitHub provenance verification was cancelled."
        );
      }
      const uniqueMatches = deduplicateProvenanceMatches(matches);
      if (uniqueMatches.length !== 1) {
        const status = uniqueMatches.length === 0 ? "custom" : "ambiguous";
        initialSkill.provenanceCheck = { status, checkedAt: now().toISOString() };
        await writeRegistry(root, registryPath, initialRegistry);
        return {
          name: request.name,
          status,
          skill: toManagedSkill(initialSkill)
        };
      }

      const registry = await readRegistry(registryPath);
      const skill = registry.skills[request.name];
      if (
        skill === undefined
        || skill.contentHash !== initialSkill.contentHash
        || skill.source?.kind === "github"
        || await hashSkillBundle(join(root, skill.relativePath)) !== skill.contentHash
      ) {
        throw new SkillManagerError(
          "SKILL_PROVENANCE_CHANGED",
          `Skill "${request.name}" changed during provenance verification.`
        );
      }
      const match = uniqueMatches[0]!;
      const catalog = match.entry.catalogs.includes("hugging-face")
        ? "hugging-face"
        : "github";
      skill.origin = "github";
      delete skill.provenanceCheck;
      skill.source = {
        kind: "github",
        repository: match.entry.install.repository,
        path: match.entry.install.path,
        commitSha: match.entry.snapshot.commitSha,
        blobSha: match.entry.snapshot.blobSha,
        bundleHash: match.bundleHash,
        ...(match.entry.snapshot.manifestFiles === undefined
          ? {}
          : { manifestFiles: match.entry.snapshot.manifestFiles }),
        catalog,
        url: match.entry.repository.url,
        repositoryId: match.entry.repository.id,
        nodeId: match.entry.repository.nodeId,
        matchMethod: "exact-content",
        matchedAt: now().toISOString(),
        identityFingerprint: match.identityFingerprint,
        discoverySources: [...(match.entry.catalogs ?? [match.entry.source])]
      };
      skill.updatedAt = now().toISOString();
      await writeRegistry(root, registryPath, registry);
      return { name: request.name, status: "matched", skill: toManagedSkill(skill) };
    },

    async checkUpdates(request: CheckUpdatesRequest = {}) {
      await ensureRecovered();
      const registry = await readRegistry(registryPath);
      const names = request.names === undefined
        ? Object.keys(registry.skills).sort((left, right) => left.localeCompare(right))
        : normalizeUpdateNames(request.names, registry);
      const checkedAt = now().toISOString();
      const checks: SkillUpdateCheck[] = [];
      const remoteChecks: Array<{ index: number; name: string; skill: RegistrySkill }> = [];
      for (const name of names) {
        const skill = registry.skills[name]!;
        if (skill.source?.kind !== "github") {
          checks.push({ name, status: "unsupported", installed: null, latest: null, latestRisk: null, checkedAt });
          continue;
        }
        const installed = {
          commitSha: skill.source.commitSha,
          blobSha: skill.source.blobSha,
          bundleHash: skill.source.bundleHash
        };
        const currentHash = await hashSkillBundle(join(root, skill.relativePath));
        if (currentHash !== skill.contentHash) {
          checks.push({
            name,
            status: "local-modified",
            installed,
            latest: null,
            latestRisk: null,
            checkedAt
          });
          continue;
        }
        remoteChecks.push({ index: checks.length, name, skill });
        checks.push({ name, status: "up-to-date", installed, latest: installed, latestRisk: null, checkedAt });
      }
      if (remoteChecks.length > 0) {
        await checkRemoteUpdates(
          remoteChecks,
          checks,
          options,
          request.signal,
          checkedAt
        );
      }
      return checks;
    },

    async updateSkill(request: UpdateSkillRequest) {
      await ensureRecovered();
      validateManagedName(request.name);
      const registry = await readRegistry(registryPath);
      const installedSkill = registry.skills[request.name];
      if (installedSkill === undefined) {
        throw new SkillManagerError("SKILL_NOT_FOUND", `Skill "${request.name}" was not found.`);
      }
      if (installedSkill.source?.kind !== "github") {
        throw new SkillManagerError(
          "SKILL_UPDATE_UNSUPPORTED",
          `Skill "${request.name}" does not have an updateable GitHub source.`
        );
      }
      const destination = join(root, installedSkill.relativePath);
      await assertBundleUnmodified(destination, installedSkill);
      const installedSnapshot = snapshotFromSkill(installedSkill);
      const updateDeadline = createMarketplaceDeadline(options.marketplaceTimeoutMs);
      const checks: SkillUpdateCheck[] = [{
        name: request.name,
        status: "up-to-date",
        installed: installedSnapshot,
        latest: installedSnapshot,
        latestRisk: null,
        checkedAt: now().toISOString()
      }];
      await checkRemoteUpdates(
        [{ index: 0, name: request.name, skill: installedSkill }],
        checks,
        {
          ...options,
          marketplaceTimeoutMs: remainingMarketplaceTimeout(updateDeadline)
        },
        request.signal,
        checks[0]!.checkedAt
      );
      const latest = checks[0]!.latest;
      if (checks[0]!.status === "source-moved") {
        throw new SkillManagerError(
          "SKILL_SOURCE_MOVED",
          `Skill "${request.name}" is no longer available at its verified GitHub path.`
        );
      }
      if (latest === null) {
        throw new SkillManagerError("REGISTRY_INVALID", "GitHub update check returned no snapshot.");
      }
      if (latest.bundleHash === installedSnapshot.bundleHash) {
        throw new SkillManagerError(
          "SKILL_ALREADY_CURRENT",
          `Skill "${request.name}" is already current.`
        );
      }

      let finalFiles: GitHubBundleFile[];
      let finalSnapshot = latest;
      let finalResolved: ResolvedSkillSnapshot | undefined;
      if (options.snapshotResolver !== undefined) {
        finalResolved = await resolveManagedSkillSnapshot(
          options,
          request.name,
          installedSkill.source,
          request.signal
        );
        finalFiles = validateResolvedSkillSnapshot(finalResolved);
        finalSnapshot = {
          commitSha: finalResolved.snapshot.commitSha,
          blobSha: finalResolved.snapshot.skillDocumentBlobSha,
          bundleHash: finalResolved.snapshot.bundleHash
        };
        if (finalSnapshot.bundleHash === installedSnapshot.bundleHash) {
          throw new SkillManagerError(
            "SKILL_ALREADY_CURRENT",
            `Skill "${request.name}" is already current.`
          );
        }
        const assessment = options.riskAssessor?.assessResolvedSkillRisk(finalResolved) ?? null;
        if ((assessment === null || assessment.risk === "unknown" || assessment.risk === "high")
          && request.acknowledgeHighRisk !== true) {
          throw new SkillManagerError(
            "SKILL_UPDATE_RISK_CONFIRMATION_REQUIRED",
            "The final GitHub Skill snapshot has high or unknown content risk. Review it and confirm the update again."
          );
        }
      } else {
        const bundle = await createGitHubBundleFetcher({
          ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
          timeoutMs: remainingMarketplaceTimeout(updateDeadline)
        }).fetchBundle(updateEntry(installedSkill, latest, checks[0]!.checkedAt), {
          ...(request.signal === undefined ? {} : { signal: request.signal })
        });
        if (bundle.bundleHash !== latest.bundleHash) {
          throw new SkillManagerError(
            "INVALID_MARKETPLACE_INSTALL",
            "Downloaded update no longer matches the checked GitHub snapshot."
          );
        }
        finalFiles = bundle.files;
      }

      const temporary = join(libraryRoot, `.update-${request.name}-${randomUUID()}`);
      await mkdir(temporary, { recursive: false });
      try {
        await writeBundleFiles(temporary, finalFiles);
        const document = await readFile(join(temporary, "SKILL.md"), "utf8");
        const parsed = parseSkillDocument(document);
        validateCreateRequest({ name: parsed.name, description: parsed.description });
        if (parsed.name !== request.name) {
          throw new SkillManagerError(
            "INVALID_MARKETPLACE_INSTALL",
            "Updated SKILL.md name does not match the managed Skill."
          );
        }
        const timestamp = now().toISOString();
        const identityFingerprint = fingerprintSkillFiles(finalFiles);
        const updatedSkill: RegistrySkill = {
          ...installedSkill,
          description: parsed.description,
          updatedAt: timestamp,
          contentHash: await hashSkillBundle(temporary),
          source: {
            ...installedSkill.source,
            commitSha: finalSnapshot.commitSha,
            blobSha: finalSnapshot.blobSha,
            bundleHash: finalSnapshot.bundleHash,
            ...(finalResolved === undefined ? {} : {
              repository: `${finalResolved.repository.owner}/${finalResolved.repository.name}`,
              repositoryId: finalResolved.repository.repositoryId,
              nodeId: finalResolved.repository.nodeId,
              url: finalResolved.repository.url,
              path: finalResolved.skill.path,
              manifestFiles: finalResolved.skill.manifestFiles,
              identityFingerprint
            })
          }
        };
        await assertBundleUnmodified(destination, installedSkill);
        const result = await replaceSkillWithBackup({
          root,
          libraryRoot,
          backupRoot,
          registryPath,
          registry,
          currentSkill: installedSkill,
          replacementSkill: updatedSkill,
          replacementPath: temporary,
          reason: "update",
          timestamp
        });
        if (finalResolved !== undefined) {
          await recordGitHubObservation(options, observationFromResolvedSnapshot(
            finalResolved,
            identityFingerprint,
            timestamp
          ));
        }
        return result;
      } catch (error) {
        await rm(temporary, { force: true, recursive: true });
        throw error;
      }
    },

    async listBackups(request: ListSkillBackupsRequest = {}) {
      await ensureRecovered();
      if (request.name !== undefined) validateManagedName(request.name);
      return listSkillBackups(backupRoot, request.name);
    },

    async rollbackSkill(request: RollbackSkillRequest) {
      await ensureRecovered();
      validateManagedName(request.name);
      validateBackupId(request.backupId);
      const registry = await readRegistry(registryPath);
      const currentSkill = registry.skills[request.name];
      if (currentSkill === undefined) {
        throw new SkillManagerError("SKILL_NOT_FOUND", `Skill "${request.name}" was not found.`);
      }
      const destination = join(root, currentSkill.relativePath);
      await assertBundleUnmodified(destination, currentSkill);
      const stored = await readStoredBackup(backupRoot, request.name, request.backupId);
      const replacement = join(libraryRoot, `.rollback-${request.name}-${randomUUID()}`);
      await mkdir(replacement, { recursive: false });
      try {
        await copySkillBundle(join(backupRoot, request.name, request.backupId, "bundle"), replacement);
        const contentHash = await hashSkillBundle(replacement);
        if (contentHash !== stored.skill.contentHash || contentHash !== stored.backup.contentHash) {
          throw new SkillManagerError("SKILL_BACKUP_INVALID", "Skill backup content is invalid.");
        }
        const parsed = parseSkillDocument(await readFile(join(replacement, "SKILL.md"), "utf8"));
        if (parsed.name !== request.name || parsed.description !== stored.skill.description) {
          throw new SkillManagerError("SKILL_BACKUP_INVALID", "Skill backup metadata is invalid.");
        }
        const timestamp = now().toISOString();
        const replacementSkill: RegistrySkill = {
          ...stored.skill,
          createdAt: currentSkill.createdAt,
          enabledTargets: [...currentSkill.enabledTargets],
          relativePath: currentSkill.relativePath,
          updatedAt: timestamp
        };
        await assertBundleUnmodified(destination, currentSkill);
        return await replaceSkillWithBackup({
          root,
          libraryRoot,
          backupRoot,
          registryPath,
          registry,
          currentSkill,
          replacementSkill,
          replacementPath: replacement,
          reason: "rollback",
          timestamp
        });
      } catch (error) {
        await rm(replacement, { force: true, recursive: true });
        throw error;
      }
    },

    async deleteSkill(request: DeleteSkillRequest): Promise<DeletedSkill> {
      await ensureRecovered();
      validateManagedName(request.name);
      const registry = await readRegistry(registryPath);
      const entry = registry.skills[request.name];
      if (entry === undefined) {
        throw new SkillManagerError("SKILL_NOT_FOUND", `Skill "${request.name}" was not found.`);
      }
      const source = join(root, entry.relativePath);
      const ownedLinks: Array<{ destination: string; destinationRoot: string }> = [];
      for (const target of entry.enabledTargets) {
        const destinationRoot = target === "dsh"
          ? activeRoot
          : requireTargetRoot(targetRoots, target);
        const destination = join(destinationRoot, entry.name);
        if (!await pathEntryExists(destination)) continue;
        if (!await pathsReferToSameDirectory(source, destination)) {
          throw new SkillManagerError(
            "ACTIVE_PATH_CONFLICT",
            "Refusing to delete while a recorded target path is not owned by Skill Manager."
          );
        }
        ownedLinks.push({ destination, destinationRoot });
      }

      const trashId = randomUUID();
      const deletedAt = now().toISOString();
      const nameTrashRoot = join(trashRoot, request.name);
      const temporary = join(nameTrashRoot, `.delete-${trashId}`);
      const destination = join(nameTrashRoot, trashId);
      const archivedBundle = join(temporary, "bundle");
      const removedLinks: Array<{ destination: string; destinationRoot: string }> = [];
      await mkdir(temporary, { recursive: true });
      try {
        for (const link of ownedLinks) {
          await rm(link.destination, { force: true, recursive: false });
          removedLinks.push(link);
        }
        await rename(source, archivedBundle);
        await writeFile(join(temporary, "metadata.json"), `${JSON.stringify({
          version: TRASH_VERSION,
          trashId,
          deletedAt,
          skill: entry,
          archivedContentHash: await hashSkillBundle(archivedBundle)
        }, null, 2)}\n`, "utf8");
        await rename(temporary, destination);
        delete registry.skills[request.name];
        try {
          await writeRegistry(root, registryPath, registry);
        } catch (error) {
          await rename(join(destination, "bundle"), source);
          await rm(destination, { force: true, recursive: true });
          for (const link of removedLinks) {
            await enableActiveLink(source, link.destination, link.destinationRoot);
          }
          throw error;
        }
      } catch (error) {
        if (await pathExists(archivedBundle) && !await pathExists(source)) {
          await rename(archivedBundle, source);
        }
        await rm(temporary, { force: true, recursive: true });
        for (const link of removedLinks) {
          if (!await pathEntryExists(link.destination) && await pathExists(source)) {
            await enableActiveLink(source, link.destination, link.destinationRoot);
          }
        }
        throw error;
      }
      return { name: request.name, trashId, deletedAt };
    },

    async listTrash(): Promise<TrashedSkill[]> {
      await ensureRecovered();
      return listTrashedSkills(trashRoot);
    },

    async restoreTrash(request: RestoreTrashRequest): Promise<ManagedSkill> {
      await ensureRecovered();
      validateManagedName(request.name);
      validateTrashId(request.trashId);
      const stored = await readStoredTrash(trashRoot, request.name, request.trashId);
      if (trashExpiresAt(stored.deletedAt).getTime() <= now().getTime()) {
        throw new SkillManagerError("SKILL_TRASH_EXPIRED", "Deleted Skill archive has expired.");
      }
      const registry = await readRegistry(registryPath);
      if (registry.skills[request.name] !== undefined) {
        throw new SkillManagerError("SKILL_ALREADY_EXISTS", `Skill "${request.name}" already exists.`);
      }
      const destination = join(root, stored.skill.relativePath);
      if (await pathEntryExists(destination)) {
        throw new SkillManagerError("SKILL_ALREADY_EXISTS", `Skill "${request.name}" already exists.`);
      }
      const archiveRoot = join(trashRoot, request.name, request.trashId);
      const archivedBundle = join(archiveRoot, "bundle");
      const archivedHash = await hashSkillBundle(archivedBundle).catch((error: unknown) => {
        throw new SkillManagerError(
          "SKILL_TRASH_INVALID",
          "Deleted Skill archive content is invalid.",
          { cause: error }
        );
      });
      if (archivedHash !== stored.archivedContentHash || archivedHash !== stored.skill.contentHash) {
        throw new SkillManagerError("SKILL_TRASH_INVALID", "Deleted Skill archive content is invalid.");
      }
      const parsed = parseSkillDocument(await readFile(join(archivedBundle, "SKILL.md"), "utf8"));
      if (parsed.name !== stored.skill.name || parsed.description !== stored.skill.description) {
        throw new SkillManagerError("SKILL_TRASH_INVALID", "Deleted Skill archive metadata is invalid.");
      }

      const targetLinks = stored.skill.enabledTargets.map((target) => {
        const destinationRoot = target === "dsh" ? activeRoot : requireTargetRoot(targetRoots, target);
        return { destinationRoot, destination: join(destinationRoot, stored.skill.name) };
      });
      for (const link of targetLinks) {
        if (await pathEntryExists(link.destination)) {
          throw new SkillManagerError(
            "ACTIVE_PATH_CONFLICT",
            "A previously enabled target already contains a same-name path."
          );
        }
      }

      const createdLinks: typeof targetLinks = [];
      let bundleMoved = false;
      try {
        await mkdir(libraryRoot, { recursive: true });
        await rename(archivedBundle, destination);
        bundleMoved = true;
        for (const link of targetLinks) {
          await enableActiveLink(destination, link.destination, link.destinationRoot);
          createdLinks.push(link);
        }
        registry.skills[request.name] = stored.skill;
        await writeRegistry(root, registryPath, registry);
      } catch (error) {
        delete registry.skills[request.name];
        for (const link of createdLinks.reverse()) {
          await disableActiveLink(destination, link.destination, true).catch(() => undefined);
        }
        if (bundleMoved && await pathExists(destination)) {
          await rename(destination, archivedBundle);
        }
        throw error;
      }
      await rm(archiveRoot, { force: true, recursive: true }).catch(() => undefined);
      return toManagedSkill(stored.skill);
    },

    async listTargetStates(request = {}) {
      await ensureRecovered();
      const registry = await readRegistry(registryPath);
      const names = normalizeTargetStateNames(request, registry);
      const targets = normalizeDiscoveryTargets(request.targets);
      const states: SkillTargetState[] = [];
      for (const name of names) {
        const entry = registry.skills[name];
        if (entry === undefined) continue;
        const source = join(root, entry.relativePath);
        for (const target of targets) {
          const targetRoot = targetRoots[target];
          if (targetRoot === undefined) {
            states.push({ name, target, status: "not-configured" });
            continue;
          }
          const destination = join(targetRoot, name);
          if (!await pathEntryExists(destination)) {
            states.push({ name, target, status: "not-linked" });
            continue;
          }
          const registered = entry.enabledTargets.includes(target);
          states.push({
            name,
            target,
            status: registered && await pathsReferToSameDirectory(source, destination)
              ? "linked"
              : "conflict"
          });
        }
      }
      return states;
    },

    async setTargetEnabled(request) {
      await ensureRecovered();
      validateTargetRequest(request, targetRoots);
      const registry = await readRegistry(registryPath);
      const entry = registry.skills[request.name];
      if (entry === undefined) {
        throw new SkillManagerError("SKILL_NOT_FOUND", `Skill "${request.name}" was not found.`);
      }

      const source = join(root, entry.relativePath);
      const destinationRoot = request.target === "dsh"
        ? activeRoot
        : requireTargetRoot(targetRoots, request.target);
      const destination = join(destinationRoot, request.name);
      const wasLinked = entry.enabledTargets.includes(request.target)
        && await pathsReferToSameDirectory(source, destination);

      if (request.enabled) {
        await enableActiveLink(source, destination, destinationRoot, wasLinked);
      } else {
        await disableActiveLink(
          source,
          destination,
          wasLinked,
          request.target !== "dsh"
        );
      }

      entry.enabledTargets = request.enabled
        ? uniqueTargets([...entry.enabledTargets, request.target])
        : entry.enabledTargets.filter((target) => target !== request.target);
      entry.updatedAt = new Date().toISOString();

      try {
        await writeRegistry(root, registryPath, registry);
      } catch (error) {
        if (wasLinked) {
          await enableActiveLink(source, destination, destinationRoot, true);
        } else {
          await disableActiveLink(source, destination, request.enabled, false);
        }
        throw error;
      }

      return toManagedSkill(entry);
    }
  };
}

function normalizeUpdateNames(
  requested: string[],
  registry: RegistryFile
): string[] {
  const names = [...new Set(requested)].sort((left, right) => left.localeCompare(right));
  for (const name of names) {
    if (!SKILL_NAME.test(name) || registry.skills[name] === undefined) {
      throw new SkillManagerError("SKILL_NOT_FOUND", `Skill "${name}" was not found.`);
    }
  }
  return names;
}

function validateManagedName(name: string): void {
  if (!SKILL_NAME.test(name)) {
    throw new SkillManagerError("INVALID_SKILL_NAME", `Invalid managed Skill name "${name}".`);
  }
}

function createMarketplaceDeadline(configured: number | undefined): number {
  const timeoutMs = configured ?? DEFAULT_MARKETPLACE_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceResolverError(
      "INVALID_MARKETPLACE_RESOLUTION_TIMEOUT",
      "Marketplace update timeout must be a positive integer in milliseconds."
    );
  }
  return Date.now() + timeoutMs;
}

function remainingMarketplaceTimeout(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining < 1) {
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_TIMEOUT",
      "Marketplace update check exceeded its overall deadline."
    );
  }
  return remaining;
}

function validateBackupId(backupId: string): void {
  if (!UUID_PATTERN.test(backupId)) {
    throw new SkillManagerError("SKILL_BACKUP_NOT_FOUND", "Skill backup was not found.");
  }
}

function validateTrashId(trashId: string): void {
  if (!UUID_PATTERN.test(trashId)) {
    throw new SkillManagerError("SKILL_TRASH_NOT_FOUND", "Deleted Skill archive was not found.");
  }
}

function snapshotFromSkill(skill: RegistrySkill) {
  if (skill.source?.kind !== "github") {
    throw new SkillManagerError("REGISTRY_INVALID", "Managed Skill has no GitHub snapshot.");
  }
  return {
    commitSha: skill.source.commitSha,
    blobSha: skill.source.blobSha,
    bundleHash: skill.source.bundleHash
  };
}

function updateEntry(
  skill: RegistrySkill,
  snapshot: ReturnType<typeof snapshotFromSkill>,
  fetchedAt: string
): ResolvedMarketplaceEntry {
  if (skill.source?.kind !== "github") {
    throw new SkillManagerError("SKILL_UPDATE_UNSUPPORTED", "Managed Skill has no GitHub source.");
  }
  const [owner, repositoryName] = skill.source.repository.split("/") as [string, string];
  return {
    id: `${skill.source.repository}/${skill.name}`,
    source: skill.source.catalog,
    catalogs: [skill.source.catalog],
    name: skill.name,
    description: skill.description,
    publisher: null,
    author: null,
    repository: {
      host: "github",
      id: 0,
      nodeId: "managed-update",
      owner,
      name: repositoryName,
      path: skill.source.path,
      url: skill.source.url
    },
    skillUrl: skill.source.url,
    install: {
      kind: "github",
      repository: skill.source.repository,
      skill: skill.name,
      path: skill.source.path
    },
    metrics: { installs: null, stars: null, downloads: null },
    cover: { kind: "generated", seed: `${skill.source.repository}/${skill.name}` },
      snapshot: {
        commitSha: snapshot.commitSha,
        blobSha: snapshot.blobSha,
        fetchedAt,
        ...(skill.source.manifestFiles === undefined
          ? {}
          : { manifestFiles: skill.source.manifestFiles })
      }
  };
}

async function assertBundleUnmodified(path: string, skill: RegistrySkill): Promise<void> {
  const currentHash = await hashSkillBundle(path);
  if (currentHash !== skill.contentHash) {
    throw new SkillManagerError(
      "SKILL_LOCAL_MODIFIED",
      `Skill "${skill.name}" has local modifications.`
    );
  }
}

async function replaceSkillWithBackup(input: {
  root: string;
  libraryRoot: string;
  backupRoot: string;
  registryPath: string;
  registry: RegistryFile;
  currentSkill: RegistrySkill;
  replacementSkill: RegistrySkill;
  replacementPath: string;
  reason: SkillBackupReason;
  timestamp: string;
}): Promise<SkillMutationResult> {
  const destination = join(input.root, input.currentSkill.relativePath);
  const backup = describeSkillBackup(
    input.currentSkill,
    input.reason,
    input.timestamp
  );
  const displaced = join(
    input.libraryRoot,
    `.displaced-${input.currentSkill.name}-${randomUUID()}`
  );
  const journalId = randomUUID();
  const journalPath = join(input.root, `.replacement-${journalId}.json`);
  const journal: ReplacementJournal = {
    version: 1,
    id: journalId,
    name: input.currentSkill.name,
    currentHash: input.currentSkill.contentHash,
    replacementHash: input.replacementSkill.contentHash,
    displacedName: displaced.slice(input.libraryRoot.length + 1),
    replacementName: input.replacementPath.slice(input.libraryRoot.length + 1),
    backupId: backup.id,
    previousRegistry: structuredClone(input.registry)
  };
  try {
    await writeJsonAtomically(input.root, journalPath, journal);
  } catch (error) {
    throw error;
  }
  try {
    await persistSkillBackup(input.backupRoot, destination, input.currentSkill, backup);
  } catch (error) {
    await rm(journalPath, { force: true }).catch(() => undefined);
    throw error;
  }
  let currentMoved = false;
  let replacementMoved = false;
  try {
    await rename(destination, displaced);
    currentMoved = true;
    if (await hashSkillBundle(displaced) !== input.currentSkill.contentHash) {
      throw new SkillManagerError(
        "SKILL_LOCAL_MODIFIED",
        `Skill "${input.currentSkill.name}" changed during replacement.`
      );
    }
    await rename(input.replacementPath, destination);
    replacementMoved = true;
    input.registry.skills[input.currentSkill.name] = input.replacementSkill;
    await writeRegistry(input.root, input.registryPath, input.registry);
  } catch (error) {
    input.registry.skills[input.currentSkill.name] = input.currentSkill;
    if (replacementMoved && await pathExists(destination)) {
      await rename(destination, input.replacementPath);
    }
    if (currentMoved && await pathExists(displaced)) {
      await rename(displaced, destination);
    }
    await removeSkillBackup(input.backupRoot, backup);
    await rm(journalPath, { force: true });
    throw error;
  }
  await rm(displaced, { force: true, recursive: true }).catch(() => undefined);
  await rm(journalPath, { force: true }).catch(() => undefined);
  return { skill: toManagedSkill(input.replacementSkill), backup };
}

async function persistSkillBackup(
  backupRoot: string,
  sourcePath: string,
  skill: RegistrySkill,
  backup: SkillBackup
): Promise<void> {
  const id = backup.id;
  const nameRoot = join(backupRoot, skill.name);
  const temporary = join(nameRoot, `.backup-${id}`);
  const destination = join(nameRoot, id);
  const metadata: StoredBackupFile = {
    version: BACKUP_VERSION,
    backup,
    skill
  };
  await mkdir(nameRoot, { recursive: true });
  await mkdir(join(temporary, "bundle"), { recursive: true });
  try {
    await copySkillBundle(sourcePath, join(temporary, "bundle"));
    if (await hashSkillBundle(join(temporary, "bundle")) !== skill.contentHash) {
      throw new SkillManagerError("SKILL_LOCAL_MODIFIED", `Skill "${skill.name}" changed during backup.`);
    }
    await writeFile(
      join(temporary, "metadata.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8"
    );
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true, recursive: true });
    throw error;
  }
}

function describeSkillBackup(
  skill: RegistrySkill,
  reason: SkillBackupReason,
  timestamp: string
): SkillBackup {
  return {
    id: randomUUID(),
    name: skill.name,
    createdAt: timestamp,
    reason,
    contentHash: skill.contentHash,
    snapshot: skill.source?.kind === "github" ? snapshotFromSkill(skill) : null
  };
}

async function listSkillBackups(
  backupRoot: string,
  selectedName: string | undefined
): Promise<SkillBackup[]> {
  const names = selectedName === undefined
    ? await readDirectoryNames(backupRoot)
    : [selectedName];
  const backups: SkillBackup[] = [];
  for (const name of names.sort((left, right) => left.localeCompare(right))) {
    if (!SKILL_NAME.test(name)) {
      throw new SkillManagerError("SKILL_BACKUP_INVALID", "Skill backup directory is invalid.");
    }
    const ids = await readDirectoryNames(join(backupRoot, name));
    for (const id of ids) {
      validateBackupId(id);
      backups.push((await readStoredBackup(backupRoot, name, id)).backup);
    }
  }
  return backups.sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    const byTime = right.createdAt.localeCompare(left.createdAt);
    return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
  });
}

async function readStoredBackup(
  backupRoot: string,
  name: string,
  id: string
): Promise<StoredBackupFile> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(join(backupRoot, name, id, "metadata.json"), "utf8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new SkillManagerError("SKILL_BACKUP_NOT_FOUND", "Skill backup was not found.");
    }
    if (error instanceof SyntaxError) {
      throw new SkillManagerError("SKILL_BACKUP_INVALID", "Skill backup metadata is invalid.");
    }
    throw error;
  }
  if (!isStoredBackupFile(value, name, id)) {
    throw new SkillManagerError("SKILL_BACKUP_INVALID", "Skill backup metadata is invalid.");
  }
  return value;
}

async function listTrashedSkills(trashRoot: string): Promise<TrashedSkill[]> {
  const trashed: TrashedSkill[] = [];
  for (const name of (await readDirectoryNames(trashRoot)).sort((left, right) => left.localeCompare(right))) {
    validateManagedName(name);
    for (const trashId of await readDirectoryNames(join(trashRoot, name))) {
      validateTrashId(trashId);
      const stored = await readStoredTrash(trashRoot, name, trashId);
      trashed.push({
        name,
        trashId,
        description: stored.skill.description,
        origin: stored.skill.origin,
        enabledTargets: [...stored.skill.enabledTargets],
        deletedAt: stored.deletedAt,
        expiresAt: trashExpiresAt(stored.deletedAt).toISOString()
      });
    }
  }
  return trashed.sort((left, right) => {
    const byTime = right.deletedAt.localeCompare(left.deletedAt);
    return byTime !== 0 ? byTime : left.name.localeCompare(right.name);
  });
}

async function readStoredTrash(
  trashRoot: string,
  name: string,
  trashId: string
): Promise<StoredTrashFile> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(join(trashRoot, name, trashId, "metadata.json"), "utf8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new SkillManagerError("SKILL_TRASH_NOT_FOUND", "Deleted Skill archive was not found.");
    }
    if (error instanceof SyntaxError) {
      throw new SkillManagerError("SKILL_TRASH_INVALID", "Deleted Skill archive metadata is invalid.");
    }
    throw error;
  }
  if (!isStoredTrashFile(value, name, trashId)) {
    throw new SkillManagerError("SKILL_TRASH_INVALID", "Deleted Skill archive metadata is invalid.");
  }
  return value;
}

function isStoredTrashFile(value: unknown, name: string, trashId: string): value is StoredTrashFile {
  if (!isRecord(value) || value.version !== TRASH_VERSION) return false;
  return value.trashId === trashId
    && isIsoDate(value.deletedAt)
    && typeof value.archivedContentHash === "string"
    && /^[a-f0-9]{64}$/iu.test(value.archivedContentHash)
    && isValidStoredRegistrySkill(value.skill, name, value.archivedContentHash);
}

function isValidStoredRegistrySkill(
  value: unknown,
  name: string,
  contentHash: string
): value is RegistrySkill {
  if (!isRecord(value)) return false;
  const origin = value.origin;
  const source = value.source;
  const common = value.name === name
    && typeof value.description === "string"
    && Array.isArray(value.enabledTargets)
    && value.enabledTargets.every((target) => target === "dsh" || target === "codex"
      || target === "claude" || target === "agents" || target === "opencode")
    && new Set(value.enabledTargets).size === value.enabledTargets.length
    && isIsoDate(value.createdAt)
    && isIsoDate(value.updatedAt)
    && value.contentHash === contentHash
    && value.relativePath === join("library", name);
  if (!common) return false;
  if (source === undefined) return origin === "self";
  if (isRecord(source) && source.kind === "local-import") {
    return (origin === "self" || origin === "local-import")
      && isValidStoredLocalImportSource(source, name);
  }
  if (!isRecord(source) || source.kind !== "github") return false;
  return isValidGitHubRegistrySkill(value, name, contentHash, {
    commitSha: source.commitSha,
    blobSha: source.blobSha,
    bundleHash: source.bundleHash
  });
}

function isValidStoredLocalImportSource(value: Record<string, unknown>, name: string): boolean {
  return value.name === name
    && (value.target === "codex" || value.target === "claude"
      || value.target === "agents" || value.target === "opencode");
}

function trashExpiresAt(deletedAt: string): Date {
  return new Date(Date.parse(deletedAt) + TRASH_RETENTION_MS);
}

async function purgeExpiredTrash(trashRoot: string, currentTime: () => Date): Promise<void> {
  for (const name of await readDirectoryNames(trashRoot)) {
    if (!SKILL_NAME.test(name)) continue;
    for (const trashId of await readDirectoryNames(join(trashRoot, name))) {
      if (!UUID_PATTERN.test(trashId)) continue;
      let stored: StoredTrashFile;
      try {
        stored = await readStoredTrash(trashRoot, name, trashId);
      } catch {
        continue;
      }
      if (trashExpiresAt(stored.deletedAt).getTime() > currentTime().getTime()) continue;
      const archiveRoot = join(trashRoot, name, trashId);
      try {
        const contentHash = await hashSkillBundle(join(archiveRoot, "bundle"));
        if (contentHash !== stored.archivedContentHash || contentHash !== stored.skill.contentHash) continue;
      } catch {
        continue;
      }
      await rm(archiveRoot, { force: true, recursive: true });
    }
  }
}

function isStoredBackupFile(value: unknown, name: string, id: string): value is StoredBackupFile {
  if (!isRecord(value) || value.version !== BACKUP_VERSION) return false;
  const backup = value.backup;
  const skill = value.skill;
  if (!isRecord(backup) || !isRecord(skill)) return false;
  if (
    backup.id !== id
    || backup.name !== name
    || !isIsoDate(backup.createdAt)
    || (backup.reason !== "update" && backup.reason !== "rollback")
    || typeof backup.contentHash !== "string"
    || !/^[a-f0-9]{64}$/i.test(backup.contentHash)
    || !isValidGitHubRegistrySkill(skill, name, backup.contentHash, backup.snapshot)
  ) return false;
  return true;
}

function isValidGitHubRegistrySkill(
  skill: Record<string, unknown>,
  name: string,
  contentHash: unknown,
  snapshot: unknown
): boolean {
  const source = skill.source;
  if (!isRecord(source) || source.kind !== "github" || !isSnapshot(snapshot)) return false;
  return skill.name === name
    && skill.origin === "github"
    && typeof skill.description === "string"
    && isIsoDate(skill.createdAt)
    && isIsoDate(skill.updatedAt)
    && skill.contentHash === contentHash
    && skill.relativePath === join("library", name)
    && Array.isArray(skill.enabledTargets)
    && skill.enabledTargets.every((target) =>
      target === "dsh" || target === "codex" || target === "claude"
        || target === "agents" || target === "opencode")
    && typeof source.repository === "string"
    && source.repository.split("/").length === 2
    && typeof source.path === "string"
    && !source.path.includes("\\")
    && !source.path.includes("\0")
    && (source.path === "." || source.path.split("/").at(-1) === name)
    && (source.manifestFiles === undefined || (
      Array.isArray(source.manifestFiles)
      && new Set(source.manifestFiles).size === source.manifestFiles.length
      && source.manifestFiles.every((path) => typeof path === "string"
        && isSafeBundleRelativePath(path)
        && !isAgentInstructionPath(path))
    ))
    && source.commitSha === snapshot.commitSha
    && source.blobSha === snapshot.blobSha
    && source.bundleHash === snapshot.bundleHash
    && (source.catalog === "skills-sh" || source.catalog === "github"
      || source.catalog === "hugging-face")
    && typeof source.url === "string";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string"
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function isSafeBundleRelativePath(path: string): boolean {
  return path.length > 0
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.includes("\0")
    && path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isAgentInstructionPath(path: string): boolean {
  return /^(?:AGENTS|CLAUDE)\.md$/iu.test(path.split("/").at(-1) ?? "");
}

function isSnapshot(value: unknown): value is ReturnType<typeof snapshotFromSkill> {
  return isRecord(value)
    && typeof value.commitSha === "string"
    && /^[a-f0-9]{40}$/i.test(value.commitSha)
    && typeof value.blobSha === "string"
    && /^[a-f0-9]{40}$/i.test(value.blobSha)
    && typeof value.bundleHash === "string"
    && /^[a-f0-9]{64}$/i.test(value.bundleHash);
}

async function readDirectoryNames(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }
}

async function removeSkillBackup(backupRoot: string, backup: SkillBackup): Promise<void> {
  const nameRoot = join(backupRoot, backup.name);
  await Promise.all([
    rm(join(nameRoot, backup.id), { force: true, recursive: true }),
    rm(join(nameRoot, `.backup-${backup.id}`), { force: true, recursive: true })
  ]);
}

async function recoverInterruptedReplacements(
  root: string,
  libraryRoot: string,
  registryPath: string
): Promise<void> {
  const journalPaths = await listReplacementJournals(root);
  for (const journalPath of journalPaths) {
    const journal = await readReplacementJournal(journalPath);
    let registry = await readRegistry(registryPath);
    const currentSkill = registry.skills[journal.name];
    const previousSkill = journal.previousRegistry.skills[journal.name];
    if (previousSkill === undefined) {
      invalidReplacementRecovery(journal.name);
    }
    const destination = join(root, (currentSkill ?? previousSkill).relativePath);
    const displaced = join(libraryRoot, journal.displacedName);
    const replacement = join(libraryRoot, journal.replacementName);
    const destinationHash = await existingBundleHash(destination);
    const displacedHash = await existingBundleHash(displaced);
    const replacementHash = await existingBundleHash(replacement);

    if (currentSkill === undefined || currentSkill.contentHash === journal.currentHash) {
      if (
        destinationHash === journal.currentHash
        && (displacedHash === null || displacedHash === journal.currentHash)
      ) {
        await rm(displaced, { force: true, recursive: true });
        await removeSkillBackup(join(root, "backups"), backupFromJournal(journal));
        await rm(replacement, { force: true, recursive: true });
        if (currentSkill === undefined) await writeRegistry(root, registryPath, journal.previousRegistry);
        await rm(journalPath, { force: true });
        continue;
      }
      if (destinationHash === journal.replacementHash && displacedHash === journal.currentHash) {
        await rm(destination, { force: true, recursive: true });
        await rename(displaced, destination);
      } else if (destinationHash === null && displacedHash === journal.currentHash) {
        await rename(displaced, destination);
      } else {
        invalidReplacementRecovery(journal.name);
      }
      registry = journal.previousRegistry;
      await writeRegistry(root, registryPath, registry);
      await removeSkillBackup(join(root, "backups"), backupFromJournal(journal));
      if (replacementHash !== null) await rm(replacement, { force: true, recursive: true });
      await rm(journalPath, { force: true });
      continue;
    }

    if (
      currentSkill?.contentHash === journal.replacementHash
      && destinationHash === journal.replacementHash
      && (displacedHash === journal.currentHash || displacedHash === null)
    ) {
      await rm(displaced, { force: true, recursive: true });
      await rm(replacement, { force: true, recursive: true });
      await rm(journalPath, { force: true });
      continue;
    }
    invalidReplacementRecovery(journal.name);
  }
  await recoverOrphanedDisplacedDirectories(root, libraryRoot, registryPath);
}

async function recoverOrphanedDisplacedDirectories(
  root: string,
  libraryRoot: string,
  registryPath: string
): Promise<void> {
  const entries = await readDirectoryNames(libraryRoot);
  const displacedNames = entries.filter((name) => name.startsWith(".displaced-"));
  if (displacedNames.length === 0) return;
  const registry = await readRegistry(registryPath);
  for (const displacedName of displacedNames) {
    const skillName = parseDisplacedSkillName(displacedName);
    const skill = skillName === undefined ? undefined : registry.skills[skillName];
    if (skill === undefined) invalidReplacementRecovery(displacedName);
    const displaced = join(libraryRoot, displacedName);
    const destination = join(root, skill.relativePath);
    const destinationHash = await existingBundleHash(destination);
    const displacedHash = await existingBundleHash(displaced);
    if (destinationHash === skill.contentHash && displacedHash === skill.contentHash) {
      await rm(displaced, { force: true, recursive: true });
      continue;
    }
    if (destinationHash === null && displacedHash === skill.contentHash) {
      await rename(displaced, destination);
      continue;
    }
    invalidReplacementRecovery(skill.name);
  }
}

function parseDisplacedSkillName(directoryName: string): string | undefined {
  const match = /^\.displaced-(.+)-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu
    .exec(directoryName);
  const name = match?.[1];
  return name !== undefined && SKILL_NAME.test(name) ? name : undefined;
}

async function existingBundleHash(path: string): Promise<string | null> {
  if (!await pathExists(path)) return null;
  try {
    return await hashSkillBundle(path);
  } catch {
    return null;
  }
}

async function listReplacementJournals(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && /^\.replacement-[0-9a-f-]{36}\.json$/iu.test(entry.name))
    .map((entry) => join(root, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function readReplacementJournal(path: string): Promise<ReplacementJournal> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new SkillManagerError(
      "REGISTRY_INVALID",
      "Interrupted Skill replacement journal is invalid.",
      { cause: error }
    );
  }
  if (!isReplacementJournal(value)) {
    throw new SkillManagerError("REGISTRY_INVALID", "Interrupted Skill replacement journal is invalid.");
  }
  return value;
}

function isReplacementJournal(value: unknown): value is ReplacementJournal {
  if (!isRecord(value) || value.version !== 1 || !UUID_PATTERN.test(String(value.id))) return false;
  if (
    typeof value.name !== "string"
    || !SKILL_NAME.test(value.name)
    || typeof value.currentHash !== "string"
    || !/^[a-f0-9]{64}$/iu.test(value.currentHash)
    || typeof value.replacementHash !== "string"
    || !/^[a-f0-9]{64}$/iu.test(value.replacementHash)
    || typeof value.displacedName !== "string"
    || typeof value.replacementName !== "string"
    || !UUID_PATTERN.test(String(value.backupId))
    || !isSafeTransactionName(value.displacedName, [".displaced-"], value.name)
    || !isSafeTransactionName(value.replacementName, [".update-", ".rollback-"], value.name)
    || !isRegistryFile(value.previousRegistry)
  ) return false;
  const previousSkill = value.previousRegistry.skills[value.name];
  return isRecord(previousSkill)
    && isValidGitHubRegistrySkill(
      previousSkill,
      value.name,
      value.currentHash,
      isRecord(previousSkill.source) && previousSkill.source.kind === "github"
        ? {
            commitSha: previousSkill.source.commitSha,
            blobSha: previousSkill.source.blobSha,
            bundleHash: previousSkill.source.bundleHash
          }
        : null
    );
}

function isSafeTransactionName(value: string, prefixes: string[], name: string): boolean {
  if (value.includes("/") || value.includes("\\")) return false;
  const prefix = prefixes.find((candidate) => value.startsWith(`${candidate}${name}-`));
  return prefix !== undefined
    && UUID_PATTERN.test(value.slice(`${prefix}${name}-`.length));
}

function backupFromJournal(journal: ReplacementJournal): SkillBackup {
  const skill = journal.previousRegistry.skills[journal.name]!;
  return {
    id: journal.backupId,
    name: journal.name,
    createdAt: "",
    reason: "update",
    contentHash: journal.currentHash,
    snapshot: skill.source?.kind === "github" ? snapshotFromSkill(skill) : null
  };
}

function invalidReplacementRecovery(name: string): never {
  throw new SkillManagerError(
    "REGISTRY_INVALID",
    `Interrupted replacement for Skill "${name}" cannot be recovered safely.`
  );
}

async function writeJsonAtomically(root: string, path: string, value: unknown): Promise<void> {
  await mkdir(root, { recursive: true });
  const temporary = join(root, `.json-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function checkRemoteUpdates(
  remoteChecks: Array<{ index: number; name: string; skill: RegistrySkill }>,
  checks: SkillUpdateCheck[],
  options: SkillManagerOptions,
  callerSignal: AbortSignal | undefined,
  checkedAt: string
): Promise<void> {
  const timeoutMs = options.marketplaceTimeoutMs ?? DEFAULT_MARKETPLACE_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new MarketplaceResolverError(
      "INVALID_MARKETPLACE_RESOLUTION_TIMEOUT",
      "Marketplace update timeout must be a positive integer in milliseconds."
    );
  }
  if (callerSignal?.aborted) {
    throw new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_ABORTED",
      "Marketplace update check was cancelled."
    );
  }

  const checker = createGitHubUpdateChecker({
    ...(options.fetch === undefined ? {} : { fetch: options.fetch })
  });
  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = false;
  let rejectBoundary: (error: MarketplaceResolverError) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => {
    rejectBoundary = reject;
  });
  const cancelFromCaller = () => {
    callerAborted = true;
    rejectBoundary(new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_ABORTED",
      "Marketplace update check was cancelled."
    ));
    controller.abort(callerSignal?.reason);
  };
  callerSignal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    rejectBoundary(new MarketplaceResolverError(
      "MARKETPLACE_RESOLUTION_TIMEOUT",
      `Marketplace update check exceeded ${timeoutMs} ms.`
    ));
    controller.abort();
  }, timeoutMs);

  let nextIndex = 0;
  const worker = async () => {
    while (!controller.signal.aborted) {
      const remoteIndex = nextIndex;
      nextIndex += 1;
      const remote = remoteChecks[remoteIndex];
      if (remote === undefined) return;
      const source = remote.skill.source;
      if (source?.kind !== "github") return;
      const installed = checks[remote.index]?.installed;
      if (installed === null || installed === undefined) {
        throw new SkillManagerError(
          "REGISTRY_INVALID",
          `Skill "${remote.name}" is missing its installed GitHub snapshot.`
        );
      }
      if (options.snapshotResolver !== undefined) {
        let resolved: ResolvedSkillSnapshot;
        try {
          resolved = await resolveManagedSkillSnapshot(
            options,
            remote.name,
            source,
            controller.signal
          );
        } catch (error) {
          if (hasErrorCode(error, "GITHUB_SKILL_NOT_FOUND")) {
            checks[remote.index] = {
              name: remote.name,
              status: "source-moved",
              installed,
              latest: null,
              latestRisk: null,
              checkedAt
            };
            continue;
          }
          throw error;
        }
        validateResolvedSkillSnapshot(resolved);
        const latest = {
          commitSha: resolved.snapshot.commitSha,
          blobSha: resolved.snapshot.skillDocumentBlobSha,
          bundleHash: resolved.snapshot.bundleHash
        };
        checks[remote.index] = {
          name: remote.name,
          status: latest.bundleHash === installed.bundleHash ? "up-to-date" : "update-available",
          installed,
          latest,
          latestRisk: latest.bundleHash === installed.bundleHash
            ? null
            : (options.riskAssessor?.assessResolvedSkillRisk(resolved) ?? {
              risk: "unknown",
              findings: [],
              scannerVersion: "unavailable"
            }),
          checkedAt
        };
        continue;
      }
      const latest = await checker.checkLatest(remote.name, source, {
        signal: controller.signal
      });
      checks[remote.index] = {
        name: remote.name,
        status: latest.bundleHash === installed.bundleHash
          ? "up-to-date"
          : "update-available",
        installed,
        latest,
        latestRisk: null,
        checkedAt
      };
    }
  };

  const operation = Promise.all(
    Array.from(
      { length: Math.min(UPDATE_CONCURRENCY, remoteChecks.length) },
      () => worker()
    )
  ).then(() => undefined);

  try {
    await Promise.race([operation, boundary]);
  } catch (error) {
    controller.abort();
    if (timedOut) {
      throw new MarketplaceResolverError(
        "MARKETPLACE_RESOLUTION_TIMEOUT",
        `Marketplace update check exceeded ${timeoutMs} ms.`,
        { cause: error }
      );
    }
    if (callerAborted || callerSignal?.aborted) {
      throw new MarketplaceResolverError(
        "MARKETPLACE_RESOLUTION_ABORTED",
        "Marketplace update check was cancelled.",
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancelFromCaller);
  }
}

async function resolveManagedSkillSnapshot(
  options: SkillManagerOptions,
  name: string,
  source: GitHubSkillSource,
  signal: AbortSignal | undefined
): Promise<ResolvedSkillSnapshot> {
  if (options.snapshotResolver === undefined) {
    throw new SkillManagerError("SKILL_UPDATE_UNSUPPORTED", "GitHub snapshot resolution is not configured.");
  }
  const repository = await resolveCurrentRepository(source, options.fetch, signal);
  const resolved = await options.snapshotResolver.resolveSkillSnapshot(
    { repository, skillPath: source.path },
    signal === undefined ? {} : { signal }
  );
  if (resolved.skill.name !== name) {
    throw new SkillManagerError(
      "SKILL_SOURCE_MOVED",
      `GitHub path now contains a different Skill named "${resolved.skill.name}".`
    );
  }
  if (source.repositoryId !== undefined && resolved.repository.repositoryId !== source.repositoryId) {
    throw new SkillManagerError(
      "SKILL_SOURCE_MOVED",
      "GitHub repository identity no longer matches the verified source."
    );
  }
  return resolved;
}

async function resolveCurrentRepository(
  source: GitHubSkillSource,
  fetch: SkillManagerOptions["fetch"],
  signal: AbortSignal | undefined
): Promise<{ owner: string; name: string }> {
  if (source.repositoryId === undefined || fetch === undefined) {
    const [owner, name] = source.repository.split("/");
    if (!owner || !name) throw new SkillManagerError("REGISTRY_INVALID", "GitHub source repository is invalid.");
    return { owner, name };
  }
  const response = await fetch(`https://api.github.com/repositories/${source.repositoryId}`, {
    headers: { accept: "application/vnd.github+json" },
    ...(signal === undefined ? {} : { signal })
  });
  if (!response.ok) {
    throw new MarketplaceResolverError(
      response.status === 404 ? "GITHUB_SKILL_NOT_FOUND" : "GITHUB_HTTP_ERROR",
      `GitHub repository identity lookup failed with HTTP ${response.status}.`
    );
  }
  const payload = await response.json() as unknown;
  if (!isRecord(payload)
    || payload.id !== source.repositoryId
    || typeof payload.full_name !== "string"
    || !payload.full_name.includes("/")) {
    throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "GitHub returned an invalid repository identity.");
  }
  const [owner, name] = payload.full_name.split("/");
  if (!owner || !name) {
    throw new MarketplaceResolverError("INVALID_GITHUB_RESPONSE", "GitHub returned an invalid repository name.");
  }
  return { owner, name };
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && (error as Error & { code?: unknown }).code === code;
}

async function writeBundleFiles(
  root: string,
  files: GitHubBundleFile[]
): Promise<void> {
  for (const file of files) {
    const destination = join(root, ...file.path.split("/"));
    await mkdir(resolve(destination, ".."), { recursive: true });
    await writeFile(destination, file.content);
  }
}

function validateCreateRequest(request: CreateSkillRequest): void {
  if (!SKILL_NAME.test(request.name)) {
    throw new SkillManagerError(
      "INVALID_SKILL_NAME",
      "Skill names must use lowercase letters, digits, and single hyphen separators."
    );
  }
  if (request.description.trim().length === 0) {
    throw new SkillManagerError("INVALID_SKILL_DESCRIPTION", "Skill description must not be empty.");
  }
}

function validateTargetRequest(
  request: SetTargetEnabledRequest,
  targetRoots: Readonly<Partial<Record<ExternalSkillTarget, string>>>
): void {
  validateExternalSkillName(request.name);
  if (request.target !== "dsh" && targetRoots[request.target] === undefined) {
    throw new SkillManagerError(
      "TARGET_NOT_CONFIGURED",
      `Target "${request.target}" has no configured Skill root.`
    );
  }
}

function normalizeTargetStateNames(
  request: ListTargetStatesRequest,
  registry: RegistryFile
): string[] {
  return request.names === undefined
    ? Object.keys(registry.skills).sort((left, right) => left.localeCompare(right))
    : normalizeUpdateNames(request.names, registry);
}

function renderSkillDocument(request: CreateSkillRequest, body: string): string {
  const frontmatter = stringify({
    name: request.name,
    description: request.description.trim()
  }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${body}`;
}

function parseSkillDocument(document: string): { name: string; description: string; content: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n(?:\r?\n)?([\s\S]*)$/u.exec(document);
  if (match === null) {
    throw new SkillManagerError("REGISTRY_INVALID", "Managed Skill is missing valid frontmatter.");
  }
  const metadata = parse(match[1] ?? "") as unknown;
  if (!isRecord(metadata) || typeof metadata.name !== "string" || typeof metadata.description !== "string") {
    throw new SkillManagerError("REGISTRY_INVALID", "Managed Skill metadata is invalid.");
  }
  return {
    name: metadata.name.trim(),
    description: metadata.description.trim(),
    content: match[2] ?? ""
  };
}

function parseProvenanceHints(document: string): SkillProvenanceHint[] {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(document);
  if (match === null) return [];
  let metadata: unknown;
  try {
    metadata = parse(match[1] ?? "") as unknown;
  } catch {
    return [];
  }
  if (!isRecord(metadata)) return [];
  const nested = isRecord(metadata.metadata) ? metadata.metadata : undefined;
  const repositoryValue = metadata.repository ?? nested?.repository;
  const pathValue = metadata.skill_path ?? metadata.skillPath ?? nested?.skill_path ?? nested?.skillPath;
  const repository = normalizeGitHubRepositoryHint(repositoryValue);
  if (repository === null) return [];
  const path = normalizeProvenancePath(pathValue);
  return [{ repository, path }];
}

function normalizeGitHubRepositoryHint(value: unknown): string | null {
  const raw = typeof value === "string"
    ? value.trim()
    : isRecord(value) && typeof value.url === "string"
      ? value.url.trim()
      : "";
  if (raw.length === 0) return null;
  const match = /^(?:https:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/.*)?$/iu.exec(raw);
  return match?.[1] && match[2] ? `${match[1]}/${match[2]}` : null;
}

function normalizeProvenancePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\.\//u, "");
  return path === "." || isSafeSnapshotPath(path) ? path : null;
}

function parseExternalSkillDocument(
  document: string,
  expectedName: string
): { name: string; description: string; content: string } {
  try {
    return parseSkillDocument(document);
  } catch (error) {
    throw new SkillManagerError(
      "SKILL_SOURCE_INVALID",
      `External Skill "${expectedName}" has invalid frontmatter.`,
      { cause: error }
    );
  }
}

async function discoverExternalSkills(
  targetRoots: Readonly<Partial<Record<ExternalSkillTarget, string>>>,
  request: DiscoverExternalSkillsRequest
): Promise<ExternalSkillCandidate[]> {
  const candidates: ExternalSkillCandidate[] = [];
  const targets = normalizeDiscoveryTargets(request.targets);
  for (const target of targets) {
    const rootPath = targetRoots[target];
    if (rootPath === undefined) continue;
    let entries;
    try {
      entries = await readdir(rootPath, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory()) continue;
      const sourcePath = join(rootPath, entry.name);
      let document;
      try {
        document = await readFile(join(sourcePath, "SKILL.md"), "utf8");
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") continue;
        throw error;
      }
      let parsed;
      try {
        parsed = parseExternalSkillDocument(document, entry.name);
      } catch {
        continue;
      }
      if (!SKILL_NAME.test(entry.name) || parsed.name !== entry.name) continue;
      try {
        candidates.push({
          name: parsed.name,
          description: parsed.description,
          contentHash: await hashSkillBundle(sourcePath),
          target
        });
      } catch (error) {
        if (error instanceof SkillManagerError && error.code === "UNSAFE_SKILL_BUNDLE") continue;
        throw error;
      }
    }
  }
  return candidates;
}

function resolveTargetRoots(
  roots: SkillManagerOptions["targetRoots"]
): Readonly<Partial<Record<ExternalSkillTarget, string>>> {
  return {
    ...(roots?.codex === undefined ? {} : { codex: resolve(roots.codex) }),
    ...(roots?.claude === undefined ? {} : { claude: resolve(roots.claude) }),
    ...(roots?.agents === undefined ? {} : { agents: resolve(roots.agents) }),
    ...(roots?.opencode === undefined ? {} : { opencode: resolve(roots.opencode) })
  };
}

function normalizeDiscoveryTargets(
  targets: ExternalSkillTarget[] | undefined
): ExternalSkillTarget[] {
  const selected = targets ?? ["codex", "claude", "agents", "opencode"];
  return [...new Set(selected)].sort();
}

function requireTargetRoot(
  roots: Readonly<Partial<Record<ExternalSkillTarget, string>>>,
  target: ExternalSkillTarget
): string {
  const root = roots[target];
  if (root === undefined) {
    throw new SkillManagerError(
      "TARGET_NOT_CONFIGURED",
      `Target "${target}" has no configured Skill root.`
    );
  }
  return root;
}

function validateExternalSkillName(name: string): void {
  if (!SKILL_NAME.test(name)) {
    throw new SkillManagerError(
      "INVALID_SKILL_NAME",
      "Skill names must use lowercase letters, digits, and single hyphen separators."
    );
  }
}

async function assertDirectExternalSkillDirectory(path: string, name: string): Promise<void> {
  try {
    const entry = await lstat(path);
    if (entry.isDirectory() && !entry.isSymbolicLink()) return;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }
  throw new SkillManagerError(
    "SKILL_SOURCE_INVALID",
    `External Skill "${name}" is not a direct directory in its configured root.`
  );
}

async function copySkillBundle(source: string, destination: string): Promise<void> {
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourceEntry = join(source, entry.name);
    const destinationEntry = join(destination, entry.name);
    if (entry.isSymbolicLink()) {
      throw new SkillManagerError(
        "UNSAFE_SKILL_BUNDLE",
        "Skill bundle contains an unsupported symbolic link."
      );
    }
    if (entry.isDirectory()) {
      await mkdir(destinationEntry, { recursive: false });
      await copySkillBundle(sourceEntry, destinationEntry);
      continue;
    }
    if (entry.isFile()) {
      await copyFile(sourceEntry, destinationEntry);
    }
  }
}

async function hashSkillBundle(root: string): Promise<string> {
  const hash = createHash("sha256");
  await appendDirectoryHash(hash, root, "");
  return hash.digest("hex");
}

async function recordGitHubObservation(
  options: SkillManagerOptions,
  observation: GitHubSkillObservation
): Promise<void> {
  await options.githubSkillIndex?.record(observation).catch(() => undefined);
}

function observationFromEntry(
  entry: ResolvedMarketplaceEntry,
  bundleHash: string,
  fingerprint: SkillIdentityFingerprint,
  timestamp: string
): GitHubSkillObservation {
  return {
    repositoryId: entry.repository.id,
    nodeId: entry.repository.nodeId,
    repository: { owner: entry.repository.owner, name: entry.repository.name },
    skillPath: entry.install.path,
    skillName: entry.name,
    fingerprint,
    commitSha: entry.snapshot.commitSha,
    skillDocumentBlobSha: entry.snapshot.blobSha,
    bundleHash,
    manifestFiles: entry.snapshot.manifestFiles ?? [],
    observedAt: entry.snapshot.fetchedAt,
    verifiedAt: timestamp
  };
}

function observationFromResolvedSnapshot(
  resolved: ResolvedSkillSnapshot,
  fingerprint: SkillIdentityFingerprint,
  timestamp: string
): GitHubSkillObservation {
  return {
    repositoryId: resolved.repository.repositoryId,
    nodeId: resolved.repository.nodeId,
    repository: { owner: resolved.repository.owner, name: resolved.repository.name },
    skillPath: resolved.skill.path,
    skillName: resolved.skill.name,
    fingerprint,
    commitSha: resolved.snapshot.commitSha,
    skillDocumentBlobSha: resolved.snapshot.skillDocumentBlobSha,
    bundleHash: resolved.snapshot.bundleHash,
    manifestFiles: [...resolved.skill.manifestFiles],
    observedAt: resolved.repository.discovery.discoveredAt,
    verifiedAt: timestamp
  };
}

function entryFromObservation(observation: GitHubSkillObservation): ResolvedMarketplaceEntry {
  const repository = `${observation.repository.owner}/${observation.repository.name}`;
  const url = `https://github.com/${repository}`;
  return {
    id: `${repository}/${observation.skillName}`,
    source: "github",
    catalogs: ["github"],
    name: observation.skillName,
    description: observation.skillName,
    publisher: { name: observation.repository.owner, url: `https://github.com/${observation.repository.owner}` },
    author: null,
    repository: {
      host: "github",
      id: observation.repositoryId,
      nodeId: observation.nodeId,
      owner: observation.repository.owner,
      name: observation.repository.name,
      path: observation.skillPath,
      url
    },
    skillUrl: observation.skillPath === "."
      ? `${url}/blob/${observation.commitSha}/SKILL.md`
      : `${url}/tree/${observation.commitSha}/${observation.skillPath}`,
    install: {
      kind: "github",
      repository,
      skill: observation.skillName,
      path: observation.skillPath
    },
    metrics: { installs: null, stars: null, downloads: null },
    cover: { kind: "generated", seed: `${repository}#${observation.skillPath}` },
    snapshot: {
      commitSha: observation.commitSha,
      blobSha: observation.skillDocumentBlobSha,
      fetchedAt: observation.observedAt,
      ...(observation.manifestFiles.length === 0 ? {} : { manifestFiles: observation.manifestFiles })
    }
  };
}

function deduplicateProvenanceEntries(entries: ResolvedMarketplaceEntry[]): ResolvedMarketplaceEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.repository.id}#${entry.install.path}@${entry.snapshot.commitSha}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function limitProvenanceCandidates(entries: ResolvedMarketplaceEntry[]): ResolvedMarketplaceEntry[] {
  const repositories = new Set<string>();
  const accepted: ResolvedMarketplaceEntry[] = [];
  for (const entry of entries) {
    const repository = entry.install.repository.toLocaleLowerCase();
    if (!repositories.has(repository) && repositories.size >= 8) continue;
    repositories.add(repository);
    accepted.push(entry);
    if (accepted.length >= 20) break;
  }
  return accepted;
}

function deduplicateProvenanceMatches<T extends {
  entry: ResolvedMarketplaceEntry;
  identityFingerprint: SkillIdentityFingerprint;
}>(matches: T[]): T[] {
  const byIdentity = new Map<string, T>();
  for (const match of matches) {
    const key = `${match.entry.repository.id}#${match.entry.install.path}`;
    const previous = byIdentity.get(key);
    if (previous === undefined || match.entry.snapshot.fetchedAt > previous.entry.snapshot.fetchedAt) {
      byIdentity.set(key, match);
    }
  }
  return [...byIdentity.values()];
}

function validateResolvedSkillSnapshot(resolved: ResolvedSkillSnapshot): GitHubBundleFile[] {
  const { repository, skill, snapshot } = resolved;
  if (
    repository.repoKey !== `github:${repository.owner}/${repository.name}`
    || skill.skillKey !== `${repository.repoKey}#${skill.path}`
    || skill.repositoryId !== repository.repositoryId
    || !skill.installable
    || skill.structureStatus !== "structure-verified"
    || skill.validatedAtCommit !== snapshot.commitSha
    || skill.skillDocumentBlobSha !== snapshot.skillDocumentBlobSha
    || snapshot.repository.owner !== repository.owner
    || snapshot.repository.name !== repository.name
    || snapshot.skillPath !== skill.path
    || snapshot.snapshotKey !== `${skill.skillKey}@${snapshot.commitSha}`
    || !snapshot.integrity.commitPinned
    || !snapshot.integrity.pathsSafe
    || !snapshot.integrity.frontmatterValid
    || !snapshot.integrity.symlinksRejected
    || !snapshot.integrity.submodulesRejected
    || snapshot.files.length !== resolved.files.length
    || snapshot.files.length > MAX_SNAPSHOT_FILE_COUNT
    || !/^[a-f0-9]{40}$/iu.test(snapshot.commitSha)
    || !/^[a-f0-9]{40}$/iu.test(snapshot.skillDocumentBlobSha)
    || !/^[a-f0-9]{64}$/iu.test(snapshot.bundleHash)
  ) invalidResolvedSnapshot();

  const contentByPath = new Map(resolved.files.map((file) => [file.path, file.content]));
  if (contentByPath.size !== resolved.files.length) invalidResolvedSnapshot();
  const comparablePaths = new Set<string>();
  let totalBytes = 0;
  const files: GitHubBundleFile[] = snapshot.files.map((file) => {
    const content = contentByPath.get(file.path);
    const comparablePath = file.path.toLocaleLowerCase();
    if (
      !isSafeSnapshotPath(file.path)
      || isAgentInstructionPath(file.path)
      || comparablePaths.has(comparablePath)
      || !(content instanceof Uint8Array)
      || !Number.isSafeInteger(file.size)
      || file.size < 0
      || file.size > MAX_SNAPSHOT_FILE_BYTES
      || content.byteLength !== file.size
      || (file.mode !== "100644" && file.mode !== "100755")
      || !/^[a-f0-9]{40}$/iu.test(file.blobSha)
    ) invalidResolvedSnapshot();
    comparablePaths.add(comparablePath);
    totalBytes += file.size;
    if (totalBytes > MAX_SNAPSHOT_BUNDLE_BYTES) invalidResolvedSnapshot();
    const blobSha = createHash("sha1")
      .update(`blob ${content.byteLength}\0`)
      .update(content)
      .digest("hex");
    if (blobSha !== file.blobSha) invalidResolvedSnapshot();
    return { path: file.path, content, blobSha, size: file.size, mode: file.mode };
  });
  const skillDocument = files.find((file) => file.path === "SKILL.md");
  if (skillDocument?.blobSha !== snapshot.skillDocumentBlobSha) invalidResolvedSnapshot();
  if (hashGitTreeFiles(files) !== snapshot.bundleHash) invalidResolvedSnapshot();
  return files;
}

function isSafeSnapshotPath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((segment) => segment.length > 0
    && segment !== "."
    && segment !== ".."
    && !/[<>:"|?*\u0000-\u001f]/u.test(segment)
    && !/[. ]$/u.test(segment)
    && !WINDOWS_RESERVED_NAME.test(segment));
}

function hashGitTreeFiles(files: GitHubBundleFile[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.mode);
    hash.update("\0");
    hash.update(file.blobSha);
    hash.update("\0");
    hash.update(String(file.size));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function invalidResolvedSnapshot(): never {
  throw new SkillManagerError(
    "INVALID_MARKETPLACE_INSTALL",
    "Resolved Skill snapshot is inconsistent or failed integrity validation."
  );
}

async function appendDirectoryHash(hash: ReturnType<typeof createHash>, root: string, relative: string): Promise<void> {
  const directory = join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryRelative = relative.length === 0 ? entry.name : join(relative, entry.name);
    if (entry.isSymbolicLink()) {
      throw new SkillManagerError(
        "UNSAFE_SKILL_BUNDLE",
        "Skill bundle contains an unsupported symbolic link."
      );
    }
    if (entry.isDirectory()) {
      await appendDirectoryHash(hash, root, entryRelative);
      continue;
    }
    if (entry.isFile()) {
      hash.update(entryRelative.replaceAll("\\", "/"));
      hash.update("\0");
      hash.update(await readFile(join(root, entryRelative)));
      hash.update("\0");
    }
  }
}

async function readRegistry(path: string): Promise<RegistryFile> {
  try {
    const raw = await readFile(path, "utf8");
    const value = JSON.parse(raw) as unknown;
    if (!isRegistryFile(value)) {
      throw new SkillManagerError("REGISTRY_INVALID", "Skill Manager registry is invalid.");
    }
    return value;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { version: REGISTRY_VERSION, skills: {} };
    }
    throw error;
  }
}

async function writeRegistry(root: string, path: string, registry: RegistryFile): Promise<void> {
  await mkdir(root, { recursive: true });
  const temporary = join(root, `.registry-${randomUUID()}.tmp`);
  const backup = join(root, `.registry-${randomUUID()}.bak`);
  await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  const hadRegistry = await pathExists(path);
  try {
    if (hadRegistry) await rename(path, backup);
    await rename(temporary, path);
    if (hadRegistry) await rm(backup, { force: true }).catch(() => undefined);
  } catch (error) {
    await rm(temporary, { force: true });
    if (hadRegistry && await pathExists(backup) && !await pathExists(path)) {
      await rename(backup, path);
    }
    throw error;
  }
}

async function enableActiveLink(
  source: string,
  destination: string,
  activeRoot: string,
  existingIsOwned = false
): Promise<void> {
  await mkdir(activeRoot, { recursive: true });
  if (await pathEntryExists(destination)) {
    if (existingIsOwned && await pathsReferToSameDirectory(source, destination)) return;
    throw new SkillManagerError(
      "ACTIVE_PATH_CONFLICT",
      "The target already contains a different same-name path."
    );
  }
  await symlink(source, destination, process.platform === "win32" ? "junction" : "dir");
}

async function disableActiveLink(
  source: string,
  destination: string,
  existingIsOwned: boolean,
  missingIsConflict = false
): Promise<void> {
  try {
    await lstat(destination);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      if (!missingIsConflict) return;
      throw new SkillManagerError(
        "ACTIVE_PATH_CONFLICT",
        "The external target link is missing and cannot be safely disabled."
      );
    }
    throw error;
  }
  if (!existingIsOwned || !await pathsReferToSameDirectory(source, destination)) {
    throw new SkillManagerError(
      "ACTIVE_PATH_CONFLICT",
      "Refusing to remove a target path not owned by Skill Manager."
    );
  }
  await rm(destination, { force: true, recursive: false });
}

async function pathsReferToSameDirectory(left: string, right: string): Promise<boolean> {
  try {
    const [leftReal, rightReal] = await Promise.all([realpath(left), realpath(right)]);
    return normalizeComparablePath(leftReal) === normalizeComparablePath(rightReal);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function normalizeComparablePath(path: string): string {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function uniqueTargets(targets: ManagedSkill["enabledTargets"]): ManagedSkill["enabledTargets"] {
  return [...new Set(targets)];
}

function toManagedSkill(skill: RegistrySkill): ManagedSkill {
  const { relativePath: _relativePath, ...managed } = skill;
  return { ...managed, enabledTargets: [...managed.enabledTargets] };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

async function pathEntryExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isRegistryFile(value: unknown): value is RegistryFile {
  return isRecord(value)
    && value.version === REGISTRY_VERSION
    && isRecord(value.skills);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
