# RiskLab Charts

RiskLab Charts is the split-repo home for RiskLab's chart engine and adapter
packages. This repo owns the public chart surfaces, theme bridges, and chart
family taxonomy that back the live demos at `https://rpwalsh.github.io/`.

## Packages

- `@risklab/charts`: core chart engine, themes, plugins, and chart families
- `@risklab/charts-react`: recommended React adapter
- `@risklab/charts-vanilla`: no-framework adapter
- `@risklab/charts-vue`, `@risklab/charts-svelte`,
  `@risklab/charts-angular`, `@risklab/charts-lit`,
  `@risklab/charts-solid`: framework-specific adapters

## Install

| Use case | Install |
| --- | --- |
| React charts | `npm install @risklab/charts @risklab/charts-react` |
| Vanilla or mixed-stack charts | `npm install @risklab/charts @risklab/charts-vanilla` |
| Full analytical shell | `npm install @risklab/workbench @risklab/charts @risklab/charts-react` |
| Mission starter | `npm install @risklab/mission @risklab/mission-react @risklab/workbench @risklab/ui-react @risklab/charts @risklab/charts-react` |

## Chart lanes

RiskLab keeps the public chart model in three lanes:

- `@risklab/charts/basic`
- `@risklab/charts/advanced`
- `@risklab/charts/3d`

The lane policy lives in [docs/chart-family-taxonomy.md](docs/chart-family-taxonomy.md).

## Quick links

- Live demos: `https://rpwalsh.github.io/`
- Getting started: [docs/getting-started.md](docs/getting-started.md)
- Design-system guidance: [docs/design-system-integration.md](docs/design-system-integration.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## Local development

Requirements:

- Node.js `>=20`
- npm `>=10`

Core validation:

```bash
npm install
npm run typecheck
npm run test
npm run build:all
npm run release:check
```

