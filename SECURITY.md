# Security Policy

## Supported Version

Security fixes are currently provided for the latest GitHub release only.

## Reporting

Please use GitHub's private **Report a vulnerability** flow for this repository. Do not place credentials, private Skill contents, local filesystem dumps, or exploit details in a public issue.

Include the DSH/Desktop version, plugin version, affected operation, minimal reproduction, and whether the issue can write outside the managed roots, execute code, expose credentials, or bypass commit/bundle verification.

## Trust Boundary

GitHub repositories, market indexes, topics, README files, manifests, media, and Skill documents are untrusted inputs. DSH Skill Manager does not execute remote Skill scripts. Installation and updates must pass fixed-commit, path, bundle, and integrity validation; static risk findings are advisory and do not prove content is harmless.
