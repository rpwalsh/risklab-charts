# Getting Started

This guide is the fastest honest path to a first successful RiskLab Charts
install.

## Choose your path

| If you are building | Install |
| --- | --- |
| React charts | `npm install @risklab/charts @risklab/charts-react` |
| React analytical workbench | `npm install @risklab/workbench @risklab/charts @risklab/charts-react` |
| React mission starter | `npm install @risklab/mission @risklab/mission-react @risklab/workbench @risklab/ui-react @risklab/charts @risklab/charts-react` |
| Vanilla or Web Components charts | `npm install @risklab/charts @risklab/charts-vanilla` |
| Vue, Svelte, Angular, Lit, Solid | install `@risklab/charts` plus the matching `@risklab/charts-*` adapter |

## React quick start

```tsx
import { Chart } from "@risklab/charts-react";

const series = [
  {
    id: "throughput",
    name: "Throughput",
    type: "area",
    data: [
      { x: "09:00", y: 120 },
      { x: "10:00", y: 148 },
      { x: "11:00", y: 133 },
    ],
  },
];

export function ThroughputChart() {
  return (
    <Chart
      title="Requests per minute"
      height={320}
      series={series}
      yAxis={{ title: { text: "RPM" } }}
    />
  );
}
```

Reference file: [examples/quickstart-react.tsx](../examples/quickstart-react.tsx)

If you are building a full analytical application rather than a single chart
surface, pair this repo with `@risklab/workbench` for shell, panel layout,
query/filter state, and inspectors. If you want guided mission templates on
top of that shell, add `@risklab/mission` and the matching `@risklab/mission-*`
package from the RiskLab Mission repo.

## Vanilla quick start

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

Reference file: [examples/quickstart-vanilla.ts](../examples/quickstart-vanilla.ts)

## What to evaluate next

- [docs/design-system-integration.md](design-system-integration.md)
- [docs/chart-family-taxonomy.md](chart-family-taxonomy.md)
- [SECURITY.md](../SECURITY.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
