## Official Harness 0.2 release

Version 0.2.0 targets official DeepSeek Harness Desktop/Web 0.2.0-rc.2. Install the prebuilt GitHub release tarball into the `desktop` profile. The older 0.1.x compatibility notes below are historical. Automatic checks run when the management page is open; they are not a persistent system scheduler. Locally edited Skills are protected, and high/unknown risk updates require explicit review.

# DSH Skill Manager

Native DeepSeek Harness Host/Web plugin for managing Agent Skills, browsing GitHub repository candidates, inspecting fixed-commit Skill bundles, and synchronizing managed Skills with configured local targets.

## Installation

Download the prebuilt `dsh-skill-manager-0.2.0.tgz` from the [GitHub `v0.2.0` release](https://github.com/S-AN-Shu/dsh-skill-manager/releases/tag/v0.2.0), then run:

```powershell
dsh plugin --profile desktop add .\dsh-skill-manager-0.2.0.tgz
```

Restart the Web Host or DSH Desktop after installation. The package declares its native bundle through `dsh.bundle.patch` and includes `cordis.patch.yml`.

For Desktop installation, fully quit the application and use its bundled `dsh` command, not the standalone npm CLI. The standalone CLI reserves the `desktop` profile. Windows can call `resources/runtime/cli/bin/dsh.cmd` inside the application's installation directory. Standalone Web installations use `--profile web`.

The public source is a workspace; use the prebuilt release tarball for installation.

## Verified Runtime

- Official DeepSeek Harness Desktop/Web
- `@deepseek-ai/dsh@0.2.0-rc.2`
- React 18 Web Client with the public Typert Remote and `settings.section` contracts

The plugin does not require Electron or private Desktop launcher services. It currently exposes no Agent Tool and claims neither dsh-TUI admission nor `dsh-std` cross-Host conformance.

## Security Boundary

Remote content is untrusted. The Host validates fixed commits, paths, `SKILL.md`, bundle integrity, and static risk hints before installation. It never executes remote Skill scripts. Integrity checks do not mean content is absolutely safe.

Source, architecture, tests, and issue tracking: [S-AN-Shu/dsh-skill-manager](https://github.com/S-AN-Shu/dsh-skill-manager)

MIT
