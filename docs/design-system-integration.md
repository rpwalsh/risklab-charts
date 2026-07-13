# Design-system integration

RiskLab Charts exposes framework-neutral theme adapters:

- `@risklab/charts/styler` connects atomic styling tokens.
- `@risklab/charts/theme-object` maps a host theme object without a runtime dependency.
- `@risklab/charts/css-vars` emits and applies CSS custom properties.

These bridges depend only on documented public contracts. Chart core does not import UI components or application workbench code.
