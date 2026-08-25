# Architecture Decisions

## 2026-08-26: Publish A Prebuilt Native DSH Bundle Before Optional Ecosystem Adapters

**Decision:** Release `0.1.0` as public source plus a prebuilt `dsh-skill-manager-0.1.0.tgz`. Keep the workspace root private from npm publication and do not document `github:S-AN-Shu/dsh-skill-manager` as an installation method. Add a Schemastery Host `Config`, deterministic Client stylesheet disposal, package metadata, CI, and an official-rule compliance document before publication.

**Reason:** DSH GitHub source installation expects the fetched root package to build itself through `prepare`, while this repository's installable bundle is a workspace child. Advertising that path would either fail or require users to approve a remote build script. The tarball is already built, auditable, and was installed into an isolated rc.2 Profile without remote code execution at install time.

**Compatibility boundary:** The supported current runtime is DSH Desktop v0.5.4 / Harness `0.1.1-rc.2`, with the package-level rc.7 UI primitives artifact already used by that Desktop. `dsh-std` is optional and unclaimed until a manifest plus target-adapter activation test exists. dsh-TUI conformance is outside this release.

## 2026-08-24: Keep The v0.5.4 Adapter Ordinary; Use A Natural Advanced-Group Label

**Decision:** Target DSH Desktop v0.5.4 through the ordinary Harness Host/Web plugin contract. Register `settings.section` with label `Skill 管理插件` and keep the owned page title `Skill 管理`. Do not consume Desktop-only services, patch `dsh-settings-groups`, or mutate the settings DOM.

**Reason:** The official public settings contract has no group or icon field. The installed Desktop companion already classifies plugin-related labels into “高级”; using a truthful label satisfies the requested placement without creating a private dependency in Skill Manager.

**Compatibility boundary:** The active runtime uses rc.2 for DSH, Typert, runtime, settings, locale, connection, and remotes, but UI primitives remains rc.7. Peer ranges are declared per package rather than inferred from the Desktop version. If the grouping companion is absent or changes policy, functionality remains available but navigation grouping may differ.

## 2026-08-19: Align Trending And Inspection Deadlines With Their Work

**Decision:** GitHub Trending HTML fetches use a 25-second abort-aware default. Fixed-commit repository Inspection uses a 45-second abort-aware default. Repository installation remains independently bounded at 60 seconds.

**Reason:** Trending retained a private 12-second constant after repository browse moved to 25 seconds. A first multi-Skill repository Inspection must resolve metadata, download or load one fixed-commit snapshot, parse README/manifests/all `SKILL.md` files, and return structure evidence; real proxy/codeload latency could cross 30 seconds while still completing safely within the install operation's 60-second budget.

**Boundaries:** These are finite Host deadlines, not an authorization to wait indefinitely. Caller cancellation still wins. Cache hits remain fast. Installation cannot begin writing until fixed-commit structure and complete bundle validation succeeds. The change does not affect Harness process timeouts.

## 2026-08-19: Trending Uses Explicit Unknown Identity; Repository Discovery Keeps A 25-Second Boundary

**Decision:** Allow repository candidates to carry `ownerId: 0` only as an explicit list-stage “metadata not loaded” sentinel. Trending continues to use generated owner media until Inspection loads authoritative GitHub metadata. Raise the repository-search operation deadline from 12 to 25 seconds to match the existing GitHub marketplace transport while preserving cancellation and a rejecting hard boundary.

**Reason:** GitHub Trending HTML exposes repository slugs and trend metrics but not numeric owner identity. Core correctly emitted an unknown sentinel, while the Typert result schema rejected every candidate before it reached the Client. Historical-popular search was valid and returned 20 results in a live probe, but intermittent Windows proxy CONNECT/TLS latency could exceed the older 12-second boundary.

**Boundaries:** A zero owner ID is display metadata only and cannot authorize media, Inspection, installation, provenance, or updates. Inspection and every trusted snapshot still resolve GitHub repository/owner identity. The 25-second deadline remains finite and abort-aware; it does not change Harness shell timeout behavior.

## 2026-08-19: Completed Bulk Notices Are Five-Second Dismissible Toasts

**Decision:** Only completed bulk enable/disable/delete notices auto-expire after five seconds. Every ordinary notice exposes an icon close control. Progress notices and error messages are not cleared by the bulk timer, and timer cleanup compares the current notice before clearing it.

**Reason:** Large successful batches left a permanent status block in the compact settings surface. A scoped timer preserves progress/error visibility and prevents an older timer from removing a newer message.

## 2026-08-19: Pause Local Provenance Discovery; Reuse Host-Verified Install Cache

**Decision:** Hide and disable local-to-GitHub provenance discovery, including automatic matching, manual bulk rematching, row retry actions, and their network-backed compatibility RPC behavior. Keep provenance written by source-aware market/Host installation and keep updates for those trusted registry entries. Build recent-heat cards from GitHub Trending HTML without per-card REST enrichment. When a Host Inspection has already fixed and verified a repository commit, installation may reuse that Host-owned resolution and local codeload cache for up to one hour.

**Reason:** Anonymous GitHub REST provides only a small hourly allowance. Broad local matching fans out across candidate repositories and produced repeated 30-second failures; Trending enrichment consumed one REST request per candidate and silently removed cards when enrichment failed; installation then repeated commit resolution even when details had already prepared the exact fixed snapshot.

**Trust and compatibility boundaries:** No browser request may provide a trusted commit, hash, snapshot, or local path. Cache reuse applies only to a resolution created by the Host's fixed-commit Inspection and preserves complete bundle, blob, path, symlink/submodule, and risk checks. Cache expiry or absence uses fresh resolution. Update checks and updates keep their freshness requirements. A Skill copied directly by a user or AI without manager-owned source metadata remains custom; name, README, frontmatter, skills.sh, and repository similarity do not grant GitHub provenance. Protocol 5 keeps the provenance RPC descriptors for compatibility but reports the feature disabled without discovery traffic.

**Trending limitation:** GitHub Trending is a bounded global HTML list, not a Skill catalog or stable API. The recent-heat count may be below 20 because only entries with strong Skill/Agent signals are admitted. Removing REST enrichment prevents rate-limit-driven shrinkage but cannot make the global list contain more relevant repositories.

## 2026-08-19: Provenance Batches Fail Per Name; Git Directories Are Structural

**Decision:** Keep Protocol 5 and envelope schema 1, but let `verifyProvenanceBatch` return ordered successful verifications plus an optional structured failure list. Run at most two name verifications concurrently. Treat Git `tree/040000` entries as directory structure, while continuing to reject selected-Skill symlinks, submodules, unsafe blob modes, and unknown entry types. Canonicalize parsed frontmatter name/description with trimming at both Inspection and final installation.

**Reason:** One network failure previously rejected up to 20 otherwise independent provenance results, and normal Git directory rows made every nested Skill appear unsafe. YAML block-scalar descriptions also retained one final newline during the pre-write parse but not during Inspection, causing valid fixed snapshots to fail their own metadata comparison.

**Compatibility and boundaries:** The new `failures` field is optional for older Protocol 5 responses; exact fixed-commit full-bundle matching remains the only provenance authority. Directory skipping does not admit any bytes. Frontmatter normalization changes display/identity metadata only, not the verified document bytes, Git blob SHA, bundle hash, risk scan, or script-execution prohibition.

## 2026-08-19: Skill Rows Use Explicit Tracks; Detail Media Is A Bounded Gallery

**Decision:** Render managed Skill rows as `selection | icon | content | actions`, and intentionally stack actions below content on viewports narrower than 520px. Render up to eight unique Host-validated repository images as one primary preview plus a horizontal thumbnail strip, resolving at most three at a time.

**Reason:** The previous row had four direct children but only three declared grid columns, so CSS auto-placement collapsed the copy region and pushed actions into unintended rows. A single repository cover also discarded useful README screenshots even though the Host already supplied structured, validated media references.

**Boundaries:** The Client does not fetch arbitrary README URLs, decode SVG, or turn media into trust evidence. Failed media is isolated and Social Preview remains a fallback. The gallery cap, Host proxy limits, fixed-commit repository requirement, and installation checks stay unchanged.

## 2026-08-19: Repository Is The Network Unit; Skill Is The Managed Unit

**Decision:** Protocol 5 makes GitHub repository identity the discovery, detail, download, cache, and batch-analysis unit. A directory containing its own `SKILL.md` is the provenance, installation, enablement, update, and deletion unit. A repository may contain many independent Skills.

**Reason:** Comparing local Skills to a repository as one monolithic object loses correct matches for multi-Skill repositories and repeats network work. Preparing one fixed-commit repository snapshot exposes all contained Skill paths and fingerprints once, while requiring exact numeric repository ID plus path and a unique full-bundle match avoids unsafe fuzzy attribution.

**Boundaries:** skills.sh is an optional discovery accelerator only. Its anonymous API is incomplete and unstable; V1 requires Vercel OIDC. Candidate names, slugs, installation counts, README text, Topics, and manifests cannot grant provenance, install, or update authority. Final matching and updates always revalidate the GitHub fixed commit, real Skill path, and complete bundle.

**Reversal:** The Client can fall back to bounded single-Skill provenance calls for an old Host. Central catalog/index work remains deferred and can later feed repository candidates without changing the trust boundary.

## 2026-08-18: Provenance V2 Uses Trusted Registry Identity Or One Exact Canonical Bundle Match

**Decision:** A GitHub source is authoritative only when Skill Manager previously wrote it into `registry.json`, or when one and only one GitHub repository/path snapshot revalidates to the same `dsm-skill-fingerprint-v1` as the local whole bundle. Repository fields inside `SKILL.md` and all marketplace/search metadata remain untrusted candidate hints. Multiple exact mirrors are `ambiguous`; no exact match is `custom`; locally modified managed bundles are `ineligible` and keep their original raw `contentHash` baseline.

**Fingerprint boundary:** Keep raw `contentHash` unchanged for byte-exact local-modification detection. The independent identity fingerprint normalizes relative path separators and UTF-8 CRLF/CR line endings only, preserves BOM, whitespace, YAML order and binary bytes, includes every regular bundle file with stable length framing, and rejects unsafe paths and symbolic links. Only explicitly manager-owned provenance metadata may ever be excluded; generic user metadata is never stripped.

**Index boundary:** Maintain a versioned, bounded, atomically written GitHub Skill observation index under the manager cache. It retains five verified versions per repository/path and 10,000 observations globally, but it is only an acceleration structure: an indexed fixed commit must be fetched and fingerprinted again before provenance is granted. Installation, repository Inspection, provenance resolution, and successful update may populate observations.

**Stable identity and updates:** Prefer GitHub numeric repository ID plus exact Skill path over mutable owner/repository text. Repository rename or transfer updates the display slug after ID resolution. A path basename need not equal the frontmatter Skill name. A path move is accepted only through a new exact-content match; path and content changing together is reported rather than guessed. Every changed update is resolved again at a fresh fixed commit, validated as a complete snapshot, and risk-scanned before atomic replacement. High or unknown risk never auto-updates and requires explicit manual acknowledgement.

**Compatibility:** Keep registry schema version 1 and enrich old GitHub source records lazily through optional fields. Upgrade the Marketplace capability protocol to 4 with `provenanceV2` and `updateRiskGate`; keep the browser provenance request name-only so the Host never trusts browser-submitted commits, hashes, paths, or candidates. Automatic matching/check/update preferences remain opt-in and default off. DSH Desktop v0.3.8 is the sole runtime target.

**Rejected:** name/description similarity as proof, trusting `SKILL.md` provenance declarations, accepting an index row without fixed-commit revalidation, selecting one mirror by ranking, resetting a local-modification baseline during matching, basename-equals-name identity, and automatic high-risk updates.

## 2026-08-18: Recent Heat Is One Monthly-Ranked Client View

**Decision:** Keep protocol-3 `trend-monthly` and `trend-weekly` wire values for Host compatibility, but expose one Client control named `近期热度榜`. Its result contains monthly candidates ordered by monthly growth, merges weekly growth for matching repositories, and appends weekly-only Skill candidates after every monthly-ranked candidate.

**Reason:** Users need one understandable recent-heat view rather than two near-duplicate switches. Monthly growth is the stable primary rank, while weekly growth remains useful secondary evidence and broadens candidate coverage without pretending that a weekly-only repository has a monthly value.

**Reliability:** Retry only idempotent Host GET requests for a bounded set of transient connection codes and preserve the caller signal/deadline. Mount the install dialog synchronously before Inspection begins so network delay or failure cannot hide the review surface.

**Compatibility:** No protocol increment or Host RPC replacement is required. v0.3.9, Harness timeout, PR, and publication remain deferred.

## 2026-08-18: Marketplace Protocol 3 Uses Experimental GitHub Trending

**Decision:** Marketplace protocol 3 adds `trend-monthly` as the default market view, `trend-weekly`, and a rolling 60-day `latest` query. Monthly and weekly ranks come from Host-side GitHub Trending HTML (`since=monthly|weekly`) and are retained only for strong Skill candidates; repository metadata is completed through the GitHub API without loading README, Tree, or `SKILL.md` during browsing.

**Classification:** Compress the Skill Leaderboard taxonomy into 12 selectable categories plus `通用`. Inspection classification prefers `SKILL.md` metadata, then `skills.json`, Topics, name/description, and bounded README text. It produces at most three tags and evidence, but never grants installation or safety authority.

**Failure semantics:** Trending caches weekly and monthly independently for 30 minutes and may use at most 24-hour stale data. `live`, `cached`, `unavailable`, and `empty` remain distinct; a failed Trending request never silently becomes a recent-update or empty ranking.

**Compatibility:** The Client requires protocol 3, `githubTrending`, and `skillClassification`; stale v0.3.8 Host processes receive a restart instruction. Desktop v0.3.9, Harness timeout work, PR creation, and publication remain deferred.

## 2026-08-18: Explicit Provenance Batches And Recoverable Skill Deletion

**Decision:** Provenance discovery starts only from an explicit batch or per-Skill retry action. Exact immutable full-bundle matches persist trusted GitHub provenance; other outcomes persist only as last-check metadata. Managed deletion uses a two-step UI confirmation and a Core-owned recoverable trash snapshot, removing only manager-owned links.

**Reason:** Implicit sequential network work is slow and visually opaque for large libraries, while discarding negative outcomes makes every session look unfinished. Direct recursive deletion would also risk user-authored content and cross-agent paths. Cached negative outcomes improve continuity without weakening the exact-byte trust boundary, and trash-first deletion keeps removal recoverable.

**Rejected:** Automatic matching on every render, name/description-only provenance, browser-owned source metadata, direct deletion of external Skill directories, and automatic installation of remote updates.

## 2026-08-16: One Repository, Two Delivery Targets

**Decision:** Maintain one public repository with a shared core, a Harness plugin, and a thin DSH Desktop adapter.

**Reason:** Two independent implementations would duplicate synchronization, update, security, and migration behavior.

**Rejected:** Separate Harness and Desktop codebases.

## 2026-08-16: Private Managed Library

**Decision:** Store canonical bundles under `%DSH_HOME%/skill-manager/library`, outside DSH default scan roots.

**Reason:** A canonical `.agents/skills` store would make DSH per-Skill disablement impossible because DSH scans it automatically.

**Migration Boundary:** Existing roots are discovered read-only. Managed mode changes provider configuration only after backup and explicit activation.

## 2026-08-16: DSH-First Cross-Agent Support

**Decision:** DSH receives full runtime management. Codex and Claude Code receive discovery, explicit import/export, and per-Skill links, without replacing their own management interfaces.

## 2026-08-16: Update Safety

**Decision:** Default to check-and-notify. Automatic updates pause on local modifications, source changes, or security warnings.

## 2026-08-16: Slash Prefix Chain

**Decision:** Only a leading slash prefix region is indexed. Recognized Skills and commands use whitespace-bounded tokens and may continue (`/command-one /skill-one /command-two body`). The first normal-text or unknown segment ends indexing.

**Reason:** Prevent paths and ordinary mid-message slash text from being interpreted as commands or forced Skill invocation.

**Rejected:** Concatenating `/skill-one/skill-two`, which fails the Harness whitespace-bounded user-invocation grammar, and allowing ordinary body slashes to reopen the command index.

## 2026-08-17: Exact v0.3.8 Desktop Dependency Patch

**Decision:** Stage the common Harness bundle into DSH Desktop v0.3.8 and extend its existing dependency-patch workflow only for exact `@deepseek-ai/dsh-client-ui-input-trigger@0.1.0-rc.6`. The per-session controller caches names actually returned by official candidate sources and combines them with the hot Skill lexicon; the trigger admits another leading slash only after names in that aggregate. An empty query replaces a source snapshot only at the true leading position, while inline and filtered results extend it; source removal/disposal clears it. The patch fails closed on version or marker drift.

**Reason:** rc.6's public trigger service only appends sources; it cannot replace native detection, whose whitespace boundary opens slash suggestions inside body text. Its Skill source exposes a lexicon but its command source does not, so a Skill-only gate incorrectly closes `/goal /`. Reusing official candidate results avoids hard-coded command names and avoids modifying the command dependency, while keeping the correction in the thin Desktop adapter preserves native command execution, Skill serialization, and `@` behavior.

**Reversal Boundary:** Replace the dependency patch with a public trigger-policy API when Harness exposes one. v0.3.9 remains outside the current compatibility scope.

## 2026-08-17: Defer v0.3.8 Command Claims Until Enter

**Decision:** In the exact rc.6 input-trigger adapter, convert a command claim returned by manually typed Space into insertion of its source-provided canonical token. Preserve a claim when the outcome came from the native `+ 命令` launcher. Do not transform Enter adjudication: `/command arguments` still reaches the native command source, which creates and submits the original claim.

**Reason:** rc.6 claims a manually typed leading-input command on the first Space and then suppresses every `/` in the `claimed` guard tier. The requested prefix grammar must allow `/command /skill /command body`, while users choosing `+ 命令` explicitly requested the native claimed-command workflow. The controller can distinguish an active launcher snapshot and is not used by Enter adjudication, so it restores manual prefix authoring without hard-coded command names or a second command implementation.

**Tradeoff:** The live claimed-command hint is deferred until submission only for manually typed commands; launcher-selected commands keep it. Host command execution and validation remain native. Opening chained suggestions proves authoring behavior; executable semantics of a multi-command line remain bounded by the Host's first-command protocol.

**Rejected:** Patching the command package, hard-coding `goal`, modifying the conversation state machine, or releasing a claimed phase merely when any slash is typed.

**Reversal Boundary:** Remove this exact-version adapter when a later Harness exposes a first-class chainable-prefix/command API. v0.3.9 remains out of scope.

## 2026-08-16: Versioned RPC Envelopes

**Decision:** Expose DSH operations through the `skillManager` Typert namespace with `schemaVersion: 1` request and response envelopes. Keep a pure handler factory separate from the Cordis/Typert runtime class.

**Reason:** The browser boundary must remain JSON-serializable and stable across DSH releases. Injected handlers are testable without launching Harness, while the runtime adapter stays thin and follows verified companion-plugin conventions.

**Rejected:** Returning raw core values and allowing exceptions to cross the remote boundary. That would couple the client to runtime-specific error serialization and make protocol evolution ambiguous.

## 2026-08-16: Bundle the Shared Core into Harness Build Output

**Decision:** Keep `@dsh-skill-manager/core` as an independent workspace package, but bundle its runtime code into the published `dsh-skill-manager` JavaScript output. The public RPC declarations use a structural wire/port contract and do not reference the private workspace package.

**Reason:** The standalone Harness installation must work from one plugin package even before the core is published as a separate public package. npm does not include a workspace-linked package through `bundleDependencies` in this layout, while build-time bundling is explicit and verifiable from the tarball.

**Reversal Boundary:** The bundled code can become a normal semver dependency after the core receives its own stable public release.

## 2026-08-16: Separate Host and Browser Descriptor Codecs

**Decision:** Keep Zod-backed strict descriptors in the Host manifest and mount matching browser descriptors with a strict identity codec.

**Reason:** DSH performs authoritative validation at the Gateway/Host boundary. Sharing Host schemas with the React entry increased the client bundle from about 20 KB to more than 560 KB without adding a second trust boundary.

**Rejected:** Importing `typert.host.ts` into the browser bundle.

## 2026-08-16: Initial Settings UX Is a Dense Skill List

**Decision:** Use an unframed settings list with search, icon actions, one-line descriptions, source labels, and per-Skill switches. Creation expands inline above the list.

**Reason:** Skill management is a repeated operational workflow. A compact list supports scanning and toggling better than a card gallery, while preserving space for later All/Market/Custom categorization.

## 2026-08-16: Normalize Marketplace Metadata Without Inventing Metrics

**Decision:** Marketplace entries expose source-specific metrics as nullable fields. skills.sh installs map only to `installs`; GitHub stars and downloads remain `null` unless their owning source reports them. Descriptions may also be `null` when the search endpoint does not provide one.

**Reason:** Zero and unavailable are different facts. The UI must not imply that an unsupported metric was measured as zero or substitute stars for downloads.

## 2026-08-16: Do Not Fetch Repository Screenshots

**Decision:** Do not scrape README or repository screenshots for the catalog. The normalized wire contract retains its deterministic legacy cover seed for schema compatibility, but the settings client renders the shared source-neutral file glyph instead.

**Reason:** Repository screenshots are usually absent, inconsistent, expensive to fetch, and may display untrusted or unrelated content. A local file glyph is stable, compact, and theme-aware.

## 2026-08-16: Replaceable Legacy skills.sh Adapter

**Decision:** Use the unauthenticated legacy search endpoint consumed by the official `vercel-labs/skills` CLI for the backendless first release, isolated behind a replaceable adapter. Do not call the documented skills.sh V1 API directly from Desktop or Harness.

**Reason:** V1 requires a short-lived Vercel project OIDC token. Embedding credentials or requiring every desktop user to provision a Vercel project is not an acceptable default. The legacy endpoint has compatibility evidence through the official CLI but no stable public contract, so strict response validation, bounded requests, and an unavailable state are required.

**Migration Boundary:** Replace the legacy adapter with V1 when a project-operated backend or a suitable public authentication mechanism exists. The normalized catalog contract must remain unchanged.

## 2026-08-17: Aggregate Independent Catalogs Without Expanding Browser Authority

**Decision:** Keep one versioned marketplace search RPC and compose independent Host-side sources. Search results include per-source availability and entries retain both a primary source and all contributing catalog identities. Repository/Skill identity drives deterministic deduplication; installation still resolves and validates the selected GitHub repository inside the Host.

**Reason:** A comprehensive default market should survive one provider outage and expose provenance without asking users to repeat separate searches. Browser-selected paths or snapshots would weaken the existing installation trust boundary.

**Rejected:** A separate RPC per provider, silently dropping failed sources, flattening unavailable metrics to zero, and trusting a curated manifest as executable installation authority.

**Reversal Boundary:** A future backend index may implement the same aggregate contract. Adding a non-GitHub installation host requires a new resolver/installer authority and cannot reuse this decision implicitly.

## 2026-08-17: Expose GitHub as Bounded Discovery, Not a Complete Index

**Decision:** Add a separate GitHub catalog source that uses repository search for candidates and validates at most three recursive repository trees by default. It exposes only unique, safe `<skill-name>/SKILL.md` paths and reports incomplete search, rate limits, timeouts, and provider failures through the existing source-status contract.

**Reason:** Users need a visible GitHub source distinct from “GitHub-hosted installation,” but GitHub provides no reliable anonymous Skill index. Anonymous code search is unavailable, repository search is capped and can be incomplete, and unauthenticated REST is limited to 60 requests per hour per IP.

**Rejected:** A UI-only GitHub button, claiming comprehensive GitHub coverage, scraping README content as trusted Skill metadata, broad crawling, and accepting browser-provided paths or commits as installation authority.

**Reversal Boundary:** A maintained backend index or authenticated user configuration may improve coverage later while preserving the normalized catalog and immutable Host resolver boundaries.

## 2026-08-16: Distinguish Publisher from Skill Author

**Decision:** Represent the repository owner as a publisher. Populate a Skill author only when the selected Skill bundle explicitly declares validated author metadata.

**Reason:** A repository owner, contributor, or commit author is not necessarily the author of every Skill in a multi-Skill repository. The UI must not present an inference as verified authorship.

## 2026-08-16: Inherit DSH Themes Instead of Assuming Dark Mode

**Decision:** The settings client inherits text and surfaces from the DSH shell and maps its local semantic variables to verified DSH v0.3.8 `--dsw-alias-*` tokens for base/layer backgrounds, borders, primary/secondary labels, hover surfaces, and brand/status emphasis. Neutral fallback values exist only for standalone previews and tests.

**Reason:** The reference screenshot used the user's selected dark theme, but DSH supports its original theme, light, dark, and system-following modes. A plugin-specific dark palette would break contrast and visual integration in other modes.

## 2026-08-17: Use One File-Shaped Skill Glyph Across Sources

**Decision:** Render managed, discovered, synchronized, and marketplace Skills with one inline SVG showing only a paper outline and folded corner. Marketplace cards no longer derive fixed color blocks or initials from remote metadata, and repository screenshots are not fetched or displayed.

**Reason:** A source-neutral file glyph communicates that every entry is a Skill bundle, matches the compact DSH settings language, remains legible in every supported theme, and avoids noisy or inconsistently available remote artwork.

**Rejected:** Generated initial covers, repository screenshots, favicons, and source-specific logos.

## 2026-08-17: Separate Runtime Location from Verified Upstream Provenance

**Decision:** Discovery labels the trusted runtime root where a Skill was found (Codex, Claude Code, Agents, or OpenCode). Import without portable or remotely verified provenance is classified as self-authored while retaining that discovery location as operational metadata. GitHub-backed update eligibility is granted only by an exact, immutable resolver result or preserved manager provenance; names and descriptions are never fuzzy-matched into remote ownership.

**Reason:** A Skill copied into Codex may have been authored locally, downloaded from GitHub, or synchronized from another agent. Treating the scan root as authorship or guessing a repository from text would create false attribution and unsafe automatic updates.

**Rejected:** Displaying every import as an Agent Skill, treating a directory name as GitHub proof, and enabling updates after a fuzzy marketplace-name match.

## 2026-08-17: Split Local Management from Online Marketplace

**Decision:** The settings entry has two primary product areas: local Skill management (library, custom creation, update state, and cross-agent synchronization) and an online Skill marketplace (remote search, provider filters, descriptions, tags, and installation). Their search controls and empty states use distinct labels and state.

**Reason:** Reusing one compact tab row made local filtering and network search look like the same operation, obscured where downloads live, and made provider outages appear like an empty local library.

## 2026-08-17: Resolve Marketplace Networking at the Host Boundary

**Decision:** Marketplace and immutable GitHub operations use one Host-owned proxy-aware fetch. Explicit `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` configuration takes precedence; on Windows, an enabled per-user static proxy is used as a fallback. Only normalized provider errors cross RPC, and proxy endpoints or credentials never enter browser payloads.

**Reason:** Electron/Chromium follows Windows Internet Settings, but Node's default `fetch` does not. Without a Host transport boundary, the DSH UI can be online while every marketplace provider fails before TLS connection establishment.

**Rejected:** Running remote provider requests in the browser, copying proxy settings into client state, silently retrying direct connections, and hard-coding a local proxy address.

## 2026-08-17: Popular Market Home Uses Install Rank, Not Invented Skill Stars

**Decision:** The empty-query market home uses the validated skills.sh all-time leaderboard, shows 20 entries at a time, and labels the order as install popularity. The client offers an explicit load-more control and may trigger the same action near the list bottom. Keyword search remains the only flow that aggregates skills.sh, bounded GitHub discovery, and the official Hugging Face catalog.

**Reason:** skills.sh provides Skill-level install telemetry and pagination. GitHub stars belong to entire repositories, while the Hugging Face curated manifest exposes neither stars nor downloads. Calling either value a Skill rating would misrepresent provenance.

**Rejected:** Treating repository stars as per-Skill ratings, scraping website HTML, issuing an empty wildcard search, and presenting Hugging Face's small alphabetic manifest as a popularity leaderboard.

## 2026-08-17: Automatic Provenance Requires Exact Bundle Identity

**Decision:** When a self-authored Skill becomes visible in DSH settings, the client may request one bounded background provenance check per settings session. The browser submits only the managed Skill name. The Host searches catalog candidates, requires an exact normalized name and resolved description, resolves an immutable GitHub snapshot, downloads the bounded Skill directory, and asks the core to compare the complete byte-level bundle hash with the unchanged managed bundle. Only an exact match atomically replaces self/local-import provenance with a GitHub source record; the contributing GitHub or Hugging Face catalog is retained for the label and later update checks.

**Reason:** Automatic discovery removes repetitive user work, but name and description are public, copyable metadata and cannot establish ownership. Exact bundle identity proves that the candidate snapshot is the actual source of the local bytes while preserving the existing immutable update trust boundary.

**Rejected:** Persisting a source or enabling updates from fuzzy/exact text alone, sending local Skill bodies to search providers, accepting browser-supplied repositories or snapshots, and repeatedly checking every hidden library entry.

**Reversal Boundary:** A future signed Skill manifest may replace byte identity with publisher signatures while retaining Host-only authority and explicit ambiguity handling.

## 2026-08-17: Content Tags Are Automatic Derived Display Metadata

**Decision:** Infer compact content-category tags from each displayed Skill's normalized name and description in the client. The derivation is deterministic, network-free, and not persisted into `SKILL.md`; only visible rows pay the small computation cost.

**Reason:** Tags are navigation hints rather than provenance or execution authority. Deterministic derivation makes them immediate and stable without modifying imported bundles or requiring a manual action.

**Rejected:** A per-row “add tags” button, remote classification on every render, or silently editing user-authored frontmatter.

## 2026-08-16: Resolve Marketplace Installs at an Immutable GitHub Snapshot

**Decision:** A market search result is not installable until a GitHub resolver proves the exact Skill directory at a specific commit and blob. Resolution uses repository metadata, default-branch commit, recursive tree, and the selected `SKILL.md` frontmatter.

**Reason:** skills.sh search identifies a repository and Skill slug but does not expose the original repository path. Guessing `skills/<slug>` or installing an entire repository could import unrelated Agent instructions and makes update comparison unauditable.

**Rejected:** Treating the repository root or a slug-derived path as an installation locator without fetching and validating the tree.

## 2026-08-17: Install Only a Revalidated Commit-Pinned Bundle

**Decision:** Marketplace installation is a Skill Manager operation over a resolved entry. It re-fetches the exact commit tree, selects only regular blobs beneath the proven Skill directory, verifies the `SKILL.md` blob identity/frontmatter, then uses the existing private-library atomic write path.

**Reason:** Resolution and installation may be separated in time. Revalidation prevents a forged or stale UI payload from expanding the copy scope, and placing the mutation inside the manager preserves registry rollback semantics.

**Rejected:** Cloning or downloading the whole repository, running a remote installer, or importing a temporary checkout with adjacent Agent instructions.

## 2026-08-17: Resolve and Install Atomically on the Host

> **Superseded by Marketplace V2:** the public `installMarketplace` method below is historical. Current public installation uses `installSkill({ repository, skillPath })`; the Host still owns resolution and atomic installation.

**Decision:** The UI sends the original normalized marketplace entry to `installMarketplace`. The Host performs resolution and installation in one operation; client-supplied resolved snapshots are never installation authority.

**Reason:** A browser payload is untrusted and may be stale or forged. Keeping resolution and mutation in one Host operation preserves the trust boundary while still allowing a separate read-only resolution endpoint for preview and diagnostics.

**Rejected:** Sending a `ResolvedMarketplaceEntry` from the browser to the install RPC.

## 2026-08-17: Compare Whole-Bundle Fingerprints for Updates

**Decision:** Store a deterministic Git tree fingerprint for the installed Skill directory and compare it during update checks, while using the existing local content hash to detect user modifications.

**Reason:** `SKILL.md` identity alone misses changes to referenced instructions, scripts, examples, and assets. Separating the remote tree fingerprint from the local byte hash makes remote changes and local conflicts independently observable.

**Rejected:** Treating a changed default-branch commit or changed `SKILL.md` blob alone as the complete update signal.

## 2026-08-17: Persist Reversible Backups Before Every Replacement

**Decision:** A Skill update or rollback must first persist the displaced complete bundle and registry record under a manager-generated backup id. Rollback creates another backup of the current version, and backups are discoverable after restart through a read-only listing API.

**Reason:** An in-memory undo token is lost when DSH Desktop restarts, while overwriting a canonical Skill without preserving provenance makes recovery unauditable. Backing up both bytes and registry metadata restores the exact source baseline and enablement state.

**Rejected:** Keeping only the prior Git commit, exposing a mutable "rollback latest" action, or relying on the marketplace to remain available during recovery.

## 2026-08-17: Core Owns Update Resolution Authority

**Decision:** `updateSkill` accepts only the managed Skill name and optional cancellation signal. The core rechecks local integrity, resolves the repository's current default-branch snapshot, then downloads that exact snapshot through the same bounded safety path used for installation.

**Reason:** A browser-provided commit, tree fingerprint, or update-check result may be stale or forged. Re-resolving at mutation time keeps the trust boundary inside the Host/core operation.

**Rejected:** Passing a `SkillUpdateCheck` or client-selected commit into the mutating API as authority.

## 2026-08-17: Explicit Inline Update and Rollback Controls

**Decision:** Keep update management inside the existing dense Skill list. One user-triggered library check populates per-Skill status; only an `update-available` result exposes update. Backup history expands below its Skill, and rollback requires a second inline confirmation click.

**Reason:** Update state is operational metadata for an installed Skill, not a separate catalog. Inline status preserves context and DSH's compact settings style, while explicit checking and confirmation avoid surprise network access or destructive replacement. The Host/core remains authoritative and revalidates every mutation.

**Rejected:** Automatic update checks on every panel mount, automatic installation of available updates, a browser-supplied snapshot/backup path, or a separate fixed-dark update dashboard.

## 2026-08-17: Trusted Roots and Per-Skill Links for Cross-Agent Sync

**Decision:** Configure Codex, Claude Code, and `.agents` Skill roots on the Host/core boundary. Discovery and import identify a source only by target and validated Skill name; export creates one manager-owned directory link per Skill to the canonical private bundle. A metadata-only target-state query reports unconfigured, absent, exact-link, and conflict states so the UI can warn before mutation.

**Reason:** Browser-supplied paths would expose an arbitrary filesystem capability. Per-Skill links keep one authoritative bundle, make update/rollback immediately visible to enabled targets, and preserve independent enablement. Metadata-only discovery avoids sending Skill bodies or target-specific instructions into the model context.

**Rejected:** Mirroring whole roots, copying adjacent `AGENTS.md`/`CLAUDE.md`, accepting paths from browser RPC, replacing an existing same-name target directory, or silently importing every discovered Skill.

## 2026-08-17: Link DSH Enablement Into Its Native User Skill Root

**Decision:** Let the core accept an optional trusted `dshRoot`. The Harness Host adapter resolves it to `%DSH_HOME%/skills` by default, while direct core consumers that omit it retain the private `<manager-root>/active` fallback. Enabling creates only one manager-owned per-Skill directory link in that root.

**Reason:** DSH v0.3.8's filesystem provider scans `%DSH_HOME%/skills`, project `.dsh/skills`, project `.agents/skills`, and configured custom roots. It does not scan `%DSH_HOME%/skill-manager/active` by default, so registry persistence alone did not make a managed Skill available to native `skill.list` or slash suggestions.

**Rejected:** Copying bundles into DSH, modifying the filesystem provider's global configuration, treating a private manager directory as implicitly scanned, or replacing a same-name user-owned path.

**Reversal Boundary:** A future Harness API may register a provider root dynamically. Until then, changing the native user Skill root requires an explicit Host configuration override and the same ownership/conflict checks.

## 2026-08-17: Marketplace V2 Separates Repository Discovery From Skill Installation

**Decision:** Replace the old universal marketplace entry with `RepositoryCandidate`, `RepositoryInspection`, `SkillDescriptor`, and immutable snapshot boundaries. Repository search and browse return metadata-only candidates; installation accepts only repository identity plus Skill path, performs a fresh Host inspection, and converts that single fixed inspection commit directly into the installation snapshot. The first V2 slice is GitHub-first, retains skills.sh and Hugging Face only as discovery signals, freezes an index schema without shipping the central indexer, and targets Desktop v0.3.8 only.

**Reason:** A repository may contain zero, one, or many Skills. Immediate Tree validation for every search result is slow, rate-limit-heavy, and conflates discovery evidence with installation authority. Distinct types prevent repository metadata, Topics, README text, or an index record from being mistaken for a validated Skill or trusted snapshot.

**Rejected:** Continuing to expand `MarketplaceEntry`, scanning every candidate Tree before rendering, trusting index or browser-provided commits, treating integrity verification as content safety, and installing the entire repository for a root-level Skill.

**Migration Boundary:** Marketplace V2 directly replaces the old market RPC semantics in one coordinated Host/client build. A capability endpoint detects stale Host processes before the UI calls V2 methods. The central signed indexer, blocking security policy, advanced trending history, and Desktop v0.3.9 remain later work.

## 2026-08-18: Root Manifest Resources Remain Fixed-Commit and Explicit

**Decision:** A root `SKILL.md` implicitly admits only `SKILL.md`, `scripts/**`, `references/**`, and `assets/**`. A supported manifest may explicitly add safe existing root files, but those declarations are parsed during the same fixed-commit inspection and carried inside the Host-owned snapshot. `AGENTS.md` and `CLAUDE.md` remain excluded even if declared.

**Reason:** Some valid root Skills need a small resource outside the conventional directories, but admitting the whole repository would import unrelated instructions and configuration. Binding the exception to the verified manifest and commit preserves an auditable bundle boundary.

**Rejected:** Browser-provided include lists, implicit whole-repository installation, wildcard manifest expansion, or importing adjacent Agent instructions.

## 2026-08-18: Real-Shell Market Networking Is Separate From UI Integration

**Decision:** The isolated v0.3.8 shell gate requires Marketplace V2 capability negotiation, controls, stale-Host behavior, and bounded error recovery. It records but does not require anonymous GitHub to return live candidates. Provider correctness remains covered by deterministic adapter tests and explicit live probes.

**Reason:** A proxy, anonymous GitHub limit, or regional network timeout must not be misreported as a missing RPC or failed Desktop installation. The product still exposes the bounded provider error to the user.

**Rejected:** Treating external candidate availability as proof of local Host/Client compatibility, or weakening the repository discovery deadline to make a flaky integration gate pass.

## 2026-08-18: Repository Rows Start an Install Confirmation Dialog

**Decision:** Keep repository discovery rows lightweight. Their description is available in full on hover/focus, and their only primary action is `安装`. That action opens a centered modal card and starts fixed-commit Inspection; the card owns loading, error, publisher/avatar, trusted repository media, README summary, Skill selection, risk/integrity evidence, and final install confirmation.

**Reason:** A separate `查看详情` action adds a step without representing the user's actual intent. Moving Inspection behind `安装` preserves low-cost browsing while giving the irreversible boundary a focused review surface similar to DSH's existing plugin-install confirmation.

**Rejected:** Expanding details inline, navigating away from the marketplace list, loading README/Tree on row hover, or installing immediately from repository metadata without `SKILL.md` evidence.

**Reversal Boundary:** The modal uses the existing V2 RPCs and domain types, so its presentation can change without changing Host trust boundaries.

## 2026-08-18: Backups Remain Safety Infrastructure But Leave The Primary List

**Decision:** Hide the routine `备份` affordance from the local Skill row. Preserve automatic complete-bundle backups before update/rollback and keep the Host backup APIs intact. A GitHub-sourced Skill instead shows an explicit per-row `检查更新` action until checked, then `更新` only for an available verified snapshot or a concise result status.

**Reason:** Users need to understand and perform update checks; backup history is an implementation safety mechanism and currently distracts from that workflow.

**Rejected:** Deleting backup storage/APIs, silently updating matched Skills, always showing a disabled update button, or checking every Skill automatically on page load.

**Reversal Boundary:** A future advanced recovery screen can expose the existing backup/rollback APIs without changing stored snapshots.

## 2026-08-18: Reuse One Proxy Agent Per Host Marketplace Transport

**Decision:** A proxy-aware Host marketplace fetch creates one keep-alive `HttpsProxyAgent` when the service is constructed and reuses it for repository discovery, Inspection, snapshots, media, risk, and provenance requests. Repository Inspection still limits document reads to three workers, retries only known transient resets, and retains its fixed overall deadline.

**Reason:** A live `anthropics/skills` Inspection performs 25 GitHub requests. Rebuilding the Agent for every request repeated proxy CONNECT and TLS setup, making the 20-second boundary timing-sensitive even after unbounded concurrency was fixed. Agent reuse reduced the observed live Host path to 7,305 ms without weakening cancellation or safety checks.

**Rejected:** Raising the Inspection deadline without measuring the stages, returning to unbounded blob concurrency, sharing proxy state with the browser, or retrying HTTP/rate-limit/schema failures.

**Reversal Boundary:** A future transport may use a different pooled HTTP client, provided it remains Host-only, HTTPS GET bounded, abort-aware, and does not expose proxy metadata across RPC.

## 2026-08-18: Recent Deletions Are Restorable For Thirty Days

**Decision:** Treat the existing manager-owned trash directory as a public recovery boundary through strict list/restore RPCs. A deleted Skill retains its complete bundle and prior registry metadata for 30 days; normal Core entry points opportunistically remove only validated expired trash records. Restore refuses an occupied library name or any recorded target conflict before moving bytes.

**Reason:** A recoverable delete is not useful if users cannot see or restore the archive. A fixed retention period bounds disk growth while preserving a meaningful undo window across restarts.

**Rejected:** Exposing arbitrary trash paths to the browser, indefinite retention, deleting immediately, restoring over an existing Skill, or using the update-backup UI as a substitute for deletion recovery.

## 2026-08-18: Automatic Skill Maintenance Is Explicit, Local, And Throttled

**Decision:** Store three independent client preferences—automatic source matching, automatic update checking, and automatic updating—in local settings. Enabled work runs after the managed library loads, in dependency order, at most once every 24 hours per task. Automatic updates consume only fresh Host update results and still re-resolve inside Core before mutation.

**Reason:** One-shot toolbar buttons do not communicate a continuing policy. Opt-in checkboxes make network and mutation behavior visible while the throttle prevents every settings visit from scanning a large Skill library.

**Rejected:** Enabling automation by default, running a permanent background service, trusting cached browser snapshots as update authority, updating locally modified Skills, or combining cross-tool synchronization into automatic update.

## 2026-08-18: Market Categories Trigger Discovery Instead Of Empty Local Filters

**Decision:** `全部` uses metadata browse; each named category performs a new GitHub repository query using `category + skill` across repository names, descriptions, and Topics. The selected category is a discovery intent, not proof that every result is a validated Skill or that its content is safe.

**Reason:** GitHub category Topics are optional. Filtering only the currently loaded page by exact Topics made most category controls appear broken even when relevant repositories were searchable.

**Rejected:** Requiring every term in `agent skills category`, importing all GitHub `security` or `coding` repositories, reading every candidate Tree during category selection, or inventing category certainty from a missing Topic.

## 2026-08-18: Market Exposes Only Historical Popularity And Relevance

**Decision:** The current repository market exposes two sorts: `历史热门`, backed by GitHub's all-time repository Star order, and `相关度`, backed by GitHub search relevance. Remove recent-update and recent-creation sorts from the public Core/RPC/Client protocol rather than only hiding their buttons.

**Reason:** Creation and update timestamps do not answer the user's ranking question and add low-value controls. A genuine `近期热门` rank requires historical Star observations; the current runtime has no trustworthy delta series.

**Rejected:** Labeling recently pushed repositories as trending, leaving unsupported sort values in the wire protocol, or approximating recent popularity from a single current Star count.

**Reversal Boundary:** A future indexer may add `近期热门` only after its ranking window, snapshot cadence, minimum history, and fallback behavior are explicit and testable.

## 2026-08-18: Repository Install Dialog Escapes The Settings Container

**Decision:** Render the repository install/inspection backdrop and card through a React portal attached to `document.body`. Show the card immediately while Inspection is pending, keep failures inside the same card with retry, and use a larger bounded desktop surface while retaining a narrow responsive layout.

**Reason:** DSH v0.3.8 settings ancestors can establish clipping and stacking contexts. An inline fixed backdrop could darken the visible region while the card remained clipped or obscured. A body-level portal removes that containment without changing the Host trust boundary or Inspection lifecycle.

**Rejected:** Raising only the inline z-index, navigating away from settings, hiding the dialog until Inspection completes, or making the dialog unbounded on small screens.
# Decisions

## 2026-08-19: rc.7 Uses Only Ordinary DSH Public Contracts

**Decision:** Keep `dsh-skill-manager` as one reusable ordinary DSH Host/Web Client plugin. Install and reconcile it through `dsh plugin --profile web`; use Typert Remote for Host/Client communication and the public `settings.section` slot for presentation. Do not inject `desktopProfiles` or `desktopPnpm` because Skill Manager does not manage DSH package dependencies and must load under standalone `dsh web` without Desktop.

**Presentation boundary:** Remove the v0.3.8-era DOM scan that replaced the platform-owned settings navigation icon. The official rc.7 `settings.section` contract does not expose an icon field, and mutating another plugin's rendered DOM violates the documented composition boundary. Skill Manager retains its folded-file icon inside its own list and market content.

**Installation boundary:** Validate the package in an isolated rc.7 Profile before mutating the user's Profile, then use the official plugin command with a local package artifact. Never copy the bundle directly into `node_modules`, restore the rc.6 Profile, patch rc.7 package internals, infer Desktop identity, or depend on `desktopRuntime`, Electron, launcher bootstrap state, or command shims.

**Reversal boundary:** If DSH later exposes a public settings-navigation icon contract, the folded-file icon may be registered through that field without changing Host/RPC behavior. If a future optional Desktop package-management feature is added, it must dynamically probe `desktopProfiles` and use a generation-scoped `desktopPnpm.runPlugin()` adapter while preserving the ordinary DSH fallback.

## 2026-08-18 — Prefer Fixed-Commit Codeload Snapshots For Repository Details

- **Context:** Multi-Skill repository details used one anonymous GitHub REST blob request for README, manifests, and every `SKILL.md`, exhausting the 60-request/hour unauthenticated allowance. The detail card also appeared to depend on full Inspection even though repository metadata was already available.
- **Decision:** Render candidate metadata and safe GitHub media immediately, then prepare a fixed-commit `codeload.github.com` ZIP in the background. Safely extract it into a manager-owned 100 MB / one-hour LRU cache keyed by repository and commit; coalesce concurrent work and lease active entries. Inspection, static risk scanning, and installation share this cache. Use fixed-commit Raw content plus one REST Tree only when archive download or bounded extraction is unavailable.
- **Limits:** Accept at most 20 MB compressed, 50 MB extracted, 5,000 entries, 10 MB per file, and 200:1 expansion. Reject encrypted/unsupported entries, traversal, Windows-unsafe or case-colliding paths, symbolic links, submodules, malformed ZIP boundaries, and any Tree size/SHA mismatch. Promote `.staging` atomically and never evict active leases.
- **Install boundary:** Background preparation improves perceived latency but is not installation authority. The Host refreshes the default-branch commit for the install intent, builds the final immutable snapshot, scans that exact snapshot before writing, and requires a second explicit acknowledgement when the final result is high risk.
- **Safety:** Enforce compressed/extracted/file-count/single-file/expansion bounds, reject unsafe paths, symlinks and unsupported entries, stage then atomically rename, never import adjacent Agent instructions, never execute remote scripts, and complete bundle validation before writing the managed Skill library.
- **Alternatives:** Per-document REST blobs were rejected because cost scales with Skill count. Raw-only primary reads reduce REST calls but still require many network round trips and cannot provide one reusable repository snapshot. `git clone` was rejected because it depends on local Git/configuration and can involve history, LFS, or submodules.
- **Reversal boundary:** The cache is internal to Host/Core and does not change RPC installation authority; it can later be replaced by a signed central catalog or archive service without changing Client intent semantics.

## 2026-08-18: Marketplace Protocol 3 Uses Experimental GitHub Trending

**Decision:** Marketplace protocol 3 adds `trend-monthly` as the default market view, `trend-weekly`, and a rolling 60-day `latest` query. Monthly and weekly ranks come from Host-side GitHub Trending HTML (`since=monthly|weekly`) and are retained only for strong Skill candidates; repository metadata is completed through the GitHub API without loading README, Tree, or `SKILL.md` during browsing.

**Classification:** Compress the Skill Leaderboard taxonomy into 12 selectable categories plus `通用`. Inspection classification prefers `SKILL.md` metadata, then `skills.json`, Topics, name/description, and bounded README text. It produces at most three tags and evidence, but never grants installation or safety authority.

**Failure semantics:** Trending caches weekly and monthly independently for 30 minutes and may use at most 24-hour stale data. `live`, `cached`, `unavailable`, and `empty` remain distinct; a failed Trending request never silently becomes a recent-update or empty ranking.

**Compatibility:** The Client requires protocol 3, `githubTrending`, and `skillClassification`; stale v0.3.8 Host processes receive a restart instruction. Desktop v0.3.9, Harness timeout work, PR creation, and publication remain deferred.

## Historical decisions
