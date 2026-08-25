# Lessons Learned

## A Source Repository And An Installable DSH Bundle Are Different Boundaries

A monorepo may contain a correct `dsh.bundle` child package while its root is not installable through `github:owner/repo`. DSH source installation also invokes `prepare`, which must be self-contained and explicitly allowed by pnpm policy. Publishing a verified child-package tarball avoids misleading one-line commands and avoids executing a remote build on the user's machine. Advertise GitHub source installation only after testing the fetched root from a fixed commit in a clean Profile.

## Client-Owned DOM Resources Need Shared Ownership Across HMR Generations

Idempotently inserting one `<style>` is not enough: without a disposer it survives plugin unload, while naive removal can break another live generation. Store an owner count on the shared DOM node, decrement it from each `apply()` disposer, and remove the node only when the last owner exits. Use `finally` so another cleanup failure cannot leak the stylesheet.

## 2026-08-24 - Desktop Compatibility Is A Runtime Matrix, Not One Version String

- Symptom: DSH Desktop reports v0.5.4 while its bundled application metadata still says v0.5.2, and most public DSH packages are rc.2 while UI primitives remain rc.7.
- Root cause: Desktop, Harness, and individual public client packages are released and bundled independently; assuming every package shares the visible Desktop or Harness version produces nonexistent npm requests and false incompatibility reports.
- Solution: inspect the installed package graph, compile against the exact runtime matrix, and express peer compatibility per public package. Keep UI primitives at rc.7 until an rc.2 artifact actually exists.
- Prevention: use the real Loader dependency graph as the compatibility authority, then run an isolated official Profile install and a real restarted Desktop UI/RPC gate.

## 2026-08-24 - Settings Navigation Groups Are Presentation Policy

- Symptom: the user wanted Skill Manager under “高级”, but public `settings.section` exposes only `id`, `order`, and `label`.
- Solution: keep Skill Manager an ordinary plugin and use the honest label `Skill 管理插件`; the installed grouping companion's bounded `插件` rule places it under “高级”. The panel remains `Skill 管理` and no companion code or rendered DOM is patched.
- Boundary: this placement depends on the optional Desktop grouping companion's current label policy. Without that companion the section remains valid but may appear in the platform's ordinary flat navigation.

## 2026-08-19 - A Rendered DOM Node Is Not A Plugin Contract

- Symptom: the v0.3.8 adapter replaced the settings sidebar gear by scanning buttons by text and observing the entire document for later DOM changes.
- Root cause: `settings.section` did not expose an icon field, so presentation was implemented against another plugin's rendered structure rather than an official slot or service.
- Solution: remove the MutationObserver and DOM replacement for rc.7, retain folded-file icons only inside Skill Manager-owned content, and accept the platform-owned navigation icon until an official field exists.
- Prevention: follow the DSH composition boundary: ordinary Host RPC and Web slots for portable plugins; `desktopProfiles`/`desktopPnpm` only for explicit Desktop package-management adapters; never treat Electron, launcher state, private runtime services, command shims, or rendered implementation details as public APIs.
- Verification: rc.7 typecheck, 212 tests, standalone build/package verification, and an isolated real rc.7 Web boot with zero console errors and no private sidebar marker.

## 2026-08-19 - Keep Provider And Operation Deadlines Explicit

- Symptom: historical repository browse was corrected to 25 seconds, but recent heat still reported `GitHub Trending exceeded 12000 ms`; a first `anthropics/skills` install then ended with `Repository inspection exceeded 30000 ms` even though a usable snapshot cache was produced.
- Root cause: repository discovery, Trending HTML fetch, repository Inspection, snapshot preparation, and repository installation have independent deadline layers. Changing one provider's default does not change the others. The 30-second Inspection boundary could also expire during a legitimate first codeload/parse before the 60-second install boundary was reached.
- Solution: make Trending's default 25 seconds and Inspection's default 45 seconds, preserving abort propagation and the 60-second install boundary. Add fake-timer tests for the exact default boundaries and an isolated real-repository install/recognition gate.
- Prevention: when runtime errors include an exact millisecond value, trace that value to the owning layer before changing another timeout. Validate both first-load and cache-hit behavior, and distinguish downloaded cache state from a persisted managed installation.
- Scope: DSH Skill Manager Marketplace V2 network discovery and fixed-commit Inspection on DSH Desktop v0.3.8.
- Related files: `packages/core/src/marketplace/github-trending.ts`, `packages/core/src/marketplace/github-inspector.ts`, `packages/core/test/github-trending.test.ts`, `packages/core/test/github-repositories-v2.test.ts`.

## 2026-08-19 - Placeholder Domain Values Must Match The Wire Contract

- Symptom: recent heat parsed 13 candidates successfully, but the Typert gateway rejected the entire `browseRepositories` business result.
- Root cause: Trending HTML does not contain a numeric GitHub owner ID, so Core used `ownerId: 0` as an unknown sentinel; the RPC result schema required a strictly positive value.
- Solution: explicitly admit zero for list-stage repository/owner identity while retaining generated media and requiring Inspection before trusted operations.
- Prevention: run real provider results through the public descriptor schema, not only Core fixtures with fully enriched GitHub metadata. Every placeholder needs a documented wire representation.

## 2026-08-19 - Network Deadlines Must Include Proxy Handshake Variance

- Symptom: historical-popular repository discovery intermittently exceeded 12 seconds even though the same valid query later returned 20 results in about 2.2 seconds.
- Root cause: the deadline covered proxy CONNECT, TLS, retries, response headers, and JSON parsing; the 12-second value had little margin for transient Windows proxy latency.
- Solution: align repository discovery with the existing 25-second GitHub marketplace boundary while retaining active abort and a rejecting deadline.
- Prevention: measure both warm and cold/proxied paths, keep finite operation deadlines, and separate external-network observation from protocol/UI integration gates.

## 2026-08-19 - Broad Local Provenance Discovery Competes With Installation Quota

- Symptom: unrelated local Skills such as `animejs` and several `wiki-*` bundles each reached the 30-second verification deadline; shortly afterward repository detail/install calls failed with GitHub anonymous rate limiting.
- Root cause: every local name could expand into several skills.sh/GitHub candidates, fixed-commit repository checks, and fingerprint comparisons. The work was individually bounded but collectively consumed the same 60-request/hour anonymous REST pool needed for user-requested market operations.
- Solution: disable and hide local provenance discovery, force persisted automatic matching off, and make compatibility RPCs fail before network access. Keep updates only for provenance written by source-aware manager/Host installation.
- Prevention: optional background discovery must have a separate durable index or authenticated/global quota budget before it can be re-enabled; per-item deadlines alone do not control aggregate API cost.

## 2026-08-19 - Browse Cards Must Survive Metadata Quota Failure

- Symptom: the recent-heat list shrank to one candidate and later displayed GitHub rate-limit errors.
- Root cause: parsed GitHub Trending entries were enriched through one REST repository request per card; failed enrichment silently removed otherwise usable HTML candidates. Detail followed by install also repeated repository resolution despite a recent verified snapshot.
- Solution: build Trending cards directly from weekly/monthly HTML, defer real repository metadata to Inspection, and reuse the Host-owned fixed-commit resolution plus codeload cache for installation for one hour.
- Prevention: assert request budgets at product boundaries: recent heat is two HTML requests and zero REST requests; Inspection plus a near-term install does not repeat metadata/commit/Tree resolution. Treat a naturally small global Trending subset separately from quota-driven data loss.

## 2026-08-19 - Git Tree Directories Are Not Bundle Payloads

- Symptom: every nested Skill in a real repository displayed `不可安装`, with warnings naming its own directory and every child directory as unsupported `tree` entries.
- Root cause: the boundary validator accepted only regular blobs and interpreted Git's normal `tree/040000` directory records as bundle content.
- Solution: ignore ordinary directory records because they add no bytes; continue rejecting symlinks, submodules, unsafe blob modes, and unknown types inside the selected Skill.
- Prevention: realistic recursive-Tree fixtures must include directories, not only blobs, and must prove unsafe siblings do not contaminate safe Skills.

## 2026-08-19 - Frontmatter Metadata Needs One Canonical Parse

- Symptom: a Skill became structurally installable but final installation failed with `Downloaded SKILL.md metadata does not match the resolved Skill snapshot.`
- Root cause: YAML literal/folded descriptions can parse with a final newline. Inspection trimmed strings, while final Core parsing preserved that newline and compared the two results byte-for-byte.
- Solution: trim parsed frontmatter name and description consistently at the final Core boundary while leaving the original verified `SKILL.md` bytes and hashes unchanged.
- Prevention: include YAML block-scalar metadata in the full Inspector -> resolver -> installer regression suite.

## 2026-08-19 - Batch RPC Failure Isolation Must Match The UI Unit

- Symptom: one slow or failed provenance check changed every Skill in a 20-name batch to `GitHub 来源核验暂时不可用`.
- Root cause: unbounded `Promise.all` rejected the complete RPC on the first failure, while the Client had no per-name error payload.
- Solution: use two Host workers, retain ordered successes, return structured per-name failures, and share that path between automatic maintenance and the manual all-rematch action.
- Prevention: force mixed success/failure and measure peak concurrency in RPC tests; rendered tests must assert that only the failed row becomes unavailable.

## 2026-08-19 - Grid Tracks Must Match The Row's Direct Children

- Symptom: managed Skill text collapsed to a few characters while update/delete/toggle controls appeared on unrelated lines in a narrow DSH settings panel.
- Root cause: `.dsm-row` declared three grid columns but the managed row rendered four direct children: selection, icon, copy, and actions. CSS auto-placement silently created unintended cells instead of reporting an error.
- Solution: define four explicit tracks and named placement behavior; below 520px, span the action region beneath the bounded content rather than relying on auto-placement.
- Prevention: keep deterministic geometry assertions for copy width, action position, and horizontal overflow in both browser preview and the real v0.3.8 shell.

## 2026-08-19 - A Media Failure Must Not Reset A Successful Repository Preview

- Symptom: expanding repository media from one image could make the entire preview disappear when one README image failed to resolve or decode.
- Root cause: single-value media state couples every later response to the currently visible cover.
- Solution: merge a bounded, deduplicated media set; isolate resolution/decode failures per asset; preserve Social Preview; and ignore stale requests after dialog close or repository change.
- Prevention: test mixed success/failure, the eight-item cap, deduplicated requests, thumbnail selection, and stale-response isolation without relaxing the Host media proxy.

## 2026-08-19 - One Symlink Must Not Invalidate Every Skill In A Repository

- Symptom: `mattpocock/skills` downloaded a small valid codeload ZIP, but one root `AGENTS.md` symlink invalidated the whole cache and silently triggered a Raw fallback that then read every discovered `SKILL.md` independently.
- Root cause: ZIP validation classified any repository-level symlink as a repository-wide safety failure even though only a selected Skill's files enter an installation bundle. The follow-up background index also resolved each descriptor again instead of reusing the prepared repository snapshot.
- Solution: skip and never expose repository-level symlinks during cache extraction; reject symlink or submodule content only when it falls inside a selected Skill boundary. Resolve one fixed commit snapshot once for Inspection, risk, media, fingerprint indexing, provenance comparison, and batch installation. Record structured Raw-fallback reasons and enforce hard 30-second analysis and 60-second install deadlines.
- Prevention: retain the root-symlink multi-Skill fixture with a deterministic three-REST, one-codeload, zero-Raw request budget. Test that an unsafe selected Skill fails alone, never lowering the safety boundary for another Skill in the same repository.

## 2026-08-18 - Type checking output is not the final standalone Host bundle

- Symptom: plugin build verification reported that `dist/index.js` referenced the private Core package after TypeScript project checking.
- Root cause: `tsc -b` emits the plugin's intermediate module output into `dist`; only the later esbuild post-build step bundles Core and the proxy transport into the standalone Host artifact.
- Solution: run the final workspace build after type checking/tests, then run plugin build verification and npm dry-run against that rebuilt artifact.
- Prevention: keep deployment gates ordered as typecheck/test, final build, `verify:build`, then package inspection; never deploy the intermediate `tsc` output.

## 2026-08-18 - Source identity needs a separate canonical hash

- Symptom: raw bundle hashes correctly detected local edits but could not identify the same text bundle across LF/CRLF environments, while path-basename and name/description filters rejected valid sources.
- Root cause: one primitive was serving two incompatible contracts: byte-exact modification protection and portable content identity.
- Solution: preserve raw `contentHash`; add versioned whole-bundle `dsm-skill-fingerprint-v1`; key remote identity by numeric repository ID plus exact path; and use names, descriptions, manifests, and local metadata only to discover candidates.
- Prevention: never weaken a modification baseline for discovery. Add an independent identity primitive and require unique fixed-commit revalidation before persisting authority.

## 2026-08-18 - Cache hits and prior checks are not write authorization

- Symptom: an index row could identify historical content and an update check could observe a snapshot, but remote state might change before a later write.
- Root cause: discovery acceleration and UI checks happen before the security-sensitive mutation boundary.
- Solution: re-fetch indexed commits before source matching, refresh the final update commit, and repeat complete integrity and risk validation immediately before atomic replacement. High/unknown risk never auto-updates.
- Prevention: keep cached metadata advisory and put authorization checks at the final mutation boundary.

## 2026-08-18: Repository Inspection Cost Must Not Scale With Skill Count

- **Symptom:** A large multi-Skill repository exhausted GitHub's anonymous REST allowance after metadata, commit, and Tree succeeded because every README/manifest/`SKILL.md` was fetched through a separate blob endpoint.
- **Scope:** Repository detail, risk assessment, media, and installation preparation for public GitHub repositories.
- **Root cause:** Fixed-commit correctness had been implemented at document granularity, so correctness was safe but network cost grew linearly with discovered Skills.
- **Solution:** Keep the small metadata/commit/Tree REST baseline, then download one bounded fixed-commit codeload ZIP, verify every file against the Tree, and share the validated snapshot across Inspector, risk, media, and installer. Fall back to fixed-commit Raw only when ZIP validation or limits fail.
- **Prevention:** Test request counts, concurrent coalescing, caller cancellation isolation, cache TTL/LRU, ZIP-bomb limits, disk metadata tampering, Raw SHA mismatch, and final pre-write risk assessment. Do not describe this as zero REST usage.
- **Related files:** `packages/core/src/marketplace/github-snapshot-cache.ts`, `packages/core/src/marketplace/github-inspector.ts`, `packages/core/src/marketplace/github-snapshot.ts`, `packages/core/test/github-repositories-v2.test.ts`.

## 2026-08-18: Persisted Metadata Must Accept Every Historically Valid Discriminant

- **Symptom:** Startup showed `Deleted Skill archive metadata is invalid.` for a complete recoverable `aframe-webxr` archive.
- **Root cause:** The registry correctly persisted `origin: local-import` with a `source.kind: local-import`, but the trash validator accepted that source only when the origin was `self`.
- **Solution:** Accept both historically valid origins for a fully validated local-import source while preserving the name, target, timestamp, path, and bundle-hash checks.
- **Prevention:** Round-trip every persisted origin through restart, delete, list, and restore tests; compatibility validators must follow historical storage contracts rather than only current creation defaults.
- **Related files:** `packages/core/src/skill-manager.ts`, `packages/core/test/set-target-enabled.test.ts`.

## 2026-08-18: A Loading Dialog Must Commit Before Network Work Starts

- **Symptom:** Repository actions visibly reacted, yet the detail/install card sometimes appeared not to open while Inspection was slow or failed.
- **Root cause:** React state updates and the asynchronous Inspection call began in the same event turn, leaving the Host shell free to delay painting the dialog even though its eventual portal structure was correct.
- **Solution:** Commit the dialog repository/loading state synchronously before starting Inspection, make the large repository content area keyboard-accessible, and keep failure/retry inside the mounted dialog.
- **Prevention:** Test with a deliberately unresolved Inspection promise and assert the portal, loading status, and accessible trigger before resolving it.
- **Related files:** `packages/plugin/src/client.tsx`, `packages/plugin/test/client.test.tsx`.

## 2026-08-18: A Fixed Modal Can Still Be Trapped By Its Host Settings Container

- **Symptom:** Clicking a repository install action visibly darkened the DSH settings page, but the central review card did not appear usable.
- **Root cause:** The modal was rendered inline beneath the settings component. Host ancestors can establish clipping and stacking contexts, so increasing the child's fixed-position z-index alone does not guarantee that the card escapes containment.
- **Solution:** Portal the complete backdrop and card to `document.body`, duplicate DSH semantic theme variables on the portal root, show the card before async Inspection settles, and keep loading/failure/retry inside the same review surface.
- **Prevention:** Real-shell UI gates must click the actual action, wait for React to commit, then assert portal ancestry, visible loading state, card bounds, and overflow. A backdrop alone is not evidence that a modal is visible.
- **Related files:** `packages/plugin/src/client.tsx`, `packages/plugin/test/client.test.tsx`, `scripts/verify-desktop-v038-ui.mjs`, `design-qa.md`.

## 2026-08-18: Bound Concurrency Is Not Enough When Every Proxy Request Reconnects

- **Symptom:** After replacing unbounded GitHub blob downloads with three-worker Inspection, `anthropics/skills` stopped failing with `ECONNRESET` but could still reach the fixed 20-second deadline.
- **Scope:** Multi-Skill repository Inspection through the Windows/explicit proxy Host transport.
- **Root cause:** `createHostMarketplaceFetch` selected the right proxy but instantiated a new `HttpsProxyAgent` for every request. A 25-request Inspection repeated CONNECT and TLS setup even though all requests shared one Host service.
- **Solution:** Create one keep-alive proxy Agent per Host marketplace-fetch instance, retain three-worker document reads, and retry only known transient transport resets within the original deadline. The live Host path then completed `anthropics/skills` in 7,305 ms.
- **Prevention:** Test transport-factory reuse separately from Inspector concurrency, trace real request count/timing before raising deadlines, and keep live probes as environment evidence alongside deterministic tests.
- **Related files:** `packages/plugin/src/marketplace-fetch.ts`, `packages/plugin/test/marketplace-fetch.test.ts`, `packages/core/src/marketplace/github-inspector.ts`, `packages/core/test/github-repositories-v2.test.ts`.

## 2026-08-18: GitHub Search Does Not Accept Qualifier-Only OR Groups

- **Symptom:** Marketplace V2 repository browsing failed with GitHub HTTP 422 before returning any candidate rows.
- **Scope:** GitHub repository-search queries that combine multiple format Topics.
- **Root cause:** The query joined multiple `topic:` qualifiers with `OR`; GitHub repository search rejects that qualifier-only logical form.
- **Solution:** Search topic terms as ordinary terms constrained by `in:topics`, then normalize and classify returned Topics locally. An official endpoint probe and deterministic provider tests both return valid candidates.
- **Prevention:** Keep a provider test for the exact browse query and probe query-shape changes against the official endpoint before attributing 4xx failures to authentication or proxy state.
- **Related files:** `packages/core/src/marketplace/github-repositories.ts`, `packages/core/test/github-repositories-v2.test.ts`.

## 2026-08-18: Provenance Discovery Must Be Explicit and Its Outcome Durable

- **Symptom:** Opening the local library started one remote provenance request per visible Skill, while non-match results disappeared after reopening and made users repeat the same work.
- **Scope:** Local-to-remote Skill source matching and update authority.
- **Root cause:** The client owned session-only scheduling and Core persisted only successful trusted provenance.
- **Solution:** Persist safe last-check metadata for exact match, no-match, ambiguity, and ineligibility; expose source matching as a default-off, throttled automatic-maintenance preference, while granting update authority only to an exact immutable full-bundle match.
- **Prevention:** Keep network work behind explicit opt-in, separate diagnostic check state from trusted provenance state, throttle automatic work, and test reload visibility for both positive and negative outcomes.
- **Related files:** `packages/core/src/skill-manager.ts`, `packages/core/src/types.ts`, `packages/plugin/src/client.tsx`, `packages/core/test/verify-marketplace-provenance.test.ts`.

## 2026-08-18: Category Discovery Must Not Require Every Vocabulary Token

- **Symptom:** Category buttons correctly started a new GitHub request but commonly returned zero repositories, making the controls still appear ineffective.
- **Scope:** Marketplace V2 category discovery queries.
- **Root cause:** Queries such as `agent skills security` required all ordinary terms to match only repository names/descriptions, which excluded relevant repositories whose category evidence was in Topics or whose metadata omitted `agent`.
- **Solution:** Query `category + skill` across repository names, descriptions, and Topics, keep results as unverified candidates, and distinguish a completed zero-result GitHub search from local filtering.
- **Prevention:** Probe query-shape changes against the official endpoint, assert the exact encoded query in provider tests, and retain fixed-commit Inspection before installation.
- **Related files:** `packages/core/src/marketplace/github-repositories.ts`, `packages/core/test/github-repositories-v2.test.ts`, `packages/plugin/src/client.tsx`, `packages/plugin/test/client.test.tsx`.

## 2026-08-18: Verify the Running Bundle Before Debugging a Reported UI Regression

- **Symptom:** The live Desktop showed an oversized sidebar icon and the old skills.sh “热门 Skill” page even though Marketplace V2 and a 16×18 SVG existed in the repository.
- **Scope:** Portable Desktop assets, active DSH profile plugins, and any dual Host/Client plugin deployed as copied build artifacts.
- **Root cause:** Both live plugin directories contained the same stale V1 Client/Host bundle; source completion and isolated staging had been mistaken for deployment to the user's running instance. V2 also still lacked category controls and visible non-success provenance outcomes, which were separate source-level gaps.
- **Solution:** Compare repository and installed hashes plus stable V2 markers before changing code, then test source gaps independently. Keep Host and Client as one coordinated deployment, harden the SVG against host CSS, and expose every safe provenance result rather than only successful matches.
- **Prevention:** Maintain a red-capable installed-bundle hash/marker check, record deployed versus repository state separately, and require an isolated real-shell gate to assert computed icon dimensions and key market controls before requesting live synchronization.
- **Related files:** `packages/plugin/src/client.tsx`, `packages/plugin/test/client.test.tsx`, `scripts/verify-desktop-v038-ui.mjs`, `docs/TASK_STATUS.md`.

## 2026-08-18: One Installation Intent Must Produce One Fixed-Commit Snapshot

- **Symptom:** Marketplace V2 first performed an Inspection, then delegated to the legacy resolver, which could observe a different default-branch commit.
- **Scope:** Host-owned repository inspection and installation snapshot construction.
- **Root cause:** Reusing a safe V1 resolver also preserved its independent default-branch resolution step.
- **Solution:** Convert the fresh Host Inspection directly into the resolved installation snapshot; Core downloads and verifies only that fixed commit. Manifest-declared root files travel inside the Host-owned snapshot.
- **Prevention:** Tests require one default-branch commit request and assert the root manifest files and selected `SKILL.md` share the inspection commit.
- **Related files:** `packages/core/src/marketplace/github-snapshot.ts`, `packages/core/src/marketplace/github-inspector.ts`, `packages/core/test/github-repositories-v2.test.ts`.

## 2026-08-18: Do Not Make Local UI Integration Depend on Live GitHub Results

- **Symptom:** The isolated Desktop shell mounted Marketplace V2 correctly but its gate waited for repository rows and failed when GitHub discovery reached the 12-second deadline.
- **Scope:** Real-shell acceptance under proxy, rate-limit, and regional network variability.
- **Root cause:** The gate conflated provider availability with Host/Client capability and UI registration.
- **Solution:** Require capability negotiation, V2 controls, bounded error recovery, and local workflows; record live provider success/failure separately.
- **Prevention:** Keep provider parsing in deterministic injected-transport tests and treat live calls as environment evidence.
- **Related files:** `scripts/verify-desktop-v038-ui.mjs`, `packages/core/src/marketplace/github-repositories.ts`.

## 2026-08-17: Leaderboards May Repeat a Valid Stable Identity

- **Symptom:** The skills.sh all-time endpoint returned HTTP 200, but the popular market home stayed empty with `INVALID_MARKETPLACE_RESPONSE`.
- **Scope:** Popular-market browsing; keyword search already tolerated duplicates.
- **Root cause:** The upstream 200-row leaderboard repeated valid repository/Skill identities and began mixing non-GitHub catalog sources such as `open.feishu.cn`, while the adapter treated any count reduction after GitHub-installable normalization as a malformed page.
- **Solution:** Continue strict field/path validation, retain only the first repeated stable identity, skip structurally valid sources that the GitHub-only installer cannot safely resolve, and reject genuinely malformed entries.
- **Prevention:** Test duplicates and malformed leaderboard rows separately, and probe live provider shape changes through the same Host transport before attributing a UI timeout.
- **Related files:** `packages/core/src/marketplace/skills-sh-source.ts`, `packages/core/test/skills-sh-source.test.ts`.

## 2026-08-17: Use One Bundle Hash Algorithm for Every Ingestion Path

- **Symptom:** A newly created self-authored Skill was immediately treated as locally modified by provenance and update integrity checks.
- **Scope:** Skills created through `createSkill`; imported and marketplace-installed Skills were unaffected.
- **Root cause:** Creation stored a SHA-256 of only the `SKILL.md` bytes, while every later integrity check hashes normalized relative paths plus all bundle bytes.
- **Solution:** Write the temporary bundle first and compute its registry `contentHash` with the shared whole-bundle hash routine before the atomic rename.
- **Prevention:** Every creation/import/install/replacement path must use `hashSkillBundle`; tests for provenance now begin with a normally created Skill and require exact identity to pass.
- **Related files:** `packages/core/src/skill-manager.ts`, `packages/core/test/verify-marketplace-provenance.test.ts`.

## 2026-08-17: Electron Proxy Success Does Not Imply Node Host Proxy Success

- **Symptom:** The DSH UI was online, but GitHub failed before TLS with `ECONNRESET` and skills.sh timed out; GitHub and Hugging Face appeared unavailable together.
- **Scope:** Marketplace operations executed by the DSH Node Host on Windows.
- **Root cause:** Chromium honored Windows Internet Settings, while Node's default `fetch` bypassed the enabled per-user proxy. The first externalized transport also resolved only because Desktop happened to provide a parent dependency, which would break a standalone Harness profile.
- **Solution:** Select explicit proxy environment variables first, fall back to the enabled static Windows user proxy, restrict the transport to HTTPS GET, bundle the proxy agent into the Host artifact, and send GitHub's required User-Agent.
- **Prevention:** Test direct and proxy-aware requests separately, verify the built Host has no external proxy-agent import, and load the staged profile artifact independently of the Desktop application root.
- **Related files:** `packages/plugin/src/marketplace-fetch.ts`, `packages/plugin/scripts/build.mjs`, `packages/plugin/scripts/verify-build.mjs`, `packages/plugin/test/marketplace-fetch.test.ts`.

## 2026-08-17: An Active DSH Host Plugin Can Still Have No Browser UI

- **Symptom:** DSH Desktop v0.3.8 copied and activated `dsh-skill-manager`, but Settings had no `Skill 管理` entry and `/plugins/dsh-skill-manager/client.js` returned 404.
- **Scope:** Dual-face DSH plugins that declare `dsh.client` and rely on the v0.3.8 client-module registry.
- **Root cause:** The package exported Host/client entry points but not `./package.json`. The Host Loader imported the main entry, while `dsh-client-modules` used `require.resolve("<package>/package.json")`, treated the blocked manifest as unresolved metadata, and omitted the client bundle.
- **Solution:** Export `"./package.json": "./package.json"` and verify this seam in both bundle and Desktop adapter checks.
- **Prevention:** Treat Host activation and browser registration as separate gates. A real-shell test must assert the client bundle, settings entry, and key UI controls.
- **Related files:** `packages/plugin/package.json`, `packages/plugin/scripts/verify-build.mjs`, `scripts/dsh-desktop-v038.mjs`, `scripts/verify-desktop-v038-ui.mjs`.

## 2026-08-17: Verify Upstream Boot Failures Against the Adapter Diff

- **Symptom:** An exact v0.3.8 Electron checkout synchronized the Skill Manager bundle, then failed before Web UI readiness with `ReferenceError: home is not defined` in `applySettingsSectionGuard`.
- **Scope:** DSH Desktop v0.3.8 commit `888b6fecf872478c7207e64cf1c109a949b1acf5` isolated packaging and Chromium QA.
- **Root cause:** The upstream baseline function referenced a local variable that it never declared. The Skill Manager adapter diff changed only companion registration and recursive `dist` copying.
- **Solution:** Preserve the original failure as evidence, verify it with baseline source and adapter diff, then apply a temporary checkout-only expression using the existing isolated `dshHome` resolution to continue `boot-healthy` QA.
- **Prevention:** Attribute integration failures with baseline source, `git diff`, and logs before changing product code; never smuggle an unrelated upstream repair into a focused adapter PR.
- **Related files:** `scripts/dsh-desktop-v038.mjs`, `docs/TESTING.md`.

## 2026-08-17: Prefix Authoring and Command Execution Are Different Protocols

- **Symptom:** A proposed `/skill-one/skill-two` chain lost Skill injection, while a direct-value Composer test incorrectly suggested `/goal /` could continue even though a real Space key moved rc.6 into `claimed` and suppressed the next slash.
- **Scope:** DSH Desktop v0.3.8 and Harness `0.1.0-rc.6` slash/Skill integration.
- **Root cause:** The Host injects Skills from whitespace-bounded `/name` gestures, but native commands use a separate claim/execute protocol whose first command owns the remaining text as arguments. Setting a textarea value bypassed the Space claim path. The `+ 命令` menu also selects through `mousedown`, not `click`.
- **Solution:** Use `/command /skill /command body` as the authoring grammar, defer claims only for manually typed command tokens during prefix editing, preserve native launcher claims and Enter adjudication, and keep the Host's first-command execution boundary explicit.
- **Prevention:** Drive Composer gates with real `keydown` and `mousedown` events, assert phase as well as text/menu visibility, and never infer multi-command execution from candidate authoring behavior.
- **Related files:** `packages/core/src/slash-prefix.ts`, `scripts/dsh-desktop-v038.mjs`.

## 2026-08-17: A Matching Link Target Does Not Prove Ownership

- **Symptom:** A third-party link that happened to point at the canonical managed bundle could be classified as manager-owned and removed during disable.
- **Scope:** Per-Skill junction/symlink synchronization into user-owned Agent roots.
- **Root cause:** Filesystem target equality proves destination identity but does not record which tool created the link.
- **Solution:** Require both persisted `enabledTargets` ownership and an exact canonical target before classifying or removing a link; reject top-level external links during discovery/import.
- **Prevention:** Test same-target third-party links, links to other targets, missing registered links, and restart-visible manager links separately.
- **Related files:** `packages/core/src/skill-manager.ts`, `packages/core/test/set-target-enabled.test.ts`, `packages/core/test/import-external-skill.test.ts`.

## 2026-08-17: Exception Rollback Does Not Cover Process Termination

- **Symptom:** A directory swap could be restored in a `catch` block after ordinary I/O failure but remain half-finished if the Desktop process terminated between renames or registry commit.
- **Scope:** Multi-path filesystem mutations whose state must remain recoverable across process restart.
- **Root cause:** Language-level exception handling cannot run after a crash or forced process exit.
- **Solution:** Persist an atomic transaction journal before mutation and recover only when the journal's old/new hashes, canonical directory, displaced directory, and registry agree on a known pre-commit or post-commit state.
- **Prevention:** Test restart recovery from both sides of the commit boundary; reject unknown or locally modified states rather than guessing which directory to delete.
- **Related files:** `packages/core/src/skill-manager.ts`, `packages/core/test/update-skill.test.ts`.

## 2026-08-17: A Commit or Main Document Is Not a Bundle Update Signal

- **Symptom:** Comparing only a repository commit or `SKILL.md` blob would miss or over-report changes when references, scripts, examples, or unrelated repository files changed.
- **Scope:** GitHub-backed Skills whose behavior can depend on any regular file inside the selected Skill directory.
- **Root cause:** Repository commits are too broad, while one document blob is too narrow to represent the installed bundle.
- **Solution:** Store and compare a deterministic fingerprint of every bounded regular file's relative path, mode, Git blob SHA, and size, separately from the local byte hash used for modification detection.
- **Prevention:** Update tests must change a non-`SKILL.md` file and prove that unrelated repository paths do not affect the result.
- **Related files:** `packages/core/src/marketplace/github-bundle.ts`, `packages/core/test/check-updates.test.ts`.

## 2026-08-17: Aborting a Signal Does Not Enforce a Deadline

- **Symptom:** A resolver configured with a timeout could still wait forever when an injected `fetch` ignored `AbortSignal`.
- **Scope:** Network operations whose transport or response-body implementation may not cooperate with cancellation.
- **Root cause:** Calling `AbortController.abort()` requests cancellation but does not settle the awaited transport promise.
- **Solution:** Race the complete resolution against an explicit rejecting deadline/cancellation boundary while also propagating abort for resource cleanup.
- **Prevention:** Deadline tests must include a dependency that never resolves and ignores abort; an abort-aware mock proves only signal propagation, not bounded completion.
- **Related files:** `packages/core/src/marketplace/github-resolver.ts`, `packages/core/test/github-marketplace-resolver.test.ts`.

## 2026-08-16: Validate Built Decorator Syntax with the Runtime

- **Symptom:** TypeScript checking and source-level tests passed, but importing the bundled Host entry in Node failed on the literal `@Remote` token.
- **Scope:** DSH Host packages built from TypeScript standard decorators through esbuild.
- **Root cause:** esbuild's default target preserved decorator syntax instead of lowering it for the Node runtime.
- **Solution:** Set the plugin bundle target to `es2022` and import the emitted entry during validation.
- **Prevention:** Keep a built-artifact import smoke test in the release gates; source tests and declarations alone are insufficient for decorator-based plugins.
- **Related files:** `packages/plugin/package.json`, `packages/plugin/src/index.ts`.

## 2026-08-16: Do Not Ship Host Schemas in the Client Bundle

- **Symptom:** The first browser bundle was about 563 KB despite a small settings component.
- **Scope:** DSH Typert plugins with strict Host schemas and browser Remote mounting.
- **Root cause:** The client imported the Zod-backed Host descriptor module, pulling the full validation library into the browser.
- **Solution:** Keep the authoritative schemas in `typert.host.ts` and mount matching strict identity codecs from `client-descriptors.ts`.
- **Prevention:** Verify the emitted client bundle size and execute the DSH factory during build validation.
- **Related files:** `packages/plugin/src/client-descriptors.ts`, `packages/plugin/scripts/verify-build.mjs`.

## 2026-08-16: Include the Root Panel in Box-Sizing Rules

- **Symptom:** At 390px, toolbar buttons and switches were clipped on the right despite child elements using `border-box`.
- **Scope:** The React Skill settings panel on narrow viewports.
- **Root cause:** `width: 100%` and horizontal padding applied to `.dsm-panel`, while the box-sizing rule covered only descendants.
- **Solution:** Set `box-sizing: border-box` directly on the root panel.
- **Prevention:** Compare `document.documentElement.scrollWidth` with `innerWidth` during mobile Playwright QA.
- **Related files:** `packages/plugin/src/client.tsx`.

## 2026-08-16: A Documented API May Still Be Unsuitable for Desktop Clients

- **Symptom:** The documented skills.sh V1 API appeared to be the stable marketplace contract, but unauthenticated requests returned `401`.
- **Scope:** Backendless Desktop and Harness integrations that need marketplace discovery.
- **Root cause:** V1 requires a short-lived Vercel project OIDC token rather than a normal public API key. A desktop package cannot mint or embed that credential safely.
- **Solution:** Isolate the anonymous legacy endpoint used by the official CLI behind a replaceable adapter, with strict response validation and an unavailable state.
- **Prevention:** Verify authentication and rate-limit requirements from first-party documentation and live responses before selecting an external API for a client application.
- **Related files:** `packages/core/src/marketplace/skills-sh-source.ts`, `docs/research/market-sources.md`.

## Marketplace V2 Trend And Classification Notes

### 2026-08-18: Trending HTML Must Remain Experimental

- **Symptom:** GitHub offers weekly/monthly Trending pages but no stable Skill-specific REST endpoint.
- **Root cause:** Trending is a full-site HTML view, subject to markup changes, rate limits, and incomplete Skill coverage.
- **Solution:** Request only Host-side GitHub Trending HTML, enforce a 2 MB body/timeout limit, filter strong Skill signals, enrich candidates with repository metadata, and keep live/cache/unavailable/empty states distinct.
- **Prevention:** Never call README, Tree, or `SKILL.md` during list browsing; require fixed-commit Inspection before install, and never substitute `updated_at` when Trending is unavailable.

### 2026-08-18: Classification Is Discovery Metadata, Not Trust

- **Symptom:** A repository can mention a category without containing an installable Skill.
- **Root cause:** Topics, README text, and manifest hints are discovery evidence only; only a validated `SKILL.md` establishes a Skill descriptor.
- **Solution:** Use deterministic priority `SKILL.md` -> `skills.json` -> Topics -> name/description -> bounded README, compress into 12 categories, cap tags at three, and show evidence/confidence separately from integrity and risk.
- **Prevention:** Keep candidate classification out of installation authorization and re-run full Host validation at install time.
