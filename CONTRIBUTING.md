# Contributing

## Setup

```bash
npm install
```

## Validate before opening a PR

```bash
npm run typecheck
npm run test
npm run build:all
npm run pack:all
npm run smoke:install
```

For release-sensitive changes:

```bash
npm run release:check
```

## Contribution rules

- Keep package boundaries clear.
- Keep public export maps, docs, and install instructions truthful.
- Keep docs and examples on public package imports, not repo-private paths.
- Keep adapter packages as standalone package-owned implementations.
- Add or update tests when behavior changes.
- Keep new chart families aligned with the lane policy in `docs/chart-family-taxonomy.md`.
- Do not add demo-only behavior to package surfaces.

## Pull request checklist

- [ ] Build passes for changed workspaces
- [ ] Typecheck passes
- [ ] Tests pass or rationale is provided
- [ ] Public API changes are documented
- [ ] No placeholder copy or debug artifacts left behind
