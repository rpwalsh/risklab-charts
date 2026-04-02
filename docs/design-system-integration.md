# Design-System Integration

RiskLab Charts is designed to fit into an existing design system with a small
number of clear integration surfaces.

## Current recommendation

### Adopt now

- React teams: `@risklab/charts` + `@risklab/charts-react`
- Vanilla and mixed-stack teams: `@risklab/charts` + `@risklab/charts-vanilla`
- Material UI environments: `@risklab/charts/mui`
- Tailwind, CSS Modules, and design-token pipelines: `@risklab/charts/css-vars`

### Keep for specific teams

- `@risklab/charts/stylex` for actual StyleX users
- framework-specific adapter packages when you truly need them

### Defer for now

- dedicated Fluent wrapper package
- dedicated Chakra, Mantine, Ant, or shadcn wrapper packages

Those can come later if there is proven adoption pressure. Today the better move
is to keep the core lean and use token bridges rather than multiply wrappers.

## Why no Fluent adapter right now

RiskLab Charts does not need a full Fluent-specific wrapper to be usable in
large enterprise environments.

The highest-value compatibility layer today is:

- chart theme conversion to CSS variables
- existing MUI token bridge for teams already on Material UI

If a Fluent integration becomes necessary, the next step should be a token
bridge, not a parallel component suite.

## Charts token strategy

Use the generic CSS variable bridge when you want chart tokens to participate in
an existing styling system without depending on StyleX naming.

```ts
import { createTheme } from "@risklab/charts";
import { applyThemeCSSVars } from "@risklab/charts/css-vars";

const hostTheme = createTheme("corp", "Corporate", "default", {
  palette: ["#0057d9", "#00a36c", "#d97706"],
  backgroundColor: "#ffffff",
  textColor: "#111827",
});

applyThemeCSSVars(document.documentElement, hostTheme, "--risklab-chart");
```

## Existing compatibility surfaces

### Material UI

Use `@risklab/charts/mui` to derive a RiskLab chart theme from an MUI theme
object without adding a hard dependency on MUI inside RiskLab itself.

### Tailwind

Use RiskLab CSS variables as the contract and let Tailwind utilities style the
surrounding layout, shell, and spacing. Do not add a Tailwind-only wrapper
layer.

### StyleX

If your team already uses StyleX, `@risklab/charts/stylex` stays available. It
is useful, but it is no longer the recommended default bridge for everyone else.

## Practical adapter matrix

| Surface | Now | Why |
| --- | --- | --- |
| React charts | Keep first-class | Highest adoption ROI |
| Vanilla charts | Keep first-class | Strong no-framework path |
| MUI theme adapter | Keep | Real enterprise integration value |
| Generic CSS vars bridge | Keep and promote | Works across many stacks |
| Fluent wrapper | Defer | Token bridge beats wrapper sprawl |
| Tailwind wrapper | Do not add | CSS vars already cover the need |
| shadcn wrapper | Do not add | Better to document coexistence |
