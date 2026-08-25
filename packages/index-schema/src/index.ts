export const INDEX_SCHEMA_VERSION = 1 as const;

export interface CatalogMeta {
  schemaVersion: typeof INDEX_SCHEMA_VERSION;
  generatedAt: string;
  generatorVersion: string;
  repositoryCount: number;
  skillCount: number;
  files: {
    repositories: { path: "repositories.jsonl.gz"; sha256: string; bytes: number };
    skills: { path: "skills.jsonl.gz"; sha256: string; bytes: number };
  };
}

export interface IndexDiscoverySignal {
  source: "github" | "skills-sh" | "hugging-face" | "curated";
  kind: "format-topic" | "metadata" | "registry" | "manifest" | "curated";
  label: string;
}

export type IndexMediaReference =
  | { type: "repo-blob"; commit: string; path: string }
  | { type: "github-avatar"; owner: string }
  | { type: "github-social-preview" }
  | { type: "generated"; seed: string };

export interface RepositoryIndexRecord {
  schemaVersion: typeof INDEX_SCHEMA_VERSION;
  repoKey: `github:${string}/${string}`;
  repositoryId: number;
  nodeId: string;
  owner: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  headCommit: string;
  stars: number;
  forks: number;
  topics: string[];
  archived: boolean;
  updatedAt: string;
  pushedAt: string;
  discoveredAt: string;
  discoverySignals: IndexDiscoverySignal[];
  knownSkillCount: number;
  media: IndexMediaReference[];
}

export interface SkillIndexRecord {
  schemaVersion: typeof INDEX_SCHEMA_VERSION;
  skillKey: `github:${string}/${string}#${string}`;
  repoKey: RepositoryIndexRecord["repoKey"];
  path: string;
  name: string;
  description: string;
  author: string | null;
  validatedAtCommit: string;
  skillDocumentBlobSha: string;
  indexedAt: string;
  risk: "unknown" | "low" | "medium" | "high";
  riskScannerVersion: string | null;
  media: IndexMediaReference[];
}

export function isSupportedCatalogMeta(value: unknown): value is CatalogMeta {
  return typeof value === "object" && value !== null
    && (value as { schemaVersion?: unknown }).schemaVersion === INDEX_SCHEMA_VERSION;
}
