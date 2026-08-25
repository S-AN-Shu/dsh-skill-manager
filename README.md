# DSH Skill Manager

DSH Skill Manager is a community plugin for managing Agent Skills in DeepSeek Harness, with a thin integration layer for DSH Desktop.

Version `0.1.0` provides:

- creation and validation of `SKILL.md` bundles;
- an isolated managed library with per-Skill enablement for DSH;
- discovery and explicit import/export for Codex, Claude Code, `.agents/skills`, and OpenCode;
- Marketplace V2 repository discovery, fixed-commit inspection, bounded media, risk hints, and safe GitHub installation;
- update checks, conflict detection, backup, and rollback;
- a DSH settings section and leading slash command/Skill prefix parsing.

## Development Status

The architecture and acceptance criteria are recorded under `docs/`. The managed Core, 24-method Protocol 5 Marketplace V2 Host protocol, metadata-only GitHub repository home, category-backed GitHub searches, on-demand fixed-commit inspection, repository-level batch analysis and installation, bounded media resolver, static risk hints, safe update/rollback, 30-day recoverable deletion, opt-in background maintenance, cross-agent synchronization, theme-adaptive React settings UI, ordinary Harness rc.2 adapter, and historical DSH Desktop v0.3.8 adapter are implemented in tested slices. skills.sh and Hugging Face remain optional discovery/provenance signals rather than installation authority. The central index schema is frozen, but no Indexer service ships yet.

For the current protocol, see [`docs/API_SPEC.md`](docs/API_SPEC.md). For a detailed Chinese overview, see [`docs/PROJECT_OVERVIEW.zh-CN.md`](docs/PROJECT_OVERVIEW.zh-CN.md).

## Install The Prebuilt DSH Plugin

The supported public installation path is the prebuilt tarball attached to the GitHub `v0.1.0` release. It contains the Host bundle, Web Client, declarations, license, and `cordis.patch.yml`; installing it does not run a remote repository build script.

```powershell
Invoke-WebRequest `
  https://github.com/S-AN-Shu/dsh-skill-manager/releases/download/v0.1.0/dsh-skill-manager-0.1.0.tgz `
  -OutFile .\dsh-skill-manager-0.1.0.tgz
dsh plugin --profile web add .\dsh-skill-manager-0.1.0.tgz
```

Restart `dsh web` or DSH Desktop after changing the Profile. Do not copy selected bundle files into `node_modules`: Host, Client, Typert descriptors, metadata, and the Cordis patch are one versioned unit.

GitHub source installation (`github:S-AN-Shu/dsh-skill-manager`) is intentionally not advertised in `v0.1.0`. The repository is an npm workspace, not a self-contained root plugin package, and official source installation would require an allowed `prepare` build. Use the release tarball instead.

## Supported Runtime

The verified current target is DSH Desktop v0.5.4 with `@deepseek-ai/dsh@0.1.1-rc.2`. Skill Manager is a normal Host/Web Client plugin: it uses public Typert Remote and `settings.section` contracts and does not depend on Electron, Desktop launcher state, `desktopRuntime`, or private package helpers. The v0.5.4 package matrix still supplies UI primitives at rc.7, so compatibility is declared per package rather than inferred from one global version.

The historic DSH Desktop v0.3.8 / Harness rc.6 adapter remains in `scripts/` for the already-submitted reference integration. It is not the supported target for the `v0.1.0` public release.

## Development

The current installed target is DSH Desktop v0.5.4 with `@deepseek-ai/dsh@0.1.1-rc.2`. Skill Manager is a normal Host/Web Client plugin: it uses public Typert Remote and `settings.section` contracts and does not depend on Electron, Desktop launcher state, `desktopRuntime`, or private package helpers. The v0.5.4 package matrix still supplies UI primitives at rc.7, so compatibility is declared per package rather than inferred from one global version.

Build, verify, package, and install through the official profile command:

```powershell
npm install
npm test
npm run typecheck
npm run build
npm run verify:build --workspace dsh-skill-manager
npm pack --workspace dsh-skill-manager --pack-destination C:\path\to\artifacts
dsh plugin --profile web add C:\path\to\artifacts\dsh-skill-manager-0.1.0.tgz
```

The public plugin-development baseline and release compliance matrix are in [`docs/DSH_PLUGIN_DEVELOPMENT_STANDARD.zh-CN.md`](docs/DSH_PLUGIN_DEVELOPMENT_STANDARD.zh-CN.md). This release does not claim dsh-TUI admission or `dsh-std` cross-Host conformance.

## Security

Remote repositories, README content, manifests, media, and Skill documents are treated as untrusted input. Installation fixes a commit, validates the selected Skill bundle, rejects unsafe paths/symlinks/submodules, performs static risk hints, and never executes remote Skill scripts. Integrity verification is not a guarantee that text or scripts are harmless. See [`SECURITY.md`](SECURITY.md).

## License

MIT
