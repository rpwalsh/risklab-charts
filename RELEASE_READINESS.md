# Release readiness

- Packages: `@risklab/charts` and seven framework adapter packages
- Version: `1.0.0`
- Build: `npm run build:all`
- Validation: `npm run release:check`
- Tarball consumer test: `npm run smoke:install`
- Release workflow: `.github/workflows/release.yml`
- License: Proprietary (see LICENSE and NOTICE)
- ESM and CommonJS: root, documented subpaths, and adapter entrypoints
- Browser support: modern evergreen browsers; browser lifecycle validation runs in Chromium
- Publication order: root package, then framework adapter packages

Known limitation: GPU availability and performance vary by device. Three-dimensional scenes provide a deterministic non-WebGL failure path and must be benchmarked against the target deployment hardware.
