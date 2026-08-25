export const RPC_SCHEMA_VERSION = 1 as const;

export type SkillOrigin = "self" | "local-import" | "github" | "skills-sh" | "hugging-face";
export type SkillTarget = "dsh" | "codex" | "claude" | "agents" | "opencode";
export type ExternalSkillTargetWire = Exclude<SkillTarget, "dsh">;
export interface ExternalSkillCandidateWire { name: string; description: string; contentHash: string; target: ExternalSkillTargetWire }
export interface SkillTargetStateWire { name: string; target: ExternalSkillTargetWire; status: "not-configured" | "not-linked" | "linked" | "conflict" }

export interface ManagedSkillWire {
  name: string;
  description: string;
  origin: SkillOrigin;
  enabledTargets: SkillTarget[];
  createdAt: string;
  updatedAt: string;
  contentHash: string;
  source?: {
    kind: "local-import";
    name: string;
    target: Exclude<SkillTarget, "dsh">;
  } | {
    kind: "github";
    repository: string;
    path: string;
    commitSha: string;
    blobSha: string;
    bundleHash: string;
    catalog: "skills-sh" | "github" | "hugging-face";
    url: string;
    repositoryId?: number;
    nodeId?: string;
    matchMethod?: "install" | "exact-content";
    matchedAt?: string;
    identityFingerprint?: {
      version: "dsm-skill-fingerprint-v1";
      hash: string;
    };
    discoverySources?: Array<"skills-sh" | "github" | "hugging-face">;
  };
  provenanceCheck?: {
    status: "no-match" | "custom" | "ambiguous" | "ineligible";
    checkedAt: string;
  };
}

export interface SkillManagerPort {
  listSkills(): Promise<ManagedSkillWire[]>;
  createSkill(request: { name: string; description: string }): Promise<ManagedSkillWire>;
  setTargetEnabled(request: {
    name: string;
    target: SkillTarget;
    enabled: boolean;
  }): Promise<ManagedSkillWire>;
  installMarketplaceSkill(request: {
    entry: ResolvedMarketplaceEntryWire;
  }): Promise<ManagedSkillWire>;
  installSkillSnapshot(request: {
    resolved: ResolvedSkillSnapshotWire;
  }): Promise<ManagedSkillWire>;
  getProvenanceHints?(name: string): Promise<Array<{ repository: string; path: string | null }>>;
  verifyMarketplaceProvenance(request: {
    name: string;
    entries: ResolvedMarketplaceEntryWire[];
    signal?: AbortSignal;
  }): Promise<SkillProvenanceVerificationWire>;
  checkUpdates(request?: { names?: string[] }): Promise<SkillUpdateCheckWire[]>;
  updateSkill(request: { name: string; acknowledgeHighRisk?: boolean }): Promise<SkillMutationResultWire>;
  listBackups(request?: { name?: string }): Promise<SkillBackupWire[]>;
  rollbackSkill(request: { name: string; backupId: string }): Promise<SkillMutationResultWire>;
  deleteSkill(request: { name: string }): Promise<DeletedSkillWire>;
  listTrash(): Promise<TrashedSkillWire[]>;
  restoreTrash(request: { name: string; trashId: string }): Promise<ManagedSkillWire>;
  discoverExternalSkills(request?: { targets?: ExternalSkillTargetWire[] }): Promise<ExternalSkillCandidateWire[]>;
  importSkill(request: { target: ExternalSkillTargetWire; name: string }): Promise<ManagedSkillWire>;
  listTargetStates(request?: { names?: string[]; targets?: ExternalSkillTargetWire[] }): Promise<SkillTargetStateWire[]>;
}

export interface SkillSnapshotWire {
  commitSha: string;
  blobSha: string;
  bundleHash: string;
}

export interface SkillUpdateCheckWire {
  name: string;
  status: "unsupported" | "local-modified" | "source-moved" | "up-to-date" | "update-available";
  installed: SkillSnapshotWire | null;
  latest: SkillSnapshotWire | null;
  latestRisk: SkillRiskAssessmentWire | null;
  checkedAt: string;
}

export interface SkillBackupWire {
  id: string;
  name: string;
  createdAt: string;
  reason: "update" | "rollback";
  contentHash: string;
  snapshot: SkillSnapshotWire | null;
}

export interface SkillMutationResultWire {
  skill: ManagedSkillWire;
  backup: SkillBackupWire;
}

export interface DeletedSkillWire {
  name: string;
  trashId: string;
  deletedAt: string;
}

export interface RepositoryInstallResultWire {
  skillPath: string;
  status: "installed" | "already-installed" | "needs-confirmation" | "failed";
  skill?: ManagedSkillWire;
  assessment?: SkillRiskAssessmentWire;
  error?: { code: string; message: string };
}

export interface TrashedSkillWire {
  name: string;
  trashId: string;
  description: string;
  origin: SkillOrigin;
  enabledTargets: SkillTarget[];
  deletedAt: string;
  expiresAt: string;
}

export interface SkillProvenanceVerificationWire {
  name: string;
  status: "matched" | "custom" | "ambiguous" | "ineligible";
  skill: ManagedSkillWire;
}

export type RepositorySortWire = "popular" | "latest" | "trend-weekly" | "trend-monthly" | "relevance";
export type SkillCategoryIdWire =
  | "agent" | "automation" | "development" | "data" | "design" | "content"
  | "research" | "business" | "finance" | "security" | "creative" | "life" | "general";
export interface ClassificationEvidenceWire {
  source: "skill-frontmatter" | "skills-manifest" | "github-topic" | "name" | "description" | "readme";
  value: string;
}
export interface SkillClassificationWire {
  primaryCategory: SkillCategoryIdWire;
  tags: string[];
  evidence: ClassificationEvidenceWire[];
  confidence: "explicit" | "topic" | "keyword" | "none";
}
export interface RepositoryTrendWire {
  weeklyStars: number | null;
  monthlyStars: number | null;
  observedAt: string;
  source: "github-trending-html";
  stale: boolean;
}
export type MediaSourceWire =
  | { type: "repo-blob"; repo: string; commit: string; path: string }
  | { type: "github-avatar"; owner: string; accountId: number }
  | { type: "github-social-preview"; repo: string }
  | { type: "generated"; seed: string };

export interface DiscoverySignalWire {
  source: "skills-sh" | "github" | "hugging-face" | "index";
  kind: "format-topic" | "metadata" | "registry" | "index" | "ordinary-search";
  label: string;
}

export interface RepositoryCandidateWire {
  repositoryId: number;
  nodeId: string;
  repoKey: string;
  host: "github";
  owner: string;
  ownerId: number;
  ownerType: "User" | "Organization" | "Bot";
  ownerAvatar: MediaSourceWire;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  topics: string[];
  formatTopics: string[];
  categoryTopics: string[];
  archived: boolean;
  license: string | null;
  knownSkillCount: number | null;
  classification: SkillClassificationWire;
  trend: RepositoryTrendWire | null;
  cover: MediaSourceWire;
  discovery: { signals: DiscoverySignalWire[]; discoveredAt: string };
}

export interface RepositoryQueryResultWire {
  source: "github";
  query: string | null;
  sort: RepositorySortWire;
  page: number;
  returnedCount: number;
  total: number;
  hasMore: boolean;
  incomplete: boolean;
  dataUpdatedAt: string;
  sourceState: "live" | "cached" | "unavailable" | "empty";
  sourceMessage: string | null;
  repositories: RepositoryCandidateWire[];
}

export interface SkillDescriptorWire {
  skillKey: string;
  repositoryId: number;
  path: string;
  name: string;
  description: string;
  classification: SkillClassificationWire;
  author: MarketplacePartyWire | null;
  structureStatus: "invalid" | "parsed" | "structure-verified";
  validatedAtCommit: string;
  skillDocumentBlobSha: string;
  manifestFiles: string[];
  installable: boolean;
  warnings: string[];
}

export interface RepositoryInspectionWire {
  repository: RepositoryCandidateWire;
  inspectionCommit: string;
  inspectedAt: string;
  status: "inspected" | "structure-verified";
  readme: { path: string; title: string | null; content: string; blobSha: string } | null;
  manifestPaths: string[];
  declaredSkillPaths: string[];
  skills: SkillDescriptorWire[];
  media: MediaSourceWire[];
  warnings: string[];
}

export interface RepositoryRiskAssessmentWire {
  skillPath: string;
  assessment: SkillRiskAssessmentWire;
}

export interface RepositoryInspectionResultWire {
  inspection: RepositoryInspectionWire;
  assessments: RepositoryRiskAssessmentWire[];
}

export interface RiskFindingWire {
  code: string;
  severity: "info" | "warning" | "high";
  title: string;
  detail: string;
  file: string;
}

export interface SkillRiskAssessmentWire {
  risk: "unknown" | "low" | "medium" | "high";
  findings: RiskFindingWire[];
  scannerVersion: string;
}

export interface MediaAssetWire {
  source: MediaSourceWire;
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  width: number;
  height: number;
}

export interface SkillManagerCapabilitiesWire {
  protocolVersion: number;
  buildId: string;
  features: {
    marketplaceV2: boolean;
    repositoryInspection: boolean;
    mediaProxy: boolean;
    indexCatalog: boolean;
    riskAssessment: boolean;
    githubTrending: boolean;
    skillClassification: boolean;
    provenanceV2: boolean;
    updateRiskGate: boolean;
    repositoryBatchAnalysis: boolean;
    repositoryBatchInstall: boolean;
    batchProvenance: boolean;
    skillsShDiscoveryHints: boolean;
  };
}

export interface MarketplacePartyWire {
  name: string;
  url: string | null;
}

export interface MarketplaceEntryWire {
  id: string;
  source: "skills-sh" | "github" | "hugging-face";
  catalogs: Array<"skills-sh" | "github" | "hugging-face">;
  name: string;
  description: string | null;
  publisher: MarketplacePartyWire | null;
  author: MarketplacePartyWire | null;
  repository: {
    host: "github";
    owner: string;
    name: string;
    path: string | null;
    url: string;
  };
  skillUrl: string;
  install: {
    kind: "github";
    repository: string;
    skill: string;
    path: string | null;
  };
  metrics: {
    installs: {
      value: number;
      source: "skills.sh";
    } | null;
    stars: {
      value: number;
      source: "github";
      scope: "repository";
    } | null;
    downloads: number | null;
  };
  cover: {
    kind: "generated";
    seed: string;
  };
}

export interface MarketplaceSearchResultWire {
  source: "skills-sh" | "github" | "hugging-face" | "composite";
  query: string;
  returnedCount: number;
  entries: MarketplaceEntryWire[];
  sources: MarketplaceSourceStatusWire[];
}

export interface MarketplaceBrowseResultWire {
  source: "skills-sh";
  ranking: "all-time-installs";
  offset: number;
  returnedCount: number;
  total: number;
  hasMore: boolean;
  entries: MarketplaceEntryWire[];
}

export interface MarketplaceSourceStatusWire {
  source: "skills-sh" | "github" | "hugging-face";
  status: "available" | "unavailable";
  returnedCount: number;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface ResolvedMarketplaceEntryWire extends Omit<
  MarketplaceEntryWire,
  "description" | "repository" | "install"
> {
  description: string;
  repository: MarketplaceEntryWire["repository"] & {
    id: number;
    nodeId: string;
    path: string;
  };
  install: MarketplaceEntryWire["install"] & { path: string };
  snapshot: {
    commitSha: string;
    blobSha: string;
    fetchedAt: string;
    manifestFiles?: string[];
  };
}

export interface MarketplaceSourcePort {
  search(request: { query: string; limit?: number; signal?: AbortSignal }): Promise<MarketplaceSearchResultWire>;
}

export interface MarketplaceResolverPort {
  resolve(
    entry: MarketplaceEntryWire,
    request?: { signal?: AbortSignal }
  ): Promise<ResolvedMarketplaceEntryWire>;
}

export interface RepositoryDiscoveryPort {
  searchRepositories(request: {
    query?: string;
    sort?: RepositorySortWire;
    page?: number;
    limit?: number;
  }): Promise<RepositoryQueryResultWire>;
  browseRepositories(request?: {
    sort?: RepositorySortWire;
    page?: number;
    limit?: number;
  }): Promise<RepositoryQueryResultWire>;
}

export interface RepositoryInspectorPort {
  inspectRepository(request: {
    repository: { owner: string; name: string };
  }): Promise<RepositoryInspectionResultWire>;
}

export interface SnapshotResolverPort {
  resolveSkillSnapshot(intent: {
    repository: { owner: string; name: string };
    skillPath: string;
  }, request?: { signal?: AbortSignal; refreshCommit?: boolean }): Promise<ResolvedSkillSnapshotWire>;
  resolveRepositorySnapshots?(intent: {
    repository: { owner: string; name: string };
    skillPaths?: string[];
  }, request?: { signal?: AbortSignal; refreshCommit?: boolean }): Promise<{
    inspection: RepositoryInspectionWire;
    snapshots: ResolvedSkillSnapshotWire[];
    failures: Array<{ skillPath: string; code: string; message: string }>;
  }>;
}

export interface ResolvedSkillSnapshotWire {
  repository: RepositoryCandidateWire;
  skill: SkillDescriptorWire;
  snapshot: {
    snapshotKey: string;
    repository: { owner: string; name: string };
    skillPath: string;
    commitSha: string;
    skillDocumentBlobSha: string;
    files: Array<{ path: string; blobSha: string; size: number; mode: "100644" | "100755" }>;
    bundleHash: string;
    integrity: {
      commitPinned: true;
      pathsSafe: true;
      frontmatterValid: true;
      symlinksRejected: true;
      submodulesRejected: true;
    };
  };
  files: Array<{ path: string; content: Uint8Array }>;
}

export interface SkillRiskAssessorPort {
  assessSkillRisk(intent: {
    repository: { owner: string; name: string };
    skillPath: string;
  }): Promise<SkillRiskAssessmentWire>;
  assessResolvedSkillRisk(snapshot: ResolvedSkillSnapshotWire): SkillRiskAssessmentWire;
}

export interface MediaResolverPort {
  resolveMedia(source: MediaSourceWire): Promise<MediaAssetWire>;
}

export interface SkillManagerRpcDependencies {
  manager: SkillManagerPort;
  marketplace: MarketplaceSourcePort;
  provenanceMarketplace?: MarketplaceSourcePort;
  resolver: MarketplaceResolverPort;
  repositoryDiscovery?: RepositoryDiscoveryPort;
  repositoryInspector?: RepositoryInspectorPort;
  snapshotResolver?: SnapshotResolverPort;
  riskAssessor?: SkillRiskAssessorPort;
  mediaResolver?: MediaResolverPort;
  buildId?: string;
}

export interface RpcVersionedRequest {
  schemaVersion: typeof RPC_SCHEMA_VERSION;
}

export interface ListSkillsRpcRequest extends RpcVersionedRequest {}

export interface CreateSkillRpcRequest extends RpcVersionedRequest {
  name: string;
  description: string;
}

export interface SetEnabledRpcRequest extends RpcVersionedRequest {
  name: string;
  enabled: boolean;
}

export interface GetCapabilitiesRpcRequest extends RpcVersionedRequest {}

export interface SearchRepositoriesRpcRequest extends RpcVersionedRequest {
  query: string;
  sort?: RepositorySortWire;
  page?: number;
  limit?: number;
}

export interface BrowseRepositoriesRpcRequest extends RpcVersionedRequest {
  sort?: RepositorySortWire;
  page?: number;
  limit?: number;
}

export interface InspectRepositoryRpcRequest extends RpcVersionedRequest {
  repository: { owner: string; name: string };
}

export interface InstallRepositoryRpcRequest extends RpcVersionedRequest {
  repository: { owner: string; name: string };
  selection: { mode: "all" } | { mode: "paths"; paths: string[] };
  acknowledgeHighRiskPaths?: string[];
}

export interface VerifyProvenanceBatchRpcRequest extends RpcVersionedRequest {
  names: string[];
}

export interface ProvenanceBatchFailureWire {
  name: string;
  code: string;
  message: string;
}

export interface InstallSkillRpcRequest extends RpcVersionedRequest {
  repository: { owner: string; name: string };
  skillPath: string;
  acknowledgeHighRisk?: boolean;
}

export interface AssessSkillRiskRpcRequest extends RpcVersionedRequest {
  repository: { owner: string; name: string };
  skillPath: string;
}

export interface ResolveMediaRpcRequest extends RpcVersionedRequest {
  source: MediaSourceWire;
}

export interface VerifyProvenanceRpcRequest extends RpcVersionedRequest {
  name: string;
}

export interface CheckUpdatesRpcRequest extends RpcVersionedRequest {
  names?: string[];
}

export interface UpdateSkillRpcRequest extends RpcVersionedRequest {
  name: string;
  acknowledgeHighRisk?: boolean;
}

export interface ListBackupsRpcRequest extends RpcVersionedRequest {
  name?: string;
}

export interface RollbackSkillRpcRequest extends RpcVersionedRequest {
  name: string;
  backupId: string;
}
export interface DeleteSkillRpcRequest extends RpcVersionedRequest { name: string }
export interface ListTrashRpcRequest extends RpcVersionedRequest {}
export interface RestoreTrashRpcRequest extends RpcVersionedRequest { name: string; trashId: string }
export interface DiscoverExternalRpcRequest extends RpcVersionedRequest { targets?: ExternalSkillTargetWire[] }
export interface ImportExternalRpcRequest extends RpcVersionedRequest { target: ExternalSkillTargetWire; name: string }
export interface ListTargetStatesRpcRequest extends RpcVersionedRequest { names?: string[]; targets?: ExternalSkillTargetWire[] }
export interface SetTargetEnabledRpcRequest extends RpcVersionedRequest { name: string; target: ExternalSkillTargetWire; enabled: boolean }

export interface RpcSuccess<T> {
  schemaVersion: typeof RPC_SCHEMA_VERSION;
  ok: true;
  data: T;
}

export interface RpcFailure {
  schemaVersion: typeof RPC_SCHEMA_VERSION;
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type RpcResponse<T> = RpcSuccess<T> | RpcFailure;

export interface SkillManagerRpcHandlers {
  list(request: ListSkillsRpcRequest): Promise<RpcResponse<{ skills: ManagedSkillWire[] }>>;
  create(request: CreateSkillRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  setEnabled(request: SetEnabledRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  getCapabilities(
    request: GetCapabilitiesRpcRequest
  ): Promise<RpcResponse<{ capabilities: SkillManagerCapabilitiesWire }>>;
  searchRepositories(
    request: SearchRepositoriesRpcRequest
  ): Promise<RpcResponse<{ result: RepositoryQueryResultWire }>>;
  browseRepositories(
    request: BrowseRepositoriesRpcRequest
  ): Promise<RpcResponse<{ result: RepositoryQueryResultWire }>>;
  inspectRepository(
    request: InspectRepositoryRpcRequest
  ): Promise<RpcResponse<RepositoryInspectionResultWire>>;
  installRepository(
    request: InstallRepositoryRpcRequest
  ): Promise<RpcResponse<{ results: RepositoryInstallResultWire[] }>>;
  verifyProvenanceBatch(
    request: VerifyProvenanceBatchRpcRequest
  ): Promise<RpcResponse<{
    results: SkillProvenanceVerificationWire[];
    failures?: ProvenanceBatchFailureWire[];
  }>>;
  installSkill(
    request: InstallSkillRpcRequest
  ): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  assessSkillRisk(
    request: AssessSkillRiskRpcRequest
  ): Promise<RpcResponse<{ assessment: SkillRiskAssessmentWire }>>;
  resolveMedia(
    request: ResolveMediaRpcRequest
  ): Promise<RpcResponse<{ asset: MediaAssetWire }>>;
  verifyProvenance(
    request: VerifyProvenanceRpcRequest
  ): Promise<RpcResponse<{ verification: SkillProvenanceVerificationWire }>>;
  checkUpdates(
    request: CheckUpdatesRpcRequest
  ): Promise<RpcResponse<{ checks: SkillUpdateCheckWire[] }>>;
  update(
    request: UpdateSkillRpcRequest
  ): Promise<RpcResponse<SkillMutationResultWire>>;
  listBackups(
    request: ListBackupsRpcRequest
  ): Promise<RpcResponse<{ backups: SkillBackupWire[] }>>;
  rollback(
    request: RollbackSkillRpcRequest
  ): Promise<RpcResponse<SkillMutationResultWire>>;
  delete(request: DeleteSkillRpcRequest): Promise<RpcResponse<{ deleted: DeletedSkillWire }>>;
  listTrash(request: ListTrashRpcRequest): Promise<RpcResponse<{ trashed: TrashedSkillWire[] }>>;
  restoreTrash(request: RestoreTrashRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  discoverExternal(request: DiscoverExternalRpcRequest): Promise<RpcResponse<{ candidates: ExternalSkillCandidateWire[] }>>;
  importExternal(request: ImportExternalRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
  listTargetStates(request: ListTargetStatesRpcRequest): Promise<RpcResponse<{ states: SkillTargetStateWire[] }>>;
  setTargetEnabled(request: SetTargetEnabledRpcRequest): Promise<RpcResponse<{ skill: ManagedSkillWire }>>;
}

export function createSkillManagerRpcHandlers(
  dependencies: SkillManagerRpcDependencies
): SkillManagerRpcHandlers {
  const {
    manager,
    marketplace,
    provenanceMarketplace = marketplace,
    resolver,
    repositoryDiscovery,
    repositoryInspector,
    snapshotResolver,
    riskAssessor,
    mediaResolver,
    buildId = "dsh-skill-manager@0.0.0"
  } = dependencies;
  return {
    list(request) {
      return runRpc(request, async () => ({ skills: await manager.listSkills() }));
    },

    create(request) {
      return runRpc(request, async () => ({
        skill: await manager.createSkill({
          name: request.name,
          description: request.description
        })
      }));
    },

    setEnabled(request) {
      return runRpc(request, async () => ({
        skill: await manager.setTargetEnabled({
          name: request.name,
          target: "dsh",
          enabled: request.enabled
        })
      }));
    },

    getCapabilities(request) {
      return runRpc(request, async () => ({
        capabilities: {
          protocolVersion: 5,
          buildId,
          features: {
            marketplaceV2: repositoryDiscovery !== undefined && snapshotResolver !== undefined,
            repositoryInspection: repositoryInspector !== undefined,
            mediaProxy: mediaResolver !== undefined,
            indexCatalog: false,
            riskAssessment: riskAssessor !== undefined,
            githubTrending: repositoryDiscovery !== undefined,
            skillClassification: repositoryInspector !== undefined,
            provenanceV2: false,
            updateRiskGate: snapshotResolver !== undefined && riskAssessor !== undefined,
            repositoryBatchAnalysis: snapshotResolver?.resolveRepositorySnapshots !== undefined,
            repositoryBatchInstall: snapshotResolver?.resolveRepositorySnapshots !== undefined,
            batchProvenance: false,
            skillsShDiscoveryHints: false
          }
        }
      }));
    },

    searchRepositories(request) {
      return runRpc(request, async () => ({
        result: await requireV2(repositoryDiscovery, "Repository discovery").searchRepositories({
          query: request.query,
          ...(request.sort === undefined ? {} : { sort: request.sort }),
          ...(request.page === undefined ? {} : { page: request.page }),
          ...(request.limit === undefined ? {} : { limit: request.limit })
        })
      }));
    },

    browseRepositories(request) {
      return runRpc(request, async () => ({
        result: await requireV2(repositoryDiscovery, "Repository discovery").browseRepositories({
          ...(request.sort === undefined ? {} : { sort: request.sort }),
          ...(request.page === undefined ? {} : { page: request.page }),
          ...(request.limit === undefined ? {} : { limit: request.limit })
        })
      }));
    },

    inspectRepository(request) {
      return runRpc(request, async () => await requireV2(repositoryInspector, "Repository inspection").inspectRepository({
          repository: request.repository
        }));
    },

    installSkill(request) {
      return runRpc(request, async () => {
        const resolved = await requireV2(snapshotResolver, "Skill snapshot resolution").resolveSkillSnapshot({
          repository: request.repository,
          skillPath: request.skillPath
        }, { refreshCommit: false });
        const assessment = requireV2(riskAssessor, "Skill risk assessment").assessResolvedSkillRisk(resolved);
        if (assessment.risk === "unknown") {
          throw codedError(
            "SKILL_RISK_UNKNOWN",
            "The final fixed-commit Skill snapshot could not be assessed. Retry before installation."
          );
        }
        if (assessment.risk === "high" && request.acknowledgeHighRisk !== true) {
          throw codedError(
            "SKILL_RISK_CONFIRMATION_REQUIRED",
            "The final fixed-commit Skill snapshot has high-risk findings. Review them and confirm installation again."
          );
        }
        return { skill: await manager.installSkillSnapshot({ resolved }) };
      });
    },

    installRepository(request) {
      return runRpc(request, async () => {
        const resolverPort = requireV2(snapshotResolver, "Skill snapshot resolution");
        if (resolverPort.resolveRepositorySnapshots === undefined) {
          throw codedError("MARKETPLACE_V2_UNAVAILABLE", "Repository batch installation is not configured.");
        }
        const assessor = requireV2(riskAssessor, "Skill risk assessment");
        return await withHardDeadline(async (signal) => {
          const batch = await resolverPort.resolveRepositorySnapshots!({
            repository: request.repository,
            ...(request.selection.mode === "paths" ? { skillPaths: request.selection.paths } : {})
          }, { signal, refreshCommit: false });
          const installed = await manager.listSkills();
          const acknowledged = new Set(request.acknowledgeHighRiskPaths ?? []);
          const results: RepositoryInstallResultWire[] = [];
          for (const failure of batch.failures) {
            results.push({ skillPath: failure.skillPath, status: "failed", error: { code: failure.code, message: failure.message } });
          }
          for (const resolved of batch.snapshots) {
            if (signal.aborted) throw codedError("MARKETPLACE_RESOLUTION_TIMEOUT", "Repository installation exceeded 60000 ms.");
            const existing = installed.find((skill) => skill.source?.kind === "github"
              && skill.source.repositoryId === resolved.repository.repositoryId
              && skill.source.path === resolved.skill.path);
            const assessment = assessor.assessResolvedSkillRisk(resolved);
            if (existing !== undefined) {
              results.push({ skillPath: resolved.skill.path, status: "already-installed", skill: existing, assessment });
              continue;
            }
            if (assessment.risk === "unknown") {
              results.push({
                skillPath: resolved.skill.path,
                status: "failed",
                assessment,
                error: { code: "SKILL_RISK_UNKNOWN", message: "The final fixed-commit Skill snapshot could not be assessed. Retry before installation." }
              });
              continue;
            }
            if (assessment.risk === "high" && !acknowledged.has(resolved.skill.path)) {
              results.push({ skillPath: resolved.skill.path, status: "needs-confirmation", assessment });
              continue;
            }
            try {
              const skill = await manager.installSkillSnapshot({ resolved });
              results.push({ skillPath: resolved.skill.path, status: "installed", skill, assessment });
              installed.push(skill);
            } catch (error) {
              const code = isCodedError(error) && error.code === "SKILL_ALREADY_EXISTS"
                ? "SKILL_NAME_CONFLICT"
                : isCodedError(error) ? error.code : "INSTALL_FAILED";
              const message = code === "SKILL_NAME_CONFLICT"
                ? `A different installed Skill already uses the name "${resolved.skill.name}".`
                : error instanceof Error ? error.message : "Skill installation failed.";
              results.push({ skillPath: resolved.skill.path, status: "failed", assessment, error: { code, message } });
            }
          }
          return { results };
        }, 60_000, "MARKETPLACE_RESOLUTION_TIMEOUT", "Repository installation exceeded 60000 ms.");
      });
    },

    verifyProvenanceBatch(request) {
      return runRpc(request, async () => {
        throw codedError(
          "PROVENANCE_MATCHING_DISABLED",
          "Local-to-GitHub source matching is temporarily disabled to protect the GitHub API allowance."
        );
      });
    },

    assessSkillRisk(request) {
      return runRpc(request, async () => ({
        assessment: await requireV2(riskAssessor, "Skill risk assessment").assessSkillRisk({
          repository: request.repository,
          skillPath: request.skillPath
        })
      }));
    },

    resolveMedia(request) {
      return runRpc(request, async () => ({
        asset: await requireV2(mediaResolver, "Media resolution").resolveMedia(request.source)
      }));
    },

    verifyProvenance(request) {
      return runRpc(request, async () => {
        throw codedError(
          "PROVENANCE_MATCHING_DISABLED",
          "Local-to-GitHub source matching is temporarily disabled to protect the GitHub API allowance."
        );
      });
    },

    checkUpdates(request) {
      return runRpc(request, async () => ({
        checks: await manager.checkUpdates(
          request.names === undefined ? {} : { names: request.names }
        )
      }));
    },

    update(request) {
      return runRpc(request, async () => manager.updateSkill({
        name: request.name,
        ...(request.acknowledgeHighRisk === undefined
          ? {}
          : { acknowledgeHighRisk: request.acknowledgeHighRisk })
      }));
    },

    listBackups(request) {
      return runRpc(request, async () => ({
        backups: await manager.listBackups(
          request.name === undefined ? {} : { name: request.name }
        )
      }));
    },

    rollback(request) {
      return runRpc(request, async () => manager.rollbackSkill({
        name: request.name,
        backupId: request.backupId
      }));
    },
    delete(request) {
      return runRpc(request, async () => ({ deleted: await manager.deleteSkill({ name: request.name }) }));
    },
    listTrash(request) {
      return runRpc(request, async () => ({ trashed: await manager.listTrash() }));
    },
    restoreTrash(request) {
      return runRpc(request, async () => ({
        skill: await manager.restoreTrash({ name: request.name, trashId: request.trashId })
      }));
    },
    discoverExternal(request) {
      return runRpc(request, async () => ({ candidates: await manager.discoverExternalSkills(request.targets === undefined ? {} : { targets: request.targets }) }));
    },
    importExternal(request) {
      return runRpc(request, async () => ({ skill: await manager.importSkill({ target: request.target, name: request.name }) }));
    },
    listTargetStates(request) {
      return runRpc(request, async () => ({ states: await manager.listTargetStates({
        ...(request.names === undefined ? {} : { names: request.names }),
        ...(request.targets === undefined ? {} : { targets: request.targets })
      }) }));
    },
    setTargetEnabled(request) {
      return runRpc(request, async () => ({ skill: await manager.setTargetEnabled({ name: request.name, target: request.target, enabled: request.enabled }) }));
    }
  };
}

async function runRpc<T>(
  request: RpcVersionedRequest,
  operation: () => Promise<T>
): Promise<RpcResponse<T>> {
  if (request.schemaVersion !== RPC_SCHEMA_VERSION) {
    return failure(
      "UNSUPPORTED_SCHEMA_VERSION",
      `Unsupported RPC schema version "${String(request.schemaVersion)}".`
    );
  }

  try {
    return {
      schemaVersion: RPC_SCHEMA_VERSION,
      ok: true,
      data: await operation()
    };
  } catch (error) {
    if (isCodedError(error)) {
      return failure(error.code, error.message);
    }
    return failure("INTERNAL_ERROR", "Skill Manager operation failed.");
  }
}

function isCodedError(error: unknown): error is Error & { code: string } {
  return error instanceof Error
    && typeof (error as Error & { code?: unknown }).code === "string";
}

function codedError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function requireV2<T>(value: T | undefined, label: string): T {
  if (value !== undefined) return value;
  throw codedError("MARKETPLACE_V2_UNAVAILABLE", `${label} is not configured.`);
}

function provenanceHintEntry(
  skillName: string,
  hint: { repository: string; path: string | null }
): MarketplaceEntryWire {
  const [owner = "", name = ""] = hint.repository.split("/");
  const url = `https://github.com/${owner}/${name}`;
  return {
    id: `${owner}/${name}/${skillName}`,
    source: "github",
    catalogs: ["github"],
    name: skillName,
    description: null,
    publisher: { name: owner, url: `https://github.com/${owner}` },
    author: null,
    repository: { host: "github", owner, name, path: hint.path, url },
    skillUrl: hint.path === null ? url : `${url}/tree/HEAD/${hint.path}`,
    install: { kind: "github", repository: `${owner}/${name}`, skill: skillName, path: hint.path },
    metrics: { installs: null, stars: null, downloads: null },
    cover: { kind: "generated", seed: `${owner}/${name}#${hint.path ?? skillName}` }
  };
}

function limitProvenanceCandidateEntries(entries: MarketplaceEntryWire[]): MarketplaceEntryWire[] {
  const repositories = new Set<string>();
  const identities = new Set<string>();
  const accepted: MarketplaceEntryWire[] = [];
  for (const entry of entries) {
    const repository = `${entry.repository.owner}/${entry.repository.name}`.toLocaleLowerCase();
    const identity = `${repository}#${entry.repository.path ?? entry.install.skill}`;
    if (identities.has(identity)) continue;
    if (!repositories.has(repository) && repositories.size >= 8) continue;
    repositories.add(repository);
    identities.add(identity);
    accepted.push(entry);
    if (accepted.length >= 20) break;
  }
  return accepted;
}

async function resolveProvenanceCandidates(
  candidates: MarketplaceEntryWire[],
  resolver: MarketplaceResolverPort,
  snapshotResolver: SnapshotResolverPort | undefined,
  signal: AbortSignal,
  skillName: string
): Promise<ResolvedMarketplaceEntryWire[]> {
  if (snapshotResolver?.resolveRepositorySnapshots !== undefined) {
    const repositories = new Map<string, MarketplaceEntryWire>();
    for (const candidate of candidates) {
      const key = `${candidate.repository.owner}/${candidate.repository.name}`.toLocaleLowerCase();
      if (!repositories.has(key)) repositories.set(key, candidate);
    }
    const resolved: ResolvedMarketplaceEntryWire[] = [];
    let nextRepository = 0;
    const values = [...repositories.values()];
    const worker = async () => {
      while (!signal.aborted) {
        const candidate = values[nextRepository++];
        if (candidate === undefined) return;
        try {
          const batch = await snapshotResolver.resolveRepositorySnapshots!({
            repository: { owner: candidate.repository.owner, name: candidate.repository.name }
          }, { signal });
          for (const snapshot of batch.snapshots) {
            if (snapshot.skill.name === skillName) {
              resolved.push(toProvenanceResolvedEntry(candidate, snapshot));
            }
          }
        } catch (error) {
          if (signal.aborted) throw error;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, values.length) }, () => worker()));
    if (signal.aborted) {
      throw codedError("MARKETPLACE_RESOLUTION_TIMEOUT", "GitHub provenance verification exceeded 30000 ms.");
    }
    return resolved;
  }
  const resolved: ResolvedMarketplaceEntryWire[] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const candidate = candidates[nextIndex++];
      if (candidate === undefined) return;
      try {
        const entry = await resolver.resolve(candidate, { signal });
        if (entry.name === skillName) resolved.push(entry);
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, candidates.length) }, () => worker()));
  if (signal.aborted) {
    throw codedError("MARKETPLACE_RESOLUTION_TIMEOUT", "GitHub provenance verification exceeded 30000 ms.");
  }
  return resolved;
}

function toProvenanceResolvedEntry(
  candidate: MarketplaceEntryWire,
  snapshot: ResolvedSkillSnapshotWire
): ResolvedMarketplaceEntryWire {
  const repository = snapshot.repository;
  const skill = snapshot.skill;
  const slug = `${repository.owner}/${repository.name}`;
  const url = repository.url;
  return {
    ...candidate,
    id: `${slug}/${skill.name}`,
    source: "github",
    catalogs: [...new Set<MarketplaceEntryWire["catalogs"][number]>(["github", ...candidate.catalogs])],
    name: skill.name,
    description: skill.description,
    publisher: { name: repository.owner, url: `https://github.com/${repository.owner}` },
    author: skill.author,
    repository: {
      host: "github",
      id: repository.repositoryId,
      nodeId: repository.nodeId,
      owner: repository.owner,
      name: repository.name,
      path: skill.path,
      url
    },
    skillUrl: skill.path === "." ? `${url}/blob/${snapshot.snapshot.commitSha}/SKILL.md` : `${url}/tree/${snapshot.snapshot.commitSha}/${skill.path}`,
    install: { kind: "github", repository: slug, skill: skill.name, path: skill.path },
    metrics: {
      ...candidate.metrics,
      stars: { value: repository.stars, source: "github", scope: "repository" }
    },
    snapshot: {
      commitSha: snapshot.snapshot.commitSha,
      blobSha: snapshot.snapshot.skillDocumentBlobSha,
      fetchedAt: new Date().toISOString(),
      ...(skill.manifestFiles.length === 0 ? {} : { manifestFiles: skill.manifestFiles })
    }
  };
}

function createProvenanceDeadline(): { signal: AbortSignal; race<T>(operation: Promise<T>): Promise<T>; dispose(): void } {
  const controller = new AbortController();
  let rejectDeadline: (error: Error & { code: string }) => void = () => undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    rejectDeadline(codedError("MARKETPLACE_RESOLUTION_TIMEOUT", "GitHub provenance verification exceeded 30000 ms."));
  }, 30_000);
  return {
    signal: controller.signal,
    race: <T>(operation: Promise<T>) => Promise.race([operation, expiry]),
    dispose: () => clearTimeout(timer)
  };
}

async function withHardDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  code: string,
  message: string
): Promise<T> {
  const controller = new AbortController();
  let rejectDeadline: (error: Error & { code: string }) => void = () => undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    rejectDeadline(codedError(code, message));
  }, timeoutMs);
  try {
    return await Promise.race([operation(controller.signal), expiry]);
  } finally {
    clearTimeout(timer);
  }
}

function failure(code: string, message: string): RpcFailure {
  return {
    schemaVersion: RPC_SCHEMA_VERSION,
    ok: false,
    error: { code, message }
  };
}
