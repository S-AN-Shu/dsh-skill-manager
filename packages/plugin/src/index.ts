import {
  createCompositeMarketplaceSource,
  createGitHubMarketplaceSource,
  createGitHubMarketplaceResolver,
  createGitHubRepositoryDiscovery,
  createGitHubTrendingDiscovery,
  createGitHubRepositoryInspector,
  createGitHubSnapshotCache,
  createGitHubSkillIndex,
  createGitHubSnapshotResolver,
  createGitHubMediaResolver,
  createHuggingFaceMarketplaceSource,
  createSkillManager,
  createSkillsShMarketplaceSource,
  createStaticSkillRiskAssessor,
  fingerprintSkillFiles
} from "@dsh-skill-manager/core";
import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import Schema from "@deepseek-ai/schemastery";
import { join, resolve } from "node:path";

import { createHostMarketplaceFetch } from "./marketplace-fetch.js";

import {
  createSkillManagerRpcHandlers,
  type CheckUpdatesRpcRequest,
  type AssessSkillRiskRpcRequest,
  type BrowseRepositoriesRpcRequest,
  type CreateSkillRpcRequest,
  type DiscoverExternalRpcRequest,
  type ImportExternalRpcRequest,
  type GetCapabilitiesRpcRequest,
  type InspectRepositoryRpcRequest,
  type InstallRepositoryRpcRequest,
  type InstallSkillRpcRequest,
  type ListBackupsRpcRequest,
  type ListTrashRpcRequest,
  type ListSkillsRpcRequest,
  type ListTargetStatesRpcRequest,
  type ResolveMediaRpcRequest,
  type RollbackSkillRpcRequest,
  type RestoreTrashRpcRequest,
  type SearchRepositoriesRpcRequest,
  type SetEnabledRpcRequest,
  type SetTargetEnabledRpcRequest,
  type SkillManagerRpcHandlers,
  type UpdateSkillRpcRequest,
  type VerifyProvenanceRpcRequest
} from "./rpc.js";

export interface SkillManagerPluginConfig {
  root?: string;
  dshRoot?: string;
  codexRoot?: string;
  claudeRoot?: string;
  agentsRoot?: string;
  opencodeRoot?: string;
}

export const Config = Schema.object({
  root: Schema.string().description("Skill Manager 的注册表、缓存与可恢复归档目录。留空时使用 DSH_HOME/skill-manager。"),
  dshRoot: Schema.string().description("DSH 原生 Skill 目录。留空时使用 DSH_HOME/skills。"),
  codexRoot: Schema.string().description("Codex Skill 目录。留空时使用用户目录下的 .codex/skills。"),
  claudeRoot: Schema.string().description("Claude Code Skill 目录。留空时使用用户目录下的 .claude/skills。"),
  agentsRoot: Schema.string().description("Agents 通用 Skill 目录。留空时使用用户目录下的 .agents/skills。"),
  opencodeRoot: Schema.string().description("OpenCode Skill 目录。留空时使用用户目录下的 .config/opencode/skills。")
});

export class DshSkillManagerService extends TypertRemoteService {
  static Config = Config;
  static inject: string[] = [];

  readonly handlers: SkillManagerRpcHandlers;

  constructor(ctx: Context, config: SkillManagerPluginConfig = {}) {
    super(ctx, "skillManager");
    const targetRoots = resolveTargetRoots(config);
    const marketplaceFetch = createHostMarketplaceFetch();
    const skillsShMarketplace = createSkillsShMarketplaceSource({ fetch: marketplaceFetch });
    const githubMarketplace = createGitHubMarketplaceSource({
      fetch: marketplaceFetch,
      timeoutMs: 25_000
    });
    const huggingFaceMarketplace = createHuggingFaceMarketplaceSource({ fetch: marketplaceFetch });
    const trendingDiscovery = createGitHubTrendingDiscovery({ fetch: marketplaceFetch });
    const repositoryDiscovery = createGitHubRepositoryDiscovery({ fetch: marketplaceFetch, trending: trendingDiscovery });
    const managerRoot = resolveManagerRoot(config);
    const snapshotCache = createGitHubSnapshotCache({
      fetch: marketplaceFetch,
      cacheRoot: join(managerRoot, "cache", "github-snapshots")
    });
    const baseRepositoryInspector = createGitHubRepositoryInspector({ fetch: marketplaceFetch, snapshotCache });
    const snapshotResolver = createGitHubSnapshotResolver({ fetch: marketplaceFetch, snapshotCache });
    const githubSkillIndex = createGitHubSkillIndex({
      path: join(managerRoot, "cache", "github-skill-index", "v1.json")
    });
    const riskAssessor = createStaticSkillRiskAssessor({ fetch: marketplaceFetch, snapshotCache });
    const mediaResolver = createGitHubMediaResolver({ fetch: marketplaceFetch, snapshotCache });
    const repositoryInspector = {
      async inspectRepository(request: Parameters<typeof baseRepositoryInspector.inspectRepository>[0]) {
        const assessments = [] as Array<{ skillPath: string; assessment: ReturnType<typeof riskAssessor.assessResolvedSkillRisk> }>;
        const batch = await snapshotResolver.resolveRepositorySnapshots?.({ repository: request.repository });
        if (batch !== undefined) {
          const verifiedAt = new Date().toISOString();
          for (const resolved of batch.snapshots) {
            await githubSkillIndex.record({
              repositoryId: resolved.repository.repositoryId,
              nodeId: resolved.repository.nodeId,
              repository: { owner: resolved.repository.owner, name: resolved.repository.name },
              skillPath: resolved.skill.path,
              skillName: resolved.skill.name,
              fingerprint: fingerprintSkillFiles(resolved.files),
              commitSha: resolved.snapshot.commitSha,
              skillDocumentBlobSha: resolved.snapshot.skillDocumentBlobSha,
              bundleHash: resolved.snapshot.bundleHash,
              manifestFiles: [...resolved.skill.manifestFiles],
              observedAt: batch.inspection.inspectedAt,
              verifiedAt
            });
            assessments.push({ skillPath: resolved.skill.path, assessment: riskAssessor.assessResolvedSkillRisk(resolved) });
          }
          return { inspection: batch.inspection, assessments };
        }
        return { inspection: await baseRepositoryInspector.inspectRepository(request), assessments };
      }
    };
    this.handlers = createSkillManagerRpcHandlers({
      manager: createSkillManager({
        root: managerRoot,
        dshRoot: resolveDshRoot(config),
        targetRoots,
        fetch: marketplaceFetch,
        githubSkillIndex,
        snapshotCache,
        snapshotResolver,
        riskAssessor
      }),
      marketplace: createCompositeMarketplaceSource({
        sources: [
          { kind: "skills-sh", source: skillsShMarketplace },
          { kind: "github", source: githubMarketplace },
          { kind: "hugging-face", source: huggingFaceMarketplace }
        ]
      }),
      provenanceMarketplace: createCompositeMarketplaceSource({
        sources: [
          { kind: "skills-sh", source: skillsShMarketplace },
          { kind: "github", source: githubMarketplace },
          { kind: "hugging-face", source: huggingFaceMarketplace }
        ]
      }),
      resolver: createGitHubMarketplaceResolver({ fetch: marketplaceFetch }),
      repositoryDiscovery,
      repositoryInspector,
      snapshotResolver,
      riskAssessor,
      mediaResolver,
      buildId: "dsh-skill-manager@0.1.0+protocol5"
    });
  }

  @Remote("list")
  list(request: ListSkillsRpcRequest) {
    return this.handlers.list(request);
  }

  @Remote("create")
  create(request: CreateSkillRpcRequest) {
    return this.handlers.create(request);
  }

  @Remote("setEnabled")
  setEnabled(request: SetEnabledRpcRequest) {
    return this.handlers.setEnabled(request);
  }

  @Remote("getCapabilities")
  getCapabilities(request: GetCapabilitiesRpcRequest) {
    return this.handlers.getCapabilities(request);
  }

  @Remote("searchRepositories")
  searchRepositories(request: SearchRepositoriesRpcRequest) {
    return this.handlers.searchRepositories(request);
  }

  @Remote("browseRepositories")
  browseRepositories(request: BrowseRepositoriesRpcRequest) {
    return this.handlers.browseRepositories(request);
  }

  @Remote("inspectRepository")
  inspectRepository(request: InspectRepositoryRpcRequest) {
    return this.handlers.inspectRepository(request);
  }

  @Remote("installSkill")
  installSkill(request: InstallSkillRpcRequest) {
    return this.handlers.installSkill(request);
  }

  @Remote("installRepository")
  installRepository(request: InstallRepositoryRpcRequest) {
    return this.handlers.installRepository(request);
  }

  @Remote("assessSkillRisk")
  assessSkillRisk(request: AssessSkillRiskRpcRequest) {
    return this.handlers.assessSkillRisk(request);
  }

  @Remote("resolveMedia")
  resolveMedia(request: ResolveMediaRpcRequest) {
    return this.handlers.resolveMedia(request);
  }

  @Remote("verifyProvenance")
  verifyProvenance(request: VerifyProvenanceRpcRequest) {
    return this.handlers.verifyProvenance(request);
  }

  @Remote("verifyProvenanceBatch")
  verifyProvenanceBatch(request: import("./rpc.js").VerifyProvenanceBatchRpcRequest) {
    return this.handlers.verifyProvenanceBatch(request);
  }

  @Remote("checkUpdates")
  checkUpdates(request: CheckUpdatesRpcRequest) {
    return this.handlers.checkUpdates(request);
  }

  @Remote("update")
  update(request: UpdateSkillRpcRequest) {
    return this.handlers.update(request);
  }

  @Remote("listBackups")
  listBackups(request: ListBackupsRpcRequest) {
    return this.handlers.listBackups(request);
  }

  @Remote("rollback")
  rollback(request: RollbackSkillRpcRequest) {
    return this.handlers.rollback(request);
  }

  @Remote("delete")
  delete(request: import("./rpc.js").DeleteSkillRpcRequest) {
    return this.handlers.delete(request);
  }

  @Remote("listTrash")
  listTrash(request: ListTrashRpcRequest) {
    return this.handlers.listTrash(request);
  }

  @Remote("restoreTrash")
  restoreTrash(request: RestoreTrashRpcRequest) {
    return this.handlers.restoreTrash(request);
  }

  @Remote("discoverExternal")
  discoverExternal(request: DiscoverExternalRpcRequest) { return this.handlers.discoverExternal(request); }

  @Remote("importExternal")
  importExternal(request: ImportExternalRpcRequest) { return this.handlers.importExternal(request); }

  @Remote("listTargetStates")
  listTargetStates(request: ListTargetStatesRpcRequest) { return this.handlers.listTargetStates(request); }

  @Remote("setTargetEnabled")
  setTargetEnabled(request: SetTargetEnabledRpcRequest) { return this.handlers.setTargetEnabled(request); }
}

export function resolveManagerRoot(
  config: SkillManagerPluginConfig,
  environment: NodeJS.ProcessEnv = process.env
): string {
  if (config.root?.trim()) return resolve(config.root);

  const dshHome = environment.DSH_HOME?.trim()
    || join(environment.HOME || environment.USERPROFILE || process.cwd(), ".dsh");
  return resolve(dshHome, "skill-manager");
}

async function runBounded<T>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await task(values[currentIndex]!).catch(() => undefined);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(concurrency, values.length) },
    () => worker()
  ));
}

export function resolveTargetRoots(
  config: SkillManagerPluginConfig,
  environment: NodeJS.ProcessEnv = process.env
) {
  const userHome = environment.HOME || environment.USERPROFILE || process.cwd();
  return {
    codex: resolve(config.codexRoot?.trim() || join(userHome, ".codex", "skills")),
    claude: resolve(config.claudeRoot?.trim() || join(userHome, ".claude", "skills")),
    agents: resolve(config.agentsRoot?.trim() || join(userHome, ".agents", "skills")),
    opencode: resolve(config.opencodeRoot?.trim() || join(userHome, ".config", "opencode", "skills"))
  };
}

export function resolveDshRoot(
  config: SkillManagerPluginConfig,
  environment: NodeJS.ProcessEnv = process.env
): string {
  if (config.dshRoot?.trim()) return resolve(config.dshRoot);

  const dshHome = environment.DSH_HOME?.trim()
    || join(environment.HOME || environment.USERPROFILE || process.cwd(), ".dsh");
  return resolve(dshHome, "skills");
}

export * from "./rpc.js";
export { TYPERT, skillManagerDescriptors } from "./typert.host.js";
export default DshSkillManagerService;
