import type { SkillClassification } from "./skill-classification.js";

export type MarketplaceSourceKind = "skills-sh" | "github" | "hugging-face";

export type RepositoryKey = `github:${string}/${string}`;
export type SkillKey = `github:${string}/${string}#${string}`;

export type RepositorySort = "popular" | "latest" | "trend-weekly" | "trend-monthly" | "relevance";

export type RepositorySourceState = "live" | "cached" | "unavailable" | "empty";

export interface RepositoryTrend {
  weeklyStars: number | null;
  monthlyStars: number | null;
  observedAt: string;
  source: "github-trending-html";
  stale: boolean;
}

export interface DiscoverySignal {
  source: MarketplaceSourceKind | "index";
  kind: "format-topic" | "metadata" | "registry" | "index" | "ordinary-search";
  label: string;
}

export type MediaSource =
  | { type: "repo-blob"; repo: RepositoryKey; commit: string; path: string }
  | { type: "github-avatar"; owner: string; accountId: number }
  | { type: "github-social-preview"; repo: RepositoryKey }
  | { type: "generated"; seed: string };

export interface MediaAsset {
  source: MediaSource;
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  width: number;
  height: number;
}

export interface MediaResolver {
  resolveMedia(source: MediaSource, request?: { signal?: AbortSignal }): Promise<MediaAsset>;
}

export interface RepositoryCandidate {
  repositoryId: number;
  nodeId: string;
  repoKey: RepositoryKey;
  host: "github";
  owner: string;
  ownerId: number;
  ownerType: "User" | "Organization" | "Bot";
  ownerAvatar: MediaSource;
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
  classification: SkillClassification;
  trend: RepositoryTrend | null;
  cover: MediaSource;
  discovery: {
    signals: DiscoverySignal[];
    discoveredAt: string;
  };
}

export interface RepositoryQueryRequest {
  query?: string;
  sort?: RepositorySort;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface RepositoryQueryResult {
  source: "github";
  query: string | null;
  sort: RepositorySort;
  page: number;
  returnedCount: number;
  total: number;
  hasMore: boolean;
  incomplete: boolean;
  dataUpdatedAt: string;
  sourceState: RepositorySourceState;
  sourceMessage: string | null;
  repositories: RepositoryCandidate[];
}

export interface DiscoveryProvider {
  searchRepositories(request: RepositoryQueryRequest): Promise<RepositoryQueryResult>;
  browseRepositories(request?: RepositoryQueryRequest): Promise<RepositoryQueryResult>;
}

export type SkillStructureStatus = "invalid" | "parsed" | "structure-verified";

export interface SkillDescriptor {
  skillKey: SkillKey;
  repositoryId: number;
  path: string;
  name: string;
  description: string;
  classification: SkillClassification;
  author: MarketplaceParty | null;
  structureStatus: SkillStructureStatus;
  validatedAtCommit: string;
  skillDocumentBlobSha: string;
  manifestFiles: string[];
  installable: boolean;
  warnings: string[];
}

export interface RepositoryReadme {
  path: string;
  title: string | null;
  content: string;
  blobSha: string;
}

export interface RepositoryInspection {
  repository: RepositoryCandidate;
  inspectionCommit: string;
  inspectedAt: string;
  status: "inspected" | "structure-verified";
  readme: RepositoryReadme | null;
  manifestPaths: string[];
  declaredSkillPaths: string[];
  skills: SkillDescriptor[];
  media: MediaSource[];
  warnings: string[];
}

export interface RepositoryInspectionRequest {
  repository: { owner: string; name: string };
  signal?: AbortSignal;
}

export interface RepositoryInspector {
  inspectRepository(request: RepositoryInspectionRequest): Promise<RepositoryInspection>;
}

export interface InstallSkillIntent {
  repository: { owner: string; name: string };
  skillPath: string;
}

export interface MarketplaceSkillSnapshot {
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
}

export interface ResolvedSkillSnapshot {
  repository: RepositoryCandidate;
  skill: SkillDescriptor;
  snapshot: MarketplaceSkillSnapshot;
  files: Array<{ path: string; content: Uint8Array }>;
}

export interface RepositorySnapshotFailure {
  skillPath: string;
  code: string;
  message: string;
}

export interface RepositorySnapshotResolution {
  inspection: RepositoryInspection;
  snapshots: ResolvedSkillSnapshot[];
  failures: RepositorySnapshotFailure[];
}

export interface SnapshotResolver {
  resolveSkillSnapshot(
    intent: InstallSkillIntent,
    request?: MarketplaceResolveRequest
  ): Promise<ResolvedSkillSnapshot>;
  resolveRepositorySnapshots?(
    intent: { repository: { owner: string; name: string }; skillPaths?: string[] },
    request?: MarketplaceResolveRequest
  ): Promise<RepositorySnapshotResolution>;
}

export interface RiskFinding {
  code: string;
  severity: "info" | "warning" | "high";
  title: string;
  detail: string;
  file: string;
}

export interface SkillRiskAssessment {
  risk: "unknown" | "low" | "medium" | "high";
  findings: RiskFinding[];
  scannerVersion: string;
}

export interface SkillRiskAssessor {
  assessSkillRisk(
    intent: InstallSkillIntent,
    request?: MarketplaceResolveRequest
  ): Promise<SkillRiskAssessment>;
  assessResolvedSkillRisk(snapshot: ResolvedSkillSnapshot): SkillRiskAssessment;
}

export interface MarketplaceSourceStatus {
  source: MarketplaceSourceKind;
  status: "available" | "unavailable";
  returnedCount: number;
  error: {
    code: MarketplaceSourceErrorCode;
    message: string;
  } | null;
}

export interface MarketplaceParty {
  name: string;
  url: string | null;
}

export interface MarketplaceRepository {
  host: "github";
  owner: string;
  name: string;
  path: string | null;
  url: string;
}

export interface MarketplaceEntry {
  id: string;
  source: MarketplaceSourceKind;
  catalogs: MarketplaceSourceKind[];
  name: string;
  description: string | null;
  publisher: MarketplaceParty | null;
  author: MarketplaceParty | null;
  repository: MarketplaceRepository;
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

export interface MarketplaceSearchRequest {
  query: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface MarketplaceSearchResult {
  source: MarketplaceSourceKind | "composite";
  query: string;
  returnedCount: number;
  entries: MarketplaceEntry[];
  sources: MarketplaceSourceStatus[];
}

export interface MarketplaceBrowseRequest {
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface MarketplaceBrowseResult {
  source: "skills-sh";
  ranking: "all-time-installs";
  offset: number;
  returnedCount: number;
  total: number;
  hasMore: boolean;
  entries: MarketplaceEntry[];
}

export interface MarketplaceSource {
  search(request: MarketplaceSearchRequest): Promise<MarketplaceSearchResult>;
}

export interface MarketplaceBrowser {
  browse(request?: MarketplaceBrowseRequest): Promise<MarketplaceBrowseResult>;
}

export interface ResolvedMarketplaceRepository extends MarketplaceRepository {
  id: number;
  nodeId: string;
  path: string;
}

export interface ResolvedMarketplaceEntry extends Omit<
  MarketplaceEntry,
  "description" | "repository" | "install"
> {
  description: string;
  repository: ResolvedMarketplaceRepository;
  install: MarketplaceEntry["install"] & { path: string };
  snapshot: {
    commitSha: string;
    blobSha: string;
    fetchedAt: string;
    manifestFiles?: string[];
  };
}

export interface MarketplaceResolveRequest {
  signal?: AbortSignal;
  refreshCommit?: boolean;
}

export interface GitHubMarketplaceResolver {
  resolve(
    entry: MarketplaceEntry,
    request?: MarketplaceResolveRequest
  ): Promise<ResolvedMarketplaceEntry>;
}

export type MarketplaceFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export class MarketplaceSourceError extends Error {
  constructor(
    public readonly code: MarketplaceSourceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "MarketplaceSourceError";
  }
}

export type MarketplaceSourceErrorCode =
  | "INVALID_MARKETPLACE_QUERY"
  | "INVALID_MARKETPLACE_LIMIT"
  | "INVALID_MARKETPLACE_TIMEOUT"
  | "MARKETPLACE_ABORTED"
  | "MARKETPLACE_TIMEOUT"
  | "MARKETPLACE_FETCH_FAILED"
  | "MARKETPLACE_HTTP_ERROR"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_SEARCH_INCOMPLETE"
  | "INVALID_MARKETPLACE_RESPONSE";

export class MarketplaceResolverError extends Error {
  constructor(
    public readonly code: MarketplaceResolverErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "MarketplaceResolverError";
  }
}

export type MarketplaceResolverErrorCode =
  | "INVALID_MARKETPLACE_ENTRY"
  | "INVALID_MARKETPLACE_RESOLUTION_TIMEOUT"
  | "MARKETPLACE_RESOLUTION_ABORTED"
  | "MARKETPLACE_RESOLUTION_TIMEOUT"
  | "MARKETPLACE_RESOLUTION_FETCH_FAILED"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_HTTP_ERROR"
  | "INVALID_GITHUB_RESPONSE"
  | "GITHUB_TREE_TRUNCATED"
  | "GITHUB_SKILL_NOT_FOUND"
  | "GITHUB_SKILL_AMBIGUOUS"
  | "INVALID_SKILL_DOCUMENT";
