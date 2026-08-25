# Environment

## Public v0.1.0 Release - 2026-08-26

- Build runtime: Node `24.11.1`, npm `11.6.2`; active global Harness `@deepseek-ai/dsh@0.1.1-rc.2`.
- Release artifact: `output/release/dsh-skill-manager-0.1.0.tgz`, 16 files and 128,682 bytes. GitHub Release and a fresh downloaded copy both have SHA-256 `46118AE5425BC68CA3020B0FF80DD770A497AC6C30A9843FC5C0D0EBCF98A38B`.
- Public source: `https://github.com/S-AN-Shu/dsh-skill-manager`, clean public commit `5d1e3ea2319e57c3d7d64b4c7e174f00bb54d416`; release `https://github.com/S-AN-Shu/dsh-skill-manager/releases/tag/v0.1.0`; successful Linux CI run `https://github.com/S-AN-Shu/dsh-skill-manager/actions/runs/32871114313`.
- Isolated package/Profile gate ran under a task-owned `%TEMP%/dsh-skill-manager-release-*` directory. It did not read or mutate the active `web` Profile, Skill library, sessions, credentials, settings, or Desktop installation.
- The accidental help-only Profile name `release-smoke` was initialized under the default DSH home before isolation. It contains no installed plugin or user data; automated recursive cleanup was denied by the execution policy, so final handoff must disclose this harmless empty test Profile for optional manual removal.

## DSH Desktop v0.5.4 / Harness rc.2 - Installed And UI-Verified - 2026-08-24

- Desktop executable: `%USERPROFILE%\AppData\Local\DSH Desktop\dsh-tauri-app.exe`, version `0.5.4`.
- Active Harness: global and Desktop runtime `@deepseek-ai/dsh@0.1.1-rc.2`; the current Desktop package matrix keeps `@deepseek-ai/dsh-client-ui-primitives@0.1.0-rc.7` while the other plugin-facing DSH packages are rc.2.
- Stable package: `%USERPROFILE%\.dsh\local-packages\dsh-skill-manager\dsh-skill-manager-0.0.0-rc2-adapter.tgz`, 128,519 bytes, SHA-256 `6E577966E304D8F738BFC9CB0C064AFD3A26649B982F92A20060CD6F11A31F60`.
- Recoverable pre-install Profile backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260824-052127-desktop-v054-rc2-before-install\profile-web`, verified as 3,351 files and 67,937,463 bytes. Restore it only while DSH Desktop and its Web Host are fully stopped.
- Official installation completed through `dsh plugin --profile web add <tgz>`. Registry metadata requests for `yaml` and `zod` timed out, but pnpm reused the verified local content-addressable store and completed successfully; the Profile dependency and `dsh.profile.bundles` entry both contain `dsh-skill-manager`.
- Real restarted Desktop Host served on `127.0.0.1:53214` during verification. The expanded “高级” group contained `Skill 管理插件`, its panel loaded 117 Skills, and Playwright reported zero console errors. Evidence: `output/playwright/dsh-desktop-v054-rc2-skill-manager-advanced.png`.

## Ordinary Harness rc.7 Adapter - Isolated Verified, Real Install Pending - 2026-08-19

- The source workspace now resolves its plugin-facing DeepSeek packages at rc.7 and no longer mutates the platform-owned settings sidebar DOM.
- Full validation passed 212 tests with 8 historical skips, typecheck, workspace build, standalone bundle verification, and the 16-file package gate. Artifact: `%USERPROFILE%\Documents\dsh-skill-manager-artifacts\rc7-20260819\dsh-skill-manager-0.0.0.tgz`, SHA-256 `CD38F509557DA73949A82906B1C3D627C119391ACDF8A1E88B50CCE225100844`.
- Isolated Profile: `%USERPROFILE%\AppData\Local\Temp\dsh-skill-manager-rc7-smoke-20260819-1722`. Official `dsh plugin --profile web add` installation, rc.7 boot, Client resource, settings UI, list/trash/capability/market RPC, live 12-candidate market, console, and layout checks passed.
- Real Profile installation is pending because PID `10368` is currently serving `dsh web --host 127.0.0.1 --port 3000`. No backup or mutation of `%USERPROFILE%\.dsh\profiles\web` occurred after the process check failed. Stop that Host before the rollback-backed install.

## Local Desktop v0.3.8 Retired; Harness rc.7 Installed - 2026-08-19

- The portable Desktop v0.3.8 program, Electron user-data directory, old `web` Profile, and desktop shortcut were moved out of their active locations after a zero-process check.
- Recoverable backup: `%USERPROFILE%\Documents\dsh-desktop-backups\20260819-164633-v038-clean-uninstall`. It contains `portable-v038` (549,086,323 bytes), `electron-userdata-v038` (18,087,475 bytes), `profile-web-v038` (10,168,877 bytes), and `DSH Desktop-v038.lnk`.
- The active v0.3.8 paths no longer exist: `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable`, `%USERPROFILE%\AppData\Roaming\DSH Desktop`, `%USERPROFILE%\.dsh\profiles\web`, and `%USERPROFILE%\Desktop\DSH Desktop.lnk`.
- User data was preserved in place: `.dsh\sessions`, `.dsh\skills`, `.dsh\skill-manager`, `.dsh\storages`, `.dsh\.credentials.yaml`, and `.dsh\settings.yaml` all remained present.
- `@deepseek-ai/dsh@0.1.0-rc.7` was installed globally under `C:\Program Files\nodejs\node_global`; both `dsh --version` and `npm list -g` reported `0.1.0-rc.7`.
- No DSH, DeepSeek, or Electron process was running after verification. A future Desktop installation must create a fresh `web` Profile; the backed-up rc.6 Profile should not be restored wholesale into an rc.7 Desktop.

## Market Timeout Parity - Historical v0.3.8 Build

- Source now gives GitHub Trending a 25-second abort-aware default and fixed-commit repository Inspection a 45-second abort-aware default. Repository installation remains bounded at 60 seconds.
- Full validation passed 212 tests with 8 historical skips, typecheck, workspace build, 178,084-byte Client verification, exact 16-file npm dry-run, and two idempotent exact-v0.3.8 stages plus adapter verification.
- A live source-build Trending probe returned 12 candidates in 7,066 ms. An isolated `anthropics/skills` test returned 20/20 installable descriptors, installed `skills/academy-guide` with complete fixed-commit GitHub provenance, recognized the repeat request as `already-installed`, and created a real DSH enablement symlink when explicitly enabled.
- The user's live registry was not changed: it remains at 117 entries with zero `anthropics/skills` sources. The prior UI attempt created only a repository cache and did not install a Skill.
- Historical state: this specific revision was not synchronized while five portable processes were running. The local v0.3.8 Desktop and its rc.6 `web` Profile were later retired into the recoverable backup recorded above.

## Market Runtime Repair - Synchronized 2026-08-19

- The built v0.3.8 package accepts HTML-only Trending candidates through the Typert boundary and uses a 25-second repository discovery deadline.
- Full validation passed 210 tests with 8 historical skips, typecheck, workspace build, 178,084-byte Client verification, 16-file npm dry-run, exact adapter stage/verify, and the isolated real-shell gate.
- Live built-artifact probes returned 13 recent-heat candidates in 4,094 ms and 20 historical-popular candidates in 2,182 ms; both responses passed the descriptor schema.
- After the user fully exited DSH Desktop and the zero-process lock check passed, deployment `d56b95eaa4344e17a684dcdd0aceaf88` atomically synchronized all 16 package files to `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager` and `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable\resources\app\assets\plugins\dsh-skill-manager`.
- Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-131245-market-runtime-contract`. Its `profile`, `portable`, and atomic predecessor trees preserve the replaced revision.
- Source, profile, and portable files share manifest SHA-256 `AEAA6E418E17054C14321EC5AF6704D9985B966BBD2FE9630C3B6FC95EBF2CA6`. `dist\client.js` is `7BBEEF6D41A51868C45460DBA6A923282089B91BD3DAE3A1D867F19A91129E9A`; `dist\index.js` is `EB464893847FBE9A44D144E044F22CC8B92215FE777F955083EF7B84C99EC979`.
- Both targets passed six-file `node --check`. The installed profile package imported under Node 24 with 24 Host methods, 24 RPC descriptors, and Protocol 5 capabilities. Real installed-package probes returned 12 recent-heat candidates in 2,446 ms and 20 historical-popular candidates in 2,391 ms, with both responses accepted by the installed Typert descriptor.

## Quota-Safe Market Revision - Synchronized 2026-08-19

- Protocol remains `5`, but `provenanceV2`, `batchProvenance`, and `skillsShDiscoveryHints` report `false`. Local provenance compatibility RPCs perform no network work.
- Recent heat uses only two Host-side GitHub Trending HTML requests. A live built-Core probe on 2026-08-19 returned 13 candidates and recorded zero `api.github.com` requests.
- Repository resolution/codeload caches retain a one-hour TTL; install can reuse a recent Host-owned Inspection resolution, while update flows remain fresh.
- Workspace build, 176,635-byte Client bundle verification, 16-file npm dry-run, exact v0.3.8 adapter stage/verify, and isolated real-shell UI gate passed. The real-shell gate confirms the local provenance controls are absent and trusted update maintenance remains present.
- After a zero-process lock check, deployment `8af88d4b90fb47af9771c7b6708bb75e` atomically synchronized the complete 16-file package to the live `web` profile and portable v0.3.8 directory. Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-031020-quota-safe-market`.
- Source, profile, and portable package manifests share SHA-256 `8EC60B2EE6B361CA7E15C3618EC045818BB078AE30745F99A00ED450312E5990`. `dist\client.js` is `0AB60F5C76F9F9A7B554DFF9AD1F975FE191B8E32BB6CE541EBB5549F82462E9`; `dist\index.js` is `5ED0D2DD969554705B29B0AE1107EB41F413BC5BDBA58D9ADC7BC360A70E6E44`.
- Both targets passed six-file `node --check`, Node 24 Host import, 24 service methods, 24 RPC descriptors, protocol 5 capabilities, and installed-bundle provenance probes returning `PROVENANCE_MATCHING_DISABLED` with zero dependency/discovery calls.

## Protocol 5 Repository Batch Runtime

- The rematch/installability repair passed full source, package, exact-adapter, isolated-shell, and real fixed-commit GitHub installation gates on 2026-08-19. Source bundle hashes are `dist\client.js` `8EF1B44810D2B31590EFF84092B976C321082B075C457BF56452709FB1C35AD4`, `dist\index.js` `A5FA8CEF267F8410918AA5AFA468E52559129FE7DE876C8A8234202B42BC3388`, `dist\rpc.js` `B1675756A7282DFD586DFCA7A073F4493EE0E167104E34629BE99649D5B901DF`, and `dist\typert.host.js` `05606BA2A0287680B2596412ACBDFACEFA55FF221DACD237D70625FA9A950870`.
- Deployment `cdd635cb3523472abdc6e0cd3a0578d7` completed after the user fully exited DSH Desktop and the lock check reported zero DSH/Electron processes. The complete 16-file package was atomically synchronized to `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager` and `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable\resources\app\assets\plugins\dsh-skill-manager`.
- Source, profile, and portable hashes match for all 16 package files. The manifest SHA-256 is `06806444604EEFD853C1B8F67B804B2470F2903713BF37092C53E5B9F6B85C6A`. Both installed targets passed `node --check` for all six JavaScript artifacts and imported under Node 24 with `DshSkillManagerService`, 24 service methods, and 24 RPC descriptors. No DSH/Electron process was started during post-deployment verification, so the next normal v0.3.8 launch loads this revision.
- Rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-015809-rematch-installability`, containing the prior 16-file `profile` and `portable` copies plus their atomic predecessor directories. Restore the matching plugin directory only while DSH Desktop is fully stopped.

- The dense-layout and multi-image detail revision was synchronized on 2026-08-19 after the full test/build/package/adapter/browser/real-shell gates. No DSH/Electron process was running during replacement. The complete rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-010858-dense-layout-gallery`.
- The repository package, `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager`, and `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable\resources\app\assets\plugins\dsh-skill-manager` share 16 files and manifest SHA-256 `DE4A362DE3922D215DBE9284A38624377DAF70C3CDB3F14400B56CBB20F3A40D`. Key hashes are `dist\client.js` `66467B1283F327C77C405BF13254DFC4A407E825A222766E6C671D7EA2DCC101`, `dist\index.js` `33D40A96EB4D278C0548957223601FD96C9404183B5B39AADD268EB19D654514`, and `dist\typert.host.js` `D8E297E81FC2B8CBF74ADD3E73EEA9D4BE579E33EC4CD60BEE033FBA3AD88617`.
- Both installed packages passed `node --check` for all six JavaScript artifacts and Host ESM import with 24 `DshSkillManagerService` methods. The next normal v0.3.8 Desktop launch loads this revision.

- Capability protocol is `5`; the disposable verified-observation index is `%DSH_HOME%\skill-manager\cache\github-skill-index\v1.json`.
- Registry schema remains `1`. Existing GitHub entries load unchanged and gain optional repository ID, node ID, match method/time, and identity fingerprint after a successful validation, installation, match, or update.
- Local automatic matching is disabled and hidden. Automatic update checks and updates remain opt-in and default off; automatic update never sends high-risk acknowledgement.
- Repository snapshot preparation is capped by a 30-second hard deadline; batch installation is capped by a 60-second hard deadline. The fixed-commit cache is shared by Inspection, media, risk, provenance, and repository batch installation.
- skills.sh is an optional discovery hint only. Its anonymous interface is incomplete and may be unavailable; the official V1 API requires Vercel OIDC and is not a Desktop dependency. GitHub fixed-commit repository identity, exact Skill path, and complete-bundle fingerprint remain the only provenance/update authority.
- DSH Desktop v0.3.8 remains the only runtime/adapter target for this historical deployment. v0.3.9 and PR/publication were deferred.
- Historical Protocol 4 deployment records below are retained for rollback provenance only. The Protocol 5 package passed source, package, v0.3.8 adapter, and isolated UI verification on 2026-08-19, then was synchronized after a zero-process lock check.
- Complete rollback backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260819-001448-repository-batch-protocol5`. It contains the original `profile` and `portable` 16-file packages plus the atomically renamed `atomic-predecessor-profile` and `atomic-predecessor-portable` trees. Restore the matching plugin directory only while DSH Desktop is fully stopped.
- The repository package, `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager`, and `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable\resources\app\assets\plugins\dsh-skill-manager` each have the same 16-file manifest SHA-256: `00382C5D9A174B9039C6714E0F20CCA640DF3CD1E0746AF95BC4B486308FCAD1`. Key file hashes are `dist\index.js` `33D40A96EB4D278C0548957223601FD96C9404183B5B39AADD268EB19D654514`, `dist\client.js` `8E19AF9F384559C0B91260E6A6D4270E0349B93CA044C65F06C23F2B509A8E25`, `dist\marketplace-fetch.js` `30FF6AD2BAF9FEE350B9D4B0C223D112599B75B0B22D3C11D376DE7E747A33C7`, and `dist\typert.host.js` `D8E297E81FC2B8CBF74ADD3E73EEA9D4BE579E33EC4CD60BEE033FBA3AD88617`.
- Both installed JavaScript trees passed `node --check`; their Host entries import under Node 24 and expose the same 24 `DshSkillManagerService` methods. No DSH/Electron process was running at replacement time, so the next normal v0.3.8 launch loads Protocol 5 without a forced restart.

## Required

- Windows 10/11 for primary integration testing.
- Node.js 24 or a DSH-compatible maintained Node.js release.
- npm 11 or compatible npm workspace support.
- Git for Windows.

The workspace installs TypeScript and Vitest for source validation. The Harness plugin additionally uses esbuild to lower standard decorators to ES2022, bundle the private core runtime and proxy transport into its published Host entry, and emit the browser entry in DSH's `window.__ModuleLoader__` factory format. React 18 and DSH client packages are peer dependencies. `yaml` and `zod` remain ordinary public Host runtime dependencies. `https-proxy-agent` is build-only and must not remain an external import in the standalone Host bundle.

## Optional

- GitHub CLI is optional; browser-based repository and PR creation remains supported.
- Git Bash is not required by the Skill Manager itself.

## Skill Roots

The v0.3.8 Host adapter defaults to `%USERPROFILE%/.codex/skills`, `%USERPROFILE%/.claude/skills`, `%USERPROFILE%/.agents/skills`, and `%USERPROFILE%/.config/opencode/skills`. Plugin configuration may override them with `codexRoot`, `claudeRoot`, `agentsRoot`, and `opencodeRoot`. These paths remain Host configuration and never cross browser RPC.

## Upstream Compatibility Baseline

- `@deepseek-ai/dsh@0.1.0-rc.6`
- React 18 client packages
- DSH Desktop v0.3.8 is the only current adapter, runtime, packaging, smoke-test, and upstream PR acceptance baseline.
- The Desktop source adapter also requires `@deepseek-ai/dsh-client-ui-input-trigger@0.1.0-rc.6`; its dependency patch rejects any other version or changed source marker.
- The local installed Desktop remains v0.3.8; development must not require a v0.3.9 update.

The v0.3.9 release source (`v0.3.9`, commit `91a56fd`) was previously inspected and retained the same package/interface line, but that finding is research only. Reported v0.3.9 regressions make all v0.3.9 installation, packaged smoke testing, adapter work, and PR acceptance deferred until a later explicitly approved compatibility slice.

## Local Evaluation Installation

- On 2026-08-17, after explicit user approval, the current build was staged into the portable DSH Desktop v0.3.8 at `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable` and synchronized into `%USERPROFILE%\.dsh\profiles\web` for UI evaluation.
- The pre-install rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260817-122056`; seven key Desktop/profile files were copied and SHA-256 checked, and neither target `dsh-skill-manager` directory existed before installation.
- Static verification passed: exact adapter verification, Host/client syntax, profile bundle registration, and `dsh --profile web --dump-config` with the bundled rc.6 runtime. The real Desktop then logged Web UI readiness on v0.3.8 without a Skill Manager/profile error and remains open for user testing.
- This evaluation installation is local and unpublished. Restore only with the Desktop stopped: copy the backed-up files to their original locations and remove the newly added Desktop/profile `dsh-skill-manager` directories.
- The market/synchronization refinement was restaged on 2026-08-17 with rollback backup `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260817-132000-market-sync`. Desktop and profile Host/client hashes match the verified build; the running Desktop was intentionally not stopped, so the user must restart it to load this revision.
- The popular-market/automatic-provenance refinement was staged on 2026-08-17 with rollback backup `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260817-200100-popular-provenance`. Desktop and `web` profile Host/client/package hashes match the final verified build; Host import and real profile config composition pass. The running Desktop was intentionally not stopped or restarted.
- The Marketplace V2 reliability correction was deployed on 2026-08-18 after explicit approval. The complete 16-file package was copied to both `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager` and the portable Desktop asset directory; repository, profile, and portable hashes match for `package.json`, `client.js`, `index.js`, `typert.host.js`, and all other packaged files.
- The rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-043818-reliability-batch-delete`, containing complete `profile` and `portable` plugin directories plus `manifest.json`. Restore only while DSH Desktop is stopped.
- Actual v0.3.8 dark-theme acceptance passed: GitHub browse returned 20 repository candidates, repository category controls rendered, the local page exposed explicit provenance/update/synchronization batches and delete actions, and an existing exact GitHub match remained visible. The rc.7 update prompt was deferred to preserve the v0.3.8 baseline.
- The automatic-maintenance/trash/category correction was deployed on 2026-08-18 at 06:42. A fresh complete backup of both previous plugin directories is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-064257-automation-trash-category`.
- The verified 16-file package was copied to `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager` and `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable\resources\app\assets\plugins\dsh-skill-manager`. Every source/profile/portable SHA-256 matches; deployed `dist\client.js` is `5BEAF924530839BB34475A4364FD7CACE12D1D55675DBD0867B5159F219347EC` and `dist\index.js` is `A8CAC20804B2D920B39C010E85D663605ECDA38714055244F7D07E5E313AD127`.
- Installed Client/Host/Typert syntax and Host ESM import passed. The live profile does not expose a standalone `dsh` command for a redundant `--dump-config` check; the exact v0.3.8 isolated shell loaded the same package and verified capabilities, live category discovery, automatic-maintenance controls, deletion/restore, synchronization, restart persistence, and Composer behavior.
- Five portable Desktop processes were running during synchronization. They were not stopped or restarted, so the open Desktop may keep the old in-memory Client/Host until the user closes every DSH Desktop process and starts v0.3.8 again. Restore the backup only with Desktop stopped by replacing both plugin directories with their matching `profile` and `portable` backup folders.
- The ranking/dialog correction was deployed on 2026-08-18 at 07:49. The fresh complete rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-074934-ranking-dialog-portal`, with separate 16-file `profile` and `portable` trees.
- All 16 verified package files were synchronized to `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager` and `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable\resources\app\assets\plugins\dsh-skill-manager`. Every source/profile/portable SHA-256 matches. `dist\client.js` is `4B84AD15CE4201765F4468FD6CBC16338304B152A015DE9273A12D7887C99F2E`; `dist\index.js` is `E14E0B0364E112CD8BB5A00580FD0458E4404D01B76D5685F0AD82E23B7CED33`.
- Installed Client/Host/Typert syntax and profile Host ESM import passed with `DshSkillManagerService` and 22 descriptors. No DSH or Electron process was running after synchronization, so the next normal v0.3.8 launch will load this package without requiring a forced restart.

## Historical Marketplace V3 Environment Notes (2026-08-18)

- Repository validation is complete for Marketplace protocol 3: monthly Trending default, weekly Trending, historical Stars, rolling-60-day latest, relevance search, 12-category classification, and explicit source states.
- GitHub Trending is an experimental Host-side HTML source (`https://github.com/trending?since=weekly|monthly`), not a stable REST API. It is cached for 30 minutes and may use at most 24-hour stale data; it does not fall back to `updated_at`.
- The compatibility target remains DSH Desktop v0.3.8. v0.3.9, PR creation, and publication were deferred for this historical iteration.
- Full v0.3.8 synchronization completed after the stage/verify gates. The 16-file runtime package is synchronized as one unit; do not copy only `client.js` because Host and Client protocol 3 resources must stay together. The latest rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-091234-marketplace-v3`. The final repository bundle hashes are recorded in `docs/TASK_STATUS.md`.
- The recent-heat/dialog/archive repair was synchronized on 2026-08-18 at 11:14. The new complete rollback backup is `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-111457-recent-heat-dialog`, with separate 16-file `profile` and `portable` trees verified before replacement.
- The current profile and portable packages are byte-identical. Key SHA-256 values: `dist\index.js` `F89A70CC7F10CE98A856477DDEE02F2A8E3FA2D3F2EB7D9DE46105FC9CF52996`, `dist\client.js` `5932E69F454FAFFBB6E33C66C3E5EBEC94E7DFA9DAB440C77390414BE1BD30FC`, and `dist\marketplace-fetch.js` `9993EF57FA9FCCC29B3D295E60EDD5856ADCAF65089B7BE5386377EBC8CD2FC3`.
- No DSH/Electron process was running after synchronization. The next normal v0.3.8 launch loads this package; restore the matching `profile` and `portable` backup directories only while Desktop is stopped.
- The fixed-commit codeload snapshot-cache revision was synchronized on 2026-08-18 at 13:18 after a complete two-target backup: `%USERPROFILE%\Documents\dsh-skill-manager-backups\20260818-131821-codeload-snapshot-cache`. The backup intentionally preserves the previously different profile and portable package states and includes `manifest.json`; restore either side only while DSH Desktop is fully stopped.
- The final 16-file package is byte-identical across repository, `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-skill-manager`, and `%USERPROFILE%\AppData\Local\Temp\dsh-desktop-portable\resources\app\assets\plugins\dsh-skill-manager`. Key SHA-256 values are `dist\index.js` `83C0991A9674D1C69DD5C132AF12CB54DBB5E95F150D2EC84750FEF0E9A7C79E`, `dist\client.js` `6990B6221258B89A08E74A32CC946B8B69D4D6804729D0624190F1E71A59C930`, `dist\marketplace-fetch.js` `30FF6AD2BAF9FEE350B9D4B0C223D112599B75B0B22D3C11D376DE7E747A33C7`, and `dist\typert.host.js` `F08BD1C23C5B1BFC9E57325EB5894D2384039B593161CB28817D49579BF3EAE0`.
- Five DSH Desktop processes were still running during disk synchronization and were deliberately not stopped. Their loaded JavaScript remains the previous in-memory revision until the user completely exits every DSH Desktop process and reopens v0.3.8.
- Installed Client/Host/RPC/Typert JavaScript passed `node --check` in both targets. Importing each installed Host entry under Node 24 succeeded with `DshSkillManagerService` and all 22 Remote descriptors.
