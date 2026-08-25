# Task Status

## Completed Objective - Public GitHub DSH Plugin Release - 2026-08-26

- Objective: turn the existing Skill Manager workspace into an auditable native DeepSeek Harness Host/Web plugin distribution, publish its source as the new public GitHub repository `S-AN-Shu/dsh-skill-manager`, and attach a prebuilt release artifact that can be installed without executing remote build scripts.
- Scope: native DSH bundle and the ordinary public Desktop/Web settings integration are primary. Summarize the official DSH plugin rules inside the project and stage one reusable Wiki candidate. Do not claim `dsh-std` compatibility or dsh-TUI ecosystem admission in this release; both remain optional future work that requires their own activation/conformance evidence.
- Initial baseline: the plugin exposed a `dsh.bundle.patch`, a stable Cordis patch id, a Typert Host service, and a public `settings.section` Client entry tested against Harness `0.1.1-rc.2` / DSH Desktop v0.5.4. It had no public repository or Git remote, package versions remained `0.0.0`, Host config lacked an exported Schemastery `Config`, Client-owned CSS was not disposed on unload, and GitHub-source installation was not self-contained from the monorepo root.
- Publication strategy: initial version `0.1.0`; public source plus a verified prebuilt plugin tarball. Do not advertise `dsh plugin add github:...` until a root-installable, self-contained `prepare` path has been proven. The release notes and README must distinguish source checkout, release artifact installation, bundle activation, Desktop integration, and the unsupported TUI/cross-Host claims.
- Privacy and safety gate: audit the worktree and Git history for credentials, keys, private files, user-specific absolute paths, generated evidence, and oversized artifacts. Preserve the existing dirty worktree and unrelated user changes. Publish only the reviewed project scope; never include caches, build output, local profiles, credentials, rollback archives, or remote Skill contents.
- Acceptance: official-rule compliance matrix recorded; Config and lifecycle ownership corrected; package metadata/version/install documentation/CI ready; focused and full tests, typecheck, workspace build, standalone bundle verification, npm-pack contents, isolated rc.2 profile install/activation, secret scan, and exact Git diff/scope checks pass; then create the public repository, push the audited commit, add DSH topics, publish the prebuilt `v0.1.0` release, and stage the Wiki candidate with sources, evidence, limits, and invalidation conditions.
- Current status: completed. Terra's official-rule study is recorded in `docs/DSH_PLUGIN_DEVELOPMENT_STANDARD.zh-CN.md` and the reusable Wiki candidate. The Host exports one Schemastery Config through both the module and service class; Client CSS is reference-counted and disposed; public metadata, CI, security policy, release instructions, and `0.1.0` versions are synchronized.
- Validation: focused coverage passed 42 cases with 8 historical skips; full Vitest passed 25 files and 213 tests with 8 historical skips. Typecheck, workspace build, standalone bundle import/Client verification, exact 16-file npm pack, isolated rc.2 official Profile install/config composition, and real Web Host HTTP loading passed. Clean GitHub Linux CI run `32871114313` passed all gates after it exposed and drove fixes for an unbuilt private workspace and a Windows-only path fixture.
- Publication: public repository `https://github.com/S-AN-Shu/dsh-skill-manager`; release `https://github.com/S-AN-Shu/dsh-skill-manager/releases/tag/v0.1.0`; tagged commit `5d1e3ea2319e57c3d7d64b4c7e174f00bb54d416`. The uploaded 128,682-byte `dsh-skill-manager-0.1.0.tgz` downloads byte-identically with SHA-256 `46118AE5425BC68CA3020B0FF80DD770A497AC6C30A9843FC5C0D0EBCF98A38B`.
- Privacy boundary: public `main` starts from a clean root commit and contains only GitHub noreply authors. Existing local history with the personal email was preserved on `codex/core-library` and was not uploaded. Credential/path scans found no publishable secret or user-specific absolute path; `.planning`, `design-qa.md`, caches, build output, profiles, credentials, and rollback archives are excluded.

## Active Objective - DSH Desktop v0.5.4 / Harness rc.2 Adapter And Local Installation - 2026-08-24

- Objective: adapt the current Skill Manager ordinary DSH plugin to the locally installed DSH Desktop v0.5.4 runtime, whose active Harness contract is `@deepseek-ai/dsh@0.1.1-rc.2`, then install it into the active `web` Profile through official plugin semantics.
- Verified baseline: the Windows application and registry report DSH Desktop `0.5.4`; its bundled `dsh-desktop/package.json` still reports `0.5.2`, but its actual DSH, Typert, client runtime, locale, settings, and remote packages are `0.1.1-rc.2`. The active `web` Profile does not contain `dsh-skill-manager`, and the Desktop process is currently running.
- Governing contract: follow the current `anywhere-labs/deepseek-harness-desktop/docs/plugin-development.md`. Skill Manager remains an ordinary Host/Web Client plugin using public Typert Remote and `settings.section`; it must not require `desktopProfiles`, `desktopPnpm`, Electron globals, private launcher state, or DOM replacement of platform-owned settings chrome.
- Advanced-navigation requirement: place the entry in the Desktop's visible “高级” group. Upstream `settings.section` exposes only `id`, `order`, and `label`; the installed `dsh-settings-groups` companion classifies navigation labels by bounded keywords. Use the natural navigation label `Skill 管理插件` so the existing `插件` rule places it under “高级”, while the feature page title remains `Skill 管理`. Do not patch the companion plugin or add private DOM coupling to Skill Manager.
- Compatibility work: compile and test against rc.2 packages, preserve a peer range that covers the previously supported rc.7 generation where the public contracts remain compatible, and repair only concrete build/runtime differences found by rc.2 verification.
- Installation rule: build and package the standalone plugin, verify it in an isolated rc.2 `DSH_HOME`, then create a rollback backup of the real `web` Profile and install through `dsh plugin --profile web add <package>`. Do not copy files directly into the Desktop installation directory or hand-edit Profile `node_modules`.
- Acceptance: focused and full tests, typecheck, workspace build, standalone package verification, isolated rc.2 profile installation/boot/RPC checks, exact rollback backup, real Profile package/bundle verification, and a v0.5.4 UI gate showing `Skill 管理插件` under “高级” all pass. Preserve sessions, credentials, settings, Skills, Skill Manager data, storages, and all unrelated Profile plugins.
- Current status: completed. Source compiles against the v0.5.4 runtime matrix (`0.1.1-rc.2` public packages plus the still-rc.7 UI primitives package), while peer ranges retain the prior rc.7 contract. Focused tests passed 50 cases with 8 historical skips; full Vitest passed 25 files and 212 cases with 8 historical skips; typecheck, workspace build, 175,211-byte Client verification, and the exact 16-file npm package gate passed. The isolated rc.2 gate mounted management and market RPC surfaces and returned 13 live recent-heat candidates with zero browser console errors. After an exact zero-process check, the real Profile was backed up to `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260824-052127-desktop-v054-rc2-before-install`, installed through `dsh plugin --profile web add` from the stable local package, and restarted. The real v0.5.4 UI shows `Skill 管理插件` inside the expanded “高级” group, loads 117 Skills through Host RPC, and reports zero browser console errors. Evidence screenshot: `output/playwright/dsh-desktop-v054-rc2-skill-manager-advanced.png`.

## Active Objective - Ordinary Harness rc.7 Skill Manager Adapter - 2026-08-19

- Objective: adapt and install the current Skill Manager into the standalone `dsh web` Profile running `@deepseek-ai/dsh@0.1.0-rc.7`.
- Governing contract: follow `anywhere-labs/deepseek-harness-desktop/docs/plugin-development.md`, its referenced architecture, and `dsh-plugin-desktop/docs/plugin-services.md`. Skill Manager remains an ordinary DSH Host/Web Client plugin; it must use public Host RPC and Web slots, must not require Desktop services, and must not read Electron/private Desktop runtime state.
- Verified baseline: the fresh rc.7 `web` Profile contains only `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app`. The current plugin uses public Typert Remote and `settings.section`, but its peer/dev manifests still target rc.6 and its Client mutates the rendered settings sidebar DOM to replace an icon.
- Compatibility correction: update the declared/tested DSH contract to rc.7 and remove the private DOM icon replacement. Keep the shared folded-file icon inside Skill Manager-owned content; accept the platform-owned settings navigation presentation until a public icon slot exists.
- Installation rule: build a standalone package, test it first in an isolated rc.7 `DSH_HOME`, then back up the real fresh `web` Profile and install through `dsh plugin --profile web add <package>`. Do not copy into `node_modules`, edit Loader internals, restore the rc.6 Profile, or patch rc.7 runtime packages.
- Acceptance: focused/full tests, typecheck, workspace build, package verification, isolated rc.7 profile install/boot/UI/RPC checks, rollback-backed real Profile installation, and installed Profile verification pass. Preserve `.dsh` sessions, credentials, settings, Skills, Skill Manager data, and storages.
- Status: baseline and official contracts verified; source adaptation pending.

## Completed Local Desktop v0.3.8 Retirement And Harness rc.7 Install - 2026-08-19

- Objective: remove the local portable DSH Desktop v0.3.8 cleanly before a new Desktop download and make the standalone DeepSeek Harness rc.7 command available.
- Scope executed: after a zero-process check, moved the v0.3.8 portable program, Electron state, old rc.6 `web` Profile, and desktop shortcut to `%USERPROFILE%\Documents\dsh-desktop-backups\20260819-164633-v038-clean-uninstall`.
- Preserved state: `.dsh\sessions`, credentials, settings, Skills, Skill Manager data, and storages remain in their original locations. The old Profile was isolated rather than deleted so its custom plugin configuration remains recoverable without contaminating a fresh rc.7 Profile.
- Harness result: installed global `@deepseek-ai/dsh@0.1.0-rc.7`; `dsh --version` and the global npm inventory both report `0.1.0-rc.7`.
- Verification: all four old active Desktop/Profile paths are absent, all six preservation targets are present, the backup contains all four expected payloads, and the final DSH/Electron process count is zero.
- Status: completed. The user can now install the newer Desktop, which should create a fresh `web` Profile.

## Active Objective - Upstream Desktop Draft PR - 2026-08-19

- Objective: publish the verified DSH Skill Manager Desktop adapter as a draft pull request to `myYangyunfan/dsh_desktop`.
- Authorized compatibility boundary: the implementation remains based on exact DSH Desktop v0.3.8 commit `888b6fe` and DSH rc.6. Upstream `main` is currently v0.4.1 with DSH rc.7; the user explicitly authorized submission without a local v0.4.1 port so maintainers can decide how to adapt it alongside their pending stabilization work.
- Required PR disclosure: do not claim v0.4.1 compatibility. State the exact tested baseline, changed Desktop integration paths, completed validation, expected porting work, and that the PR is intentionally draft.
- Intended Desktop PR scope: `dsh-desktop/main.js`, `dsh-desktop/scripts/patch-deps.js`, `dsh-desktop/scripts/sync-companion-plugins.js`, and the packaged `dsh-desktop/assets/plugins/dsh-skill-manager/` directory only.
- Acceptance: create a fork branch under the authenticated `S-AN-Shu` account, stage only the intended paths, commit and push, open a draft PR against upstream `main`, and record the branch, commit, PR URL, validation, and compatibility risk.
- Publication: fork branch `S-AN-Shu:codex/dsh-skill-manager-v038`, commit `563522c`, draft PR `myYangyunfan/dsh_desktop#117` (`https://github.com/myYangyunfan/dsh_desktop/pull/117`) targeting upstream `main`.
- PR disclosure: the opening compatibility notice states that this is a v0.3.8/rc.6 reference implementation, that upstream is v0.4.1/rc.7, that `patch-deps.js` must not be merged unchanged, and that maintainers must port and revalidate it.
- Publication validation: the pushed commit contains exactly 19 intended paths; staged diff checks and 9 JavaScript syntax checks passed before commit. GitHub reports the PR as draft with the expected cross-fork head and `main` base.
- Status: completed. No package or release was published, and no v0.4.1 compatibility claim was made.

## Active Objective - Market Timeout Parity And Install Verification - 2026-08-19

- Objective: remove the remaining 12-second GitHub Trending boundary, prevent a first fixed-commit multi-Skill Inspection from failing at 30 seconds under observed proxy/codeload latency, and prove that market installation persists trusted GitHub identity and is recognized as installed.
- Verified state: the user's `anthropics/skills` attempt did not install any Skill. The live registry still contains 117 Skills with no `anthropics/skills` source and the managed library has no `academy-guide`; the downloaded repository cache is inspection state, not an installation.
- Verified isolated behavior: the installed v0.3.8 package inspected `anthropics/skills` at commit `0a64e39`, returned 20/20 `installable: true` descriptors, installed `skills/academy-guide`, wrote its fixed commit/blob/bundle hash/numeric repository ID/path/fingerprint provenance, and returned it through `list`. Installation defaults to disabled (`enabledTargets: []`) by design.
- Implementation target: use a 25-second cancellable Trending deadline and a 45-second cancellable repository Inspection deadline while retaining the 60-second repository-install boundary.
- Acceptance: default-deadline regressions pass; focused/full tests, typecheck, build/package, exact v0.3.8 adapter, and installed package checks pass; after a zero-process lock check, both v0.3.8 targets are rollback-backed and synchronized.
- Scope: DSH Desktop v0.3.8 only. Do not install the isolated test Skill into the user's live registry, re-enable local provenance discovery, adapt v0.3.9, publish, or change Harness timeout behavior.
- Implementation: GitHub Trending now uses a 25-second abortable default; repository Inspection now uses a 45-second abortable default. The existing repository-install deadline remains 60 seconds.
- Validation: focused deadline/market/RPC/Client tests passed 61 cases with 8 historical skips; full Vitest passed 25 files and 212 tests with 8 historical skips. Typecheck, workspace build, 178,084-byte Client verification, exact 16-file npm dry-run, and two idempotent exact-v0.3.8 stages plus adapter verification passed.
- Recognition gate: the new source build reinspected the isolated installed `academy-guide` as `installable: true` and `structure-verified`; reinstall returned `already-installed`, with exact repository ID `1061953414` and path `skills/academy-guide` preserved. The user's live registry remains unchanged at 117 entries with no `anthropics/skills` installation.
- Next action: after the user fully exits the currently running Desktop, perform a zero-process lock check, create a fresh two-target rollback backup, synchronize the new 16-file package, and verify the installed Host and both market deadlines.

## Active Objective - Market Runtime Contract And Transient Notice Repair - 2026-08-19

- Objective: repair the deployed recent-heat Typert response rejection, make historical-popular discovery tolerate observed proxy/TLS latency without unbounded waiting, and make batch-completion notices dismissible plus automatically expire after five seconds.
- Verified recent-heat cause: HTML-only candidates deliberately use `ownerId: 0` until Inspection loads real GitHub metadata, while the Typert repository-candidate result schema requires a positive owner ID. Feeding the real 13-candidate result into the built descriptor reproduces 13 `ownerId` failures and no other schema issue.
- Verified historical-popular cause: the REST query and response shape are valid; a controlled live query returned 20 candidates in 2,591 ms. The deployed repository discovery still uses a 12,000 ms overall boundary, which is too tight for intermittent Windows proxy CONNECT/TLS latency but remains a real bounded timeout rather than an infinite wait.
- UI requirement: only completed bulk enable/disable/delete notices auto-expire after 5,000 ms; every notice gets an explicit close control. Progress notices and errors must not be silently cleared by that timer.
- Acceptance: the Typert descriptor accepts a real Trending response with unknown owner ID; historical browse uses a 25-second bounded deadline and existing cancellation; batch completion remains visible before five seconds, disappears at five seconds, can be manually dismissed, and a newer notice cannot be cleared by an older timer. Focused/full tests, typecheck, build/package, exact v0.3.8 adapter, isolated UI gate, rollback-backed synchronization, and installed Host verification must pass.
- Scope: DSH Desktop v0.3.8 only. No provenance re-enable, v0.3.9 adaptation, PR/publication, or Harness timeout work.
- Implementation: Typert accepts nonnegative list-stage owner IDs; repository discovery defaults to 25 seconds; completed bulk enable/disable/delete notices use a scoped five-second effect and icon close control.
- Validation: focused tests passed 56 cases with 8 historical skips; full Vitest passed 25 files and 210 tests with 8 skips; typecheck, workspace build, 178,084-byte standalone Client verification, 16-file npm dry-run, exact v0.3.8 adapter stage/verify, and isolated real-shell UI gate passed.
- Live evidence: the built artifact returned 13 recent-heat candidates in 4,094 ms and 20 historical-popular candidates in 2,182 ms; both success envelopes passed the actual `browseRepositories` Typert descriptor. The request trace contained two Trending HTML calls and one historical-popular REST search.
- Deployment: after the user fully exited DSH Desktop and a zero-process lock check passed, deployment `d56b95eaa4344e17a684dcdd0aceaf88` atomically synchronized the complete 16-file package to the `web` profile and portable v0.3.8 plugin directories. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-131245-market-runtime-contract`.
- Installed verification: source, profile, and portable files match manifest SHA-256 `AEAA6E418E17054C14321EC5AF6704D9985B966BBD2FE9630C3B6FC95EBF2CA6`; both targets passed six JavaScript syntax checks. The profile package imported under Node 24 with 24 service methods, 24 Typert descriptors, and Protocol 5 capabilities. Its real recent-heat response returned 12 candidates in 2,446 ms and its historical-popular response returned 20 candidates in 2,391 ms; both complete envelopes passed the installed Typert schema.
- Status: completed, verified, documented, and synchronized for DSH Desktop v0.3.8. The next normal Desktop launch loads this revision.

## Active Objective - Quota-Safe Market And Source-Matching Pause - 2026-08-19

- Objective: stop local-to-GitHub provenance matching from exhausting the anonymous GitHub REST allowance, keep trusted market-installed provenance/update behavior, prevent Trending cards from disappearing when metadata enrichment is rate-limited, and install from a recent Host-verified fixed-commit cache without re-resolving the same repository.
- Verified symptoms: the recent-heat view currently shows one candidate; GitHub REST rate limiting appears in both details/install and provenance matching; `animejs`, `wiki-history-ingest`, `wiki-ingest`, and `wiki-query` each reached the 30-second provenance deadline. Inspection of `anthropics/skills` had already succeeded at fixed commit `0a64e39`, but installation attempted a fresh repository resolution and failed on the exhausted REST quota.
- Product boundary: hide manual and automatic local provenance matching, force any persisted automatic-match preference off, and make the compatibility RPC return a stable disabled error without network access. Existing trusted GitHub registry sources and new market/Host installations retain update checks and automatic updates. Arbitrary AI/manual filesystem copies remain custom unless they are installed through the manager's source-aware Host path.
- Market boundary: construct recent-heat candidates directly from bounded GitHub Trending HTML and do not issue per-card `/repos/{owner}/{repo}` enrichment calls. Trending remains an experimental global-list signal and may naturally contain fewer than 20 Skill candidates.
- Install boundary: after Host Inspection fixes a commit and validates the complete repository snapshot, installation may reuse that Host-owned resolution and codeload cache for one hour. The Client still cannot submit a commit, hash, snapshot, or local path; cache miss/expiry performs normal fresh resolution, and update checks continue to require the latest verified snapshot.
- Acceptance: Trending uses two HTML requests and zero REST metadata requests; a partial/empty metadata environment no longer drops parsed candidates; details followed by installation within the cache window performs no additional REST request; provenance controls are absent, persisted auto-match is ignored, compatibility provenance RPCs perform zero discovery calls, and market-installed GitHub Skills remain updateable.
- Scope: DSH Desktop v0.3.8 only. v0.3.9, PR/publication, Harness timeout, fuzzy provenance, and execution of remote scripts remain deferred.
- Implementation: completed in source. Provenance controls and automatic execution are removed from the Client; compatibility RPCs fail with `PROVENANCE_MATCHING_DISABLED`; disabled capability flags are no longer market prerequisites; Trending cards are HTML-only; repository resolution TTL is one hour; install requests reuse a recent Host-owned resolution with `refreshCommit: false`, while update paths retain fresh resolution.
- Validation: focused quota/cache/Client/RPC tests passed 70 cases with 8 historical skips; full Vitest passed 25 files and 208 tests with 8 historical skips; typecheck, workspace build, standalone plugin verification, 16-file npm dry-run, exact v0.3.8 adapter stage/verify, and isolated real-shell UI gate passed. A live built-Core Trending probe returned 13 candidates with exactly two `github.com/trending` requests and zero `api.github.com` requests.
- UI gate correction: the first isolated run correctly observed that `自动匹配来源` and `一键全部重匹配` were absent, but its historical assertion still required them. The gate was updated to require those controls absent while preserving automatic update checks, automatic updates, synchronization, recent deletion, persistence, layout, and Composer behavior; the rerun passed.
- Deployment: after a zero-process lock check, deployment `8af88d4b90fb47af9771c7b6708bb75e` atomically synchronized all 16 files to the `web` profile and portable v0.3.8 Desktop. The rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-031020-quota-safe-market`.
- Installed verification: source/profile/portable manifest SHA-256 is `8EC60B2EE6B361CA7E15C3618EC045818BB078AE30745F99A00ED450312E5990`; both targets passed six JavaScript syntax checks, Node 24 Host import, 24 service methods, 24 descriptors, protocol 5 capability checks, and direct installed-bundle provenance calls that returned `PROVENANCE_MATCHING_DISABLED` with zero discovery calls.
- Status: completed, verified, documented, and synchronized for DSH Desktop v0.3.8. The next normal Desktop launch loads this revision.

## Provenance Rematch And Installability Repair - Completed - 2026-08-19

- Objective: repair the reported local GitHub provenance parsing/verification failure, add one explicit manual action that rematches every currently unmanaged local Skill, and restore repository installation where valid Skills are incorrectly classified as unavailable.
- Verified install symptom: real `anthropics/skills` Inspection parses each `SKILL.md` but marks every descriptor un-installable with warnings such as `Skill bundle 包含不支持的 tree 条目：skills/academy-guide`. The boundary validator currently treats ordinary Git directory entries (`type: tree`) as unsafe bundle content.
- Provenance target: manual rematch must use the protocol-5 batch RPC in groups of at most 20, include all non-GitHub managed Skills regardless of prior `no-match/custom/unavailable` state, preserve exact fixed-commit fingerprint authority, expose the real batch error instead of only `暂时不可用`, and report matched/custom/ambiguous/ineligible/unavailable counts.
- Install target: ignore ordinary directory Tree entries during structural boundary checks while continuing to reject Skill-contained symlinks, submodules, unsafe blob modes, unverified paths, unknown risk, and final snapshot failures.
- Validation: add red-capable Core and rendered Client regressions, run focused then full Vitest/typecheck/build/package checks, inspect a real multi-Skill GitHub repository, verify the manual rematch flow, run the exact v0.3.8 adapter and real-shell UI gate, then create a fresh rollback backup before synchronizing both local v0.3.8 targets.
- Deferred: v0.3.9, PR/publication, Harness timeout, semantic/AI matching, and any relaxation of fixed-commit full-bundle provenance.
- Implementation: ordinary `tree/040000` entries are ignored during Skill boundary validation; unsafe entries remain per-Skill blockers. Final frontmatter parsing trims `name` and `description` consistently with Inspection. `verifyProvenanceBatch` runs two workers, returns ordered successes plus optional structured per-name failures, and no longer rejects a whole batch for one failed item. The Client shares one batch path between automatic matching and `一键全部重匹配`, reruns every non-GitHub Skill in groups of 20, preserves individual errors, and reports matched/custom/ambiguous/ineligible/unavailable totals.
- Validation: focused red/green regressions passed; full Vitest passed 25 files with 210 tests and 8 historical skips. Typecheck, workspace build, standalone bundle verification, 16-file npm dry-run, exact v0.3.8 adapter stage/verify, and isolated real-shell UI gate passed. The real shell confirmed the rematch button plus enablement, deletion/restore, synchronization, restart persistence, dense layout, and Composer boundaries. Real GitHub Inspection of `anthropics/skills` at `0a64e39` returned 20/20 installable Skills in 6,073 ms; isolated installation of `academy-guide` then succeeded with two fixed-commit bundle files.
- Deployment: after the user fully exited DSH Desktop and a zero-process lock check passed, deployment `cdd635cb3523472abdc6e0cd3a0578d7` atomically synchronized the complete 16-file package to `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager` and the portable v0.3.8 plugin directory. Source/profile/portable hashes match for all 16 files; manifest SHA-256 is `06806444604EEFD853C1B8F67B804B2470F2903713BF37092C53E5B9F6B85C6A`. Both installed targets passed six-file `node --check` and Node 24 Host import with 24 service methods and 24 RPC descriptors. The complete rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-015809-rematch-installability`.
- Status: completed, verified, and synchronized to both local DSH Desktop v0.3.8 targets. The next normal Desktop launch loads this revision.

## Dense Skill List Layout And Multi-Image Details - Completed - 2026-08-19

- Objective: repair the verified narrow settings-panel layout regression where local Skill row selection, copy, state, and actions occupy incorrect grid tracks, then expand repository details to present multiple safe README/manifest images without weakening media or installation trust boundaries.
- Reproduction target: a deterministic browser gate at approximately the reported 572px viewport/panel width with multiple long-name/long-description Skills, visible bulk controls, and a recent-deletion section. It must fail on overlap, out-of-row controls, clipped primary content, or horizontal document overflow.
- UI acceptance: each local Skill row keeps its selection checkbox, icon/copy, status/actions, and DSH control in stable non-overlapping regions; long text truncates or wraps within its own region; current-filter selection and bulk enable/disable/delete remain functional at narrow and desktop widths.
- Media acceptance: repository details preserve the immediate avatar/social preview, then show up to eight validated repository images discovered from explicit manifests and same-repository fixed-commit README references. Thumbnail failure must not clear already loaded media or block inspection/installation; arbitrary external/SVG/oversized media remains rejected.
- Validation: add a red-capable narrow-layout browser/DOM regression, focused Client/media tests, visual screenshots at narrow and desktop widths, full Vitest/typecheck/build/package verification, exact Desktop v0.3.8 adapter verification, and a real-shell UI gate before rollback-backed synchronization to the `web` profile and portable v0.3.8 Desktop.
- Deferred: DSH Desktop v0.3.9, public PR/release, Harness timeout work, remote script execution, and unrelated UI redesign.
- Implementation: local Skill rows now define explicit checkbox, icon, content, and action tracks. Below 520px the action region intentionally stacks beneath content. Repository details resolve at most eight unique safe repository/social-preview images with three workers, preserve successful media across individual failures, and provide a primary preview plus selectable horizontal thumbnails.
- Validation: the focused Client suite passed 29 tests with 8 historical skips; the full suite passed 25 files with 206 tests and 8 skips. Typecheck, workspace build, standalone plugin verification, 16-file package inspection, exact v0.3.8 adapter verification, 572px/390px Playwright visual checks, and the isolated real v0.3.8 shell gate all passed. The real-shell row measured 347px of copy width, right-aligned actions, and zero horizontal overflow; synchronization, enablement persistence, deletion/restore, and Composer boundaries also passed.
- Deployment: after confirming that no DSH/Electron process was running, the complete 16-file package was atomically synchronized to the `web` profile and portable v0.3.8 Desktop. Source/profile/portable manifest SHA-256 is `DE4A362DE3922D215DBE9284A38624377DAF70C3CDB3F14400B56CBB20F3A40D`; `dist/client.js` is `66467B1283F327C77C405BF13254DFC4A407E825A222766E6C671D7EA2DCC101`.
- Rollback: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-010858-dense-layout-gallery` contains verified pre-replacement copies and the atomic predecessor trees for both targets.
- Status: completed for DSH Desktop v0.3.8. Both installed bundles passed six-file JavaScript syntax checks and Host ESM import with all 24 service methods. The next normal Desktop launch loads this revision; no forced process restart was required.

## Repository Batch Analysis And Provenance Recall - Completed - 2026-08-19

- Execution ledger: `.planning/repository-batch-protocol5/`. On 2026-08-19, Protocol 5/24-method implementation evidence was reconciled, verified, documented, and synchronized with a fresh rollback backup.
- Objective: repair the verified multi-Skill repository timeout and low local-to-GitHub match recall while preserving GitHub fixed-commit whole-bundle proof as the only provenance authority.
- Product model: repositories are discovery, presentation, download, and cache units; individual directories containing their own `SKILL.md` remain the installable, matchable, enableable, updateable, and deletable units.
- Scope: protocol 5 batch repository analysis/install, optional skills.sh candidate hints, one-pass repository fingerprint/risk indexing, repository-level symlink skipping with per-Skill rejection, immediate details media, silent install-all, and filtered local multi-selection with bulk enable/disable/delete.
- Trust boundary: skills.sh names, slugs, installs, GitHub repository search, README, Topics, and manifests are discovery hints only. Persist provenance only after one unique canonical complete-bundle fingerprint match at a fixed GitHub commit. Modified or cropped local Skills remain unmatched.
- Performance target: a fixed-commit multi-Skill repository is prepared once; the root-symlink fixture must use three GitHub REST calls, one codeload ZIP, and zero Raw reads. Inspection has a hard 30-second deadline and repository installation a hard 60-second deadline.
- UI decisions: the repository body opens details; the Install action silently installs all remaining installable Skills. Low/medium-risk items continue when other items require review. Local select-all applies only to the current filtered result, and bulk deletion uses one summary confirmation before independent 30-day recoverable deletions.
- Acceptance: focused snapshot/provenance/RPC/Client tests, full Vitest, typecheck, build/package verification, exact Desktop v0.3.8 adapter and real-shell UI gates, then recoverable synchronization to the `web` profile and portable v0.3.8 Desktop.
- Deferred: v0.3.9, PR/publication, central crawling, semantic/AI provenance, remote script execution, and Harness timeout work.
- Implementation: completed Protocol 5 repository batch analysis/install, provenance batching, skills.sh discovery hints, one-pass repository indexing/risk preparation, per-Skill symlink isolation, immediate details media, silent all-install, and filtered local bulk enable/disable/delete.
- Validation: `npm test` passed 25 files with 205 tests and 8 historical skips; typecheck, build, 16-file package inspection, standalone plugin verification, exact v0.3.8 adapter verification, and isolated UI gate passed. The isolated live GitHub keyword request exceeded its separate 15-second observation limit, so this remains an external-network observation rather than a local acceptance claim.
- Deployment: a complete predecessor backup and atomic predecessor copies are retained in `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-001448-repository-batch-protocol5`. All 16 package files in the repository, `web` profile, and portable Desktop share manifest SHA-256 `00382C5D9A174B9039C6714E0F20CCA640DF3CD1E0746AF95BC4B486308FCAD1`.
- Status: completed for DSH Desktop v0.3.8. No DSH/Electron process was running during replacement; the next normal v0.3.8 launch loads Protocol 5. v0.3.9, PR/publication, central indexing, remote script execution, and Harness timeout remain deferred.

## Historical Objective - Provenance V2 And Verified GitHub Updates - 2026-08-18

- Objective: replace weak local-Skill source matching with a trusted provenance resolver plus exact whole-bundle content matcher, then make every matched GitHub Skill follow verified fixed-commit updates without losing local-modification protection.
- Scope: add a versioned canonical identity fingerprint, a bounded atomic GitHub Skill observation index, stable repository-id plus Skill-path identity, trusted-source validation, exact historical-content matching, protocol-4 capability/RPC/UI states, and final update risk confirmation. Reuse the existing fixed-commit codeload snapshot cache, Snapshot Resolver, risk scanner, atomic replacement, backups, and target-link preservation.
- Trust boundary: only manager-written registry provenance is directly trusted. `SKILL.md` repository fields, names, descriptions, Topics, manifests, skills.sh, Hugging Face, and GitHub search are candidate hints only. A new source is persisted only after one unique fixed-commit whole-bundle fingerprint match; multiple exact mirrors remain ambiguous and zero matches remain custom.
- Fingerprint: `dsm-skill-fingerprint-v1` includes every regular bundle file in stable normalized-path order using length-framed records. UTF-8 text normalizes CRLF/CR to LF; binary bytes, BOM, YAML order, spacing, and all other content stay exact. Unsafe paths and symbolic links are rejected. The existing raw `contentHash` remains independent and authoritative for detecting local changes.
- Index: store bounded verified observations at `%DSH_HOME%/skill-manager/cache/github-skill-index/v1.json`, retain five observations per repository/path and at most 10,000 globally, and write atomically. Index matches are discovery acceleration only and must be re-fetched at their fixed commit before they can grant provenance.
- Update policy: resolve the current repository through numeric GitHub identity when available, allow Skill paths whose basename differs from frontmatter name, re-resolve and validate a fresh fixed commit before writing, and risk-scan the exact changed snapshot. Low/medium risk can follow the existing opt-in automatic update preference; high/unknown risk never auto-updates and requires manual review plus explicit second confirmation.
- Limits: at most eight candidate repositories and twenty Skill paths per local Skill, network concurrency two, and a 30-second total provenance deadline. Do not reset `contentHash` for a locally modified Skill.
- Acceptance: fingerprint canonicalization and rejection tests, index persistence/corruption/history/bounds tests, trusted and exact historical provenance tests, mirror/custom/ineligible/timeout tests, repository rename/path-name mismatch/update-risk tests, protocol-4 and restart-persistence UI/RPC tests, focused/full test and build gates, exact v0.3.8 adapter gates, then recoverable two-target local synchronization.
- Deferred: DSH Desktop v0.3.9, PR/publication, central GitHub crawling, Harness timeout, semantic/AI source guessing, and execution of remote Skill scripts.
- Implementation: complete in the repository. Added the independent canonical fingerprint, atomic bounded observation index, trusted-source/index/hint/search matching order, stable repository identity fields, shared Snapshot Resolver updates, final risk gate, protocol-4 capabilities, Client source/risk states, and fixed-commit background index population from repository details. Existing uncommitted Marketplace V2/V3 work remains preserved.
- Validation: `npm run typecheck` passed; the final full Vitest suite passed 25 files with 202 current tests and 8 explicitly skipped historical V1 cases; workspace build, standalone Host/Client verification, and the 16-file npm dry-run passed. The Client bundle is 157,349 bytes and the bundled Host entry is 371,007 bytes.
- Review: Inspection populates verified fingerprints after returning the details card with at most two background workers and per-Skill failure isolation. The single 30-second provenance deadline covers search, candidate resolution, and complete-bundle comparison. The strict Host source schema retains optional `manifestFiles` compatibility.
- v0.3.8 evidence: exact adapter stage/verify and the isolated real-shell UI gate passed protocol-4 loading, a 16×18 icon, restart persistence, deletion/restore, cross-tool synchronization, and `/command /skill /command body` boundaries. Live GitHub keyword search did not settle inside the gate's separate 15-second observation window and remains explicitly external-network unverified for this run.
- Deployment: the complete 16-file package is SHA-256-identical across the repository, `web` profile, and portable v0.3.8 Desktop. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-163603-provenance-v2`. Key hashes: `dist/index.js` `85D7733330ECCA0592DBB8F019749EF5412466AEE03A238C85766680A2135A2B`, `dist/client.js` `C7D80E3B71D2AFB25030419EF718835FEB252185034D9907A6A58AAF621DCA12`, `dist/typert.host.js` `7B35063929F2F2071D6FA6009194A6B98EB9D56EA13F20DACD860725252E6040`.
- Status: completed locally for DSH Desktop v0.3.8. Five Desktop processes were deliberately left running, so every open window keeps its previous in-memory Host/Client until the user fully exits DSH Desktop and reopens it. No commit, PR, publication, v0.3.9 work, or Harness-timeout work was performed.

## Bulk DSH Enablement And Rate-Efficient Repository Details — Completed — 2026-08-18

- Objective: add an explicit `一键开启全部` action for managed Skills that are currently disabled in DSH, and make large public GitHub Skill repositories inspectable without spending one anonymous REST request per README/manifest/`SKILL.md` document.
- Verified behavior: the DSH switch is operational rather than cosmetic—enable creates a manager-owned per-Skill link in the DSH scan root and persists `dsh` in `enabledTargets`; disable removes only that verified manager-owned link and updates the registry. Imported and marketplace-installed Skills currently remain disabled until the user enables them.
- Verified failure: current `mattpocock/skills` Inspection reaches `GITHUB_RATE_LIMITED` while reading individual Git blobs after repository, commit, and recursive Tree requests succeed. The existing Inspector uses one REST `/git/blobs/{sha}` request per document, so multi-Skill repositories quickly exhaust GitHub's anonymous 60-request/hour allowance. The reported screenshot is an opened dialog with failed Inspection, not a dialog-mount failure.
- Design: opening a repository synchronously presents a low-cost details card using candidate metadata, publisher avatar, repository description, and GitHub social preview. The Host then automatically prepares content in the background without delaying that first render: resolve the default branch to a fixed commit, prefer one bounded `codeload.github.com` ZIP, safely extract it into the manager-owned snapshot cache, and inspect README/manifests/`SKILL.md` locally. Raw fixed-commit reads remain the bounded fallback. Preserve all pre-install security validation: checks may run quietly behind the install flow, but untrusted files are never committed to the managed library before validation succeeds.
- Snapshot cache: key by `github:owner/repository@commit`, keep at most 100 MB, expire one hour after last access, evict least-recently-used unlocked entries, coalesce concurrent downloads, and never clean a lease used by Inspection/risk/install. Stage downloads and extraction under the cache root, validate fully, then atomically rename. Limit archive bytes, extracted bytes (50 MB per repository), file count, single-file bytes, expansion ratio, paths, symlinks, and unsupported entries. Failed/oversized archives fall back to fixed-commit Raw reads.
- Bulk behavior: process only currently disabled managed Skills, sequentially call the existing Host `setEnabled` operation, keep successful links when another item conflicts, and report individual failures. Do not touch unimported external directories or auto-enable future imports without a separate product decision.
- Provenance boundary: do not change the current local-to-GitHub matching algorithm in this repair. Repository cards may show `已安装` only when a managed Skill already has persisted exact GitHub repository provenance; inspected Skill rows use exact repository plus Skill path. Do not infer installation from weak name/description similarity. Document the verified matching pipeline and limitations for the user's replacement design.
- Implementation: the Client opens the detail card before Inspection settles and independently loads candidate avatar/social preview; Inspection, risk assessment, final installation resolution, and repository media share a fixed-commit snapshot cache. Codeload content is accepted only when every file matches the fixed recursive Tree size and Git blob SHA. Raw fallback verifies the same identity. Installation refreshes the default-branch commit, reconstructs the final snapshot, synchronously scans that exact snapshot, requires explicit acknowledgement for high risk, and only then calls the atomic managed-library write.
- Limits: compressed ZIP 20 MB, extracted repository 50 MB, global cache 100 MB, 10 MB per file, 5,000 entries, 200:1 expansion ratio, and one-hour last-access TTL. Staging is atomically renamed only after validation; expired and LRU entries are removed only when unlocked. Concurrent callers coalesce the same repository/commit work, and one caller cancellation does not abort a shared download needed by another caller.
- Validation: 22 test files passed with 196 current tests and 8 historical V1 skips; `npm run typecheck`, `npm test`, `npm run build`, plugin build verification, and the 16-file npm dry-run passed. The Client bundle is 154,618 bytes. Exact v0.3.8 stage/verify and the isolated UI gate passed, including bulk DSH enablement, immediate detail dialog, local workflows, deletion/restore, icon size, and Composer boundaries. Live GitHub keyword search exceeded its separate 15-second observation window, so external keyword networking remains explicitly unverified by that UI run rather than reported as a local UI failure.
- Deployment: synchronized to both local v0.3.8 plugin targets after a complete rollback backup; exact backup path and final hashes are recorded in `docs/ENVIRONMENT.md`.
- Status: completed. DSH Desktop v0.3.9, PR/publication, Harness timeout, and provenance-algorithm redesign remain out of scope.

## Trash Compatibility, Recent Heat, And Install Dialog — Completed — 2026-08-18

- Objective: fix valid locally imported deletion archives being rejected after restart, combine weekly/monthly GitHub Trending into one `近期热度榜` ranked by monthly growth, and make the repository install/Inspection card reliably visible with actionable network failure state in DSH Desktop v0.3.8.
- Verified symptoms: the live `aframe-webxr` trash archive is structurally present but `listTrash()` returns `SKILL_TRASH_INVALID`; the validator currently requires a `local-import` source to have `origin: self` even though persisted imports correctly use `origin: local-import`. The configured Windows proxy is `http://127.0.0.1:9674`; direct Host probes currently load monthly Trending, repository search, and `anthropics/skills` Inspection successfully, confirming the reported TLS reset is intermittent rather than persistent data corruption.
- Design: preserve the protocol-3 wire sort for minimum compatibility but expose one `近期热度榜` Client option backed by monthly ordering and merged weekly/monthly metrics. Network transport failures remain explicit and retryable; they must not dismiss or hide the install dialog.
- Acceptance: a deleted local-import Skill lists and restores after restart; the market exposes `近期热度榜 | 历史热门 | 最新 | 相关度`; recent heat is monthly-ranked while cards show both available week/month metrics; clicking install immediately opens a centered portal and retains a visible retry state when Inspection fails; focused/full tests, build/package checks, exact v0.3.8 stage/verify, and local synchronization pass.
- Implementation: legacy `local-import` deletion metadata is accepted without weakening source/path/hash validation; idempotent Host GET requests retry only known transient transport failures with two abort-aware short delays; `trend-monthly` now returns month-ranked candidates followed by weekly-only candidates; the Client exposes one `近期热度榜` control, renders both available metrics, and mounts the body-portaled Inspection dialog synchronously from either the repository body or `安装` action.
- Validation: focused tests passed 46 current cases with 8 historical UI skips; the full suite passed 184 cases with 8 skips, followed by typecheck, workspace build, 146,820-byte Client bundle verification, exact v0.3.8 stage/verify, and the isolated v0.3.8 UI gate. The real `aframe-webxr` archive now lists with its 30-day expiry. Live Host probes returned 18 recent-heat candidates in 11.6 seconds and inspected `anthropics/skills` at `f379e5a` with 20 descriptors in 8.5 seconds. The UI gate's live keyword search did not settle within its separate 15-second observation window; deterministic retry/error tests and the later live Host probes passed.
- Deployment: all 16 package files are SHA-256-identical in the `web` profile and portable v0.3.8 Desktop. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-111457-recent-heat-dialog`. Key hashes: `dist/index.js` `F89A70CC7F10CE98A856477DDEE02F2A8E3FA2D3F2EB7D9DE46105FC9CF52996`, `dist/client.js` `5932E69F454FAFFBB6E33C66C3E5EBEC94E7DFA9DAB440C77390414BE1BD30FC`, `dist/marketplace-fetch.js` `9993EF57FA9FCCC29B3D295E60EDD5856ADCAF65089B7BE5386377EBC8CD2FC3`.
- Status: completed. No DSH/Electron process was running after synchronization, so the next v0.3.8 launch loads this revision. v0.3.9, Harness timeout, PR, publication, and destructive cleanup remain out of scope.

## Marketplace Classification And Trend Rankings — Completed — 2026-08-18

- Implemented protocol 3 fields and capabilities for `latest`, `trend-weekly`, `trend-monthly`, `githubTrending`, and `skillClassification`.
- Implemented 12-category deterministic classification with 36 Skill Leaderboard subcategory mappings, explicit metadata precedence, bounded tags, evidence, and confidence.
- Implemented Host-side GitHub Trending HTML parsing with strong Skill-signal filtering, repository metadata enrichment, independent fresh/stale caches, and stable unavailable/empty states.
- Added focused classification and Trending fixtures. Final validation: 22 test files, 181 passed, 8 historical/deferred skips; `npm run typecheck`; workspace build; Host/Client package verification; and exact DSH Desktop v0.3.8 stage/verify all pass.
- Local deployment is synchronized byte-for-byte for the 16-file runtime package in the `web` profile and portable Desktop asset directory. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-091234-marketplace-v3`. Key bundle hashes: `dist/index.js` `5E5A6BF2DF3F8F51FD4587285A15424643A8F81A5C4A33C978DD215BD138D2E6`, `dist/client.js` `B70D5F97D9B02AF06EE7293A5A4EF8B2467420353855ECF08B223BB2C3417949`, `dist/typert.host.js` `5039ED3BDB885268FE33FE8C5077415E20701F39FA0C9C2551E40686049F9AFE`.
- The isolated v0.3.8 UI gate already verified protocol 3, ranking controls, 12 categories, icon sizing, restart persistence, deletion/restore, cross-tool synchronization, and chained slash-prefix behavior. Live GitHub keyword search did not settle within the gate's 15-second observation window, so that external-network condition is recorded rather than treated as a product failure. v0.3.9, timeout, PR, and publication remain out of scope.

## Active Objective — Marketplace Classification And Trend Rankings — 2026-08-18

- Objective: extend Marketplace V2 with a compact 12-category Skill classifier, rolling-60-day newest repositories, and Host-owned GitHub Trending weekly/monthly candidate rankings for DSH Desktop v0.3.8.
- Scope: update Core domain types and classification rules, add bounded GitHub Trending HTML discovery with independent cache states, extend Marketplace protocol capabilities/sorts, update the Client ranking and evidence UI, test all new behavior, and verify the v0.3.8 bundle.
- Decisions: use `SKILL.md` metadata before `skills.json`, then GitHub Topics and bounded text signals; use Host time minus 60 days for newest; use GitHub Trending HTML as an explicitly experimental source with no fallback to update time or empty-result masquerading.
- Deferred: DSH Desktop v0.3.9, Harness timeout changes, PR creation, publication, and a central historical Star index.
- Acceptance: protocol version 3 reports the new capabilities, monthly trend is the default market view, weekly/monthly/latest/history/relevance sorts behave as specified, source states distinguish live/cache/unavailable/empty, and focused plus full v0.3.8 validation passes.
- Status: completed on 2026-08-18; baseline documents and existing uncommitted work preserved. Evidence: focused and full tests, typecheck, build/package verification, exact v0.3.8 stage/verify, and the isolated UI gate.

## Historical Documentation Deliverable — Superseded by Marketplace V2

- Objective: create one detailed Chinese project overview that can serve as the shared orientation document for development, review, local acceptance, and future upstream work.
- Content boundary: distinguish implemented repository capabilities, verified evidence, locally installed/runtime state, known defects, approved next-stage design, deferred work, and non-goals.
- Planned output: `docs/PROJECT_OVERVIEW.zh-CN.md`, linked from the root `README.md`.
- Original acceptance: architecture, packages, workflows, security boundaries, DSH Desktop v0.3.8 compatibility, the then-current marketplace 404, media-preview design status, validation evidence, and roadmap were traceable to existing project documents or code.
- Status: completed on 2026-08-17; no product code, dependency, runtime installation, or external publication was part of this documentation task.
- Evidence: `docs/PROJECT_OVERVIEW.zh-CN.md` was added and linked from `README.md`. Its earlier 404 and unimplemented-media observations are historical; the Marketplace V2 completion update below is the current authority.

## Active Objective

Implement Marketplace V2 for DSH Desktop v0.3.8: separate GitHub repository discovery from repository inspection, Skill descriptors, immutable snapshots, and installed Skills while preserving the existing Host-owned safe installation path.

## Active Market Ranking And Dialog Repair — 2026-08-18

- Objective: simplify the repository market to `历史热门` and `相关度`, and make the install/inspection dialog reliably visible and easier to review inside DSH Desktop v0.3.8.
- Scope: remove `latest` and `recently-updated` from Core, RPC validation, Client wire types, and UI controls; rename the all-time Stars sort to `历史热门`; render the complete dialog at `document.body`; enlarge its desktop review surface and preserve responsive bounds.
- Deferred: `近期热门` remains unimplemented until a historical Star snapshot/index design is available. Repository activity timestamps must not be presented as Star trend evidence.
- Acceptance: only the two approved sorts are accepted and rendered; clicking a repository install action immediately presents a visible loading dialog; inspection errors remain in the dialog with retry; the dialog is not clipped by the settings container and is materially larger on desktop; focused and full validation pass before deployment.
- Risk: React portal support must remain compatible with the standalone v0.3.8 Client bundle. Build verification and the isolated real-shell UI gate must exercise the resulting bundle.
- Status: completed and deployed locally on 2026-08-18.
- Implementation: Core/RPC/Host/Client accept only `popular | relevance`; the UI labels them `历史热门` and `相关度`; keyword search defaults to relevance but honors a later explicit historical-popularity switch. The install action is 82×36 and the complete 720px bounded dialog is portaled to `document.body` with immediate loading, in-dialog failure, and retry states.
- Validation: focused tests passed; full suite passed 175 tests with 8 historical V1 skips; typecheck/build passed; standalone Client bundle verified at 139,220 bytes; npm dry-run contains 16 files; visual preview built; two v0.3.8 stage/verify cycles passed; the isolated real shell returned 20 live Security candidates and passed portal/loading/size, persistence, deletion/restore, synchronization, icon, and Composer gates.
- Visual evidence: 1280×833 dark-theme rendering measured a centered 720×752.7 dialog with zero horizontal overflow. A new 520px screenshot attempt exceeded the bounded Playwright CLI wait and was stopped; no new narrow screenshot is claimed.
- Deployment: a fresh rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-074934-ranking-dialog-portal`. All 16 package files were synchronized to the `web` profile and portable Desktop and verified byte-for-byte by SHA-256. No DSH/Electron process was running after deployment.
- Deferred: `近期热门` remains unimplemented until a historical Star snapshot/index design is available. Repository activity timestamps must not be presented as Star trend evidence.
- Next action: user opens DSH Desktop v0.3.8 and reviews the market/detail experience; further UI refinements should use that feedback without adding a provisional trend rank.

## Completed Local Automation, Recovery, And Category Correction — 2026-08-18

- User-visible problems: deleted Skills are recoverably archived but there is no list/restore UI; the toolbar mixes one-shot provenance/update/synchronization actions; `同步到已配置目标` does not explain which tools or operation it affects; market categories only filter category Topics from the current page and commonly show no repositories.
- Recovery design: expose Host-owned recent-deletion records with `listTrash` and `restoreTrash`. Preserve the full Skill registry record and bundle for 30 days, show the expiry date, restore only when the managed name/library path and every recorded target are conflict-free, and opportunistically purge expired manager-owned trash during normal Core operations.
- Automation design: replace provenance/update batch buttons with persistent opt-in checkboxes for `自动匹配来源`, `自动检查更新`, and `自动更新`. Opening local Skill management starts enabled work in the background at most once per 24 hours. Automatic update acts only on a fresh `update-available` result and retains the existing immutable re-resolution, local-modification refusal, and automatic backup.
- Synchronization wording: keep synchronization explicit and manual, rename it to `同步到其他工具`, and explain that it creates manager-owned per-Skill links for configured Codex, Claude Code, Agents, and OpenCode roots without copying Agent instruction files.
- Category design: selecting a non-`全部` category performs a new GitHub repository search using the category vocabulary; it no longer filters only the current page's category Topics. Repository results remain candidates and require normal fixed-commit Inspection before installation.
- Non-goals: no periodic process while DSH is closed, no silent provenance authority from text similarity, no automatic update of locally modified Skills, no v0.3.9 work, and no publication/PR.
- Acceptance: recent deletion list/restore/30-day expiry and conflict refusal pass Core/RPC/UI tests; automatic preferences survive remount and run in dependency order with a 24-hour gate; synchronization copy is clear; every category dispatches a remote query; themes and compact/narrow layouts remain usable; full build and v0.3.8 gates pass before approved live deployment.
- Repository implementation status: complete. `listTrash`/`restoreTrash` bring the public Host surface to 22 methods; the Client exposes `最近删除`, three default-off automatic-maintenance checkboxes, and `同步到其他工具`. Category selections issue new `category + skill` searches over GitHub repository names, descriptions, and Topics, with explicit remote zero-result feedback.
- Final validation: 20 Vitest files and 172 current tests pass with 8 historical V1 cases skipped; typecheck, workspace build, 138,829-byte Client verification, 16-file npm dry-run, visual-preview build, double exact-v0.3.8 stage/verify, and the isolated real-shell gate pass. The shell returned 20 live category candidates and verified 16×18 icon sizing, all three automatic-maintenance checkboxes, `最近删除`, `同步到其他工具`, restart persistence, deletion/restore, external synchronization, and Composer prefix behavior.
- Local deployment: the complete 16-file package is SHA-256-identical in the `web` profile and portable Desktop asset directory. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-064257-automation-trash-category`. The user's Desktop processes were intentionally not stopped; one manual restart is still required before the open window loads these disk changes.

## Completed Marketplace Install Dialog And Update-Affordance Correction — 2026-08-18

- User-visible failure: clicking a repository action returns `Unable to inspect the GitHub repository.` even though repository browsing succeeds.
- Reproduced causes: Inspection previously downloaded README, manifests, and every discovered `SKILL.md` blob in one unbounded `Promise.all`, so multi-Skill repositories could reset concurrent proxy TLS connections (`ECONNRESET`). After bounding concurrency, a live 25-request `anthropics/skills` trace exposed a second Host transport cost: `createHostMarketplaceFetch` creates a new `HttpsProxyAgent` for every request, repeating proxy/TLS connection setup until the 20-second Inspection deadline becomes timing-sensitive.
- Network correction: bound Inspection document concurrency, retry only transient transport resets with short abort-aware backoff, and reuse one proxy Agent per Host marketplace-fetch instance while retaining the overall inspection deadline and stable error contract.
- Market interaction: repository descriptions expose their complete text on hover/focus; the row CTA becomes `安装`. Clicking it opens a centered, theme-adaptive confirmation card over a dimmed backdrop. Only this card performs fixed-commit Inspection and loads the trusted avatar/media, repository description, Skill selection, integrity and risk information. Final installation remains explicit.
- Local interaction: hide the backup/rollback entry from the normal Skill list for this slice while retaining internal pre-update backups and rollback APIs as safety infrastructure. GitHub-matched Skills expose `检查更新` until checked, `更新` only when a newer immutable snapshot exists, and a concise current/conflict status otherwise.
- Non-goals: no v0.3.9 adaptation, PR, publication, automatic background updates, removal of backup storage, or execution of remote scripts.
- Acceptance: real `anthropics/skills` Inspection succeeds through the Host proxy; repository rows have no `查看详情`; the install card matches the supplied compact centered-modal reference at dark/original/light themes and narrow widths; update controls are clear without a visible backup button; focused tests, full tests, typecheck, build/package verification, and actual v0.3.8 UI acceptance pass before handoff.
- Affected documents: `docs/TASK_STATUS.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/LESSONS_LEARNED.md`, `docs/PROJECT_CONTEXT.md`, `CHANGELOG.md`, and `docs/ENVIRONMENT.md` after deployment.
- Repository implementation status: complete. Inspection limits document reads to three, retries only transient resets, and the Host reuses one keep-alive proxy Agent. A live `anthropics/skills` Host probe succeeded in 7,305 ms at `f379e5a` with 20 descriptors. The market row now uses `安装`, the final 460×640 confirmation card passed same-input visual QA plus original/dark/narrow checks, and local GitHub Skills show explicit `检查更新`/verified `更新` without routine backup history.
- Repository validation at that milestone: 20 test files and 165 current tests passed with 8 obsolete/deferred UI cases skipped; later final evidence in the local automation/recovery correction supersedes the artifact counts and deployment status.

## Completed Reliability And Local Management Correction — 2026-08-18

- User-visible failures: the repository market browse request returns GitHub HTTP 422; managed Skills have no delete action; provenance checks run implicitly one Skill at a time and non-match outcomes disappear after reopening; update and cross-agent synchronization are not presented as clear batch actions.
- Reproduced 422 cause: the browse query joins multiple `topic:` qualifiers with `OR`, which GitHub rejects as a qualifier-only logical query. `agent-skills OR claude-skills OR codex-skills in:topics` was probed against the official repository-search endpoint and returned HTTP 200.
- Provenance decision: replace implicit per-visible-row checking with an explicit bounded `自动匹配来源` batch action and progress summary. Exact full-bundle matches keep persisting trusted GitHub provenance; non-match, ambiguous, and ineligible outcomes persist only as cached last-check metadata and never grant update authority.
- Delete decision: add explicit two-step deletion backed by a recoverable manager-owned trash snapshot. Delete may remove only links recorded by the manager that still resolve to the canonical bundle, then archive the complete canonical bundle and registry metadata; unmanaged same-name target paths cause a safe refusal.
- Batch actions: expose `检查全部更新` and `同步到已配置目标`. Update remains read-only until the user chooses a per-Skill update; synchronization creates only missing manager-owned links for configured targets and reports conflicts independently.
- Acceptance: browse no longer emits the invalid qualifier-only query; delete removes the managed entry and owned links while preserving a trash copy and refusing unmanaged conflicts; provenance runs only after explicit batch/retry actions and survives reload; batch update/sync controls expose progress and stable results; focused tests, full tests, typecheck, build, package verification, and isolated v0.3.8 verification pass before any live deployment.
- Deployment authorization: the user explicitly approved execution. After the final repository gate, back up and synchronize the complete Host/Client package to the v0.3.8 profile and portable Desktop; never copy only `client.js`.
- Deployment completed: the full 16-file package was backed up and hash-synchronized to both live plugin directories. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-043818-reliability-batch-delete`.
- Live acceptance: portable DSH Desktop v0.3.8 started with the new package. The market returned 20 live GitHub repository candidates instead of HTTP 422; the local page exposed all three batch controls and per-Skill delete actions; the persisted `apple-design` GitHub match remained visible after reopening. No destructive Skill action was triggered during acceptance.

## Active UI Correction — 2026-08-18

- User-visible symptoms: the live v0.3.8 settings sidebar still renders an oversized folded-file icon, the market still shows the V1 skills.sh “热门 Skill” list instead of GitHub repository candidates/categories, and local Skills expose no durable GitHub provenance-result status.
- Verified runtime cause: both the live profile copy and the portable Desktop asset copy contain the same stale V1 bundle. Their Client SHA-256 is `01ADAAC184410854582429F1DD74F887777B1DB4EDE75C91E5A3111EF8EBBD9`, while the current repository build is a different, larger Marketplace V2 bundle. The screenshot is therefore not evidence that the current V2 repository UI failed to mount; it proves that the V2 Client was never deployed to the running installation.
- Source gaps found before correction: V2 displayed repository category Topics but had no selectable GitHub category filter; automatic exact-bundle provenance verification persisted successful matches but discarded `no-match`, `ambiguous`, `ineligible`, and provider-failure outcomes from the UI; the raw sidebar SVG lacked maximum-size, overflow, and box-model constraints against v0.3.8 host styles.
- Implemented correction: add accessible loaded-result category filters, retain and display per-Skill provenance outcomes with retry, and harden the 16×18 sidebar glyph. Immutable byte-level matching remains unchanged; names/descriptions do not grant update authority.
- Acceptance: rendered tests prove GitHub repository search/category controls, category filtering, visible matched/unmatched/ambiguous/unavailable provenance states plus retry, and exact sidebar computed-size constraints. Focused tests, typecheck, full tests, build verification, package dry-run, and isolated v0.3.8 verification must pass.
- Deployment status: superseded by the completed, approved 2026-08-18 full-package synchronization and live acceptance above.
- Repository status: completed. The Client now labels GitHub repository search explicitly, provides `全部/代码/安全/设计/研究/写作/游戏/数据/效率` filters over loaded candidates, retains exact provenance outcomes with per-row retry, and applies important 16×18 minimum/maximum size constraints to the native sidebar glyph.
- Validation: focused Client coverage plus the reliability correction passed; full Vitest passed 20 files and 162 current tests with 7 obsolete V1 UI cases skipped; typecheck, workspace build, 118,151-byte Client verification, 16-file npm dry-run, double isolated v0.3.8 staging, adapter verification, and the isolated real-shell gate passed. The shell measured the sidebar icon at exactly 16×18, rendered all three batch controls, returned live GitHub repository candidates, preserved restart and synchronization behavior, verified recoverable deletion, and preserved Composer-prefix behavior.

## Marketplace V2 Completion Update — 2026-08-18

- Repository implementation is complete for the agreed first slice: layered Core types, metadata-only GitHub repository discovery, fixed-commit Inspection, a Host-owned `ResolvedSkillSnapshot` containing verified bytes and immutable file metadata, bounded root-manifest resources, static risk assessment, structured media resolution, 20-method V2 RPC, capability negotiation, repository-first UI, multi-Skill batch installation, high-risk confirmation, and the frozen index schema workspace.
- Public V1 marketplace descriptors and handlers are removed. Core legacy marketplace types remain internal to safe installation, update, and provenance implementation; they are not browser authority.
- Verification passed after the reliability correction: 20 Vitest files, 162 current tests, typecheck, workspace build, 118,151-byte Client bundle verification, 16-file npm dry-run, double isolated v0.3.8 stage/verify, and the updated real-shell local workflow gate.
- The real shell loaded the Client with HTTP 200, exposed Marketplace V2 GitHub search/sort/category controls, measured the folded-file icon at exactly 16×18, preserved create/enable across restart, synchronized Codex to Claude without adjacent `AGENTS.md`, and preserved `/command /skill /command body` behavior.
- An earlier isolated run returned `Repository discovery exceeded 12000 ms.` for live anonymous GitHub browse and recovered with a stable message. The current corrected-shell run returned live repository candidates. Deterministic repository discovery tests remain the provider correctness authority because network availability can change.
- Seven skipped Client tests are retained only as obsolete V1 UI history and are excluded from V2 coverage counts.
- Root and nested bundle resolution now exclude `AGENTS.md` and `CLAUDE.md` at any depth, manifest persistence rejects those paths, and registry recovery accepts the supported OpenCode enablement target.
- Live Desktop/Harness installation is complete for the v0.3.8 evaluation directories. No GitHub push, PR, release, v0.3.9 adaptation, central Indexer, or Harness timeout change is part of this iteration.

## Status

- Marketplace V2 design is approved for implementation on 2026-08-17. The first slice uses a GitHub repository-candidate home, Topics-first plus ordinary keyword search, on-demand inspection, multi-Skill batch selection, static content-risk hints, and explicit Host capability negotiation. The central indexer only freezes a schema in this slice; its GitHub Actions implementation is deferred.
- V2 migration replaces the old market RPC semantics rather than maintaining a long-term compatibility layer. Installation requests carry only repository identity and Skill path; commit, blob, bundle hash, and local paths remain Host-owned.
- Root-level Skill bundles use the restricted resource policy: `SKILL.md`, `scripts/**`, `references/**`, `assets/**`, plus manifest-declared files only.
- V2 repository work, isolated verification, complete-package synchronization, and actual v0.3.8 UI acceptance are complete.

- Current iteration: GitHub discovery reaches GitHub through the repaired proxy but exceeds its 10-second deadline while searching repositories and validating multiple recursive trees. Hugging Face successfully loads its official `huggingface/skills` manifest; a zero-match query is available-with-no-results, not a provider outage. The market UI must preserve that distinction.
- Verified browse capability: skills.sh's unauthenticated legacy all-time leaderboard returns 200 ranked Skills per page with `total`, `hasMore`, and install counts. It is an unstable internal route, so the adapter must validate/cache it and expose failures without pretending that repository stars are per-Skill ratings.
- UI decision: before a query, show 20 all-time Skills ranked by skills.sh installs, then load another 20 through an accessible action plus bottom-of-list auto-loading. Provider filters belong to keyword search results; the popular home explicitly states its skills.sh provenance.
- Sidebar icon gap: DSH v0.3.8 `settings.section` registrations accept only id/order/label; the settings shell hard-codes a gear for every row. The plugin client will replace only its own rendered row icon with the same plain folded-file SVG used by Skill lists, without editing other settings rows.
- Visual correction: the native replacement SVG must declare a fixed `16 × 18 px` sidebar size because v0.3.8's original icon sizing is component-internal and does not reliably carry over to a raw SVG node.
- Provenance scope: visible self-authored Skills may trigger bounded background discovery against GitHub and the official Hugging Face catalog. Name and description only select candidates; updateable provenance is persisted only after the Host resolves an immutable snapshot, downloads the bounded bundle, and proves its complete byte-level hash equals the unchanged local bundle.
- Content tags: local and marketplace tags are deterministic client-side derivations from the displayed name and description. They render automatically, require no button or network call, and do not rewrite user-owned `SKILL.md` files.
- Phase: the Marketplace V2 UI correction is implemented, isolated-verified, deployed to the approved v0.3.8 evaluation directories, and loaded by the actual portable Desktop. PR/GitHub delivery remains paused by user request.
- Completed execution: repaired live marketplace connectivity, split local-library and online-market search semantics, added Codex/Claude/Agents/OpenCode source filters and selectable bulk import, classified unverifiable imports as self-authored, added verified on-demand Skill descriptions/tags, simplified the folded-file glyph, and restaged the same v0.3.8 Desktop/Harness integration.
- Verified live marketplace cause: Windows Internet Settings enables the local proxy at `127.0.0.1:9674`, while the DSH Host process has no proxy environment variables. Node `fetch` therefore bypasses the system proxy; direct probes reproduce `ECONNRESET` for `api.github.com` and a connect timeout for `skills.sh`. GitHub and Hugging Face fail together because both current adapters depend on GitHub API endpoints.
- Corrected requirement: the prior assumption that a leading-input command must terminate the prefix conflicts with the requested `/command /skill /command body` interaction. The v0.3.8 adapter must preserve normal `/command arguments` Enter execution while keeping a whitespace-followed `/` available as a continued prefix token.
- Verified integration gap: core's default private `active/` directory is not one of the v0.3.8 filesystem provider's default roots. The Host adapter must explicitly target `%DSH_HOME%/skills` so a checked DSH switch becomes visible to the native Skill catalog; same-name unmanaged paths remain conflicts.
- Started: 2026-08-16.
- Historical pre-V2 verification baseline: 16 Vitest files and 151 tests passed; typecheck, workspace build, Host/client bundle verification, exact v0.3.8 staging/verification, live Host leaderboard probe, isolated real-shell popular/keyword market, folded-file sidebar icon, persistence/synchronization/Composer interaction, installed-file syntax/import, and real profile config parsing passed.
- Historical backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260817-200100-popular-provenance` remains available for the prior slice. The current pre-deployment rollback point is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-043818-reliability-batch-delete`.
- Blockers: none for this requested correction. Restore UI for deleted trash snapshots remains a future enhancement; filesystem recovery is available.

## Planned Steps

1. Establish repository, architecture, public seams, and test runner.
2. Implement the managed Skill library and atomic creation API. (Creation slice complete.)
3. Add discovery, import/export, DSH active-root enablement, and junction handling. (Discovery, import, and DSH active-root slices complete.)
4. Add DSH host RPC and React settings section. (Initial list/create/enable slice complete.)
5. Add market sources, update checks, conflicts, backups, and rollback.
6. Add leading prefix-chain parsing while preserving DSH Skill content semantics.
7. Build the DSH Desktop adapter and run end-to-end verification.

## Acceptance Criteria

- Valid Skills can be created without manually creating directories.
- DSH enable/disable is authoritative and persists across restart.
- Existing Codex, Claude Code, and `.agents/skills` roots can be discovered without importing unrelated Agent instructions.
- Existing OpenCode Skills can be discovered from its configured trusted root under the same metadata-only boundary.
- The settings information architecture clearly separates local Skill management/search from the online Skill marketplace/search.
- External discovery can be filtered by Codex, Claude Code, Agents, or OpenCode and supports select-all, deselection, and bulk import with per-item failures.
- A local import is classified as self-authored unless portable metadata or an exact verified remote match proves upstream provenance; the platform it was scanned from remains visible separately.
- Self-authored Skills are checked for exact upstream provenance only after `自动匹配来源` or a per-row retry; persisted ambiguous, unavailable, description-mismatched, or byte-mismatched outcomes remain untrusted and never gain update authority.
- Type tags appear automatically for displayed local and market Skills without a manual labeling action.
- Marketplace failures expose safe actionable reasons, and Host networking honors explicit proxy environment variables or the enabled Windows user proxy without exposing proxy details to the browser.
- Remote updates never silently overwrite local modifications.
- Marketplace data reports only source-supported metrics.
- Slash parsing recognizes only a leading prefix chain; normal body text remains text.
- A Skill enabled for DSH is discoverable through the native v0.3.8 `skill.list` path, not merely present in the manager registry.
- Standalone Harness and DSH Desktop integrations use the same core implementation.
- The settings UI follows DSH original/light/dark/system themes without assuming a fixed dark palette.
- Local, synchronized, and marketplace Skills use one minimal file-shaped outline with a folded corner and no code marks; marketplace entries do not use generated letter covers or repository screenshots.
- The current Desktop adapter and packaged integration gate target DSH Desktop v0.3.8 only; v0.3.9 work is deferred until its reported regressions stabilize.

## Public Test Seams

- Core library API operating on a temporary filesystem root.
- Host RPC handlers operating through documented request/response types.
- Slash prefix parser as a pure exported function.
- React settings interactions through rendered accessibility roles and visible text.

## Next Action

Collect the user's visual/interaction feedback on the deployed dark-theme v0.3.8 UI. Keep PR, publication, v0.3.9 adaptation, and automatic background updates deferred until separately approved.

## Active Isolated v0.3.8 Shell Gate

- Reuse the upstream v0.3.8 isolation contract (`DSH_DESKTOP_USERDATA`, `DSH_HOME`, test mode, update suppression) instead of requiring the user's running Desktop to close.
- Connect only to a random loopback Chromium DevTools port owned by the spawned test Electron process; do not add a browser-visible debug RPC to the plugin or Desktop product.
- Bound boot, DOM interaction, and shutdown independently and enforce one overall deadline. On failure, preserve concise logs/artifacts and terminate only the spawned process tree.
- Prove the Skill settings entry mounts in the real shell, the GitHub filter is visible, create/enable state survives a controlled restart, and leading slash suggestions follow the approved prefix/body boundary.
- All filesystem mutations remain under a generated isolated test directory and the repository's cached v0.3.8 checkout.

### Completed Settings and Market Evidence

- Root cause of the missing UI: the plugin did not export `./package.json`; v0.3.8 Host loading succeeded, but `dsh-client-modules` could not resolve the manifest and omitted the browser bundle.
- The manifest now exports `./package.json`; build verification and the Desktop adapter both fail if that compatibility seam regresses.
- `npm run desktop:v038:ui` opens an isolated real v0.3.8 shell, verifies separate `Skill 管理` and `Skill 市场` areas, asserts the local All/Custom/Sync views before entering Market, and verifies the GitHub source there.
- The shell serves `/plugins/dsh-skill-manager/client.js` with HTTP 200 and shows all four source controls: all, skills.sh, GitHub, and Hugging Face.
- The real settings form creates and enables a Skill inside an isolated `DSH_HOME`; its registry state and manager-owned active link survive a controlled second boot using the same isolated profile.

## Active GitHub Discovery Source

- Add a distinct `GitHub` catalog source instead of conflating GitHub-hosted installation with marketplace discovery.
- Use GitHub repository search only for candidates whose searchable repository metadata/README matches the user query and `SKILL.md`, then inspect a bounded number of recursive trees for exact Skill documents.
- Do not use anonymous code search, crawl GitHub, trust repository descriptions as Skill descriptions, or claim complete coverage.
- Preserve the existing immutable Host-side resolver as installation authority; browser data never selects a commit or bypasses exact path/frontmatter validation.
- Surface rate-limit, timeout, malformed response, incomplete search, and partial-source failures explicitly while preserving other catalog results.

### GitHub Discovery Evidence

- The core exports a bounded GitHub source; the default Host composite now includes skills.sh, GitHub, and Hugging Face.
- The Market view exposes a real `GitHub` filter backed by `catalogs: ["github"]` entries, distinct from the `GitHub 托管安装` host label shared by all current sources.
- Nine focused GitHub source tests cover exact paths, ambiguity and truncation filtering, incomplete results, invalid data, rate limits, cancellation, and active deadlines when transport ignores abort.
- Composite tests prove skills.sh install counts, GitHub repository stars, exact paths, and all catalog identities survive deterministic merging.
- Marketplace expansion gate at that milestone: 14 Vitest files and 133 tests passed; later final evidence supersedes this count.

## Completed Chromium Visual Gate

- The repository preview renders the real `SkillManagerPanel` against deterministic data and does not call live providers.
- Dark Market verification at 1280px and 390px shows all four source buttons and a GitHub-only filtered result with the shared file glyph; both widths have `scrollWidth === innerWidth`.
- Original, light, dark, and system-following modes switch the expected semantic theme values without overflow. Chromium console evidence is 0 errors and 0 warnings.
- GitHub screenshots are stored under `output/playwright/current-visual-preview/`; they are local QA artifacts and do not prove packaged Desktop integration.
- The preview builder now replaces only generated preview assets instead of deleting the output root, so an active Playwright artifact directory no longer causes Windows `EBUSY` failures.

## Active Chromium Visual Gate

- Add a repository-owned preview fixture that renders the real `SkillManagerPanel` against deterministic Remote data; keep it outside the published package surface.
- Exercise All, Market, Custom, and Sync views at desktop and 390px widths, with DSH original/light/dark token fixtures plus system-following behavior.
- Verify file-glyph visibility, one-line descriptions, source metadata, switches/actions, no horizontal overflow, and no browser console errors.
- Store only bounded local QA artifacts under `output/playwright/`; they are not release assets and do not prove packaged Desktop integration.

## Completed Visual Refinement

- Replace generated marketplace initials and the imported generic Skill glyph with one lightweight inline SVG: paper outline and folded corner only.
- Use the same visual language for managed, discovered, and marketplace Skills, with size variants only where list density differs.
- Prefer verified DSH v0.3.8 theme tokens for background layers, borders, primary/secondary labels, hover surfaces, and brand emphasis. Keep neutral fallbacks only for standalone rendering and tests.
- Preserve the existing compact divided-list layout and all original/light/dark/system theme modes; the user's current dark selection is a validation case, not a fixed palette.
- Rendered client assertions cover local and marketplace file glyphs and prove the retired generated-cover element is absent.

## Completion Audit

- The requirement-by-requirement evidence and remaining proof are maintained in `docs/REQUIREMENTS_MATRIX.md`.
- The previous 0.3.8 adapter slice is complete but does not close the full product objective.
- Multi-source product gap is closed: the official Hugging Face curated source, aggregate availability, deterministic merging, exact-path resolution, and local source filtering are implemented and tested.
- Delivery gaps: coherent local commits and any upstream push/PR remain pending explicit authorization. Controlled restart, synchronization, and Composer interaction now pass in the isolated real v0.3.8 shell.

## Completed Multi-Source Marketplace Slice

> Historical V1 implementation record. Marketplace V2 supersedes the public RPC and UI semantics in this section.

- Keep `skillManager.searchMarketplace` as the only browser search operation. The Host owns a composite source and returns one merged result plus per-source availability; the browser cannot submit repository paths or select an installation snapshot.
- Each entry records a primary `source` and all contributing `catalogs`. Duplicate identity is normalized GitHub `owner/repository + Skill name`; skills.sh remains primary when present so its install metric and detail link survive, while a Hugging Face curated duplicate may fill an absent description and exact path.
- The official Hugging Face source reads only the generated full manifest from `huggingface/skills`, validates its fixed schema and direct `skills/<name>` paths, and filters metadata locally. Search does not trust or execute Skill content.
- Installation remains GitHub-backed. The resolver honors and revalidates an exact source path when one is supplied, then parses the immutable `SKILL.md` blob and enriches repository metadata before the manager downloads the bounded bundle.
- One failed catalog does not erase successful results. The aggregate result reports that source as unavailable with a stable public error; if every source is unavailable, the UI still receives explicit status rather than an ambiguous empty market.
- The market view defaults to all sources, allows local source filtering, shows every contributing catalog and GitHub as the installation host, and never renders unsupported metrics as zero.

## Active v0.3.8 Leading-Prefix Design

- A chain uses whitespace-bounded leading tokens: `/skill-one /skill-two body`. This preserves the Harness `SKILL_GESTURE` contract, which injects every matching user-invoked Skill in first-seen order.
- Skill references and recognized commands may continue the prefix. Once ordinary body text starts, a later `/` remains ordinary text.
- rc.6 currently claims a leading-input command on the first Space and suppresses every later `/`. The adapter must defer that claim until Enter without hard-coding command names: Space/menu selection inserts the canonical command token as ordinary leading-prefix text, while Enter still uses the native command source to claim and submit arguments.
- A submitted line whose first token is a leading-input command still belongs to that command; the adapter changes prefix authoring and suggestions, not Host command execution authority. Multi-command execution semantics must be verified separately rather than inferred from an open candidate menu.
- The Desktop adapter patches only the exact rc.6 input-trigger dependency. Each session controller caches names actually returned by the official command/Skill candidate sources and combines them with the hot Skill lexicon when validating a later leading `/`; no command names are hard-coded and native command execution remains unchanged. Only an empty query at the true leading position refreshes a source snapshot; inline and filtered results extend it so a narrower inline roster cannot erase valid leading commands. Source removal and controller disposal clear cached names. The patch preserves `@`, is idempotent, and fails closed on version or marker drift.

## Completed v0.3.8 Desktop Adapter Slice

- The exact source baseline is DSH Desktop `0.3.8` at commit `888b6fecf872478c7207e64cf1c109a949b1acf5` with Harness `0.1.0-rc.6`; the adapter rejects the local `0.3.9` checkout.
- `desktop:v038:stage` vendors the standalone plugin under `assets/plugins/dsh-skill-manager`, registers the companion in both v0.3.8 copy paths, and copies the complete `dist` directory. Running it twice remains idempotent; `desktop:v038:verify` passes.
- The existing Desktop `patch-deps.js` workflow gains an exact-version rc.6 input-trigger patch. A clean published dependency fixture applies twice, both the patch script and emitted client bundle pass `node --check`, and seven leading Skill-prefix boundary cases pass.
- Standalone Harness tgz installation/profile composition and clean Desktop companion synchronization previously passed in isolated `DSH_HOME` roots with 120-second subprocess bounds.
- Full repository evidence: 123 Vitest tests, TypeScript project typecheck, workspace build, Host/client build verification, and the 14-file npm package dry-run all pass.
- An exact `888b6fe` checkout staged twice and verified, then produced `dist/win-unpacked`; the packaged resources contain the complete Skill Manager client/Host bundle. An isolated source Electron `boot-healthy` run passed after applying a temporary upstream-only fix for the baseline's undefined `home` variable.
- The isolated real-shell gate now proves the settings entry, all Market filters including GitHub, controlled restart persistence, external scan/import/link synchronization, native launcher claims, real-keyboard prefix continuation/body termination, and native command Enter. The user's installed/running Desktop and real `%USERPROFILE%/.dsh` profile were not modified or restarted.

## Completed Cross-Agent Synchronization Slice

- The core receives trusted target roots through manager/Host configuration. Browser RPC never accepts an arbitrary filesystem path.
- Supported external targets are `codex`, `claude`, and `agents`; DSH remains the private active-root target.
- Discovery without path arguments reads only direct child Skill bundles under configured roots and returns validated name, one-line description, target, and whole-bundle content hash. It does not return Skill body text or read adjacent `AGENTS.md`/`CLAUDE.md` files.
- Import accepts only `{ target, name }`, resolves the candidate beneath the configured root, revalidates its frontmatter and safe bundle, and fails on an existing managed name rather than overwriting.
- Export/synchronization uses a manager-owned per-Skill directory link from the configured target root to the canonical private bundle. Updates and rollback therefore propagate without duplicate copies.
- A read-only target-state query reports `not-configured`, `not-linked`, `linked`, or `conflict` without returning filesystem paths, so the UI can expose conflicts before an enable attempt.
- Enabling is idempotent when the exact manager link already exists. A same-name directory/link owned by anything else is a conflict and is never replaced or removed.
- Disabling removes only a link that still resolves to the canonical managed bundle. Missing or changed paths fail closed; adjacent target files remain untouched.
- The registry records enabled target names only after the filesystem operation succeeds and restores the prior link state if registry persistence fails.

### Synchronization Acceptance Evidence

- Core tests cover configured-root discovery without body leakage, explicit import, all three target links, update visibility through links, same-name conflicts, unmanaged-link removal refusal, and restart-visible target state.
- Host RPC accepts no paths and exposes only normalized metadata/status; rendered UI requires explicit scans/imports/links and visibly disables conflicts or unconfigured targets.
- Direct-child import rejects top-level junctions/symlinks, revalidates the staged copy after transfer, and filters malformed or internally linked candidates without aborting the entire discovery batch.
- Link ownership requires both registry enablement and an exact canonical target. A third-party same-target link is still a conflict and is never removed.
- Historical synchronization-slice gate: 101 tests, typecheck, workspace build, Host/client bundle verification, and the then-current 12-file npm package dry-run passed.
- The isolated real v0.3.8 shell scans a temporary Codex root, imports one complete Skill bundle, refreshes its target states without a second scan, and creates a manager-owned Claude link that resolves to the canonical library. A sibling `AGENTS.md` remains at the source and is absent from the imported bundle.

## Completed Update Management UI Slice

- Public seam: rendered React interactions calling the existing versioned `checkUpdates`, `update`, `listBackups`, and `rollback` Remote methods.
- A single explicit check action refreshes status for the managed library; no update runs automatically during panel load.
- Per-Skill status distinguishes unchecked, unsupported, locally modified, current, and update-available states. Only `update-available` exposes the update action; locally modified Skills never expose an overwrite path.
- Backup history expands inline per Skill, remains usable independently of update support, and shows public creation time, reason, and snapshot identity without exposing filesystem paths.
- Rollback requires a second explicit confirmation click. Success immediately refreshes the visible Skill and backup history while preserving its DSH enable switch state returned by the Host.
- Update and rollback busy states are scoped to one Skill/backup; failures restore the action and surface the Host message through the existing live status region.
- Layout remains a compact divided settings list and inherits DSH original/light/dark/system colors. Narrow layouts wrap metadata/actions without horizontal overflow.

### UI Acceptance Evidence

- Rendered tests prove status mapping, explicit update, local-modification refusal, backup expansion, two-step rollback, success synchronization, and failure recovery.
- Type checking, all tests, workspace build, Host/client bundle verification, and npm package dry-run pass.
- Playwright verified light and dark update/backup views at 1280px and 390px. Every case had `document.scrollWidth === innerWidth`; status, actions, switches, backup metadata, and rollback controls remained visible.
- These checks validate the standalone client preview, not the still-pending v0.3.8 packaged Desktop integration.

## Completed Update RPC Slice

- v0.3.8 Host methods: `checkUpdates`, `update`, `listBackups`, and `rollback`, all under the existing `skillManager` namespace and schema version 1.
- Requests carry only JSON names and opaque backup ids. `AbortSignal`, filesystem paths, commit SHA, blob SHA, bundle hash, and private backup metadata never cross the browser boundary.
- `checkUpdates` returns deterministic read-only status records; `update` and `rollback` return the resulting public Skill plus the newly created public backup summary; `listBackups` remains read-only and restart-stable.
- Strict Typert Host schemas validate requests and every success/failure result. Lightweight client descriptors mirror method names without importing Host Zod schemas.
- Stable core/provider errors remain in the existing failure envelope. Unexpected exceptions remain `INTERNAL_ERROR`.

## Completed Core Update/Backup/Rollback Slice

- Public seams: `updateSkill({ name, signal? })`, `listBackups({ name? })`, and `rollbackSkill({ name, backupId })`.
- Update accepts only a managed Skill name. Core verifies the installed bundle is unchanged, resolves the latest GitHub snapshot itself, downloads/revalidates that immutable snapshot, and rejects unsupported, locally modified, or already-current Skills.
- Every replacement first persists the complete prior bundle plus its validated registry record under `backups/<name>/<backupId>/`. Backup ids are manager-generated UUIDs and never accepted as filesystem paths.
- Rollback requires an explicit persisted backup id, refuses to overwrite a locally modified current bundle, and preserves the displaced current version as a new backup so the rollback itself can be undone.
- Library directory replacement and registry persistence form one recoverable operation: staging or validation failure leaves the current bundle untouched; registry failure restores the prior directory and registry state.
- Existing DSH enablement remains attached to the managed Skill name and must survive update and rollback without recreating an unmanaged link.
- Remote bundle content remains untrusted data: exact-directory, regular-file, path/size, Git blob, and frontmatter checks are reused; scripts are stored but never executed.
- Update checking plus commit-pinned download share one overall network deadline rather than resetting the timeout between stages.
- A manager-owned replacement journal and strict whole-bundle hashes recover the known pre-commit or post-commit directory state after restart. Unknown or locally altered crash states stop with `REGISTRY_INVALID` instead of deleting data.
- The DSH active link remains attached to the canonical Skill path and reflects updated or rolled-back content without changing the user's current enablement choice.

## Completed Read-Only Update Check Slice

- Public seam: `manager.checkUpdates({ names?, signal? })`, returning one deterministic status per selected managed Skill.
- Status values: `unsupported` for non-GitHub sources, `local-modified` when the current managed bundle hash differs from its registry baseline, `up-to-date` when the remote bundle fingerprint matches, and `update-available` when it differs.
- GitHub source provenance gains `bundleHash`, a deterministic fingerprint over every regular file path/mode/blob SHA/declared size inside the exact Skill directory.
- Local modification detection runs before network access. Locally modified Skills are never silently refreshed or overwritten.
- Remote checks use the source's exact repository path, default-branch commit, and complete bounded tree fingerprint; changes to `references/`, `scripts/`, assets, or `SKILL.md` all count.
- Batch checking has one bounded deadline/cancellation boundary and bounded concurrency; it must settle even if an injected transport ignores abort.
- This slice is read-only: no bundle, registry baseline, active link, or user file is changed.
- Selected names are de-duplicated and sorted; missing names fail explicitly. One timestamp is shared by the complete batch and at most four GitHub checks run concurrently.
- New GitHub installations record `bundleHash`. No package has been released, so there is no published registry migration requirement yet; any future stable registry format must migrate rather than invent a missing remote baseline.

## Completed End-to-End Installation Slice

> Historical V1 implementation record. The Core installation machinery remains reused, but the browser no longer sends a `MarketplaceEntry`.

- Added `skillManager.installMarketplace({ schemaVersion: 1, entry })`; `entry` is the normalized search result selected by the user, not a client-authored resolved snapshot.
- The Host must resolve the entry immediately and pass only that Host-produced `ResolvedMarketplaceEntry` to the manager installation API.
- Success returns `{ skill: ManagedSkill }`; stable resolver/manager errors use the existing normal failure envelope.
- The Market view shows `安装`, `安装中`, or `已安装` per entry. Successful installation upserts the returned Skill into local state so All view updates without a restart.
- Duplicate clicks are blocked per marketplace id; installing one result does not disable unrelated cards or the market search.
- No automatic DSH enablement occurs during installation; users retain a separate explicit enable switch in the All view.

## Completed Safe Installation Slice

- Public seam: `createSkillManager({ root, fetch?, marketplaceTimeoutMs? }).installMarketplaceSkill({ entry, signal? })`.
- Only `ResolvedMarketplaceEntry` values with consistent repository/Skill/path/SHA identity are accepted.
- Installation fetches the recursive tree at `snapshot.commitSha`, proves `path/SKILL.md` still has `snapshot.blobSha`, and downloads only regular blobs inside that exact Skill directory.
- Repository-root and adjacent Agent instruction files are never selected. Symlinks, submodules, unsafe paths, truncated trees, malformed blobs, and bounded-size violations fail before the final library rename.
- Bundle files are staged under a temporary sibling, `SKILL.md` frontmatter is revalidated, and library plus registry updates use the existing rollback behavior. Remote content is stored but never executed.
- The installed registry source records repository, exact path, commit/blob snapshot, catalog source, and repository URL for later update/conflict checks.
- Blob bytes are re-hashed with the Git object algorithm and must equal the tree SHA. Limits are 512 files, 10 MiB per file, and 25 MiB total declared bytes.
- Marketplace networking is initialized lazily so local creation, discovery, import, and enablement remain usable in a runtime without `fetch`.

## Completed Host Resolution Slice

> Historical V1 implementation record. Current public resolution is folded into Host-owned `installSkill` intent handling.

- Added `skillManager.resolveMarketplace({ schemaVersion: 1, entry })` beside search; the request carries the exact normalized entry selected by the user.
- The Host validates the complete entry envelope, delegates through an injected structural resolver port, and returns `{ entry: ResolvedMarketplaceEntry }` in the existing success/failure envelope.
- Stable `MarketplaceResolverError` codes cross the RPC boundary; unexpected errors remain `INTERNAL_ERROR`.
- Browser descriptors gain the method for later UI use, but this slice does not display an install action or execute repository content.

## Completed GitHub Resolution Slice

- Public seam: `createGitHubMarketplaceResolver(options).resolve(entry, { signal? })`.
- The resolver accepts a normalized GitHub-backed marketplace entry and returns a commit-pinned resolved entry.
- Resolution reads repository metadata, the default-branch commit, its recursive tree, and selected `SKILL.md` blob through injected `fetch`.
- A candidate path must end in `SKILL.md`, match the requested Skill directory/name, and contain valid frontmatter whose `name` equals the requested Skill id.
- The resolved result includes exact repository path, repository id/node id, repository-level stars, parsed description, explicit `metadata.author` when present, commit SHA, blob SHA, and fetch timestamp.
- Repository/Skill identifiers and returned paths are validated before use; the install repository must match the repository that was resolved.
- Truncated trees, ambiguous/missing candidates, unsafe paths, invalid frontmatter/blob data, non-2xx responses, rate limits, cancellation, and deadlines produce stable errors. No remote script is executed.
- The 10-second default is one overall deadline, not a per-request timer. Resolution returns on deadline or caller cancellation even when an injected `fetch` ignores its abort signal.

## Current Marketplace Slice

- First source: a replaceable legacy skills.sh adapter using the public search endpoint consumed by the official `vercel-labs/skills` CLI. The documented V1 API is not called directly because it requires Vercel project OIDC.
- Operation: read-only keyword search; the endpoint requires at least two characters and exposes no stable browse-all pagination contract.
- Supported fields: Skill id/name, GitHub repository source/publisher, and skills.sh install count.
- Unsupported fields remain explicit `null`: Skill description, Skill author, GitHub stars, and download count.
- Repository owners are publishers, not inferred Skill authors. A later GitHub enrichment slice may populate `author` only from explicit Skill metadata.
- Every network request receives a bounded timeout and can also accept caller cancellation.
- Source parsing is isolated behind an injected `fetch` adapter so tests never call the live service.

## Completed Host Slice

> Historical V1 implementation record. The current public Host descriptor list is the 20-method V2 surface recorded at the top of this file and in `docs/API_SPEC.md`.

- Verified DSH v0.3.8 companion plugins use a host `TypertRemoteService`, strict Typert descriptors mounted by the client, and `ctx.get("remote.<namespace>")` for browser calls.
- Namespace: `skillManager`.
- Protocol version: `1`.
- Runtime methods: `list`, `create`, `setEnabled`, `searchMarketplace`, `resolveMarketplace`, `installMarketplace`, `checkUpdates`, `update`, `listBackups`, `rollback`, `discoverExternal`, `importExternal`, `listTargetStates`, and `setTargetEnabled`.
- The pure handler factory accepts an injected core manager so tests do not need a running Harness process.
- Marketplace search and GitHub resolution accept injected structural ports, keeping network calls out of RPC tests unless explicitly selected.
- Host runtime configuration may override the manager root and external roots. Defaults resolve under `%DSH_HOME%/skill-manager` plus the user-home `.codex/skills`, `.claude/skills`, and `.agents/skills` directories.

## Completed Client Slice

- React 18 client registers an independent `settings.section` at order 30.
- Separate top-level local management and online market areas; local All/Custom/Sync views cover managed Skills, self-authored Skills, and explicit cross-agent discovery/linking.
- Local views support loading, refresh, search, self-authored Skill creation, and DSH enable/disable.
- The Market view searches only on explicit submission, ignores stale responses, and shows the shared file glyph, publisher, source, supported metrics, and repository links without presenting an unsafe install action.
- Skill descriptions remain one line and expose the full text through the native title tooltip.
- Remote transport failures release loading/busy states and surface an accessible status message.
- Host descriptors keep full Zod validation; the browser mounts lightweight strict identity codecs matching verified DSH plugin practice.
- Theme styling maps local semantics directly to verified DSH v0.3.8 aliases for surfaces, borders, labels, hover states, and accents; standalone fallbacks remain secondary.

## Deferred Desktop v0.3.9 Compatibility Research

- Verified tag: `v0.3.9` (`91a56fd`).
- Desktop v0.3.8 and v0.3.9 both use `@deepseek-ai/dsh@0.1.0-rc.6` and Electron `^43.4.0`.
- v0.3.9 continues to ship `settings.section`, Typert Remote services, and `window.__ModuleLoader__` client bundles.
- Its new plugin manager uses `settings.plugins.tab`, so it does not collide with the Skill Manager's `settings.section` registration.
- This is research evidence only. v0.3.9 packaged testing, adapter changes, installation, and PR acceptance are explicitly out of the current development scope because the user reports significant v0.3.9 regressions.
- DSH Desktop v0.3.8 is the sole current Desktop adapter, runtime smoke-test, packaging, and upstream PR baseline.

## Verification Evidence

- Current final repository gate: `npm test` passed 14 files and 137 tests; `npm run typecheck`, `npm run build`, Host/client `verify:build` (60,849-byte client bundle), the 14-file npm package dry-run, exact v0.3.8 adapter verification, and the final isolated real-shell gate all passed.
- Multi-source coverage includes 11 Hugging Face source cases, 9 GitHub discovery source cases, 4 aggregate source cases, 21 GitHub resolver cases, strict RPC schema coverage, and rendered catalog filtering/partial-failure interactions.
- DSH Desktop v0.3.8 commit `888b6fe` staged twice and verified, installed lockfile dependencies, passed syntax checks, fetched the vendored runtime, and built `dist/win-unpacked` with the complete plugin resource directory.
- The first isolated Electron boot exposed a pre-existing v0.3.8 `ReferenceError: home is not defined` in `applySettingsSectionGuard`; adapter diff and baseline history prove the Skill Manager did not introduce it. A temporary checkout-only correction allowed upstream `boot-healthy` to pass in 50 seconds.
- Isolated real-shell interaction verifies settings/market, create/enable restart persistence, cross-agent scan/import/link isolation, and Composer launcher/manual-prefix/body/Enter behavior without terminating the user's live application.

- Historical pre-marketplace-expansion gate: 11 files and 101 tests passed, including update/backup/rollback, update-check, installation, Host RPC, rendered client, external discovery/import, and target-link coverage.
- Update/rollback tests cover immutable re-resolution and download, durable restart-visible backups, reversible rollback, local conflict refusal, unsupported/current states, corrupted downloads/backups, untrusted backup ids, active-link continuity, cancellation against an abort-ignoring transport, one two-stage deadline, orphan recovery, and journaled recovery on both sides of registry commit.
- Update checks cover local/self/imported sources, local modification short-circuiting with zero network access, full-tree unchanged/changed comparison, unsafe/truncated trees, selected-name validation, deterministic ordering, one batch timestamp, four-worker concurrency, and deadline/cancellation against a transport that ignores abort.
- GitHub resolver tests cover the successful immutable snapshot, invalid configuration/input, malformed base64, truncated/missing/ambiguous/unsafe paths, frontmatter mismatch, HTTP/rate-limit classification, caller cancellation, the default deadline, and a `fetch` implementation that ignores abort.
- Focused skills.sh source tests: 6 cases passed for normalization, validation, malformed responses, de-duplication, cancellation, and the default 10-second deadline.
- `npm run typecheck`: TypeScript project references passed.
- `npm run build`: core and plugin builds passed; the Host bundle lowers decorators for ES2022.
- Built entry import: exported `DshSkillManagerService` and the `list`, `create`, `setEnabled`, `searchMarketplace`, `resolveMarketplace` descriptors loaded successfully in Node 24.
- Historical initial client factory gate: registered `dsh-skill-manager` and exported `apply`, `inject`, and `SkillManagerPanel`; that earlier client bundle was 45,899 bytes.
- Playwright visual QA: light and dark marketplace flows passed at 390px and 1280px. Both narrow previews had `document.scrollWidth === innerWidth === 390`, with segmented controls, toolbar actions, truncated descriptions, metrics, and source links remaining visible.
- `npm pack --dry-run --workspace dsh-skill-manager`: standalone package contains Host/client artifacts, declarations, Cordis patch, and manifest; no private core import remains in published code or declarations.
- Built core import verified `createGitHubMarketplaceResolver` is exported; Host/client bundle verification passes with both resolution/install methods and a 32,563-byte client bundle.
- Built core import verified `installMarketplaceSkill` is present; npm package dry-run contains the standalone Host/client artifacts and no private core import.
- Playwright install-flow QA: light and dark themes passed at 390px and 1280px. Every case showed three install buttons and three source links with `document.scrollWidth === innerWidth`; successful narrow-screen installation changed the selected button to disabled `已安装` without overflow.
- Update-management Playwright QA: light and dark themes passed at 390px and 1280px with explicit status, update controls, and expanded backup history. Both widths had `document.scrollWidth === innerWidth`; screenshots are local validation artifacts and are not part of the package.
- Historical pre-curated-market build verification passed with all 14 Host/client RPC method descriptors and a 55,845-byte client bundle; the current aggregate-market package contains 14 expected files with no private workspace dependency in the package surface.
