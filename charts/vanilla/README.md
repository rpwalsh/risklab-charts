# @risklab/charts-vanilla

`@risklab/charts-vanilla` is the recommended no-framework chart surface for
RiskLab.

Use it when you want:

- static-site or mixed-stack charting
- explicit control over mounting and lifecycle
- an install surface that works cleanly with HTMX, Alpine, Astro islands,
  classic server-rendered apps, and custom shells

## Install

```bash
npm install @risklab/charts @risklab/charts-vanilla
```

## Quick start

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

## Design-system fit

Use `@risklab/charts/css-vars` when you want host-level chart tokens available
to plain CSS, Tailwind, CSS Modules, or another design-token pipeline.
