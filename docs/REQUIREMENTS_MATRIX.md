# Requirements Evidence Matrix

Updated: 2026-08-18

This matrix preserves the complete requested product scope. A row is complete only when implementation and requirement-matched evidence both exist. Passing narrower unit tests does not close a broader runtime or delivery requirement.

| Requirement | Current evidence | Status | Remaining proof or work |
| --- | --- | --- | --- |
| Create valid Skill bundles and missing directories | Core creation API, atomic filesystem tests, Host RPC, rendered create interaction, isolated real Desktop creation | Implemented and tested | None for v0.3.8 scope |
| Enable/disable Skills in Harness | Manager-owned DSH links, persisted registry, restart tests, isolated real Desktop controlled-restart persistence | Implemented and tested | None for v0.3.8 scope |
| Dense settings UI with switch, one-line description, full hover text | React settings list, shared folded-file glyph, accessible controls, adaptive CSS, rendered tests | Implemented and tested | User visual feedback after manual restart remains |
| Original/light/dark/system themes | Direct DSH v0.3.8 alias-token mapping plus standalone four-mode Chromium checks and isolated real-shell mounting | Implemented; standalone themes and real-shell mount verified | Full four-theme comparison inside the real shell remains optional |
| Separate local management and online market | Primary `Skill 管理`/`Skill 市场` areas, distinct search labels and empty states, local All/Custom/Sync views | Implemented and isolated real-shell tested | User visual feedback after manual restart remains |
| Market metadata without invented metrics | GitHub repository candidates expose only repository-level Stars/forks and nullable Skill counts; on-demand Inspection separates README from exact `SKILL.md` descriptions | Implemented and tested for Marketplace V2 | User-triggered live search remains after restart |
| Popular market home | GitHub format-Topic repository candidates sorted by Stars, 20-row initial load, explicit load-more, and metadata-only list boundary; final isolated shell returned live candidates | Implemented and tested | Future network/rate-limit conditions remain provider-dependent |
| Market category discovery | Each category starts a new `category + skill` GitHub search across name, description, and Topics; zero results are labeled as a completed remote search | Implemented and tested, including live 20-row category result | Results remain unverified candidates until Inspection |
| Automatic local tags and upstream provenance | Visible-row deterministic tags; Host-only GitHub/Hugging Face discovery; exact resolved description and complete-bundle byte identity before persistence | Implemented and tested against same-text impostors | Bounded discovery may remain unmatched when GitHub is slow or rate-limited |
| GitHub market source | Metadata-only repository discovery, fixed-commit Inspection, exact Skill path validation, intent-only Host installation, rate-limit/deadline tests | Implemented and tested; deliberately not a complete GitHub index | Optional live-network smoke remains non-authoritative and rate-limited |
| skills.sh discovery signal and safe install | Historical V1 adapter remains available internally for provenance/discovery evidence; it does not authorize V2 installation or drive the repository home | Implemented as a supporting signal | Central Indexer integration is deferred |
| Hugging Face discovery signal | Strict official `huggingface/skills` manifest adapter remains a discovery/classification signal; installation authority stays with fixed GitHub snapshots | Implemented as a supporting signal | Central Indexer integration is deferred |
| Skill update, backup, rollback, deletion recovery | Whole-bundle update checks, local conflict refusal, journaled replacement, 30-day recent-deletion list/restore, expiry and conflict tests | Implemented, tested, and locally deployed | User must restart the already-running Desktop to load the new package |
| Automatic maintenance | Three independent default-off persisted preferences, dependency ordering, fresh-check update gate, four-worker provenance matching, 24-hour throttle | Implemented and tested | User may choose which policies to enable after restart |
| Cross-agent discovery/import/synchronization | Codex/Claude Code/Agents/OpenCode filters, trusted Host roots, metadata-only scan, selectable/bulk import, manager-owned per-Skill links, conflict states, isolated real Desktop scan/import/Claude-link interaction | Implemented and tested | User visual feedback after manual restart remains |
| Sync updates propagate to linked targets | Canonical links plus update/rollback restart tests; isolated real Desktop link resolves to the canonical managed bundle | Implemented and tested | None for v0.3.8 scope |
| Avoid Codex/Claude instruction contamination | Direct-child Skill-only scans; no adjacent Agent instruction/body returned through discovery | Implemented and tested | Continue enforcing for every future source/target |
| Leading `/` command/Skill suggestions only in prefix | Pure parser, exact rc.6 dependency patch, clean published-dependency fixture, real-keyboard packaged Composer gate | Implemented and tested | None for v0.3.8 scope |
| Multiple prefix Skills/commands | Real `/goal /` key events reopen the complete command/Skill roster; native launcher remains claimed; body text closes suggestions; `/goal clear` still submits natively | Implemented and tested for v0.3.8 authoring semantics | Host v0.3.8 still executes only the first native command and treats the remainder as its arguments; this is a documented platform boundary, not multi-command transaction support |
| Standalone Harness plugin and thin Desktop adapter share core | One plugin bundle plus exact v0.3.8 source staging adapter | Implemented and isolated-tested | Produce reviewable commits; optional upstream PR needs explicit authorization |
| DSH Desktop v0.3.8 compatibility only | Exact Desktop/Harness/dependency gates; double stage/verify at `888b6fe`; unpacked Electron build; isolated boot, settings/market, controlled restart, and Composer interaction | Implemented and tested for the requested v0.3.8 integration | Keep v0.3.9 deferred |
| Desktop update/install workflow | Adapter documents source staging; it does not modify the user's installed application | Partially addressed | Decide updater/product workflow separately; no silent live installation |
| Timeout diagnosis/fix | Explicitly outside this repository | Separate workstream | Do not mix into this product repository |
| Git history and upstream delivery | Existing local repository and feature branch; current iteration uncommitted | Incomplete | Audit coherent commits; pushing/opening PR requires explicit authorization |

## Current Development Order

1. Run and record the final repository, package, and exact v0.3.8 adapter gates.
2. Prepare coherent local commits for the standalone project and the thin Desktop adapter only after explicit authorization.
3. Prepare an upstream PR patch; push or publish only after explicit authorization.
4. Keep every v0.3.9 implementation and verification task deferred.
