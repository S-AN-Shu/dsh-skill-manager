# DSH Skill Manager

Native DeepSeek Harness Host/Web plugin for managing Agent Skills, browsing GitHub repository candidates, inspecting fixed-commit Skill bundles, and synchronizing managed Skills with configured local targets.

## Installation

Download the prebuilt `dsh-skill-manager-0.1.0.tgz` from the [GitHub `v0.1.0` release](https://github.com/S-AN-Shu/dsh-skill-manager/releases/tag/v0.1.0), then run:

```powershell
dsh plugin --profile web add .\dsh-skill-manager-0.1.0.tgz
```

Restart the Web Host or DSH Desktop after installation. The package declares its native bundle through `dsh.bundle.patch` and includes `cordis.patch.yml`.

Do not use `github:S-AN-Shu/dsh-skill-manager` for `v0.1.0`: the public source is a workspace and the verified distribution is the prebuilt release tarball.

## Verified Runtime

- DSH Desktop v0.5.4
- `@deepseek-ai/dsh@0.1.1-rc.2`
- React 18 Web Client with the public Typert Remote and `settings.section` contracts

The plugin does not require Electron or private Desktop launcher services. It currently exposes no Agent Tool and claims neither dsh-TUI admission nor `dsh-std` cross-Host conformance.

## Security Boundary

Remote content is untrusted. The Host validates fixed commits, paths, `SKILL.md`, bundle integrity, and static risk hints before installation. It never executes remote Skill scripts. Integrity checks do not mean content is absolutely safe.

Source, architecture, tests, and issue tracking: [S-AN-Shu/dsh-skill-manager](https://github.com/S-AN-Shu/dsh-skill-manager)

MIT
