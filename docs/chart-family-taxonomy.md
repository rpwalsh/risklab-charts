# Chart Family Taxonomy

RiskLab already exposes three public chart lanes:

- `@risklab/charts/basic`
- `@risklab/charts/advanced`
- `@risklab/charts/3d`

This document defines what belongs in each lane for ongoing package design and
for v1.1 roadmap decisions. It is a package taxonomy, not a claim that every
family listed here is already implemented today.

## Current public lane intent

| Lane | Public surface | Intent |
| --- | --- | --- |
| Basic | `@risklab/charts/basic` | Common application charts and safe defaults |
| Advanced | `@risklab/charts/advanced` | Specialized analytical, scientific, finance, and ops visuals |
| 3D | `@risklab/charts/3d` | Spatial, graph, and topology-heavy visuals only |

The current `basic` export is broader than the long-term target and still
contains some transitional families such as `sankey`, `dependencyWheel`,
`marimekko`, `wordCloud`, and `treegraph`. Those stay supported in `1.x`, but
new lane decisions should follow the taxonomy below.

## Lane rules

- `basic` is the default lane for dashboards, internal tools, workbenches, and
  product analytics.
- `advanced` is for charts that are specialized, domain-heavy, or easier to
  misuse without analyst context.
- `3d` is reserved for charts with real spatial or graph value, not decorative
  perspective effects.
- Domain-heavy families should move into future vertical packs instead of
  bloating the default lanes.

## Basic lane

These chart families belong in the default RiskLab lane:

- line, multi-series line, spline, step line
- area, stacked area, 100% stacked area, range area
- bar, grouped bar, stacked bar, 100% stacked bar
- column, grouped column, stacked column, 100% stacked column
- lollipop, dumbbell, dot plot, Cleveland dot plot
- waterfall, bridge, Pareto
- histogram
- box plot
- scatter, bubble
- heatmap, calendar heatmap
- treemap, circle packing, sunburst
- pie, donut
- radar
- gauge
- slope chart, bump chart
- sparkline
- choropleth map, proportional symbol map
- candlestick, OHLC, stock area, stock volume bar
- small-multiples line, bar, area, and map
- timeline, swimlane timeline, milestone, and Gantt-style scheduling visuals

Families that can live in `basic` later, but should not outrank the default
lane above:

- pictogram
- bullet
- cumulative histogram
- violin, strip, beeswarm
- quadrant, connected scatter, hexbin
- table heatmap
- icicle
- nested donut, polar area, Nightingale rose
- radial bar, progress ring
- funnel, pyramid
- streamgraph
- sparkbar
- dot density map, flow map, tile grid map, cartogram
- Kagi, Renko, point-and-figure, Heikin-Ashi
- horizon chart

## Advanced lane

These chart families belong in RiskLab's specialized analytical lane:

- Sankey, alluvial, chord, arc, dependency wheel
- parallel coordinates, parallel sets
- Marimekko, mosaic
- contour, filled contour, density contour, 2D kernel density
- ridgeline, raincloud
- fan chart, uncertainty band, prediction interval fan, ribbon
- range bar, error bar, error line
- control chart, run chart, XmR, p-chart, c-chart, u-chart, np-chart
- cohort retention heatmap
- survival curve, Kaplan-Meier, hazard plot
- forest plot
- volcano plot, MA plot, Manhattan plot, Q-Q plot, P-P plot
- correlogram, scatterplot matrix, clustered heatmap, dendrogram
- confusion matrix, ROC curve, precision-recall curve, lift chart, gain chart,
  calibration plot
- partial dependence, ICE, SHAP summary, SHAP dependence
- adjacency matrix, bipartite matrix, bubble matrix
- volume profile, market profile, footprint, order book depth
- spectrogram, waveform

These are strong candidates for future vertical packs instead of the default
advanced lane:

- finance-heavy market structure and trading visuals
- ML evaluation and explainability visuals
- biostats and survival-analysis visuals
- quality-control SPC families
- operations and scheduling-heavy planning views

## 3D and graph lane

The `3d` lane should stay selective. These are the families that justify it:

- 3D surface, 3D scatter, volume rendering, voxel, isosurface, point cloud
- terrain or elevation surfaces
- 3D vector field, streamtube, cone field
- force-directed graph, radial network, ego network, community network,
  multilevel network
- DAG, layered DAG, causal graph
- knowledge graph, hypergraph
- edge-bundled graph
- shortest-path graph
- temporal network graph, dynamic graph animation

Families that can come later if the graph and topology core proves strong:

- wireframe, mesh, contour surface
- globe choropleth, globe arc map
- hierarchical trees, radial dendrograms, tidy trees, cluster trees
- Bayesian networks, Markov chains, finite-state machines, Petri nets
- bipartite and tripartite network views
- adjacency matrix graph, incidence matrix graph
- hive plot, metro map graph
- minimum spanning tree, spanning forest

Default-no 3D chart types:

- 3D bubble
- 3D bar
- 3D area surface

## Future vertical packs

These clusters should stay out of the default lanes until there is proven demand:

- `risklab-finance`
- `risklab-ml`
- `risklab-biostats`
- `risklab-quality`
- `risklab-ops`
- `risklab-networks`

## Default-no families

These are not banned forever, but they should not drive the default RiskLab
story:

- word cloud
- pyramid
- progress ring
- cartogram-heavy map variants
- novelty 3D perspective charts

## v1.1 package direction

The v1.1 package story should stay disciplined:

- keep `@risklab/charts/basic` as the evaluation-friendly default lane
- keep `@risklab/charts/advanced` for justified analytical complexity
- keep `@risklab/charts/3d` focused on graph and spatial value
- do not add wrapper sprawl around chart families
- move domain-heavy long-tail work into vertical packs only when there is clear
  adoption pressure
