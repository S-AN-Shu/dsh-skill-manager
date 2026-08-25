# Conventions

- TypeScript strict mode; ESM packages.
- ASCII source by default; user-facing Chinese text belongs in locale dictionaries.
- Public errors use stable codes and human-readable messages.
- Filesystem operations receive explicit roots; no implicit home-directory writes in tests.
- External network access is isolated behind source adapter interfaces.
- Commits should contain one coherent behavior change and its tests/documentation.
