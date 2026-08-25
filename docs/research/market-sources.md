# Marketplace Source Research

Date: 2026-08-16
Status: primary-source review for the first read-only marketplace catalog

## Scope

This note evaluates three catalog inputs:

1. `skills.sh` as the primary ecosystem index and install-count source;
2. GitHub REST as the repository discovery and enrichment source;
3. the official `huggingface/skills` repository as a later curated source.

Only first-party documentation, first-party source code, and live first-party API responses are used. Remote Skill content remains untrusted data and must never be executed during catalog discovery.

## Recommended First Slice

For a backendless DSH Desktop/Harness release, use a replaceable composite adapter:

1. **Search and leaderboard:** use the currently public `skills.sh` legacy endpoints behind a `SkillsShLegacyAdapter`.
2. **Description and exact bundle discovery:** fetch the candidate GitHub repository tree and parse the selected `SKILL.md` with a YAML parser.
3. **Stars and publisher:** enrich from GitHub's repository API.
4. **Later curated source:** ingest the fixed `huggingface/skills` repository directly from GitHub.
5. **Do not label installs as downloads.** They are deduplicated, opt-in CLI telemetry events.

The documented `skills.sh` V1 API is the preferred long-term contract, but it requires a Vercel OIDC token. A local Electron/Harness process cannot mint that token by itself, and a token must not be embedded in the desktop package. V1 therefore requires a project-operated Vercel backend or a future non-Vercel authentication option.

## Capability Summary

Legend:

- **Verified:** explicitly documented or returned by a first-party API.
- **Conditional:** derivable only after fetching another first-party resource.
- **Unavailable:** the source does not provide the field.
- **Unstable:** observed on a public internal/legacy route without a compatibility contract.

| Field | skills.sh V1 | skills.sh public legacy | GitHub REST | `huggingface/skills` |
| --- | --- | --- | --- | --- |
| Stable logical Skill ID | **Verified:** `id={source}/{slug}` | Search returns the same-shaped `id`; leaderboard requires composing `source/skillId` | **Conditional:** repository plus verified Skill path | **Verified:** fixed repository plus manifest `source` path |
| Skill name/slug | **Verified** | **Verified** | **Conditional:** parse `SKILL.md` | **Verified:** manifest and `SKILL.md` |
| Skill description | **Conditional:** parse detail `files[].contents` | **Unavailable** in JSON search/list responses | **Conditional:** parse `SKILL.md`; repo description is not a Skill description | **Verified:** generated manifest and frontmatter |
| Source repository | **Verified:** `source`, `installUrl` | **Verified:** GitHub `source=owner/repo` | **Verified** | **Verified** |
| Exact repository path | **Unavailable:** detail paths are bundle-relative | **Unavailable** | **Verified** after tree/contents lookup | **Verified:** `./skills/<name>` in the full manifest |
| Install count | **Verified** | **Verified**, but endpoint is legacy | **Unavailable** | **Unavailable** unless separately matched to skills.sh |
| Download count | **Unavailable** | **Unavailable** | **Unavailable** for repositories/Skills; only release assets have `download_count` | **Unavailable** |
| Stars | **Unavailable** | **Unavailable** | **Verified at repository level** | **Verified at repository level only** |
| Publisher/source owner | **Conditional:** derive from GitHub source or provider domain | **Conditional:** derive from `source` | **Verified:** repository owner | **Verified:** Hugging Face organization |
| Skill author | **Unavailable** unless declared in Skill metadata | **Unavailable** | **Conditional:** `metadata.author` is optional; repository owner is not necessarily the author | **Unavailable per Skill** in the reviewed catalog |
| Cover image | **Unavailable** | **Unavailable** | Owner avatar is available; no standard Skill cover | **Unavailable per Skill** |
| Pagination | **Verified** for the V1 leaderboard | Search has no pagination; internal leaderboard paging is **unstable** | **Verified**, with endpoint-specific caps | Small fixed manifest; no pagination needed |

## 1. skills.sh

### 1.1 Documented V1 API

The official API reference is <https://skills.sh/docs/api>. It documents an HTTPS JSON API under `/api/v1/`.

Documented endpoints:

| Endpoint | Function | Pagination/limit |
| --- | --- | --- |
| `GET /api/v1/skills` | all-time, trending, or hot leaderboard | `page` is zero-based; `per_page` 1-500, default 100 |
| `GET /api/v1/skills/search` | search by name, source, or description | `q` minimum 2 characters; `limit` 1-200, default 50; optional `owner`; no page cursor |
| `GET /api/v1/skills/curated` | official first-party curated set | no pagination documented |
| `GET /api/v1/skills/{id}` | install count, content hash, and bundle files | one Skill |
| `GET /api/v1/skills/audit/{id}` | partner security audit results | one Skill |

The leaderboard returns:

- `id`, `slug`, `name`, `source`, `installs`;
- `sourceType`, `installUrl`, and the skills.sh detail `url`;
- `pagination.page`, `perPage`, `total`, and `hasMore`.

The detail endpoint returns:

- `id`, `source`, `slug`, and `installs`;
- `hash`, documented as a SHA-256 content hash for cache invalidation/change detection;
- `files[].path` and `files[].contents`, relative to the Skill bundle root.

The V1 documentation explicitly calls `id` a stable unique identifier with format `{source}/{slug}`. This is a logical catalog identifier, not an immutable content version. Pin installed content separately with the Git commit SHA and content hash.

#### Authentication and rate limit

V1 requires a Vercel project OIDC token. The documented flow uses `@vercel/oidc`, `VERCEL_OIDC_TOKEN`, or `x-vercel-oidc-token`. Tokens are short-lived and scoped to a Vercel team/project/environment.

Verified V1 limits:

- 600 requests per minute per `(team, project)`;
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers;
- `429 Too Many Requests` with `Retry-After` on exhaustion.

Unauthenticated calls made during this review to the V1 list, search, and detail endpoints returned `401`. There is no documented ordinary API-key flow. Consequently, the desktop plugin cannot call V1 directly without requiring users to create/link a Vercel project, which is not an acceptable default installation requirement.

### 1.2 Public Legacy Search

The official `skills` CLI currently calls:

```text
GET https://skills.sh/api/search?q=<query>&limit=20[&owner=<github-owner>]
```

First-party source evidence: [`src/find.ts`](https://github.com/vercel-labs/skills/blob/c6f69c631292444cc541ac6d91e2226b0ff247da/src/find.ts#L17-L112).

The current response contains:

- top-level `query`, `searchType`, `searchVersion`, `skills`, `count`, and `duration_ms`;
- per result `id`, `skillId`, `name`, `installs`, and `source`.

Live example: <https://skills.sh/api/search?q=react&limit=3>.

Observed behavior on 2026-08-16:

- responses include `searchVersion: "legacy"` and `x-search-version: legacy`;
- `limit` is capped at 200;
- `page`, `offset`, and `cursor` do not paginate the result set;
- no `X-RateLimit-*` or `Retry-After` headers were present;
- an empty or one-character query returns `400`;
- the endpoint does not return description, stars, author, exact repository path, or bundle files.

This endpoint has meaningful compatibility evidence because the official CLI depends on it, but it is not the documented V1 contract. Keep its response validation strict and isolate it behind an adapter.

### 1.3 Public Internal Leaderboards

The website currently serves these unauthenticated JSON routes:

- <https://skills.sh/api/skills/all-time/0>
- <https://skills.sh/api/skills/trending/0>
- <https://skills.sh/api/skills/hot/0>

Observed response shape:

- `skills`, `total`, `hasMore`, and zero-based `page`;
- 200 entries per page;
- base entries contain `source`, `skillId`, `name`, and `installs`;
- all-time entries also contain `weeklyInstalls` and may contain `isOfficial`;
- hot entries also contain `installsYesterday` and `change`.

These routes are not documented in the V1 API reference and expose no published rate limit. They can support the first default marketplace view, but only as an **unstable site-internal capability** with caching, backoff, response validation, and a visible unavailable state.

There is no stable unauthenticated browse/trending/detail API. The stable browse and detail contract is V1, which requires Vercel OIDC.

### 1.4 Meaning of `installs`

skills.sh states that rankings use anonymous, deduplicated install telemetry from the official CLI and that deduplication runs hourly: <https://skills.sh/about>.

The privacy page confirms that disabling telemetry excludes those installs from the count: <https://skills.sh/privacy>.

The official CLI source sends an `event: "install"` with source, selected Skills, agents, and related install metadata, and allows opt-out through `DISABLE_TELEMETRY` or `DO_NOT_TRACK`: [`src/telemetry.ts`](https://github.com/vercel-labs/skills/blob/c6f69c631292444cc541ac6d91e2226b0ff247da/src/telemetry.ts#L1-L189).

Therefore:

- display the metric as **Installs**;
- record its provenance as `skills.sh`;
- do not rename it to Downloads;
- do not treat it as a complete count of all installations.

### 1.5 Missing Metadata

- **Exact source path:** neither V1 listing/search nor V1 detail exposes the original repository directory. `files[].path` is relative to the bundle snapshot.
- **Description:** listing/search does not return it. V1 detail can supply `SKILL.md`; legacy requires GitHub content lookup.
- **Stars:** absent from the JSON APIs and must come from GitHub.
- **Author:** there is no reliable Skill author field. The source owner may be shown as **Publisher**, not Author.
- **Cover:** no structured cover field exists. Do not scrape arbitrary GitHub README screenshots.

## 2. GitHub REST

### 2.1 Candidate Discovery

Official search documentation: <https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28>.

Useful endpoints:

```text
GET /search/repositories?q=<query>
GET /search/code?q=<query>
```

Repository search can use terms and qualifiers such as `topic:agent-skills` or `in:name,description,readme`. It returns repository metadata but does not prove that the repository contains a valid Skill. Topics and README text are publisher-controlled signals, not validation.

Code search can locate `SKILL.md`, but it:

- requires authentication;
- is limited to 10 requests per minute;
- shares the search result cap and timeout/incomplete-result behavior;
- is not appropriate as the anonymous desktop catalog's primary enumerator.

GitHub search provides at most 1,000 results per query, up to 100 results per page. Search responses can set `incomplete_results: true`. A broad GitHub-wide Skill index cannot be proven complete.

Recommended use: accept candidates from skills.sh or a curated source, or perform a deliberately bounded repository-metadata discovery query and validate only a small candidate set. Never present that bounded query as a complete GitHub index and do not crawl all of GitHub.

### 2.2 Repository and Skill Validation

Official endpoints:

- repository metadata: <https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository>
- repository contents: <https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content>
- recursive Git tree: <https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28#get-a-tree>

Validation flow:

1. `GET /repos/{owner}/{repo}` for repository metadata and `default_branch`.
2. Resolve the branch head to a commit SHA.
3. `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` to find candidate `SKILL.md` paths.
4. Fetch the selected file using an immutable `ref={commit_sha}`.
5. Parse YAML frontmatter and verify the Skill name/path rules.

The recursive tree response is capped at 100,000 entries or 7 MB and exposes `truncated`. If truncated, fetch subtrees non-recursively. Do not silently treat a truncated tree as a complete repository scan.

For provenance, store:

- GitHub repository `id` and `node_id` as returned by the API;
- current `owner/repo` and repository URL;
- normalized Skill directory path;
- commit SHA and `SKILL.md` blob SHA;
- fetched timestamp.

The immutable commit/blob values prove the exact reviewed version. Do not rely only on a mutable default-branch URL.

### 2.3 Available Metrics

The repository endpoints expose verified repository-level fields including:

- `stargazers_count`;
- `forks_count`;
- `subscribers_count` from the full repository response;
- repository description, topics, license, owner, update timestamps, and default branch.

Important display rules:

- stars belong to the repository, not to an individual Skill in a multi-Skill repository;
- repository description must not replace the Skill frontmatter description;
- repository owner is the publisher/source owner, not necessarily the Skill author;
- contributors and commit authors are not a canonical per-Skill author field.

The Agent Skills specification permits optional arbitrary string metadata such as `metadata.author` and `metadata.version`, but does not require either: <https://agentskills.io/specification.md>. Display `author` only when explicitly declared and validated.

### 2.4 Unavailable Download Metrics

GitHub does not expose a public repository clone/download total suitable for this catalog.

- Repository traffic clone data is limited to repositories the caller can write to and covers only the last 14 days: <https://docs.github.com/en/rest/metrics/traffic?apiVersion=2022-11-28#get-repository-clones>.
- `download_count` exists for individual release assets, not for a repository or Skill: <https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28#list-release-assets>.

Therefore `downloads` must remain `null` unless a future source supplies a clearly defined Skill-level value.

### 2.5 Rate Limits

Official rate-limit documentation: <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28>.

- public unauthenticated REST requests: 60 per hour per originating IP;
- typical authenticated user requests: 5,000 per hour;
- authenticated search: 30 per minute, except code search at 10 per minute;
- unauthenticated search: 10 per minute;
- secondary rate limits also apply and are not fully observable in advance.

The adapter should cache repository metadata/tree results, respect response rate headers, use conditional requests where possible, stop on rate exhaustion, and expose optional user-supplied GitHub authentication without logging the token.

## 3. Official Hugging Face Curated Source

Primary repository: <https://github.com/huggingface/skills>.

At the reviewed tree (`ec0108293521ef698e451ec044e8b4feba6b732b`):

- the repository has 25 direct `skills/<name>/SKILL.md` bundles;
- the full generated manifest lists the same 25 Skills;
- the repository-level manifest version is `1.0.23`;
- the repository license is Apache-2.0.

Primary evidence:

- repository usage and structure: [`README.md`](https://github.com/huggingface/skills/blob/ec0108293521ef698e451ec044e8b4feba6b732b/README.md)
- full generated catalog: [`.claude-plugin/marketplace-internal.json`](https://github.com/huggingface/skills/blob/ec0108293521ef698e451ec044e8b4feba6b732b/.claude-plugin/marketplace-internal.json)
- catalog generation/validation: [`scripts/generate_agents.py`](https://github.com/huggingface/skills/blob/ec0108293521ef698e451ec044e8b4feba6b732b/scripts/generate_agents.py)
- GitHub repository metadata: <https://api.github.com/repos/huggingface/skills>
- current recursive tree: <https://api.github.com/repos/huggingface/skills/git/trees/main?recursive=1>

### 3.1 Which Manifest to Use

The public Claude/Cursor marketplace manifests intentionally expose only `hf-cli`. The repository README explains that the generated `.claude-plugin/marketplace-internal.json` contains the full list used by `hf skills`, MCP, and discovery.

The generation script proves that the full manifest is deterministically built from direct `skills/*/SKILL.md` frontmatter and validates that every direct Skill is represented. Each entry supplies:

- `name`;
- exact repository-relative `source`, such as `./skills/huggingface-datasets`;
- `skills: "./"`;
- description.

Use the full manifest as the fast curated index, then validate each referenced `SKILL.md` at the same commit. Because the filename includes `internal` and is generated, isolate it behind `HuggingFaceCuratedAdapter`; the content repository and Skill paths remain the authoritative fallback.

### 3.2 Stable and Missing Metadata

Use the logical ID:

```text
huggingface/skills:<normalized manifest source path>
```

Pin each fetched version with the repository commit SHA and file blob SHA.

Verified fields:

- publisher: `Hugging Face`;
- repository and exact Skill path;
- Skill name and description;
- repository-level manifest version;
- repository-level license;
- repository-level stars/forks via GitHub REST.

Unavailable or non-Skill-specific fields:

- no per-Skill star count;
- no per-Skill download/install count in the repository manifest;
- no required per-Skill author;
- no standard cover image;
- the manifest version is repository/plugin-level, not proof that every Skill changed.

This source should be labeled **Official Hugging Face curated source**, not a general Hugging Face Hub marketplace. The first integration can use GitHub only; it does not require a Hugging Face token or Hub API.

## 4. Normalized Catalog Contract

The source adapter should preserve provenance rather than flatten unlike metrics:

```ts
interface CatalogSkill {
  catalogId: string;
  sourceKind: "skills-sh" | "github" | "hugging-face-curated";
  slug: string;
  name: string;
  description: string | null;
  installUrl: string | null;
  detailUrl: string | null;
  publisher: { name: string; url: string | null } | null;
  author: { name: string; url: string | null } | null;
  repository: {
    host: "github";
    id: number | null;
    owner: string;
    name: string;
    path: string | null;
  } | null;
  metrics: {
    installs: { value: number; source: "skills.sh" } | null;
    stars: { value: number; source: "github"; scope: "repository" } | null;
    downloads: null;
  };
  snapshot: {
    commitSha: string | null;
    blobSha: string | null;
    contentHash: string | null;
    fetchedAt: string;
  };
}
```

The UI should render unavailable values as absent/"not provided", never as zero.

## 5. Product Consequences

- Label GitHub owners as **Publisher**. Show **Author** only when `metadata.author` exists.
- Current UI decision supersedes the early cover exploration: render one plain local folded-file glyph for every Skill and do not fetch owner avatars or README screenshots. The deterministic cover seed remains wire-compatible metadata only.
- Show `skills.sh` installs and GitHub repository stars with distinct labels and provenance tooltips.
- Treat all remote descriptions, Markdown, images, and files as untrusted content.
- Cache legacy skills.sh responses and GitHub enrichment independently so one provider outage does not erase the whole catalog.
- Keep the `skills.sh` adapter replaceable: legacy public routes for the backendless first release, documented V1 when an acceptable authentication/backend design exists.
- Keep Hugging Face as an explicit curated provider rather than mixing it into noisy GitHub-wide search results.

## Decision for Implementation

Proceed with:

1. `SkillsShLegacyAdapter` for read-only search and leaderboard data, including `installs` only.
2. `GitHubRepositoryAdapter` for validation, exact source paths, frontmatter description, repository stars, and publisher.
3. `HuggingFaceCuratedAdapter` in a later slice using the official full manifest plus commit-pinned `SKILL.md` validation.
4. A capability/provenance-aware catalog model so V1 can replace legacy endpoints without changing the UI contract.

Do not add a Vercel backend, require Vercel CLI setup, fabricate download counts, infer authors from commit history, or depend on HTML scraping in the first catalog slice.
