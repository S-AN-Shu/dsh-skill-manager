## Official Harness 0.2 release

Version 0.2.0 targets official DeepSeek Harness Desktop/Web 0.2.0-rc.2. Install the prebuilt GitHub release tarball into the `desktop` profile. The older 0.1.x compatibility notes below are historical. Automatic checks run when the management page is open; they are not a persistent system scheduler. Locally edited Skills are protected, and high/unknown risk updates require explicit review.

# DSH Skill Manager

DSH Skill Manager is a community plugin for managing Agent Skills in DeepSeek Harness, with a thin integration layer for DSH Desktop.

Version `0.2.0` provides:

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

The supported public installation path is the prebuilt tarball attached to the GitHub `v0.2.0` release. It contains the Host bundle, Web Client, declarations, license, and `cordis.patch.yml`; installing it does not run a remote repository build script.

```powershell
Invoke-WebRequest `
  https://github.com/S-AN-Shu/dsh-skill-manager/releases/download/v0.2.0/dsh-skill-manager-0.2.0.tgz `
  -OutFile .\dsh-skill-manager-0.2.0.tgz
dsh plugin --profile desktop add .\dsh-skill-manager-0.2.0.tgz
```

Restart `dsh web` or DSH Desktop after changing the Profile. Do not copy selected bundle files into `node_modules`: Host, Client, Typert descriptors, metadata, and the Cordis patch are one versioned unit.

For the official Desktop, fully quit the application first and use its bundled `dsh` command (available through the application's command-management menu). The standalone npm CLI cannot manage the reserved `desktop` profile. Windows installations also provide `resources/runtime/cli/bin/dsh.cmd` inside the application directory. For a standalone Web Host, use `--profile web` instead.

The repository is an npm workspace, not a self-contained root plugin package. Use the release tarball for installation.

## Supported Runtime

The current target is official DeepSeek Harness Desktop/Web with `@deepseek-ai/dsh@0.2.0-rc.2`. Skill Manager uses public Typert Remote and `settings.section` contracts. It does not depend on Electron, Desktop launcher state, `desktopRuntime`, or private package helpers. Release 0.1.0 remains available for the historical 0.1 runtime.

The historic DSH Desktop v0.3.8 / Harness rc.6 adapter remains in `scripts/` for the already-submitted reference integration. It is not the current supported target.

## Development

Build against the declared official 0.2.0-rc.2 development packages. Core remains independent from Desktop and the Web client.

Build, verify, package, and install through the official profile command:

```powershell
npm install
npm test
npm run typecheck
npm run build
npm run verify:build --workspace dsh-skill-manager
npm pack --workspace dsh-skill-manager --pack-destination C:\path\to\artifacts
dsh plugin --profile desktop add C:\path\to\artifacts\dsh-skill-manager-0.2.0.tgz
```

The public plugin-development baseline and release compliance matrix are in [`docs/DSH_PLUGIN_DEVELOPMENT_STANDARD.zh-CN.md`](docs/DSH_PLUGIN_DEVELOPMENT_STANDARD.zh-CN.md). This release does not claim dsh-TUI admission or `dsh-std` cross-Host conformance.

## Security

Remote repositories, README content, manifests, media, and Skill documents are treated as untrusted input. Installation fixes a commit, validates the selected Skill bundle, rejects unsafe paths/symlinks/submodules, performs static risk hints, and never executes remote Skill scripts. Integrity verification is not a guarantee that text or scripts are harmless. See [`SECURITY.md`](SECURITY.md).

## License

MIT
