# API Specification

## Protocol 5 Repository Batch Additions

The request/response envelope remains schema version `1`; Marketplace capability protocol is `5`. The Client requires repository batch analysis/install and the Marketplace/risk/media/classification features. Local provenance discovery is paused: `provenanceV2`, `batchProvenance`, and `skillsShDiscoveryHints` are reported as `false` and are not market initialization requirements.

`verifyProvenance` and `verifyProvenanceBatch` remain registered for Protocol 5 wire compatibility, but both immediately return `PROVENANCE_MATCHING_DISABLED` and perform no marketplace discovery or GitHub request. The historical request schemas remain strict. GitHub update support is available only when trusted provenance was written by a source-aware market/Host installation or already exists in the manager registry.

`checkUpdates` adds `source-moved` and `latestRisk` to each result. `update` accepts `{ schemaVersion: 1, name, acknowledgeHighRisk?: boolean }`. The browser cannot submit commits, repository paths, hashes, snapshots, or risk results. Host resolves repository rename/transfer by numeric ID, refreshes the final fixed commit, validates the complete snapshot, and repeats risk scanning. High/unknown risk returns `SKILL_UPDATE_RISK_CONFIRMATION_REQUIRED` until a manual second request sets `acknowledgeHighRisk: true`; automatic maintenance never sends it.

## Protocol

The public `skillManager` namespace uses request/response envelope schema version `1`. Marketplace capability protocol version is `5`; protocol-3 ranking sort strings remain wire-compatible fields inside Protocol 5. Every public Host request is strictly validated and returns either:

```ts
{ schemaVersion: 1; ok: true; data: T }
{ schemaVersion: 1; ok: false; error: { code: string; message: string } }
```

The public surface has 24 methods. Marketplace V2 directly replaces the former `searchMarketplace`, `browseMarketplace`, `resolveMarketplace`, and `installMarketplace` methods; those names are not registered by the current Host or client descriptors. The new public methods are `installRepository` and `verifyProvenanceBatch`; the legacy one-Skill methods remain supported and delegate to the repository-aware implementation.

## Marketplace V2

### `getCapabilities`

Request:

```ts
{ schemaVersion: 1 }
```

Response data:

```ts
interface SkillManagerCapabilities {
  protocolVersion: 5;
  buildId: string;
  features: {
    marketplaceV2: boolean;
    repositoryInspection: boolean;
    mediaProxy: boolean;
    indexCatalog: boolean;
    riskAssessment: boolean;
    githubTrending: boolean;
    skillClassification: boolean;
    provenanceV2: false;
    updateRiskGate: boolean;
    repositoryBatchAnalysis: boolean;
    repositoryBatchInstall: boolean;
    batchProvenance: false;
    skillsShDiscoveryHints: false;
  };
}
```

The Client calls this before any market request. A missing method or required feature is shown as an actionable Desktop restart message rather than a later HTTP 404.

### `browseRepositories`

```ts
{
  schemaVersion: 1;
  sort?: "popular" | "latest" | "trend-weekly" | "trend-monthly" | "relevance";
  page?: number;
  limit?: number;
}
```

Returns GitHub `RepositoryCandidate[]`. Browse performs one repository-search request and does not load README, Tree, manifests, `SKILL.md`, media blobs, or bundle hashes.

HTML-only Trending candidates may carry `repositoryId: 0` and `ownerId: 0` to mean that numeric GitHub identity has not been inspected. These sentinels are list metadata only. Inspection replaces them with authoritative GitHub metadata before any trusted detail/install operation. Repository REST search uses a 25-second overall abort-aware deadline.

### `searchRepositories`

```ts
{
  schemaVersion: 1;
  query: string;
  sort?: "popular" | "latest" | "trend-weekly" | "trend-monthly" | "relevance";
  page?: number;
  limit?: number;
}
```

Searches repository name, description, and Topics. Format Topics contribute discovery signals and browse seeding. Selecting a UI category dispatches a new bounded GitHub repository search using a category-plus-`skill` query; it no longer filters only the current loaded page. Category matches still produce repository candidates and never skip fixed-commit Inspection.

The Client exposes `近期热度榜 | 历史热门 | 最新 | 相关度`, opens `trend-monthly` by default, switches to `relevance` after a keyword search, and restores recent heat after the search is cleared. `trend-weekly` remains accepted on the wire for protocol-3 compatibility but is not a separate Client control. `latest` adds a Host-computed `created:>=YYYY-MM-DD` qualifier for the rolling 60-day window and sorts by Stars; it never uses `updated_at` as a trend signal.

`trend-weekly` and `trend-monthly` are Host-owned experimental GitHub Trending HTML providers. They parse only `github.com/trending?since=weekly|monthly` and keep repositories with strong Skill signals. Recent-heat listing performs exactly those two HTML reads and no per-card GitHub REST metadata request; real metadata is loaded later by Inspection. A monthly request merges both snapshots: repositories with monthly metrics rank first by monthly growth, matching weekly growth is retained, and weekly-only candidates follow in weekly-growth order. Results carry `sourceState: live | cached | unavailable | empty`; a 30-minute cache and at most 24-hour stale cache are used, and unavailable data is not presented as an empty or update-time ranking.

Host marketplace transport retries only idempotent GET failures with codes `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EPIPE`, `EAI_AGAIN`, or `UND_ERR_CONNECT_TIMEOUT`, using two short delays while preserving abort/deadline behavior. Persistent failure remains an explicit RPC error or unavailable source state.

Repository candidates include only metadata-level classification. After Inspection, each `SkillDescriptor` receives a deterministic 12-category classification from `SKILL.md`, `skills.json`, Topics, name/description, and a bounded README summary. Classification evidence never grants installation or safety authority.

### `inspectRepository`

```ts
{
  schemaVersion: 1;
  repository: { owner: string; name: string };
}
```

The Host resolves one `inspectionCommit`, then reads README, supported manifests, the fixed-commit Tree, and discovered `SKILL.md` frontmatter. The result contains one repository inspection and zero or more `SkillDescriptor` values. README is repository documentation, not a Skill description or installation authorization. After returning the inspection, Host may populate the verified fingerprint index with at most two background workers; this optimization cannot grant provenance without later fixed-commit revalidation.

Supported discovery manifests:

1. `.codex-plugin/plugin.json`
2. `.agents/plugins/marketplace.json`
3. `.claude-plugin/marketplace.json`
4. `.claude-plugin/plugin.json`
5. `skills.json`
6. known Skill directories
7. bounded Tree fallback

A valid target `SKILL.md` remains required for structure verification.

### `installSkill`

```ts
{
  schemaVersion: 1;
  repository: { owner: string; name: string };
  skillPath: string;
}
```

This request expresses user intent only. Unknown fields are rejected, including client-provided commit, blob SHA, bundle hash, local path, or a claimed verified snapshot.

The Host re-inspects the repository, fixes one current commit, verifies the selected descriptor, and builds a Host-owned `ResolvedSkillSnapshot` containing the repository identity, `SkillDescriptor`, immutable file metadata, bundle fingerprint, and verified file bytes. Core independently checks snapshot identity, byte lengths, Git blob SHA values, the complete Tree fingerprint, paths, and frontmatter before staging to a temporary directory and atomically committing the registry. The Host also runs the static risk scanner synchronously against this final resolved snapshot before invoking Core. `acknowledgeHighRisk: true` is accepted only as user confirmation of that Host-produced high-risk result; it cannot supply or override commit, file, hash, path, or risk evidence.

For a root `SKILL.md`, the implicit bundle is limited to `SKILL.md`, `scripts/**`, `references/**`, and `assets/**`. A fixed-commit manifest may explicitly include additional safe existing root files. Files named `AGENTS.md` or `CLAUDE.md` are rejected at every bundle depth and can never enter through that exception.

### `installRepository`

```ts
{
  schemaVersion: 1;
  repository: { owner: string; name: string };
  selection: { mode: "all" } | { mode: "paths"; paths: string[] };
  acknowledgeHighRiskPaths?: string[];
}
```

The Host first reuses a recent Host-owned repository resolution produced by Inspection when it is still inside the one-hour cache window; otherwise it resolves the current repository commit. It then constructs one batch of fixed-commit snapshots. It never trusts a client-supplied commit, hash, snapshot, or local path. Each result is isolated as `installed`, `already-installed`, `needs-confirmation`, or `failed`. Existing installation identity is exact numeric repository ID plus Skill path; same-name, different-source entries return `SKILL_NAME_CONFLICT`. Unknown risk remains blocked, high risk requires a per-path acknowledgement, and the complete operation has a 60-second hard deadline.

### `verifyProvenanceBatch`

```ts
{ schemaVersion: 1; names: string[] } // 1..20 names

type ResponseData = {
  results: SkillProvenanceVerification[];
  failures?: Array<{ name: string; code: string; message: string }>;
};
```

This endpoint is currently disabled and returns `PROVENANCE_MATCHING_DISABLED` without starting workers, search, skills.sh, or GitHub traffic. It is retained only so a mixed or stale Protocol 5 Client receives a stable error instead of a missing-method failure. The current Client does not expose the action.

### `assessSkillRisk`

Accepts the same user-intent shape as `installSkill`. It statically reports `unknown | low | medium | high` plus findings for scripts, network references, credentials/sensitive paths, tool calls, and destructive patterns. Findings contain category metadata and paths, not Skill contents or local paths. High risk requires a second Client confirmation; integrity validation is never presented as absolute content safety.

The detail-page assessment is advisory and may reuse the prepared fixed-commit repository cache. `installSkill` repeats assessment against its freshly resolved final snapshot, so a prior UI result cannot bypass the pre-write gate.

### `resolveMedia`

The Host accepts structured GitHub media identities only: fixed-commit repository blobs, GitHub avatars, social previews, or local generated cards. It enforces HTTPS, redirect refusal, raster MIME/type agreement, byte, dimension, and decoded-pixel limits; SVG and arbitrary URLs are rejected. The current RPC returns a bounded data URL, so HTTP response-header claims such as `nosniff` do not apply.

## Local Management RPC

- `list`: list managed Skills.
- `create`: create a validated self-authored bundle.
- `setEnabled`: enable or disable the DSH target.
- `verifyProvenance`: grant provenance only after exact complete-bundle identity.
- `checkUpdates`: report unsupported, locally modified, current, or update-available state.
- `update`: re-resolve, verify, back up, and atomically replace one Skill.
- `listBackups`: list persistent opaque backup records.
- `rollback`: restore one backup after current-bundle integrity checks.
- `delete`: remove manager-owned links and move the complete canonical bundle plus registry metadata into a recoverable trash snapshot.
- `listTrash`: list recoverable deletion metadata without returning Host filesystem paths or Skill contents.
- `restoreTrash`: restore one opaque trash id only after bundle hash, metadata, registry name, library path, and every original target path pass conflict checks.
- `discoverExternal`: metadata-only scan of configured Agent roots.
- `importExternal`: explicitly import one validated direct-child Skill.
- `listTargetStates`: report per-Skill external link states.
- `setTargetEnabled`: create or remove one manager-owned target link.

Browser requests never submit filesystem roots or source paths.

Valid manager-owned trash is retained for 30 days and opportunistically purged during normal Core operations. Invalid or hash-damaged trash is not silently deleted or restored. The Client exposes the valid records under `最近删除`; automatic update checks and updates are local opt-in preferences and do not add new Host mutation authority. Automatic provenance matching is currently unavailable.

## Core Marketplace Types

```text
RepositoryCandidate
  -> RepositoryInspection
  -> SkillDescriptor
  -> immutable resolved snapshot
  -> InstalledSkill / managed registry Skill
```

Repository identity uses `github:owner/repository`; Skill identity uses `github:owner/repository#path`. Name alone and `owner/repository` alone are not remote Skill de-duplication keys.

The future catalog schema lives in `packages/index-schema` and defines `catalog-meta.json`, `repositories.jsonl.gz`, and `skills.jsonl.gz`. No central Indexer service or GitHub Action ships in this iteration.

## Compatibility

The current adapter and runtime acceptance target DSH Desktop v0.3.8 with `@deepseek-ai/dsh@0.1.0-rc.6`. Desktop v0.3.9, publication, and upstream PR creation were outside this historical iteration.
