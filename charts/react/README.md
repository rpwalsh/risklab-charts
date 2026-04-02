# @risklab/charts-react

First-class React adapter package for RiskLab charts.

This is the recommended chart entrypoint for React apps. It keeps the core chart
engine in `@risklab/charts` and gives product teams a clear React install surface
that is easy to explain during review.

## Install

```bash
npm install @risklab/charts @risklab/charts-react
```

## Quick start

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

## Theming

RiskLab charts can follow a host design system without a React-specific wrapper
package:

```ts
import { createTheme } from "@risklab/charts";
import { applyThemeCSSVars } from "@risklab/charts/css-vars";
```

Use `@risklab/charts/mui` when you already have a Material UI theme object and
want a direct token bridge.
