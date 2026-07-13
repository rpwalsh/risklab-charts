// ============================================================================
// RiskLab Charts — Main Entry Point
// @risklab/charts
// ============================================================================

// ─── Core ───────────────────────────────────────────────────────────────────
export { Engine } from './core/Engine';
export { LegacyChartAPI, legacyChart, legacyStockChart, fromLegacyChartOptions } from './adapters/legacy-config';
export type { LegacyChartOptions, LegacySeriesOptions, LegacyAxisOptions, LegacyCompatibleChart, LegacyCompatibleSeries, LegacyChartPoint } from './adapters/legacy-config';
export type { EngineInternalAPI, SyncableChart, EngineChartConfig } from './core/Engine';
export { EventBus } from './core/EventBus';
export { Registry, registry } from './core/Registry';
export { DataPipeline, decimateLTTB, decimateMinMax } from './core/DataPipeline';
export { SpatialIndex, nearestSortedIndex } from './core/SpatialIndex';
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
  OpenTopoConfig,
  Terrain3DConfig,
  Challenge3DConfig,
  ChartConfig,
  ResolvedScale,
  ChartState,
  ChartEventType,
  ChartEventHandler,
  ScaleType,
} from './core/types';

// ─── Renderers ──────────────────────────────────────────────────────────────
export { BaseRenderer } from './renderers/BaseRenderer';
export { SVGRenderer } from './renderers/SVGRenderer';
export { CanvasRenderer } from './renderers/CanvasRenderer';

// ─── Scales ─────────────────────────────────────────────────────────────────
export { createScale } from './scales/index';

// ─── Animations ─────────────────────────────────────────────────────────────
export { AnimationEngine } from './animations/AnimationEngine';
export { TimelinePlayback } from './animations/TimelinePlayback';export type { TimelineState, TimelineChangeHandler } from './animations/TimelinePlayback';
export { TimelineControls } from './animations/TimelineControls';
export type { TimelineControlsConfig } from './animations/TimelineControls';
// ─── Themes ─────────────────────────────────────────────────────────────────
export { defaultTheme } from './themes/defaultTheme';
export { darkTheme } from './themes/darkTheme';
export { resolveTheme, createTheme, getSeriesColor, createHighContrastTheme } from './themes/ThemeEngine';

// ─── Palettes (54 color schemes × dark/light) ──────────────────────────────
export {
  palettes,
  getPalette,
  paletteToTheme,
  listPalettesByCategory,
  getAllThemes,
} from './themes/palettes';

// ─── Components ─────────────────────────────────────────────────────────────
export { renderAxes } from './components/Axis';
export { renderLegend } from './components/Legend';
export { renderTooltip, createTooltipHTML } from './components/Tooltip';
export { renderAnnotations } from './components/Annotations';

// ─── Charts (Standard) ─────────────────────────────────────────────────────
export { renderChart } from './charts/index';
export { BASIC_CHART_TYPES } from './charts/basic/supportedTypes';
export type { BasicChartType } from './charts/basic/supportedTypes';
export { ADVANCED_CHART_TYPES } from './charts/advanced/supportedTypes';
export type { AdvancedChartType } from './charts/advanced/supportedTypes';
export { renderGanttChart } from './charts/GanttChart';
export { renderHistogramChart } from './charts/HistogramChart';
export { renderOHLCChart } from './charts/OHLCChart';
export { renderParetoChart } from './charts/ParetoChart';
export { renderLollipopChart } from './charts/LollipopChart';
export { renderRangeAreaSeries } from './charts/RangeAreaChart';
export type { RangeAreaConfig } from './charts/RangeAreaChart';
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

// ─── New Batch 2 Charts ──────────────────────────────────────────────────────
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

// ─── Stock Chart (commercial charting Stock equivalent) ──────────────────────────────
export { createStockChart } from './charts/StockChart';
export type { StockChartConfig, IndicatorConfig } from './charts/StockChart';

// ─── Charts (Advanced / Specialized) ────────────────────────────────────────
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

// ─── 3D Engine & Charts ────────────────────────────────────────────────────

// ─── Plugins ────────────────────────────────────────────────────────────────
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

// ─── Utilities ──────────────────────────────────────────────────────────────
export * as colorUtils from './utils/color';
export * as mathUtils from './utils/math';
export * as formatUtils from './utils/format';
export { escapeHtml, sanitizeSVG, safeColor } from './utils/sanitize';

// ─── Boost Module (Web Worker data processing for 1M+ points) ───────────────
export {
  BoostWorker,
  lttbSync,
  minMaxSync,
  createBoostDecimator,
} from './boost/index';
export type { BoostOptions, BoostOperation } from './boost/index';

// ─── Web Component adapter ───────────────────────────────────────────────────
export { RiskLabChartElement, defineRiskLabElement } from './adapters/webcomponent/RiskLabElement';

// ─── Vue 3 Adapter: import from '@risklab/charts/vue' (peer dep: vue@^3) ─────
// Framework adapters ship as dedicated packages instead of root subpaths:
//   @risklab/charts-react, @risklab/charts-vue, @risklab/charts-svelte
//   @risklab/charts-angular, @risklab/charts-lit, @risklab/charts-solid

// ─── RiskLab Styler / xstyle Adapter ─────────────────────────────────────────────────
export {
  stylerTokensToTheme,
  chartStyles,
  mergeClassNames,
} from './adapters/styler/index';
export { themeToCSSVars, applyThemeCSSVars } from './themes/cssVars';

// ─── SDK — Fluent ChartBuilder ───────────────────────────────────────────────
export { ChartBuilder, BoundChartBuilder, chart, charts } from './sdk/index';
export type { PointInput, NumericPair, DataInput } from './sdk/index';

// ─── Vanilla JS Adapter (zero-framework, works everywhere) ──────────────────
export { mount, autoInit, RiskLabAlpine, getStimulusControllerSource } from './adapters/vanilla/index';
export type { VanillaChartInstance } from './adapters/vanilla/index';

// ─── Angular Adapter (Google) ────────────────────────────────────────────────

// ─── Svelte Adapter ───────────────────────────────────────────────────────────

// ─── Lit Element Adapter (Google) ────────────────────────────────────────────

// ─── PivotChart — data-source driven cross-tabulation ────────────────────────
export { pivotToChartConfig, pivotToMultiView, crossTabulate } from './charts/PivotChart';
export type {
  PivotConfig,
  PivotDataSource,
  PivotAggregation,
  PivotResult,
  PivotResultCell,
  PivotSortConfig,
} from './charts/PivotChart';

// ─── DateTime Utilities ──────────────────────────────────────────────────────
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

// ─── Data Connectors — CSV, JSON, REST, WebSocket, SSE ───────────────────────
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

// ─── RiskLab — top-level namespace (one import to rule them all) ────────────────
export { RiskLab } from './sdk/RiskLab';
export type { RiskLabNamespace } from './sdk/RiskLab';
// ——— Scenes (3D) ————————————————————————————————————————————————————————
export { Graph3DScene, normalizeGraph3DSeries, GRAPH_3D_CHART_TYPES } from './scenes/index';
export type { Graph3DChartType, Graph3DRenderableData } from './scenes/index';
export { Terrain3DScene, TERRAIN_3D_CHART_TYPES } from './scenes/index';
export type { Terrain3DChartType } from './scenes/index';
export { Challenge3DScene, CHALLENGE_3D_CHART_TYPES } from './scenes/index';
export type { Challenge3DChartType } from './scenes/index';
export { THREE_D_CHART_TYPES } from './scenes/index';
export type { Production3DChartType } from './scenes/index';
export { fetchOpenTopoPoints, parseAAIGrid, aaigridToPoints } from './scenes/openTopo';
export type { AAIGridData, OpenTopoGlobalDemType, OpenTopoUSGSDemType } from './scenes/openTopo';
