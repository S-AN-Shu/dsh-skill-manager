# Project Context

The public `0.1.0` objective packages the existing ordinary DSH Host/Web implementation as a prebuilt GitHub Release tarball and publishes an audited source snapshot. The release adds official Schemastery configuration, Client stylesheet cleanup, public package metadata, CI, a security policy, and a native DSH plugin-development baseline. It targets the verified Desktop v0.5.4 / Harness rc.2 contract and deliberately makes no dsh-TUI or `dsh-std` conformance claim.

## 2026-08-24 DSH Desktop v0.5.4 / Harness rc.2 Installation

Skill Manager is now installed in the active DSH Desktop v0.5.4 `web` Profile as an ordinary public-contract Host/Web plugin. The actual runtime matrix is Harness and public client/Typert packages `0.1.1-rc.2`, with `@deepseek-ai/dsh-client-ui-primitives` still shipped at `0.1.0-rc.7`. The plugin uses compatible peer ranges, has no Desktop-private service or DOM dependency, and is registered through the official Profile package/bundle mechanism.

The public `settings.section` contract has no navigation-group field. The installed Desktop grouping companion classifies bounded navigation labels, so the section label is `Skill 管理插件`; its natural `插件` keyword places it under “高级” while the owned panel title remains `Skill 管理`. A real restarted v0.5.4 UI loaded 117 local Skills through Host RPC with zero browser console errors. The pre-install Profile is preserved at `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260824-052127-desktop-v054-rc2-before-install`.

## 2026-08-19 Ordinary Harness rc.7 Adapter

Skill Manager now targets standalone DSH rc.7 through public ordinary-Harness contracts. Its Host remains a Typert Remote service, its Web Client registers through `settings.section`, and it does not inject Desktop services or inspect Electron/private launcher state. The former v0.3.8 DOM mutation that replaced the platform settings icon was removed because rc.7 exposes no public icon field. An isolated rc.7 Profile installed through the official `dsh plugin` command and passed real Host, Client, UI, RPC, market, console, and layout checks. Real Profile installation awaits a safe stop of the user's currently running rc.7 Web Host.

## 2026-08-19 Local Runtime Transition To Harness rc.7

The user's local portable Desktop v0.3.8 and its rc.6 `web` Profile are no longer active. They were moved into `%USERPROFILE%\Documents\dsh-desktop-backups\20260819-164633-v038-clean-uninstall` before a future Desktop reinstall, while sessions, credentials, settings, managed Skills, Skill Manager data, and storage remained under `.dsh`. Standalone `@deepseek-ai/dsh@0.1.0-rc.7` is now installed globally and version-verified. This environment change does not make the repository's v0.3.8 Desktop adapter rc.7-compatible; PR #117 remains an explicitly version-bounded reference implementation.

## 2026-08-19 Upstream Desktop Draft PR

The verified v0.3.8 Desktop adapter was published for maintainer evaluation as draft PR `myYangyunfan/dsh_desktop#117` from `S-AN-Shu:codex/dsh-skill-manager-v038` at commit `563522c`. Upstream `main` was already Desktop v0.4.1 with DSH rc.7, while this implementation remains tied to exact v0.3.8 commit `888b6fe` and rc.6. The PR therefore leads with an explicit incompatibility notice and asks maintainers to port the plugin registration, packaged companion, and Composer behavior onto their chosen stable baseline rather than merge the rc.6 dependency patch unchanged.

## 2026-08-19 Market Runtime Contract And Transient Notice Repair

HTML-only Trending candidates now retain `ownerId: 0` as an explicit list-stage unknown sentinel accepted by the Typert boundary. Historical repository discovery keeps a bounded, abort-aware deadline but allows 25 seconds for intermittent Windows proxy CONNECT/TLS latency. Completed bulk enable, disable, and delete notices can be closed manually and expire automatically after five seconds without clearing progress, errors, or a newer notice.

GitHub Trending uses the same 25-second cancellable margin. Fixed-commit repository Inspection uses a 45-second cancellable boundary after a real first-load `anthropics/skills` attempt crossed the old 30-second limit. An isolated market gate verified 20/20 descriptors as installable, persisted one Skill with exact GitHub repository ID and path provenance, and recognized a repeat install without duplication. Market installations remain disabled until the user enables DSH or another configured target.

The revision is synchronized to both DSH Desktop v0.3.8 plugin targets under deployment `d56b95eaa4344e17a684dcdd0aceaf88`. Installed-package probes passed the real Typert descriptor with 12 recent-heat and 20 historical-popular candidates; the rollback backup and exact hashes are recorded in `docs/ENVIRONMENT.md`.

## 2026-08-19 Quota-Safe Market And Trusted-Source Updates

Local Skill-to-GitHub provenance discovery is temporarily disabled because candidate fan-out repeatedly exhausted the anonymous GitHub REST allowance and produced per-Skill 30-second failures. The Client hides automatic matching, bulk rematching, and per-row retry/status controls; persisted automatic-match settings are forced off. Compatibility RPCs remain registered but return `PROVENANCE_MATCHING_DISABLED` without network access. Skills installed through the market/Host keep manager-written GitHub repository ID, path, commit, and fingerprint provenance, so their explicit and automatic update paths remain available. Manual or AI filesystem copies without that trusted installation record remain self-authored.

Recent heat now parses weekly and monthly GitHub Trending HTML directly and performs no per-card `api.github.com` enrichment. A live 2026-08-19 probe returned 13 Skill/Agent candidates using exactly two HTML requests and zero REST requests. The count is intentionally variable because GitHub Trending is a global bounded list rather than a complete Skill catalog. Repository Inspection still fixes and validates a commit; installation within one hour may reuse that Host-owned resolution and codeload cache instead of consuming another metadata/commit/Tree cycle. Updates still resolve the latest verified snapshot.

This revision is synchronized to both local DSH Desktop v0.3.8 targets. The installed 16-file packages match source manifest SHA-256 `8EC60B2EE6B361CA7E15C3618EC045818BB078AE30745F99A00ED450312E5990`; rollback backup `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-031020-quota-safe-market` preserves both predecessor trees.

## 2026-08-19 Provenance Rematch And Installability Repair (Historical)

Protocol 5 now isolates per-Skill provenance failures with two Host workers and exposes an explicit `一键全部重匹配` action for every non-GitHub managed Skill. Ordinary Git Tree directory entries no longer make contained Skills un-installable; symlinks, submodules, unsafe blob modes, and unknown entry types inside a Skill remain blocked per Skill. Core also canonicalizes parsed `name` and `description` metadata so YAML block-scalar trailing newlines cannot make the fixed descriptor disagree with the final pre-write parse. A real fixed-commit `anthropics/skills` check found 20/20 installable descriptors, and `academy-guide` installed successfully into an isolated managed root. After a zero-process lock check, this revision was atomically synchronized to both local DSH Desktop v0.3.8 targets and passed installed-package hash, syntax, and Host import verification.

## 2026-08-19 Dense Settings And Repository Gallery Iteration

The v0.3.8 Client now gives each managed Skill row explicit selection, icon, copy, and action tracks, with an intentional stacked action layout below 520px. Repository details keep the immediate social preview and may add up to eight Host-validated manifest or same-repository fixed-commit README images. Media resolution is bounded to three concurrent requests, individual failures are isolated, and the user can switch the primary preview through a horizontal thumbnail strip. This iteration changes presentation only; repository inspection, fixed-commit validation, risk assessment, and installation authority remain on the Host.

## 2026-08-19 Repository Batch Protocol 5 Iteration

The current Host protocol is 5. Repository is the discovery, display, download, and cache unit; a directory with its own `SKILL.md` is the matching, installation, enablement, update, and deletion unit. Local-to-GitHub matching uses manager-owned provenance or one unique revalidated canonical whole-bundle fingerprint, backed by a bounded historical observation index and stable numeric repository identity plus exact path. Batch analysis resolves one fixed-commit repository snapshot for all contained Skills, while batch installation isolates per-Skill results. skills.sh runs only as an optional, best-effort candidate source alongside GitHub search; it cannot supply a trusted path, commit, fingerprint, installation, or update authorization. DSH Desktop v0.3.8 was the only target for this iteration; v0.3.9 and publication/PR were deferred.

## Purpose

Build one shared Skill management engine that works as a DeepSeek Harness community plugin and can be bundled into DSH Desktop through a small upstream pull request.

## Users

- DSH Desktop users who need a graphical Skill manager.
- DeepSeek Harness users who need Skill creation, enablement, marketplace, synchronization, and update workflows.
- Users who already keep Skills in Codex, Claude Code, or `.agents/skills` directories.

## Current State

The repository was initialized on 2026-08-16. The shared Core creates and manages Skills, discovers and explicitly imports direct-child bundles from Host-configured Codex/Claude Code/Agents/OpenCode roots, and links managed Skills without importing adjacent Agent instructions. Marketplace V2 separates GitHub repository candidates, fixed-commit repository inspections, Skill descriptors, Host-owned immutable snapshots, and managed installations. Repository details render candidate metadata immediately, then reuse one safely bounded fixed-commit codeload snapshot across README/manifest/Skill inspection, risk, repository media, and installation; fixed-commit Raw reads are the verified fallback. Root-level symlinks are omitted from a repository snapshot, while a symlink or submodule inside a Skill bundle blocks only that Skill. The public Host surface has 24 methods and begins market use with Protocol 5 capability negotiation. `installRepository` accepts only repository identity, an all-or-path selection, and explicit high-risk acknowledgements; it reuses a recent Host-owned resolution when available, otherwise resolves a current commit, and independently reports installed, already-installed, conflict, confirmation-required, and failed Skills. Local provenance discovery endpoints are compatibility-only and disabled without network access. The React 18 UI opens a detail card from the repository body, silently installs all installable Skills from the row action, and supports selected local Skills with bulk enable, disable, and recoverable delete actions. Marketplace protocol 3 ranking fields remain wire-compatible within Protocol 5. A separate workspace freezes the future catalog schema; the central Indexer is deferred.

The v0.3.8 adapter stages the same standalone bundle, applies the exact rc.6 leading-prefix patch, and is verified in an isolated real shell. Protocol 5 and the later dense-layout/multi-image revision passed fresh repository, package, adapter, browser, and isolated UI gates on 2026-08-19, then were hash-synchronized to the `web` profile and portable Desktop after complete two-target rollback backups. Exact hashes and recovery locations are recorded in `docs/ENVIRONMENT.md`. Draft Desktop PR #117 publishes the v0.3.8 reference implementation with an explicit v0.4.1 porting requirement; no package or release had been published at that point. DSH Desktop v0.3.9 implementation remained outside that iteration.

## Non-Goals

- Management of `AGENTS.md`, `CLAUDE.md`, or system prompts.
- Arbitrary shell/script macro commands.
- Silent modification of existing whole-directory junctions.
