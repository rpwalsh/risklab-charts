// ============================================================================
// RiskLab Charts â€” Main Entry Point
// @risklab/charts
// ============================================================================

// â”€â”€â”€ Core â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { Engine } from './core/Engine';
export type { EngineInternalAPI, SyncableChart, EngineChartConfig } from './core/Engine';
export { EventBus } from './core/EventBus';
export { Registry } from './core/Registry';
export { DataPipeline, decimateLTTB, decimateMinMax } from './core/DataPipeline';
export { SyncController, syncCharts } from './core/SyncController';
export type { SyncOptions } from './core/SyncController';
export type {
  DataPoint,
  DataValue,
  NumericValue,
  ColorValue,
  RGBAColor,
  GradientDef,
  GradientStop,
  Point,
  Rect,
  Spacing,
  SeriesConfig,
  DecimationConfig,
  MarkerConfig,
  ChartType,
  AxisConfig,
  PlotBandConfig,
  PlotLineConfig,
  LegendConfig,
  LegendGroup,
  TooltipConfig,
  AnimationConfig,
  TimelineConfig,
  InteractionConfig,
  ZoomConfig,
  PanConfig,
  SelectionConfig,
  AnnotationConfig,
  AnnotationRenderContext,
  ContextMenuItem,
  CrosshairConfig,
  ExportConfig,
  ResponsiveRule,
  AccessibilityConfig,
  PluginHooks,
  RiskLabPlugin,
  ChartTypeDefinition,
  ThemeConfig,
  RendererBackend,
  RendererConfig,
  SankeyConfig,
  HeatmapConfig,
  GaugeConfig,
  Graph3DConfig,
  Graph3DLink,
  Graph3DWalkConfig,
  ChartConfig,
  ResolvedScale,
  ChartState,
  ChartEventType,
  ChartEventHandler,
  ScaleType,
} from './core/types';

// â”€â”€â”€ Renderers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { BaseRenderer } from './renderers/BaseRenderer';
export { SVGRenderer } from './renderers/SVGRenderer';
export { CanvasRenderer } from './renderers/CanvasRenderer';

// â”€â”€â”€ Scales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { createScale } from './scales/index';

// â”€â”€â”€ Animations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { AnimationEngine } from './animations/AnimationEngine';
export { TimelinePlayback } from './animations/TimelinePlayback';export type { TimelineState, TimelineChangeHandler } from './animations/TimelinePlayback';
export { TimelineControls } from './animations/TimelineControls';
export type { TimelineControlsConfig } from './animations/TimelineControls';
// â”€â”€â”€ Themes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { defaultTheme } from './themes/defaultTheme';
export { darkTheme } from './themes/darkTheme';
export { resolveTheme, createTheme, getSeriesColor, createHighContrastTheme } from './themes/ThemeEngine';

// â”€â”€â”€ Palettes (54 color schemes Ã— dark/light) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  palettes,
  getPalette,
  paletteToTheme,
  listPalettesByCategory,
  getAllThemes,
} from './themes/palettes';

// â”€â”€â”€ Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { renderAxes } from './components/Axis';
export { renderLegend } from './components/Legend';
export { renderTooltip, createTooltipHTML } from './components/Tooltip';
export { renderAnnotations } from './components/Annotations';

// â”€â”€â”€ Charts (Standard) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { renderChart } from './charts/index';
export { renderGanttChart } from './charts/GanttChart';
export { renderHistogramChart } from './charts/HistogramChart';
export { renderOHLCChart } from './charts/OHLCChart';
export { renderParetoChart } from './charts/ParetoChart';
export { renderLollipopChart } from './charts/LollipopChart';
export { renderTimelineChart } from './charts/TimelineChart';
export { renderMapChart } from './charts/MapChart';
export type { MapChartConfig } from './charts/MapChart';
export { renderCalendarHeatmap } from './charts/CalendarHeatmap';
export type { CalendarHeatmapConfig } from './charts/CalendarHeatmap';
export { renderWordCloud } from './charts/WordCloudChart';
export type { WordCloudConfig } from './charts/WordCloudChart';
export { renderDependencyWheel } from './charts/DependencyWheelChart';
export type { DependencyWheelConfig, DependencyWheelNode, DependencyWheelLink } from './charts/DependencyWheelChart';
export { renderOrgChart } from './charts/OrgChart';
export type { OrgChartConfig, OrgNode, OrgEdge, OrgLayoutDirection } from './charts/OrgChart';
export { renderPackedBubble } from './charts/PackedBubbleChart';
export type { PackedBubbleConfig } from './charts/PackedBubbleChart';
export { renderMarimekko } from './charts/MarimekkoChart';
export type { MarimekkoConfig, MarimekkoDataPoint } from './charts/MarimekkoChart';
export { renderVennDiagram } from './charts/VennDiagram';
export type { VennConfig, VennSet, VennIntersection } from './charts/VennDiagram';
export { renderItemChart } from './charts/ItemChart';
export type { ItemChartConfig, ItemSeriesConfig, ItemShape, ItemLayout } from './charts/ItemChart';

// â”€â”€â”€ New Batch 2 Charts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { renderStreamgraph } from './charts/StreamgraphChart';
export { renderXRange } from './charts/XRangeChart';
export type { XRangeDataPoint, XRangeConfig } from './charts/XRangeChart';
export { renderSolidGauge } from './charts/SolidGaugeChart';
export type { SolidGaugeConfig } from './charts/SolidGaugeChart';
export { renderTilemap } from './charts/TilemapChart';
export type { TilemapConfig, TilemapDataPoint, TileShape } from './charts/TilemapChart';
export { renderTreeGraph } from './charts/TreeGraph';
export type { TreeGraphConfig, TreeGraphNode, TreeGraphDirection, TreeGraphLinkShape } from './charts/TreeGraph';
export { renderColumnRange, renderDumbbellChart } from './charts/ColumnRangeChart';
export type { ColumnRangeConfig, DumbbellConfig } from './charts/ColumnRangeChart';
export { renderBellCurve } from './charts/BellCurveChart';
export type { BellCurveConfig } from './charts/BellCurveChart';

// â”€â”€â”€ Stock Chart (Highcharts Stock equivalent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { createStockChart } from './charts/StockChart';
export type { StockChartConfig, IndicatorConfig } from './charts/StockChart';

// â”€â”€â”€ Charts (Advanced / Specialized) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  renderPolarChart,
  renderSmithChart,
  renderContourChart,
  renderVectorFieldChart,
  renderAltimeterGauge,
  renderAttitudeIndicator,
  renderCompassRose,
  renderSpectrumAnalyzer,
  renderOscilloscope,
  renderNetworkTopology,
  renderFlameChart,
  renderWindRose,
  renderStripChart,
  renderErrorBand,
  renderHorizonChart,
  renderBulletChart,
  renderSparklineChart,
  renderViolinChart,
  renderSunburstChart,
  renderChordDiagram,
  // Navigator (stock charting)
  renderNavigatorChart,
  getNavigatorBounds,
  hitTestNavigator,
  updateNavigatorDrag,
  startNavigatorDrag,
  stopNavigatorDrag,
  // Range selector
  renderRangeSelector,
  computeRangeForButton,
  rangeToMs,
  DEFAULT_RANGE_BUTTONS,
} from './charts/advanced/index';
export type {
  NavigatorConfig,
  NavigatorState,
  RangeSelectorConfig,
  RangeSelectorButton,
} from './charts/advanced/index';

// â”€â”€â”€ 3D Engine & Charts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Plugins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  createPlugin,
  composePlugins,
  exportPlugin,
  dataLabelsPlugin,
  responsivePlugin,
  // Export plugin utilities
  ExportPlugin,
  exportToCSV,
  exportToJSON,
  downloadFile,
  exportSVGToRaster,
  exportChartToPDF,
  exportToXLSX,
  getChartSVG,
  serializeSVG,
  // Statistics
  StatisticsPlugin,
  renderStatistics,
  // Data Table
  DataTablePlugin,
  attachDataTable,
  // Print
  PrintPlugin,
  printChart,
} from './plugins/index';
export type {
  StatisticsPluginConfig,
  RegressionSeries,
  MovingAverageSeries,
  RegressionType,
  DataTableConfig,
  PrintConfig,
} from './plugins/index';
export { DataLabelsPlugin, renderDataLabels } from './plugins/DataLabelsPlugin';
export type { DataLabelsConfig } from './plugins/DataLabelsPlugin';

// â”€â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export * as colorUtils from './utils/color';
export * as mathUtils from './utils/math';
export * as formatUtils from './utils/format';
export { escapeHtml, sanitizeSVG, safeColor } from './utils/sanitize';

// â”€â”€â”€ Boost Module (Web Worker data processing for 1M+ points) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  BoostWorker,
  lttbSync,
  minMaxSync,
  createBoostDecimator,
} from './boost/index';
export type { BoostOptions, BoostOperation } from './boost/index';

// â”€â”€â”€ Web Component adapter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { RiskLabChartElement, defineRiskLabElement } from './adapters/webcomponent/RiskLabElement';

// â”€â”€â”€ Vue 3 Adapter: import from '@risklab/charts/vue' (peer dep: vue@^3) â”€â”€â”€â”€â”€
// Vue hooks are NOT re-exported here to avoid forcing bundlers to resolve the
// optional 'vue' peer-dep for non-Vue users. Use the dedicated sub-path:
//   import { useChart, useTheme, useSync } from '@risklab/charts/vue';

// â”€â”€â”€ StyleX / xstyle Adapter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  stylexToTheme,
  chartStyles,
  themeToCSSVars,
  applyThemeCSSVars,
  mergeClassNames,
} from './adapters/stylex/index';

// â”€â”€â”€ SDK â€” Fluent ChartBuilder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { ChartBuilder, BoundChartBuilder, chart, charts } from './sdk/index';
export type { PointInput, NumericPair, DataInput } from './sdk/index';

// â”€â”€â”€ Vanilla JS Adapter (zero-framework, works everywhere) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { mount, autoInit, RiskLabAlpine, getStimulusControllerSource } from './adapters/vanilla/index';
export type { VanillaChartInstance } from './adapters/vanilla/index';

// â”€â”€â”€ Angular Adapter (Google) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  createAngularChart,
  getAngularComponentSource,
  getAngularServiceSource,
} from './adapters/angular/index';
export type { AngularChartRef } from './adapters/angular/index';

// â”€â”€â”€ Svelte Adapter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  createSvelteChart,
  getSvelteComponentSource,
  getSvelte5ComponentSource,
  getSvelteStoreSource,
} from './adapters/svelte/index';
export type { SvelteChartRef } from './adapters/svelte/index';

// â”€â”€â”€ Lit Element Adapter (Google) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { createLitChart, getLitComponentSource } from './adapters/lit/index';
export type { LitChartRef } from './adapters/lit/index';

// â”€â”€â”€ PivotChart â€” data-source driven cross-tabulation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { pivotToChartConfig, pivotToMultiView, crossTabulate } from './charts/PivotChart';
export type {
  PivotConfig,
  PivotDataSource,
  PivotAggregation,
  PivotResult,
  PivotResultCell,
  PivotSortConfig,
} from './charts/PivotChart';

// â”€â”€â”€ DateTime Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  parseDate,
  detectTimeAxis,
  getTickInterval,
  alignToInterval,
  generateTimeTicks,
  formatAxisDate,
  formatTooltipDate,
  relativeTo,
  formatDuration,
  tzOffsetMs,
  toTimezone,
  addTime,
  clampDate,
  startOfDay,
  startOfMonth,
  startOfYear,
  dayOfWeek,
  isoWeek,
  sameDay,
  MS,
} from './utils/datetime';
export type { DateLike, TickIntervalDescriptor, TimeUnit } from './utils/datetime';

// â”€â”€â”€ Data Connectors â€” CSV, JSON, REST, WebSocket, SSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export {
  parseCSV,
  fetchCSV,
  readCSVFile,
  fetchJSON,
  mapJSON,
  createRestConnector,
  createWebSocketConnector,
  createSseConnector,
} from './data/connectors';
export type {
  DataFeed,
  FieldMapper,
  CsvConnectorOptions,
  JsonConnectorOptions,
  RestConnectorOptions,
  WebSocketConnectorOptions,
  SseConnectorOptions,
} from './data/connectors';

// â”€â”€â”€ RiskLab â€” top-level namespace (one import to rule them all) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { RiskLab } from './sdk/RiskLab';
export type { RiskLabNamespace } from './sdk/RiskLab';
export { GRAPH_3D_CHART_TYPES } from './experimental/index';
export type { Graph3DChartType, Graph3DRenderableData } from './experimental/index';
