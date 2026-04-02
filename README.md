# RiskLab Charts

RiskLab Charts is a typed chart package family for analytical products,
dashboards, internal tools, and data-heavy application shells.

If you are building a full analytical application shell, pair these packages
with `@risklab/workbench` from the RiskLab UI repo, or use `@risklab/mission`
from the standalone RiskLab Mission repo when you want guided operator-facing
templates. Charts are one panel type in those higher-level shells, not the
whole product.

This repo ships:

- `@risklab/charts`: the chart engine, chart families, themes, plugins, and
  compatibility bridges
- `@risklab/charts-react`: the recommended React chart surface
- `@risklab/charts-vanilla`: the recommended no-framework chart surface
- framework-specific chart packages for Vue, Svelte, Angular, Lit, and Solid

## Package chooser

| Use case | Install | Notes |
| --- | --- | --- |
| React charts | `npm install @risklab/charts @risklab/charts-react` | Recommended evaluation path |
| React analytical workbench | `npm install @risklab/workbench @risklab/charts @risklab/charts-react` | Recommended full app path when you need shell, layout, and coordinated state |
| React mission starter | `npm install @risklab/mission @risklab/mission-react @risklab/workbench @risklab/ui-react @risklab/charts @risklab/charts-react` | Use the mission repo when you want guided mission templates on top of the base chart stack |
| Vanilla or Web Components charts | `npm install @risklab/charts @risklab/charts-vanilla` | Best path for static sites and mixed stacks |
| Vue, Svelte, Angular, Lit, Solid | install `@risklab/charts` plus the matching `@risklab/charts-*` adapter | Keep the framework choice explicit during review |

## Chart family lanes

RiskLab keeps the public chart model in three lanes:

- `@risklab/charts/basic`
- `@risklab/charts/advanced`
- `@risklab/charts/3d`

The lane policy and v1.1 taxonomy live in
[docs/chart-family-taxonomy.md](docs/chart-family-taxonomy.md).

## Five-minute quick starts

### React

```bash
npm install @risklab/charts @risklab/charts-react
```

```tsx
import { Chart } from "@risklab/charts-react";

const series = [
  {
    id: "latency",
    name: "P95 latency",
    type: "line",
    data: [
      { x: "Mon", y: 112 },
      { x: "Tue", y: 96 },
      { x: "Wed", y: 104 },
      { x: "Thu", y: 88 },
    ],
  },
];

export function LatencyChart() {
  return (
    <Chart
      title="Service latency"
      height={320}
      series={series}
      yAxis={{ title: { text: "Milliseconds" } }}
    />
  );
}
```

### Vanilla

```bash
npm install @risklab/charts @risklab/charts-vanilla
```

```ts
import { mount } from "@risklab/charts-vanilla";

const host = document.getElementById("chart-root");

if (host) {
  mount(host, {
    title: "CPU saturation",
    series: [
      {
        id: "cpu",
        name: "CPU %",
        type: "area",
        data: [
          { x: "09:00", y: 42 },
          { x: "10:00", y: 55 },
          { x: "11:00", y: 61 },
        ],
      },
    ],
    yAxis: { title: { text: "Percent" } },
  });
}
```

More working references:

- [docs/getting-started.md](docs/getting-started.md)
- [docs/design-system-integration.md](docs/design-system-integration.md)
- [examples/quickstart-react.tsx](examples/quickstart-react.tsx)
- [examples/quickstart-vanilla.ts](examples/quickstart-vanilla.ts)

## Design-system integration

RiskLab Charts is designed to fit into an existing design system without
forcing a wrapper package for every stack.

- `@risklab/charts/css-vars` is the generic token bridge for Tailwind, CSS
  Modules, plain CSS, and enterprise token pipelines.
- `@risklab/charts/mui` is the direct bridge for teams already on Material UI.
- `@risklab/charts/stylex` stays available for actual StyleX users.
- There is no dedicated Fluent wrapper today. The current recommendation is a
  token bridge, not another adapter layer.
- Framework adapter packages are expected to ship package-owned implementation
  source, not just thin re-export wrappers.

## Trust and release posture

- Apache 2.0 licensing with `LICENSE`, `LICENSE.txt`, and `NOTICE`
- `SECURITY.md` with private disclosure guidance
- `CONTRIBUTING.md` with validation expectations
- no install-time `dependencies` in the publishable package set
- `npm run release:check` validates build, types, tests, packing, and packed
  install smoke checks

## Local development

Requirements:

- Node.js `>=20`
- npm `>=10`

Useful commands:

```bash
npm run build:all
npm run test
npm run release:check
```

## License

Apache-2.0

Redistributions must preserve the applicable copyright, license, and notice
attributions in `LICENSE`, `LICENSE.txt`, and `NOTICE`.
