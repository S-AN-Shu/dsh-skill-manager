# Testing

## Public v0.1.0 Release Gate

- The first clean Linux CI attempt exposed a hidden local-artifact dependency: 199 tests passed, but the Host RPC suite could not resolve the unbuilt private Core `dist` entry. Root `pretest` now builds Core and index-schema before Vitest so `npm test` has the same prerequisite on developer machines and CI. The next run exposed a Windows-only absolute-path fixture; the DSH-root regression now derives absolute paths from the platform `tmpdir()`.
- Config/lifecycle focused tests passed 42 cases with 8 historical skips. The Config regression proves named and service-class schemas are identical, valid path data is retained, and invalid field types fail validation. Client regressions prove two stylesheet owners share one node and the last disposer removes it; `apply()` also releases the sheet after Remote disposal.
- Full Vitest passed 25 files, 213 tests, and 8 historical skips. Typecheck, all workspace builds, and standalone bundle verification passed; the Client artifact is 175,886 bytes.
- `npm pack --workspace dsh-skill-manager` produced `dsh-skill-manager-0.1.0.tgz`: 16 files, 128,682 packed bytes, 684,100 unpacked bytes, npm SHA-1 `4484e017dc6a23659ad84f21e32b67de3079ec09`.
- With `DSH_HOME` isolated under `%TEMP%`, official `dsh plugin --profile web add <tgz>` installed the artifact under Harness `0.1.1-rc.2`. `dsh --profile web --dump-config` included `id: skill-manager`, `name: dsh-skill-manager`, and `config: {}`. A real `dsh web --no-open --host 127.0.0.1 --port 0` boot returned HTTP 200 for `/` and `/plugins/dsh-skill-manager/client.js`; the served Client length matched 175,886 bytes.
- GitHub Actions Linux run `32871114313` passed `npm ci`, self-contained tests, typecheck, all workspace builds, standalone verification, and tarball creation. Downloading the published Release asset again produced the same SHA-256 `46118AE5425BC68CA3020B0FF80DD770A497AC6C30A9843FC5C0D0EBCF98A38B` as the locally verified upload.

## DSH Desktop v0.5.4 / Harness rc.2 Gate

- The source resolves DSH, Typert, connection, locale, runtime, settings, and remotes at `0.1.1-rc.2`, while matching the Desktop's real `dsh-client-ui-primitives@0.1.0-rc.7` artifact.
- Focused Client/RPC/Marketplace coverage passed 50 tests with 8 historical skips. Full Vitest passed 25 files, 212 tests, and 8 historical skips. Typecheck, workspace build, standalone verification, and the exact 16-file npm package gate passed; the Client bundle is 175,211 bytes.
- An isolated rc.2 Profile installed through the official `dsh plugin` command, booted the real Web UI, loaded management/market RPC surfaces, returned 13 live recent-heat candidates, and produced zero browser console errors.
- The real v0.5.4 `web` Profile was backed up, installed through the same official command, and restarted. Browser verification expanded “高级 ▾ (9)”, selected `Skill 管理插件`, loaded 117 Skills from the real Host, and reported zero console errors.
- Evidence screenshot: `output/playwright/dsh-desktop-v054-rc2-skill-manager-advanced.png`.

## Ordinary Harness rc.7 Compatibility Gate

- Plugin peer/dev dependencies were resolved against `@deepseek-ai/*` rc.7 declarations; `npm run typecheck` passed without using rc.6 contract types.
- Focused Host/RPC/Client coverage passed 50 tests with 8 historical skips. Full Vitest passed 25 files, 212 tests, and 8 historical skips; workspace build and standalone bundle verification passed with a 175,199-byte Client bundle.
- Package artifact `dsh-skill-manager-0.0.0.tgz` contains exactly 16 files, is 128,486 bytes, and has SHA-256 `CD38F509557DA73949A82906B1C3D627C119391ACDF8A1E88B50CCE225100844`.
- An isolated rc.7 `DSH_HOME` installed the artifact through `dsh plugin --profile web add`; the command initialized the Profile, added the package dependency, and appended `dsh-skill-manager` after the two official bundles.
- A real isolated `dsh web --host 127.0.0.1 --port 0` boot served `/plugins/dsh-skill-manager/client.js`, registered the `Skill 管理` settings section, returned HTTP 200 for `list`, `listTrash`, `getCapabilities`, and `browseRepositories`, and rendered 12 recent-heat candidates.
- Browser verification found zero console errors, zero horizontal overflow, one plugin stylesheet, and no private `data-dsh-skill-manager-sidebar-icon` DOM replacement.

## Market Runtime Contract And Notice Coverage

The Typert descriptor regression parses a complete HTML-only Trending success envelope with `repositoryId: 0`, `ownerId: 0`, generated owner media, and trend metadata. This reproduces the deployed boundary failure and proves the relaxed list-stage sentinel contract without changing inspected GitHub identities.

Client regressions prove a completed bulk notice has a close button, survives 4,999 ms, and disappears at 5,000 ms. The timer only recognizes completed bulk enable/disable/delete text. Full validation passed 25 files and 210 tests with 8 historical skips, typecheck, workspace build, 16-file package verification, exact v0.3.8 adapter stage/verify, and the isolated real-shell gate.

Live built-artifact probes on 2026-08-19 returned 13 recent-heat candidates in 4,094 ms and 20 historical-popular candidates in 2,182 ms. Both complete responses passed the real Typert result descriptor. Requests were exactly two Trending HTML reads plus one historical-popular REST search; there was no per-card enrichment.

The timeout-parity regression uses fake timers to prove that default Trending remains pending at 12 seconds and returns a stable unavailable result at 25 seconds, while default repository Inspection remains pending at 30 seconds and returns `MARKETPLACE_RESOLUTION_TIMEOUT` at 45 seconds. A real isolated `anthropics/skills` gate verified 20/20 fixed-commit descriptors as installable, installed `skills/academy-guide` with complete GitHub provenance, and observed `already-installed` on a repeat request. This gate uses an isolated manager and target root and does not mutate the live registry.

## Quota-Safe Market And Trusted-Source Coverage

Protocol/RPC tests assert that both provenance compatibility calls return `PROVENANCE_MATCHING_DISABLED` and invoke zero discovery operations. Rendered Client tests seed a persisted `autoMatch: true` preference and prove that automatic matching still does not run, the setting is forced off, and automatic-match/bulk-rematch/per-row provenance controls are absent. Existing market installation, trusted update checks, update risk confirmation, rollback, and synchronization regressions remain green.

GitHub Trending fixtures now assert two HTML requests and zero `api.github.com` enrichment requests, including partial metadata and empty/error states. A live 2026-08-19 built-Core probe returned 13 candidates from exactly `https://github.com/trending?since=weekly` and `?since=monthly`, with zero REST requests. Cache regressions prove that Inspection followed by installation inside the one-hour Host-owned resolution window adds no metadata/commit/Tree request, while cache miss/expiry and updates retain fresh resolution behavior.

The full Vitest suite passed 25 files with 208 tests and 8 historical skips before final packaging. Typecheck, workspace build, standalone plugin verification, the 16-file npm dry-run, exact v0.3.8 adapter stage/verify, and the isolated real-shell UI gate passed. The shell specifically confirmed that local provenance controls are absent while automatic update checks, automatic updates, synchronization, recent deletion, persistent enablement, dense layout, and Composer prefix behavior remain available.

## Provenance Rematch And Installability Coverage

The fixed GitHub Tree fixture now includes ordinary `tree/040000` directory entries and proves that they do not block a valid nested Skill, while a selected-Skill symlink and submodule independently block only their owning Skill. A YAML block-scalar description fixture reproduces and prevents the final-newline metadata mismatch at the real Inspector -> Snapshot Resolver -> Core installation seam.

Protocol tests force one name in a five-name provenance batch to fail and assert four ordered successes, one structured failure, and a maximum concurrency of two. Rendered Client coverage creates 22 non-GitHub Skills plus one already trusted GitHub Skill, then proves `一键全部重匹配` sends 20+2, excludes the trusted entry, preserves the failed name's concrete error, and shows the final outcome counts. The isolated v0.3.8 shell asserts that the new control is present alongside the existing maintenance, synchronization, deletion/restore, persistence, layout, and Composer gates.

Real-network observation on 2026-08-19: `anthropics/skills` commit `0a64e39` returned 20 descriptors and 20 installable paths in 6,073 ms. A separate temporary-root run resolved and installed `skills/academy-guide` with two fixed-commit files, then removed the temporary root. These observations supplement deterministic tests and are not required for offline CI.

## Dense Layout And Multi-Image Detail Coverage

The rendered Client regression proves that a failed repository image does not remove successful media, no more than eight unique images are resolved, a ninth README image is not requested, Social Preview remains available, and selecting a thumbnail changes the primary preview. Visual checks cover 572px and 390px dark-theme viewports: the wider layout keeps local actions aligned with the icon/content row, while the narrow layout deliberately stacks actions below content without horizontal document overflow.

The isolated real DSH Desktop v0.3.8 gate additionally measures the managed row geometry and rejects both the original accidental grid placement and overlap. It accepts only a right-aligned same-row action region or the intentional below-content layout, then rechecks restart persistence, DSH enablement, cross-tool synchronization, recoverable deletion, and `/command /skill /command body` boundaries.

## Protocol 5 Repository Batch Coverage

Exported fingerprint tests cover LF/CRLF equality; binary, whitespace, YAML-order, and adjacent-file inequality; stable sorting; unsafe paths; duplicate paths; and Windows junction rejection. Index tests cover atomic persistence, corrupt-cache recovery, unique/ambiguous lookup, per-path history, and global bounds. Core integration tests cover historical fixed-commit matching after upstream moves on, path basenames different from frontmatter names, raw local-modification ineligibility, risk-bearing update checks, automatic high-risk refusal, manual second acknowledgement, final commit refresh, backup persistence, and active-link preservation. Protocol 5 tests add skills.sh candidate hints with GitHub fallback, unique/mirror/ineligible provenance outcomes, a 20-name bounded batch, repository snapshot coalescing, per-Skill batch installation isolation, name/source conflict handling, high-risk acknowledgement, and hard 30/60-second deadlines.

Repository Inspection returns details before verified-fingerprint indexing and limits that background work to two workers. One Skill failure is isolated and does not cancel remaining observations or delay the details response.

## Strategy

Use Vitest with temporary directories. Tests observe behavior only through exported core APIs, RPC handlers, pure parser functions, and rendered React interactions.

Marketplace V2 proves that repository listing performs no README/Tree/blob requests, Inspection uses one fixed commit, installation requests cannot carry trusted hashes or local paths, root manifest files remain bounded, media rejects arbitrary or oversized non-raster inputs, and risk findings do not leak Skill bodies or local paths.

The rate-efficient detail suite also proves one codeload download is reused in memory and on disk, unsafe/oversized/high-expansion ZIPs fall back to fixed-commit Raw reads, ZIP and Raw bytes must match the fixed Tree, tampered disk metadata is rejected, one caller cancellation does not abort a shared download, one-hour TTL expiry refreshes content, repository media reuses the verified cache, installation reuses a recent Host-owned Inspection resolution, updates refresh the latest commit, and final risk scanning occurs before the managed-library write.

## Initial Vertical Slices

1. Creating a valid Skill produces a complete bundle and retrievable registry entry.
2. Invalid names and pre-existing destinations return stable errors without partial files.
3. Enabling a Skill creates exactly one active link; disabling removes only the managed link.
4. Importing a Skill cannot read outside its bundle.
5. A locally modified remote Skill reports a conflict instead of updating.
6. Prefix parsing uses whitespace-bounded chained segments, stops at body text, treats unknown segments as text, and rejects slash-concatenated pseudo-chains.
7. Host RPC handlers list, create, enable, and search the marketplace through injected structural core ports.
8. Host failures preserve stable core error codes and reject unsupported protocol versions.
9. The Cordis service exposes the expected Typert namespace, Remote markers, and strict descriptor methods.
10. The React settings section loads, creates, and enables Skills through an injected Remote service.
11. Client `apply()` mounts matching descriptors and registers an independent `settings.section`.
12. Marketplace search normalizes only source-supported metadata and exposes stable validation, HTTP, malformed-response, cancellation, and deadline errors.
13. Client classification and marketplace search are verified through accessible tabs, form controls, visible metadata, and source links.
14. GitHub resolution proves the exact Skill path and immutable snapshot through the exported resolver seam, while rejecting uncertain paths and malformed metadata.
15. Resolver cancellation/deadline tests include a transport that ignores `AbortSignal`, proving that the public operation settles independently of transport cooperation.
16. Host resolution RPC tests verify successful structural delegation, stable resolver error envelopes, strict Typert request validation, Remote registration, and matching browser descriptors.
17. Marketplace installation tests verify exact bundle scoping, Git blob byte identity, source provenance, unsafe entry/path rejection, bounded sizes, active deadline/cancellation, conflict short-circuiting, and failure cleanup.
18. Local creation is verified without a global `fetch`, preserving the core's offline management boundary.
19. Host marketplace installation tests prove that the browser entry is resolved on the Host and only the Host-produced snapshot reaches the manager.
20. Rendered client tests cover per-entry installing/installed states, local-list synchronization without auto-enable, and retry restoration after Host failures.
21. Read-only update checks cover whole-bundle local conflicts before network access, complete remote tree fingerprints, unsupported sources, selection validation, unsafe/truncated trees, deterministic batches, a four-worker limit, and deadline/cancellation when transport ignores abort.
22. Explicit update and rollback tests cover core-owned latest resolution, exact commit-pinned re-download, persistent backup discovery after restart, rollback reversibility, active-link continuity, conflict refusal, corrupted remote/backup data, opaque-id path safety, one multi-stage deadline, cancellation, and interrupted replacement recovery.
23. Host update/backup RPC tests cover structural delegation, stable core error envelopes, strict request rejection for client-supplied signals/paths/snapshots, strict result hashes and backup ids, Remote registration, and matching browser descriptors.
24. Rendered update-management tests cover explicit library checks, every visible update state, update success/failure recovery, local-conflict refusal, inline backup history, two-step rollback, and immediate Skill/backup synchronization.
25. Cross-agent core tests cover configured metadata-only discovery, path/body non-disclosure, explicit direct-child import, three external link targets, restart persistence, canonical update visibility, same-name conflicts, and refusal to remove unmanaged links.
26. Host/client synchronization tests reject browser-supplied paths, preserve path-free failure envelopes, expose strict Remote descriptors, require explicit scans/imports/links, and render unconfigured/conflicting targets as disabled states.
27. Hugging Face source tests cover the official manifest schema, name/description search, malformed/base64/duplicate entries, HTTP errors, caller cancellation, and response-body deadlines when transport ignores abort.
28. GitHub discovery tests cover bounded repository queries, exact safe Skill paths, ambiguity/truncation filtering, incomplete results, rate limits, malformed data, cancellation, and deadlines when transport ignores abort.
29. Composite source tests cover deterministic duplicate merging, catalog provenance, per-source availability, all-source failure, and one-source failure preserving successful results.
30. Rendered marketplace tests cover local source filtering, multiple catalog labels, GitHub installation-host labeling, and partial-source warnings.
31. Rendered client tests assert that local and marketplace entries use the shared file glyph and that the retired generated-cover element is absent.
32. Rendered marketplace tests load missing descriptions through the Host resolver, then verify the exact `SKILL.md` description, author, and recomputed content tags without inventing a repository summary.
33. Host build verification rejects an external `https-proxy-agent` import so a standalone Harness profile does not depend on Desktop's parent `node_modules` layout.
34. Obsolete V1 popular-market tests are retained as skipped history; Marketplace V2 repository-home behavior is covered by metadata-only browse and rendered repository-candidate tests.
35. Provenance tests prove that matching text with different bytes remains self-authored, while one exact complete-bundle match persists the contributing catalog without exposing repository authority to the browser.
36. Rendered client tests verify automatic visible-row tags, bounded opt-in provenance maintenance, durable matched/no-match/ambiguous/unavailable outcomes with retry, recoverable two-step deletion, 30-day recent-deletion restore, persisted automatic update preferences, clear manual cross-tool synchronization, and preservation of the platform-owned settings navigation icon.
37. Marketplace V2 rendered tests verify an explicitly labeled GitHub repository search, 12 accessible category controls, the combined monthly-backed `近期热度榜`, history/latest/relevance switching, cached/unavailable source messaging, and category behavior without triggering README or Tree inspection.
38. Marketplace V2 rendered tests verify that either the large repository body or `安装` synchronously portals a loading confirmation dialog under `document.body`, individual batch failures remain visible with retry, high-risk Skills require a second confirmation, GitHub-backed Skills expose explicit update checks, and routine backup history stays hidden.
39. Core classification tests cover all 36 Skill Leaderboard subcategories, explicit `SKILL.md` precedence, manifest/topic/keyword fallback, deterministic evidence, and the three-tag limit. GitHub Trending fixtures cover weekly/monthly metrics, monthly-first ordering with weekly-only append, strong-signal filtering, malformed/oversized HTML, independent cache freshness, stale fallback, unavailable state, and the absence of README/Tree/blob requests.
40. Host transport tests verify one proxy transport is created per marketplace-fetch instance and that transient idempotent GET failures retry without weakening cancellation; Inspector tests keep document concurrency at three and retry only transient resets. Trash tests cover both current and legacy valid `local-import` archive origins while retaining strict source and hash validation.

## Standalone Chromium Evidence

- The repository-owned preview renders the production `SkillManagerPanel` with deterministic Remote data and no live network dependency.
- GitHub Market filtering passes at 1280px and 390px in dark mode with all four source controls visible, one GitHub-only row, no horizontal overflow, and no console errors or warnings.
- Original, light, dark, and system-following modes switch their expected semantic theme values without horizontal overflow.
- Evidence under `output/playwright/current-visual-preview/` validates the standalone component. The isolated v0.3.8 real-shell gate separately validates the settings entry and Market source controls.

## Broader Validation

### Protocol 5 Final Repository Validation - 2026-08-19

- `npm test` passed: 25 test files, 205 tests passed, 8 historical Client tests skipped.
- `npm run typecheck`, `npm run build`, `npm --workspace dsh-skill-manager run verify:build`, and `npm pack --workspace=dsh-skill-manager --dry-run --json` passed.
- The package contains exactly 16 runtime files. The verified Client bundle is 167,891 bytes and the bundled Host entry is 387,388 bytes.
- Exact Desktop v0.3.8 adapter verification and isolated real-shell UI gate passed. The gate confirmed an HTTP 200 client bundle, settings registration, the 16x18 glyph, market/category controls, restart lifecycle, and prefix boundaries. Its 15-second live GitHub keyword observation did not settle, so external keyword availability remains explicitly unverified rather than counted as a local failure.
- Fresh rollback-backed target synchronization completed after this validation; exact 16-file deployment hashes and post-copy Host checks are recorded in `docs/ENVIRONMENT.md`.

- Historical Protocol 4 final gate (2026-08-18): 25 test files, 202 current tests passed, and 8 historical V1 tests skipped.
- `npm run typecheck`, `npm test`, `npm run build`, `npm run verify:build --workspace=dsh-skill-manager`, and `npm pack --workspace=dsh-skill-manager --dry-run --json` passed.
- Final package evidence: 16 files, 157,349-byte Client bundle, and 371,007-byte bundled Host entry.
- Exact DSH Desktop v0.3.8 stage/verify passed. The isolated real-shell UI gate passed protocol-4 Client loading, 16×18 icon sizing, persistence, deletion/restore, synchronization, and Composer prefix/body behavior; its separate live GitHub keyword observation exceeded 15 seconds and is recorded as external-network unverified, not silently treated as success or a product failure.
- Both installed 16-file packages are SHA-256-identical to the final build. Installed JavaScript syntax checks and Host ESM imports pass with `DshSkillManagerService`, 22 descriptors, protocol 4, and no private Core import. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-163603-provenance-v2`.

Historical Marketplace V2 gate (2026-08-18, repository validation before v0.3.8 resynchronization):

- Latest repair validation: `npm test` passed 22 files and 184 tests with 8 historical V1 UI tests skipped; `npm run typecheck`, workspace build, and the 146,820-byte Host/Client build verification passed.
- The real user archive `aframe-webxr` lists successfully with its persisted expiry. Exact v0.3.8 stage/verify and the isolated UI gate passed protocol 3, `近期热度榜`, 16×18 icon sizing, persistence, deletion/restore, synchronization, and Composer-prefix behavior. The UI gate's live keyword query exceeded its independent 15-second observation window, while subsequent Host probes returned 18 recent-heat candidates in 11.6 seconds and inspected 20 `anthropics/skills` descriptors in 8.5 seconds.
- Both locally installed 16-file packages are SHA-256-identical to the verified build. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-111457-recent-heat-dialog`.

- `npm test`: 22 files, 181 passed. Eight skipped Client tests are explicitly obsolete/deferred V1 backup UI history and are not counted as V2 coverage.
- `npm run typecheck`, serial `npm run build`, and Host/client build verification passed; the Client bundle is 138,829 bytes and exposes 22 public descriptors.
- npm dry-run contains 16 files at 91,181 bytes compressed and 514,024 bytes unpacked, with no bundled dependency list.
- The repository-owned visual preview rebuilt successfully; the latest recorded original/dark/390px Chromium evidence has no horizontal overflow.
- v0.3.8 stage twice and verify passed against isolated commit `888b6fe`.
- Isolated real Shell passed Client HTTP 200, exactly two V2 repository sorts (`历史热门`, `相关度`), enlarged repository install actions, a body-portaled dialog visible during Inspection, a live category search returning 20 candidates, an exact 16×18 computed sidebar icon, all three automatic-maintenance checkboxes, `最近删除`, `同步到其他工具`, deletion/restore, restart persistence, synchronization isolation, and Composer prefix behavior.
- This isolated run returned live GitHub repository candidates. Provider behavior remains bounded and independently covered by deterministic discovery tests because later proxy/rate-limit conditions may differ.
- A live Host-proxy Inspection of `anthropics/skills` completed in 7,305 ms at commit `f379e5a`, returned 20 descriptors, and kept the one directory/name mismatch non-installable.
- Browser design QA for this revision passed at 1280×833: the dialog measured 720×752.7, was centered through a `document.body` portal, retained its fixed footer, and had zero horizontal document overflow. A new narrow screenshot attempt was stopped after the Playwright CLI exceeded the bounded wait; responsive CSS and rendered interaction tests pass, but this revision does not claim a newly captured 520px image.
- Full validation for this revision passed 175 tests with 8 historical V1 tests skipped, TypeScript project checking, the workspace build, a 139,220-byte Client bundle check, the 16-file npm dry-run, visual-preview build, two idempotent v0.3.8 stage/verify cycles, and the isolated real-shell gate.
- Both deployed 16-file plugin directories match the repository package file-by-file by SHA-256. Installed Client/Host syntax and Host ESM import pass; the live profile has no standalone `dsh` executable for a redundant `--dump-config` call, while the same package has already passed the isolated real-shell runtime gate.

- Type checking and package build.
- Import the emitted Host entry in the supported Node runtime so decorator lowering is verified.
- Execute the emitted client script inside a VM-backed DSH module-loader factory and verify its public exports.
- Keep the client bundle below the regression threshold that would indicate Host schema code leaked into the browser.
- Inspect the npm tarball and reject private workspace imports from published code or declarations.
- Run Playwright visual QA in light and dark themes at desktop and narrow mobile widths; compare document width with viewport width and exercise create and marketplace flows.
- Exercise marketplace installation in light/dark themes at 390px and 1280px; verify install/source controls remain visible and the installed state does not introduce overflow.
- Re-run light/dark visual QA after theme-token or icon changes; verify the plain folded-file outline remains legible without adding fixed source colors.
- Windows junction and copy fallback integration tests.
- DSH web profile smoke test.
- DSH Desktop v0.3.8 packaged integration smoke test; v0.3.9 is explicitly deferred.
- Run `npm run desktop:v038:stage -- --desktop <v0.3.8 checkout>/dsh-desktop` twice, then `npm run desktop:v038:verify -- --desktop <same directory>` to prove exact-version gating, complete bundle vendoring, and idempotent companion registration.
- Run `npm run desktop:v038:ui` against the cached exact checkout to prove the manifest resolves through `./package.json`, the browser bundle returns HTTP 200, separate `Skill 管理`/`Skill 市场` areas mount, Market exposes GitHub repository search and category controls, the sidebar icon computes to exactly 16×18, create/enable persists across a controlled restart, external Codex scan/import links to an isolated Claude root without importing adjacent `AGENTS.md`, and real Composer input follows the prefix/body boundary. The gate dispatches real Space/slash key events, selects `+ 命令` through its native `mousedown` contract, verifies the launcher remains `claimed`, verifies manual `/goal /` returns both command and Skill candidates, and submits `/goal clear` through native Enter handling. It uses isolated `HOME`, `USERPROFILE`, `DSH_HOME`, and Electron data with bounded lifecycle timeouts.
- Copy a clean rc.6 input-trigger package into an isolated v0.3.8 checkout and run its patched `scripts/patch-deps.js` twice. Syntax-check the script and patched `lib/client.js`; assert unique cache, prefix gate, complete-leading-roster, launcher-aware claim, and native begin-command markers. Do not patch the running Desktop installation.
- The exact `888b6fe` baseline contains a pre-existing undefined `home` reference in `applySettingsSectionGuard`. Record the original failure, prove the adapter does not touch that function, and use a checkout-only correction when the purpose is to continue isolated Chromium QA. Never include that unrelated fix in the Skill Manager adapter patch implicitly.
