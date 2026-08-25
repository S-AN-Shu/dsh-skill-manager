# Changelog

## 0.1.0 - 2026-08-26

### Added

- Added the first public native DSH Host/Web plugin distribution, public package metadata, CI, security policy, and a DeepSeek Harness plugin-development compliance guide.
- Added an exported Schemastery `Config` for all Host-owned Skill Manager and synchronization roots; the service class exposes the same schema for Loader validation.

### Changed

- The supported public installation path is a prebuilt GitHub Release tarball. The monorepo does not advertise unverified root-level GitHub source installation or require users to approve a remote build script.
- Client stylesheet ownership is reference-counted in the DOM and released even when Remote disposal fails, preventing CSS leakage across unload and HMR generations.
- Workspace, Core, index-schema, plugin, build identity, documentation, and release artifact versions are aligned at `0.1.0`.

### Verified

- Focused Host/Client coverage passed 42 tests with 8 historical skips. Full Vitest passed 25 files and 213 tests with 8 historical skips; typecheck, workspace build, standalone Host/Client verification, and the exact 16-file npm package gate passed.
- A clean isolated `@deepseek-ai/dsh@0.1.1-rc.2` Profile installed the 128,682-byte tarball through `dsh plugin --profile web add`, composed the `skill-manager` Cordis line, booted the real Web Host, and served both the root UI and the 175,886-byte plugin Client with HTTP 200.

## Unreleased - DSH Desktop v0.5.4 / Harness rc.2 Adapter

### Changed

- Updated plugin-facing DSH development dependencies and peer ranges for the actual v0.5.4 rc.2 runtime matrix while retaining the shipped rc.7 UI primitives contract and prior rc.7 compatibility.
- Renamed the public settings navigation label to `Skill 管理插件`; the owned panel remains `Skill 管理`, and the current Desktop grouping companion places the entry under “高级” without DOM coupling.

### Verified

- Passed 212 tests, typecheck, workspace build, standalone verification, an exact 16-file package gate, an isolated rc.2 install/boot/RPC/market gate, and a rollback-backed real v0.5.4 Profile installation.
- The restarted real Desktop loaded 117 Skills through Host RPC, displayed the entry inside expanded “高级”, and reported zero browser console errors.

## Unreleased - Ordinary Harness rc.7 Compatibility

### Changed

- Updated the plugin's public and development DeepSeek package baseline from rc.6 to rc.7.
- Documented and verified official `dsh plugin --profile web` packaging and installation for standalone Harness.

### Removed

- Removed the v0.3.8-era MutationObserver/DOM replacement of the platform-owned settings navigation icon; Skill Manager now stays within its public rc.7 settings slot.

### Verified

- Passed 212 tests, typecheck, workspace build, standalone package verification, and an isolated real rc.7 Profile install/boot/UI/RPC/market gate.

## Unreleased - Market Runtime And Notice Repair

### Changed

- Repository discovery now has a 25-second abort-aware deadline instead of 12 seconds, allowing bounded margin for proxy CONNECT/TLS variance.
- GitHub Trending now uses the same 25-second abort-aware network margin instead of retaining its separate 12-second default.
- Fixed-commit repository Inspection now allows 45 seconds instead of 30 seconds so a first multi-Skill codeload/parse can finish under observed proxy and filesystem latency; repository installation remains bounded at 60 seconds.
- Completed bulk enable/disable/delete notices can be closed manually and auto-expire after five seconds.

### Fixed

- The Typert result contract now accepts `ownerId: 0` for HTML-only Trending candidates, preventing valid recent-heat results from being rejected before rendering.
- Bulk-notice timers compare the current message before clearing so an older timer cannot remove newer feedback.
- Market installation preserves numeric repository identity plus exact Skill path, and repeat installation is recognized as `already-installed` rather than written again.

## Unreleased - Quota-Safe Market And Trusted Sources

### Changed

- Recent heat now builds repository cards from weekly/monthly GitHub Trending HTML with no per-card REST enrichment; real metadata is deferred to repository Inspection.
- Repository installation may reuse a Host-owned fixed-commit Inspection resolution and codeload cache for one hour, while update checks and updates still resolve the latest snapshot.
- GitHub updates remain available for manager/Host market installations that already carry trusted repository ID and Skill path provenance.

### Removed

- Temporarily hid automatic local source matching, bulk rematching, and per-Skill provenance retry/status controls. Persisted automatic-match preferences are forced off.

### Fixed

- Provenance compatibility RPCs now return `PROVENANCE_MATCHING_DISABLED` before any search or GitHub request, preventing repeated 30-second failures and anonymous quota exhaustion.
- Trending candidates no longer disappear when GitHub REST metadata enrichment is rate-limited.
- Detail followed by installation no longer repeats the same metadata/commit/Tree resolution inside the one-hour cache window.

## Unreleased - Repository Batch Protocol 5

### Added

- Added Protocol 5 capabilities, `installRepository`, and `verifyProvenanceBatch` to the 24-method Host surface.
- Added `一键全部重匹配` with 20-name chunking, progress/outcome counts, and concrete per-Skill failure display.
- Added repository-scoped fixed-commit batch snapshot preparation, per-Skill batch result isolation, and skills.sh-origin discovery labels.
- Added filtered local multi-selection with bulk DSH enable, disable, and 30-day recoverable delete operations.
- Added a bounded repository detail gallery with one primary preview and up to eight safe manifest/README/Social Preview images.

### Changed

- Local-to-GitHub matching now reuses one repository preparation for every candidate Skill and persists only a unique exact full-bundle proof with numeric repository identity and exact Skill path.
- Repository row actions silently install all currently installable Skills; the detail card supports selecting explicit paths and resolving high-risk confirmations.

### Fixed

- Ordinary Git directory entries no longer make every nested Skill un-installable; unsafe symlinks, submodules, modes, and entry types remain isolated blockers.
- YAML block-scalar description newlines no longer make a verified snapshot fail final metadata comparison.
- One provenance transport/deadline failure no longer rejects all other names in the batch; Host concurrency is capped at two.
- Repository-level symlinks no longer discard a safe ZIP snapshot or trigger a fan-out of Raw file requests; a symlink or submodule inside one Skill blocks only that Skill.
- Abort-ignoring dependencies can no longer extend provenance analysis beyond 30 seconds or repository installation beyond 60 seconds.
- Managed Skill rows now allocate explicit selection, icon, copy, and action tracks, with an intentional narrow-screen action stack instead of CSS auto-placement.
- Individual media resolution or browser decode failures no longer clear successful repository previews.

## Unreleased - Provenance V2

### Added

- Added `dsm-skill-fingerprint-v1`, an atomic bounded GitHub Skill observation index, protocol-4 provenance/update capabilities, stable repository identity metadata, and update risk display/confirmation.

### Changed

- Local-to-GitHub matching now trusts only manager-owned provenance or one unique revalidated fixed-commit complete-bundle identity; `SKILL.md` metadata and marketplace text only generate candidates.
- GitHub updates now use the shared Snapshot Resolver, follow repository rename by numeric ID, allow path basenames different from Skill names, report moved sources, refresh the final commit, and refuse automatic high/unknown-risk updates.
- Repository Inspection now warms the verified fingerprint index after returning details with at most two background workers and per-Skill failure isolation.

All notable completed changes will be recorded here.

## Unreleased

### Added

- A shared fixed-commit GitHub repository snapshot cache for Inspection, risk, media, and installation: bounded codeload ZIP primary reads, verified Raw fallback, one-hour/100 MB LRU storage, active leases, concurrent request coalescing, ZIP-bomb/path/SHA defenses, and atomic staging.
- `一键开启全部` for currently disabled managed DSH Skills with per-Skill failure isolation.
- Marketplace protocol 3 classification and ranking: 12 compact Skill categories with evidence/confidence, rolling-60-day `最新`, Host-owned GitHub Trending weekly/monthly candidate lists, monthly-trend default, independent 30-minute/24-hour cache states, and explicit live/cached/unavailable/empty source messaging.

- Explicit GitHub repository search labeling, remote category searches across repository names, descriptions, and Topics, and per-Skill exact provenance outcomes with retry controls.
- Default-off persisted `自动匹配来源`, `自动检查更新`, and `自动更新` preferences that run on entry at most once per 24 hours, plus a clearer manual `同步到其他工具` action.
- Recoverable two-step managed Skill deletion with a visible `最近删除` list, strict restore workflow, and validated 30-day retention.
- Marketplace V2 layered repository candidates, fixed-commit inspections, Skill descriptors, Host-owned immutable snapshots, and managed-install mapping.
- Capability negotiation plus metadata-only GitHub repository browse/search, on-demand README/manifest/Tree inspection, and multi-Skill batch installation with failure isolation.
- Static content-risk assessment with high-risk second confirmation and integrity/risk separation.
- Structured GitHub media resolution with redirect, MIME, byte, dimension, pixel, and SVG restrictions.
- Independent `packages/index-schema` workspace for future catalog metadata, repository, and Skill records; no Indexer service is shipped yet.
- Restricted root-Skill manifest file support bound to the inspection commit, while adjacent `AGENTS.md` and `CLAUDE.md` remain excluded.

- Install-ranked skills.sh market home with 20-row incremental loading and explicit popularity provenance.
- Automatic visible-row content tags and explicit bounded GitHub/Hugging Face provenance matching that grants updates only after exact immutable bundle identity.
- Folded-file icon replacement for the v0.3.8 `Skill 管理` settings row with disposal-time restoration.
- Initial project documentation and development baseline.
- Initial typed core library with managed Skill creation, registry persistence, and retrieval.
- DSH target enablement through managed per-Skill active directory links.
- Explicit external Skill discovery and bundle-scoped import without adjacent Agent instructions.
- Pure leading slash prefix parser with chained segments and body-text termination.
- Versioned DSH Host RPC for listing, creating, and enabling Skills through the `skillManager` Typert namespace.
- Strict Host wire descriptors, Cordis bundle patch, and a standalone ES2022 plugin build that includes the shared core runtime.
- React 18 Skill settings section with search, refresh, inline creation, source labels, and per-Skill DSH switches.
- DSH browser module-loader bundle, lightweight client descriptors, and reusable Host/client build verification.
- Replaceable skills.sh legacy search adapter with strict normalization, source-aware metrics, validation, caller cancellation, and a bounded default request deadline.
- Official Hugging Face curated manifest source with strict schema/path validation, local metadata search, cancellation, and an active response-body deadline.
- Bounded GitHub repository discovery source with separate availability, exact Skill-document path candidates, repository-star provenance, rate-limit/incomplete-search reporting, cancellation, and an active overall deadline.
- Composite marketplace search with deterministic GitHub Skill de-duplication, per-source availability, catalog provenance, partial-failure isolation, and skills.sh metric preservation.
- Market source filters for all catalogs, skills.sh, GitHub, and Hugging Face, plus explicit partial-source warnings and GitHub installation-host labels.
- Historical V1 `searchMarketplace` Host RPC with strict Typert request/result descriptors and stable provider error envelopes (superseded by Marketplace V2).
- Theme-adaptive All/Market/Custom settings views with explicit marketplace search, source-neutral file icons, publisher and metric metadata, and repository source links.
- GitHub marketplace resolver with exact Skill-path/frontmatter validation, commit/blob snapshots, explicit author and repository-star enrichment, safe path checks, stable provider errors, caller cancellation, and an active 10-second overall deadline.
- GitHub resolver validation for source-provided exact paths, including repository/install locator equality and same-name candidate isolation.
- Historical V1 `resolveMarketplace` Host RPC with strict validation and stable resolver errors (superseded by Marketplace V2).
- Commit-pinned GitHub marketplace installation with exact-directory selection, Git blob byte verification, cross-platform path/link/submodule rejection, bounded bundles, atomic registry rollback, source provenance, and offline-safe lazy networking.
- Historical V1 `installMarketplace` Host workflow (superseded publicly by intent-only `installSkill`; its safe atomic Core machinery remains reused).
- Read-only managed Skill update checks with local conflict detection, complete GitHub tree fingerprints, immutable latest snapshots, deterministic bounded-concurrency batches, and active deadline/cancellation behavior.
- Explicit GitHub Skill updates with core-owned immutable re-resolution, durable complete-bundle backups, reversible rollback, current-enablement preservation, shared multi-stage deadlines, and journal-backed interrupted replacement recovery.
- Versioned Host RPC for update checks, explicit updates, persistent backup listing, and rollback, with strict request/result validation and matching lightweight browser descriptors.
- Theme-adaptive update management with explicit library checks, conflict-aware per-Skill status, scoped update busy/error recovery, persistent inline backup history, and two-step reversible rollback.
- Host-configured metadata-only discovery and explicit import for Codex, Claude Code, and `.agents` Skills without exposing filesystem paths or adjacent Agent instructions.
- Per-Skill external directory-link synchronization with restart-visible enablement, conflict detection, unmanaged-path removal refusal, strict Host RPC, and a theme-adaptive explicit synchronization view.
- DSH Desktop v0.3.8 adapter with standalone bundle staging, complete companion `dist` synchronization, exact version gates, and an idempotent rc.6 leading command/Skill-prefix dependency patch.

### Changed

- Repository detail cards now render candidate metadata and safe GitHub media immediately while fixed-commit repository content is prepared in the background. Final installation refreshes the commit and repeats static risk assessment against the exact snapshot before any managed-library write.
- The repository market now exposes one `近期热度榜` (monthly-ranked with weekly metrics and weekly-only candidate append), Star-backed `历史热门`, rolling-60-day `最新`, and search `相关度`. GitHub Trending remains an experimental HTML source with explicit cache/unavailable states; recent update time is not used as a popularity substitute.
- Repository content is now a large keyboard-accessible install-detail trigger, and its portal/loading state commits before fixed-commit Inspection starts.
- Repository rows now use a larger `安装` action and open a 720px bounded, theme-adaptive confirmation dialog portaled to `document.body`; full repository descriptions remain available on hover or keyboard focus.
- GitHub-backed local Skills now expose explicit per-Skill update checks and show `更新` only after a newer immutable snapshot is verified. Routine backup history is hidden from the primary list while automatic replacement backups remain intact.
- The Host marketplace transport reuses one keep-alive proxy Agent per service instance instead of rebuilding the proxy/TLS tunnel for every GitHub request.
- Replaced the four public V1 marketplace RPCs with `getCapabilities`, `searchRepositories`, `browseRepositories`, `inspectRepository`, `installSkill`, `assessSkillRisk`, and `resolveMedia`, then added recoverable managed deletion/list/restore; this historical Protocol 4 Host surface had 22 methods before Protocol 5 added repository batch operations.
- Changed the market home from skills.sh Skill rows to GitHub repository candidates; skills.sh and Hugging Face remain discovery/provenance signals.
- Bound installation metadata and allowed root manifest files to the same Host inspection commit rather than re-resolving a second potentially different default-branch head.
- Changed the V2 Snapshot Resolver contract from a legacy marketplace entry to a concrete immutable snapshot with verified file bytes; Core independently checks snapshot identity, Git blob SHA values, the complete Tree fingerprint, and metadata before installation.

- Split local Skill management/search from the online Skill marketplace/search, added Codex/Claude Code/Agents/OpenCode source filters with selectable bulk import, and classified unverifiable imports as self-authored while retaining discovery-source labels.
- Market entries with incomplete catalog metadata can now load the exact Skill description and author on demand through Host-side immutable resolution, then recompute simple content tags.
- Bundled the Windows proxy-aware HTTPS transport into the Host artifact so standalone Harness profiles do not depend on Desktop's parent dependency tree.
- Leading slash chains now use Harness-compatible whitespace-bounded command/Skill tokens; recognized tokens may continue the prefix, while ordinary body text, unknown tokens, URLs, and later slashes remain plain text.
- Managed, discovered, synchronized, and marketplace Skills now share a minimal folded-file glyph; generated letter covers and remote repository artwork are not rendered.
- Settings surfaces, borders, labels, hover states, and accents now map directly to verified DSH v0.3.8 theme aliases, preserving original/light/dark/system modes with standalone fallbacks.

### Fixed

- Removed the per-document REST blob request pattern that exhausted anonymous GitHub quota in large multi-Skill repositories; content now normally costs one fixed-commit codeload download after the repository metadata/commit/Tree baseline.
- Accepted historically valid `origin: local-import` deletion archives so they remain listable and restorable after restart without relaxing bundle/source validation.
- Retried transient idempotent Host GET connection failures with bounded abort-aware delays, reducing intermittent proxy/TLS resets while preserving explicit persistent-failure states.
- Fixed the DSH settings stacking/clipping failure where clicking a repository darkened the page but hid the install card. The card now renders immediately with a loading state, remains visible on Inspection failure, and supports retry in place.
- Fixed real multi-Skill repository Inspection failures by combining bounded document concurrency, transient reset retries, and proxy-Agent reuse; a live `anthropics/skills` Host probe completes within the existing 20-second deadline.
- Prevented v0.3.8 host styles from enlarging the `Skill 管理` sidebar glyph by enforcing important 16×18 minimum/maximum dimensions, block layout, bounded overflow, and a reset transform.
- Repaired GitHub repository discovery HTTP 422 by replacing qualifier-only `topic:` OR clauses with GitHub-supported topic terms using `in:topics`.
- Replaced implicit per-row provenance requests with an explicit bounded-concurrency batch, and persisted matched, no-match, ambiguous, ineligible, and transport-failure outcomes without granting update authority to non-matches.
- Excluded `AGENTS.md` and `CLAUDE.md` from remote bundles at every depth, rejected manifest attempts to admit them, and accepted OpenCode as a valid persisted enablement target during backup/rollback validation.
- Updated the isolated v0.3.8 UI gate to distinguish Marketplace V2 integration from external GitHub availability and to accept the stable 12-second repository discovery timeout state.

- New self-authored Skills now store the same complete-bundle hash used by import, provenance, and update integrity checks.
- Restored GitHub, skills.sh, and Hugging Face access when DSH uses an enabled Windows user proxy but the Host has no proxy environment variables; GitHub requests also send the required User-Agent.
- Exported the plugin manifest so DSH v0.3.8 registers and serves the browser bundle; the real settings shell now shows Skill Manager and its GitHub Market source.
- Prevented rc.6 from claiming manually typed commands on Space and suppressing later prefix suggestions, while preserving native `+ 命令` launcher claims and `/command arguments` Enter submission.
- Refreshed synchronization target states immediately after external Skill import so Codex, Claude Code, and `.agents` controls appear without a second scan.
