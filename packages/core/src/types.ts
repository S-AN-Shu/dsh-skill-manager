import type {
  MarketplaceFetch,
  MarketplaceSourceKind,
  ResolvedSkillSnapshot,
  ResolvedMarketplaceEntry
} from "./marketplace/types.js";
import type { GitHubSkillIndex } from "./github-skill-index.js";
import type { SkillIdentityFingerprint } from "./skill-fingerprint.js";
import type { SkillRiskAssessor, SnapshotResolver, SkillRiskAssessment } from "./marketplace/types.js";
import type { GitHubSnapshotCache } from "./marketplace/github-snapshot-cache.js";

export type SkillOrigin = "self" | "local-import" | "github" | "skills-sh" | "hugging-face";

export type SkillTarget = "dsh" | "codex" | "claude" | "agents" | "opencode";
export type ExternalSkillTarget = Exclude<SkillTarget, "dsh">;

export interface SkillManagerOptions {
  root: string;
  dshRoot?: string;
  fetch?: MarketplaceFetch;
  marketplaceTimeoutMs?: number;
  now?: () => Date;
  targetRoots?: Partial<Record<ExternalSkillTarget, string>>;
  githubSkillIndex?: GitHubSkillIndex;
  snapshotCache?: GitHubSnapshotCache;
  snapshotResolver?: SnapshotResolver;
  riskAssessor?: SkillRiskAssessor;
}

export interface CreateSkillRequest {
  name: string;
  description: string;
}

export interface SetTargetEnabledRequest {
  name: string;
  target: SkillTarget;
  enabled: boolean;
}

export type SkillTargetStatus = "not-configured" | "not-linked" | "linked" | "conflict";

export interface ListTargetStatesRequest {
  names?: string[];
  targets?: ExternalSkillTarget[];
}

export interface SkillTargetState {
  name: string;
  target: ExternalSkillTarget;
  status: SkillTargetStatus;
}

export interface DiscoverExternalSkillsRequest {
  targets?: ExternalSkillTarget[];
}

export interface ExternalSkillCandidate {
  name: string;
  description: string;
  contentHash: string;
  target: ExternalSkillTarget;
}

export interface ImportSkillRequest {
  name: string;
  target: ExternalSkillTarget;
}

export interface InstallMarketplaceSkillRequest {
  entry: ResolvedMarketplaceEntry;
  signal?: AbortSignal;
}

export interface InstallSkillSnapshotRequest {
  resolved: ResolvedSkillSnapshot;
}

export interface VerifyMarketplaceProvenanceRequest {
  name: string;
  entries: ResolvedMarketplaceEntry[];
  signal?: AbortSignal;
}

export interface SkillProvenanceHint {
  repository: string;
  path: string | null;
}

export type SkillProvenanceVerificationStatus = "matched" | "custom" | "ambiguous" | "ineligible";

export interface SkillProvenanceVerification {
  name: string;
  status: SkillProvenanceVerificationStatus;
  skill: ManagedSkill;
}

export interface CheckUpdatesRequest {
  names?: string[];
  signal?: AbortSignal;
}

export interface UpdateSkillRequest {
  name: string;
  acknowledgeHighRisk?: boolean;
  signal?: AbortSignal;
}

export interface ListSkillBackupsRequest {
  name?: string;
}

export interface RollbackSkillRequest {
  name: string;
  backupId: string;
}

export interface DeleteSkillRequest {
  name: string;
}

export interface DeletedSkill {
  name: string;
  trashId: string;
  deletedAt: string;
}

export interface TrashedSkill {
  name: string;
  trashId: string;
  description: string;
  origin: SkillOrigin;
  enabledTargets: SkillTarget[];
  deletedAt: string;
  expiresAt: string;
}

export interface RestoreTrashRequest {
  name: string;
  trashId: string;
}

export type SkillUpdateStatus =
  | "unsupported"
  | "local-modified"
  | "source-moved"
  | "up-to-date"
  | "update-available";

export interface SkillSnapshot {
  commitSha: string;
  blobSha: string;
  bundleHash: string;
}

export interface SkillUpdateCheck {
  name: string;
  status: SkillUpdateStatus;
  installed: SkillSnapshot | null;
  latest: SkillSnapshot | null;
  latestRisk: SkillRiskAssessment | null;
  checkedAt: string;
}

export type SkillBackupReason = "update" | "rollback";

export interface SkillBackup {
  id: string;
  name: string;
  createdAt: string;
  reason: SkillBackupReason;
  contentHash: string;
  snapshot: SkillSnapshot | null;
}

export interface SkillMutationResult {
  skill: ManagedSkill;
  backup: SkillBackup;
}

export interface LocalImportSkillSource {
  kind: "local-import";
  name: string;
  target: ExternalSkillTarget;
}

export interface GitHubSkillSource {
  kind: "github";
  repository: string;
  path: string;
  commitSha: string;
  blobSha: string;
  bundleHash: string;
  manifestFiles?: string[];
  catalog: MarketplaceSourceKind;
  url: string;
  repositoryId?: number;
  nodeId?: string;
  matchMethod?: "install" | "exact-content";
  matchedAt?: string;
  identityFingerprint?: SkillIdentityFingerprint;
  discoverySources?: MarketplaceSourceKind[];
}

export type SkillSource = LocalImportSkillSource | GitHubSkillSource;

export type SkillProvenanceCheckStatus = "no-match" | "custom" | "ambiguous" | "ineligible";

export interface SkillProvenanceCheck {
  status: SkillProvenanceCheckStatus;
  checkedAt: string;
}

export interface ManagedSkill {
  name: string;
  description: string;
  origin: SkillOrigin;
  enabledTargets: SkillTarget[];
  createdAt: string;
  updatedAt: string;
  contentHash: string;
  source?: SkillSource;
  provenanceCheck?: SkillProvenanceCheck;
}

export interface StoredSkill extends ManagedSkill {
  content: string;
}

export interface SkillManager {
  createSkill(request: CreateSkillRequest): Promise<ManagedSkill>;
  getSkill(name: string): Promise<StoredSkill | undefined>;
  listSkills(): Promise<ManagedSkill[]>;
  discoverExternalSkills(request?: DiscoverExternalSkillsRequest): Promise<ExternalSkillCandidate[]>;
  importSkill(request: ImportSkillRequest): Promise<ManagedSkill>;
  installMarketplaceSkill(request: InstallMarketplaceSkillRequest): Promise<ManagedSkill>;
  installSkillSnapshot(request: InstallSkillSnapshotRequest): Promise<ManagedSkill>;
  getProvenanceHints(name: string): Promise<SkillProvenanceHint[]>;
  verifyMarketplaceProvenance(
    request: VerifyMarketplaceProvenanceRequest
  ): Promise<SkillProvenanceVerification>;
  checkUpdates(request?: CheckUpdatesRequest): Promise<SkillUpdateCheck[]>;
  updateSkill(request: UpdateSkillRequest): Promise<SkillMutationResult>;
  listBackups(request?: ListSkillBackupsRequest): Promise<SkillBackup[]>;
  rollbackSkill(request: RollbackSkillRequest): Promise<SkillMutationResult>;
  deleteSkill(request: DeleteSkillRequest): Promise<DeletedSkill>;
  listTrash(): Promise<TrashedSkill[]>;
  restoreTrash(request: RestoreTrashRequest): Promise<ManagedSkill>;
  listTargetStates(request?: ListTargetStatesRequest): Promise<SkillTargetState[]>;
  setTargetEnabled(request: SetTargetEnabledRequest): Promise<ManagedSkill>;
}
