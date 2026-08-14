# Changelog

All notable changes to this project are documented in this file.

## 1.0.1 - 2026-08-14

- Fixed: the React `<Chart>` component dropped the y-axis (or x-axis) entirely when only one of the `xAxis`/`yAxis` props was set, since the engine's axis-inference fallback only runs when `axes` is completely absent, not partially populated. Every non-bar chart type rendered an empty, error-free `<g>` group as a result.

## 1.0.0 - 2026-04-01

Initial stable release posture for the RiskLab charts package family.

- Published typed chart surfaces for core, basic, advanced, and 3D lanes.
- Published standalone adapter packages for React, vanilla, Vue, Svelte, Angular, Lit, and Solid.
- Tightened package exports, type entrypoints, and build validation flow.
