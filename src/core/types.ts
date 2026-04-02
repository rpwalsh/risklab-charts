// ============================================================================
// RiskLab Charts — Core Type System
// Meta Level 6 Architecture: Every type is composable, extensible, serializable
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Primitive & Utility Types
// ---------------------------------------------------------------------------

/** Any data value that can appear in a chart */
export type DataValue = number | string | Date | null | undefined;

/** A single numeric point or a range */
export type NumericValue = number | [low: number, high: number];

/** Color expressed as CSS string, hex, rgba tuple, or gradient definition */
export type ColorValue = string | RGBAColor | GradientDef;

export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface GradientStop {
  offset: number; // 0–1
  color: string;
  opacity?: number;
}

export interface GradientDef {
  type: 'linear' | 'radial';
  angle?: number; // degrees, for linear
  stops: GradientStop[];
}

/** Padding / Margin specification */
export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** A 2D point */
export interface Point {
  x: number;
  y: number;
}

/** A bounding rectangle */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// 2. Data Model
// ---------------------------------------------------------------------------

/** A single data point inside a series */
export interface DataPoint {
  /** Primary x-axis value */
  x: DataValue;
  /** Primary y-axis value */
  y: DataValue;
  /** Optional secondary x value (for ranges, Gantt end time, etc.) */
  x2?: DataValue;
  /** Optional secondary y value (for ranges, OHLC, etc.) */
  y2?: DataValue;

  // ─── Candlestick / OHLC ───────────────────────────────────────────────
  /** Open value (candlestick) */
  open?: number;
  /** High value (candlestick / box plot) */
  high?: number;
  /** Low value (candlestick / box plot) */
  low?: number;
  /** Close value (candlestick) */
  close?: number;
  /** Volume (financial charts) */
  volume?: number;

  // ─── Box Plot ─────────────────────────────────────────────────────────
  /** First quartile (25th percentile) */
  q1?: number;
  /** Third quartile (75th percentile) */
  q3?: number;
  /** Median value (50th percentile) */
  median?: number;
  /** Lower whisker bound */
  whiskerLow?: number;
  /** Upper whisker bound */
  whiskerHigh?: number;
  /** Outlier values */
  outliers?: number[];

  // ─── Bubble / Heatmap ─────────────────────────────────────────────────
  /** Size dimension (bubbles) or value dimension (heatmap) */
  z?: number;

  // ─── Gantt / Timeline ─────────────────────────────────────────────────
  /** Start time or value (gantt, x-range, timeline) */
  start?: DataValue;
  /** End time or value (gantt, x-range, timeline) */
  end?: DataValue;
  /** Completion percentage 0–1 (gantt) */
  progress?: number;
  /** Dependency task IDs (gantt) */
  dependencies?: string[];
  /** Milestone flag (gantt) */
  milestone?: boolean;
  /** Assignee or resource (gantt, timeline) */
  resource?: string;

  // ─── Bullet Chart ─────────────────────────────────────────────────────
  /** Target value (bullet charts) */
  target?: number;
  /** Range bands [poor, satisfactory, good] (bullet charts) */
  ranges?: number[];

  // ─── Vector Field ─────────────────────────────────────────────────────
  /** Direction angle in degrees (vector field, wind rose) */
  angle?: number;
  /** Magnitude / strength (vector field, wind rose) */
  magnitude?: number;

  // ─── Violin / Distribution ────────────────────────────────────────────
  /** Distribution data points (violin charts) */
  distribution?: number[];
  /** Kernel density estimation bandwidth (violin) */
  bandwidth?: number;

  // ─── Flame Chart / Profiling ──────────────────────────────────────────
  /** Call stack depth (flame charts) */
  depth?: number;
  /** Self-time in ms (flame charts) */
  selfTime?: number;
  /** Total time in ms (flame charts) */
  totalTime?: number;

  // ─── Hierarchical (Sunburst, Treemap, Org Chart) ─────────────────────
  /** Parent node ID (sunburst, treemap, org chart, tree graph) */
  parent?: string;
  /** Node ID for hierarchical relationships */
  nodeId?: string;
  /** Children nodes (alternate to parent-based linking) */
  children?: DataPoint[];

  // ─── Network / Graph ──────────────────────────────────────────────────
  /** Source node ID (network, chord, sankey) */
  from?: string;
  /** Target node ID (network, chord, sankey) */
  to?: string;
  /** Edge/link weight (network, chord) */
  weight?: number;

  // ─── Engineering / Aviation Instruments ────────────────────────────────
  /** Altitude in feet or meters (altimeter) */
  altitude?: number;
  /** Pitch angle in degrees (attitude indicator) */
  pitch?: number;
  /** Roll angle in degrees (attitude indicator) */
  roll?: number;
  /** Heading in degrees (compass rose) */
  heading?: number;
  /** Frequency value in Hz (spectrum analyzer, oscilloscope) */
  frequency?: number;
  /** Amplitude / signal strength in dB (spectrum analyzer) */
  amplitude?: number;

  // ─── Word Cloud ───────────────────────────────────────────────────────
  /** Word text (word cloud) — uses label if not specified */
  word?: string;
  /** Word frequency / importance (word cloud) */
  count?: number;

  // ─── Range Charts (Column Range, Area Range, Dumbbell) ────────────────
  /** Low value of the range */
  rangeLow?: number;
  /** High value of the range */
  rangeHigh?: number;

  // ─── Drilldown ────────────────────────────────────────────────────────
  /** Optional point identifier (used for drilldown, lookup, etc.) */
  id?: string;
  /** Drilldown target key — links this point to a drilldown config */
  drilldown?: string;

  // ─── General / Extensible ─────────────────────────────────────────────
  /** Arbitrary metadata carried through to events & tooltips */
  meta?: Record<string, unknown>;
  /** Optional per-point color override */
  color?: ColorValue;
  /** Optional per-point label */
  label?: string;
}

/** Describes one series to be plotted */
export interface SeriesConfig {
  /** Unique id for this series */
  id: string;
  /** Human-readable name (used in legend, tooltip) */
  name: string;
  /** Which chart type renders this series */
  type: ChartType;
  /** The data */
  data: DataPoint[];
  /** Which y-axis this series binds to (default: 'y0') */
  yAxisId?: string;
  /** Which x-axis this series binds to (default: 'x0') */
  xAxisId?: string;
  /** Series-level color */
  color?: ColorValue;
  /** Series-level visibility */
  visible?: boolean;
  /** Line width (line, area, etc.) */
  lineWidth?: number;
  /** Dash pattern */
  dashArray?: number[];
  /** Point marker style */
  marker?: MarkerConfig;
  /** Fill opacity (area, stacked) */
  fillOpacity?: number;
  /** Stack group id — series with the same stackGroup are stacked */
  stackGroup?: string;
  /** Animation overrides for this series */
  animation?: AnimationConfig;
  /** Z-index layering */
  zIndex?: number;
  /** Additional plugin-specific options */
  [pluginKey: `plugin:${string}`]: unknown;
  /** Histogram binning configuration (for histogram series) */
  histogram?: import('../charts/HistogramChart').HistogramSeriesConfig;
  /** Funnel configuration (for funnel series) */
  funnel?: {
    /** Orientation of the funnel: 'vertical' (default) or 'horizontal' (left→right) */
    orientation?: 'vertical' | 'horizontal';
  };
  /** Gauge configuration (for gauge series) */
  gauge?: {
    min?: number;
    max?: number;
    bands?: Array<{ from: number; to: number; color: string }>;
  };
  /**
   * Data decimation — automatically downsample large datasets before rendering
   * for better performance without visual loss.
   */
  decimation?: DecimationConfig;
  /** Flag indicating this is a volume series (stock charts) */
  isVolume?: boolean;
}

/** Configuration for automatic data downsampling */
export interface DecimationConfig {
  /** Enable decimation (default: true when the field is present) */
  enabled?: boolean;
  /** Target number of points after decimation (default: 1000) */
  threshold?: number;
  /** Algorithm: 'lttb' (best visual fidelity) or 'minmax' (preserves extremes) */
  algorithm?: 'lttb' | 'minmax';
}

/** Marker symbol drawn at each data point */
export interface MarkerConfig {
  enabled?: boolean;
  symbol?: 'circle' | 'square' | 'diamond' | 'triangle' | 'cross' | 'custom';
  size?: number;
  color?: ColorValue;
  borderColor?: ColorValue;
  borderWidth?: number;
  /** For 'custom' symbol — an SVG path string */
  customPath?: string;
}

// ---------------------------------------------------------------------------
// 3. Chart Types
// ---------------------------------------------------------------------------

export type ChartType =
  // ── Standard / Basic ────────────────────────────────────────────────────
  | 'line'
  | 'spline'
  | 'stepLine'
  | 'area'
  | 'rangeArea'
  | 'bar'
  | 'column'
  | 'stackedBar'
  | 'stackedColumn'
  | 'stackedArea'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'connectedScatter'
  | 'bubble'
  | 'radar'
  | 'sankey'
  | 'treemap'
  | 'heatmap'
  | 'candlestick'
  | 'ohlc'
  | 'waterfall'
  | 'funnel'
  | 'gauge'
  | 'boxPlot'
  | 'histogram'
  | 'polarArea'
  | 'sunburst'
  | 'networkGraph'
  | 'chord'
  | 'timeline'
  | 'gantt'
  | 'bullet'
  | 'sparkline'
  | 'map'
  // ── Advanced / Specialized ──────────────────────────────────────────────
  | 'polar'
  | 'smith'
  | 'contour'
  | 'vectorField'
  | 'altimeter'
  | 'attitudeIndicator'
  | 'compassRose'
  | 'spectrumAnalyzer'
  | 'oscilloscope'
  | 'networkTopology'
  | 'flameChart'
  | 'windRose'
  | 'stripChart'
  | 'errorBand'
  | 'horizonChart'
  | 'bulletChart'
  | 'sparklineChart'
  | 'violin'
  | 'sunburstChart'
  | 'chordDiagram'
  // ── New chart types ──────────────────────────────────────────────────────
  | 'lollipop'
  | 'dumbbell'
  | 'pareto'
  | 'swimlane'
  | 'calendarHeatmap'
  | 'wordCloud'
  | 'wordcloud'
  | 'dependencyWheel'
  | 'dependency-wheel'
  | 'organization'
  | 'orgChart'
  | 'packedBubble'
  | 'packed-bubble'
  | 'marimekko'
  | 'variwide'
  | 'venn'
  | 'item'
  // ── New batch 2 ─────────────────────────────────────────────────────────
  | 'streamgraph'
  | 'stream'
  | 'xrange'
  | 'x-range'
  | 'progressRing'
  | 'radialBar'
  | 'solidGauge'
  | 'solidgauge'
  | 'tilemap'
  | 'treegraph'
  | 'tree'
  | 'columnrange'
  | 'columnRange'
  | 'arearange'
  | 'bellcurve'
  | 'bellCurve'
  | 'normalDistribution'
  // ── Curated 3D / Experimental ───────────────────────────────────────────
  | 'graph3d'
  // ── Custom ──────────────────────────────────────────────────────────────
  | 'custom';

// ---------------------------------------------------------------------------
// 4. Axis Configuration
// ---------------------------------------------------------------------------

export type ScaleType = 'linear' | 'logarithmic' | 'time' | 'band' | 'ordinal' | 'point';
export type AxisPosition = 'left' | 'right' | 'top' | 'bottom';

export interface AxisConfig {
  /** Unique axis id (e.g. 'x0', 'y0', 'y1') */
  id: string;
  /** Type of scale */
  type: ScaleType;
  /** Position of the axis in the chart area */
  position: AxisPosition;
  /** Axis title */
  title?: AxisTitleConfig;
  /** Min value (auto if not set) */
  min?: number | Date;
  /** Max value (auto if not set) */
  max?: number | Date;
  /** Whether to invert the axis */
  inverted?: boolean;
  /** Grid lines configuration */
  gridLines?: GridLineConfig;
  /** Tick configuration */
  ticks?: TickConfig;
  /** Labels configuration */
  labels?: AxisLabelConfig;
  /** Show / hide the axis line */
  lineVisible?: boolean;
  lineColor?: ColorValue;
  lineWidth?: number;
  /** Opposite side (Sugar for position mirror) */
  opposite?: boolean;
  /** For band/ordinal: padding ratio 0–1 */
  padding?: number;
  /** Allow decimals on ticks */
  allowDecimals?: boolean;
  /** Soft min/max — axis will expand data beyond these but not shrink */
  softMin?: number;
  softMax?: number;
  /** Plot bands (highlighted regions) */
  plotBands?: PlotBandConfig[];
  /** Plot lines (reference lines) */
  plotLines?: PlotLineConfig[];
}

export interface AxisTitleConfig {
  text: string;
  color?: ColorValue;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  rotation?: number;
  offset?: number;
}

export interface GridLineConfig {
  enabled?: boolean;
  color?: ColorValue;
  width?: number;
  dashArray?: number[];
}

export interface TickConfig {
  enabled?: boolean;
  count?: number;
  interval?: number;
  color?: ColorValue;
  length?: number;
  width?: number;
  /** Custom tick values */
  values?: DataValue[];
}

export interface AxisLabelConfig {
  enabled?: boolean;
  /** Formatting function or pattern string */
  format?: string | ((value: DataValue, index: number) => string);
  color?: ColorValue;
  fontSize?: number;
  fontFamily?: string;
  rotation?: number;
  /** Max characters before truncation */
  maxLength?: number;
  /** Stagger overlapping labels */
  stagger?: boolean;
  /** Skip every N labels */
  step?: number;
}

export interface PlotBandConfig {
  from: number | Date;
  to: number | Date;
  color: ColorValue;
  label?: string;
  zIndex?: number;
}

export interface PlotLineConfig {
  value: number | Date;
  color: ColorValue;
  width?: number;
  dashArray?: number[];
  label?: string;
  zIndex?: number;
}

// ---------------------------------------------------------------------------
// 5. Legend Configuration
// ---------------------------------------------------------------------------

export type LegendLayout = 'horizontal' | 'vertical' | 'grid' | 'flow';
export type LegendAlign = 'left' | 'center' | 'right';
export type LegendVerticalAlign = 'top' | 'middle' | 'bottom';

export interface LegendConfig {
  enabled?: boolean;
  layout?: LegendLayout;
  align?: LegendAlign;
  verticalAlign?: LegendVerticalAlign;
  /** Float the legend on top of the chart area */
  floating?: boolean;
  /** Max height before scroll kicks in */
  maxHeight?: number;
  /** Custom item rendering */
  itemStyle?: LegendItemStyle;
  /** Custom symbol width */
  symbolWidth?: number;
  symbolHeight?: number;
  symbolRadius?: number;
  /** Reverse order */
  reversed?: boolean;
  /** Enable toggle visibility on click */
  toggleOnClick?: boolean;
  /** Show a search/filter input (for many series) */
  searchable?: boolean;
  /** Pagination when items overflow */
  pagination?: boolean;
  /** Drag-to-reorder series */
  draggable?: boolean;
  /** Margin from chart area */
  margin?: Partial<Spacing>;
  /** Background */
  backgroundColor?: ColorValue;
  borderColor?: ColorValue;
  borderWidth?: number;
  borderRadius?: number;
  /** Shadow */
  shadow?: ShadowConfig;
  /** Title above the legend */
  title?: string;
  /** Custom item formatter */
  itemFormatter?: (series: SeriesConfig, index: number) => string;
  /** Group legends by category */
  groups?: LegendGroup[];
}

export interface LegendItemStyle {
  color?: ColorValue;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  hoverColor?: ColorValue;
  inactiveColor?: ColorValue;
  cursor?: string;
}

export interface LegendGroup {
  title: string;
  seriesIds: string[];
}

export interface ShadowConfig {
  enabled?: boolean;
  color?: ColorValue;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
}

// ---------------------------------------------------------------------------
// 6. Tooltip Configuration
// ---------------------------------------------------------------------------

export type TooltipTrigger = 'hover' | 'click' | 'both';

export interface TooltipConfig {
  enabled?: boolean;
  trigger?: TooltipTrigger;
  /** Shared tooltip (all series at the same x-value) */
  shared?: boolean;
  /** Follow the cursor or snap to nearest point */
  followCursor?: boolean;
  /** Delay before showing (ms) */
  showDelay?: number;
  /** Delay before hiding (ms) */
  hideDelay?: number;
  /** Custom HTML renderer */
  formatter?: (context: TooltipContext) => string;
  /** Use React/JSX renderer (in React adapter) */
  reactRenderer?: boolean;
  /** Header format */
  headerFormat?: string;
  /** Point format */
  pointFormat?: string;
  /** Footer format */
  footerFormat?: string;
  /** Style */
  backgroundColor?: ColorValue;
  borderColor?: ColorValue;
  borderWidth?: number;
  borderRadius?: number;
  padding?: Partial<Spacing>;
  shadow?: ShadowConfig;
  /** Text style */
  style?: {
    color?: ColorValue;
    fontSize?: number;
    fontFamily?: string;
  };
  /** Crosshair */
  crosshair?: CrosshairConfig;
  /** Pin tooltip on click */
  pinnable?: boolean;
  /** Sort tooltip items by value */
  sortItems?: 'none' | 'ascending' | 'descending';
}

export interface TooltipContext {
  /** The data points under the cursor */
  points: Array<{
    series: SeriesConfig;
    point: DataPoint;
    index: number;
    color: string;
    formattedX: string;
    formattedY: string;
  }>;
  /** Raw x value */
  x: DataValue;
  /** Chart instance reference */
  chart: unknown; // Resolved at runtime
}

export interface CrosshairConfig {
  enabled?: boolean;
  axis?: 'x' | 'y' | 'both';
  color?: ColorValue;
  width?: number;
  dashArray?: number[];
  snap?: boolean;
}

// ---------------------------------------------------------------------------
// 7. Animation & Timeline
// ---------------------------------------------------------------------------

export type EasingFunction =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounceOut'
  | 'elasticOut'
  | 'cubicBezier'
  | 'spring';

export interface AnimationConfig {
  enabled?: boolean;
  /** Duration in ms */
  duration?: number;
  /** Easing function */
  easing?: EasingFunction;
  /** Delay before start (ms) */
  delay?: number;
  /** Stagger animations across series (ms per series) */
  stagger?: number;
  /** Custom cubic bezier control points */
  cubicBezier?: [number, number, number, number];
}

export interface TimelineConfig {
  /** Enable playback-over-time controls */
  enabled?: boolean;
  /** Field in DataPoint.meta to use as the time key */
  timeKey?: string;
  /** Auto-play on load */
  autoPlay?: boolean;
  /** Playback speed multiplier */
  speed?: number;
  /** Loop playback */
  loop?: boolean;
  /** Show player controls (play/pause/scrubber) */
  controls?: boolean;
  /** Frames per second */
  fps?: number;
  /** Time format for the scrubber label */
  timeFormat?: string | ((time: DataValue) => string);
  /** Transition between keyframes */
  transition?: AnimationConfig;
}

// ---------------------------------------------------------------------------
// 8. Interaction & Events
// ---------------------------------------------------------------------------

export type ChartEventType =
  | 'click'
  | 'dblclick'
  | 'hover'
  | 'leave'
  | 'select'
  | 'deselect'
  | 'zoom'
  | 'pan'
  | 'legendClick'
  | 'legendHover'
  | 'beforeRender'
  | 'afterRender'
  | 'resize'
  | 'dataUpdate'
  | 'seriesShow'
  | 'seriesHide'
  | 'annotationClick'
  | 'timelineChange'
  | 'exportStart'
  | 'exportEnd'
  | 'themeChange'
  | 'pointDrag'
  | 'pointDrop'
  | 'drillDown'
  | 'drillUp';

export interface ChartEvent<T extends ChartEventType = ChartEventType> {
  type: T;
  /** Series involved (if applicable) */
  seriesId?: string;
  /** Data point involved (if applicable) */
  point?: DataPoint;
  /** Point index */
  pointIndex?: number;
  /** Mouse/touch coordinates relative to chart */
  chartX?: number;
  chartY?: number;
  /** The original DOM event */
  originalEvent?: Event;
  /** Prevent default chart behaviour */
  preventDefault: () => void;
  /** Was default prevented? */
  defaultPrevented: boolean;
  /** Arbitrary payload from plugins */
  payload?: Record<string, unknown>;
}

export type ChartEventHandler<T extends ChartEventType = ChartEventType> = (
  event: ChartEvent<T>,
) => void;

export interface InteractionConfig {
  /** Enable zoom */
  zoom?: ZoomConfig;
  /** Enable pan */
  pan?: PanConfig;
  /** Enable selection / brush */
  selection?: SelectionConfig;
  /** Enable drag-and-drop data editing */
  draggablePoints?: boolean;
  /** Drag points config (structured) */
  dragPoints?: { enabled?: boolean; axis?: 'x' | 'y' | 'both' };
  /** Context menu */
  contextMenu?: boolean | ContextMenuItem[];
}

export interface ZoomConfig {
  enabled?: boolean;
  axis?: 'x' | 'y' | 'both';
  /** Mouse wheel zoom */
  wheel?: boolean;
  /** Pinch zoom (touch) */
  pinch?: boolean;
  /** Min zoom level (1 = 100%) */
  minZoom?: number;
  /** Max zoom level */
  maxZoom?: number;
  /** Show reset button */
  resetButton?: boolean;
}

export interface PanConfig {
  enabled?: boolean;
  axis?: 'x' | 'y' | 'both';
}

export interface SelectionConfig {
  enabled?: boolean;
  mode?: 'single' | 'multi' | 'range';
  color?: ColorValue;
}

export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: (event: ChartEvent) => void;
  separator?: boolean;
}

// ---------------------------------------------------------------------------
// 9. Annotation
// ---------------------------------------------------------------------------

export interface AnnotationConfig {
  id: string;
  type: 'label' | 'line' | 'rect' | 'circle' | 'arrow' | 'callout' | 'image' | 'custom';
  /** Position in data coordinates */
  x?: DataValue;
  y?: DataValue;
  /** Or position in pixel coordinates */
  pixelX?: number;
  pixelY?: number;
  /** For lines / arrows */
  x2?: DataValue;
  y2?: DataValue;
  /** Text content */
  text?: string;
  /** Style */
  color?: ColorValue;
  backgroundColor?: ColorValue;
  borderColor?: ColorValue;
  borderWidth?: number;
  borderRadius?: number;
  fontSize?: number;
  fontFamily?: string;
  /** Image URL */
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Draggable by user */
  draggable?: boolean;
  /** Visible */
  visible?: boolean;
  /** Attached to which axis pair */
  xAxisId?: string;
  yAxisId?: string;
  /** Custom render function (SVG element) */
  render?: (ctx: AnnotationRenderContext) => string;
  /** Z-index */
  zIndex?: number;
}

export interface AnnotationRenderContext {
  x: number;
  y: number;
  chart: unknown;
  svg: unknown;
}

// ---------------------------------------------------------------------------
// 10. Export
// ---------------------------------------------------------------------------

export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf' | 'csv' | 'json';

export interface ExportConfig {
  enabled?: boolean;
  /** Show export menu button */
  menuButton?: boolean;
  /** Available formats */
  formats?: ExportFormat[];
  /** Custom filename (without extension) */
  filename?: string;
  /** Resolution multiplier for raster export */
  scale?: number;
  /** Background color for export */
  backgroundColor?: ColorValue;
  /** Custom export handler */
  onExport?: (format: ExportFormat, data: Blob | string) => void;
}

// ---------------------------------------------------------------------------
// 11. Responsive Configuration
// ---------------------------------------------------------------------------

export interface ResponsiveRule {
  /** CSS media-query-like condition */
  condition: {
    maxWidth?: number;
    minWidth?: number;
    maxHeight?: number;
    minHeight?: number;
  };
  /** Chart option overrides to apply when condition matches */
  chartOptions: Partial<ChartConfig>;
}

// ---------------------------------------------------------------------------
// 12. Accessibility
// ---------------------------------------------------------------------------

export interface AccessibilityConfig {
  enabled?: boolean;
  /** Aria label for the chart container */
  description?: string;
  /** Announce data on keyboard navigation */
  announceDataPoints?: boolean;
  /** Point description formatter */
  pointDescriptionFormatter?: (point: DataPoint, series: SeriesConfig) => string;
  /** Summary of the chart for screen readers */
  summary?: string;
  /** Enable keyboard navigation */
  keyboardNavigation?: boolean;
  /** High-contrast mode */
  highContrast?: boolean;
}

// ---------------------------------------------------------------------------
// 13. Plugin System Types
// ---------------------------------------------------------------------------

export interface PluginHooks {
  /** Before options are resolved */
  beforeInit?: (config: ChartConfig) => ChartConfig | void;
  /** After chart is initialized */
  afterInit?: (chart: unknown) => void;
  /** Before each render cycle */
  beforeRender?: (chart: unknown) => void;
  /** After each render cycle */
  afterRender?: (chart: unknown) => void;
  /** Before data is processed */
  beforeDataProcess?: (data: SeriesConfig[]) => SeriesConfig[] | void;
  /** After data is processed */
  afterDataProcess?: (data: SeriesConfig[]) => void;
  /** Before animation frame */
  beforeAnimate?: (progress: number) => void;
  /** On chart resize */
  onResize?: (width: number, height: number) => void;
  /** On chart destroy */
  onDestroy?: () => void;
  /** On export */
  onExport?: (format: ExportFormat) => void;
  /** Before tooltip renders */
  beforeTooltip?: (context: TooltipContext) => TooltipContext | void;
  /** Custom draw call (renders after all series) */
  draw?: (renderer: unknown, chartArea: Rect) => void;
}

export interface RiskLabPlugin {
  /** Unique plugin id */
  id: string;
  /** Plugin version */
  version?: string;
  /** Plugin display name */
  name?: string;
  /** Hook implementations */
  hooks: PluginHooks;
  /** Default options this plugin introduces */
  defaults?: Record<string, unknown>;
  /** Register custom chart types */
  chartTypes?: Record<string, ChartTypeDefinition>;
}

export interface ChartTypeDefinition {
  /** Type identifier */
  type: string;
  /** Human-readable name */
  name: string;
  /** Render function */
  render: (
    renderer: unknown,
    series: SeriesConfig,
    scales: unknown,
    chartArea: Rect,
    theme: unknown,
  ) => void;
  /** Default series options */
  defaults?: Partial<SeriesConfig>;
  /** Which scales this chart type requires */
  requiredScales?: ScaleType[];
}

// ---------------------------------------------------------------------------
// 14. Theme Types
// ---------------------------------------------------------------------------

export interface ThemeConfig {
  /** Theme identifier */
  id: string;
  /** Theme display name */
  name: string;
  /** Color palette for series (auto-cycled) */
  palette: string[];
  /** Background color of the chart */
  backgroundColor: ColorValue;
  /** Default text color */
  textColor: ColorValue;
  /** Font family */
  fontFamily: string;
  /** Font size base */
  fontSize: number;
  /** Axis defaults */
  axis: {
    lineColor: ColorValue;
    gridColor: ColorValue;
    labelColor: ColorValue;
    titleColor: ColorValue;
  };
  /** Tooltip defaults */
  tooltip: {
    backgroundColor: ColorValue;
    borderColor: ColorValue;
    textColor: ColorValue;
    shadow: ShadowConfig;
  };
  /** Legend defaults */
  legend: {
    textColor: ColorValue;
    hoverColor: ColorValue;
    inactiveColor: ColorValue;
  };
  /** Color tokens (for UI framework integration) */
  colors?: {
    background?: string;
    text?: string;
    grid?: string;
    border?: string;
    [key: string]: string | undefined;
  };
  /** Typography tokens (for UI framework integration) */
  typography?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    [key: string]: string | number | undefined;
  };
  /** Additional theme tokens (for UI framework integration) */
  tokens?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 15. Renderer Types
// ---------------------------------------------------------------------------

export type RendererBackend = 'svg' | 'canvas' | 'hybrid';

export interface RendererConfig {
  /** Which rendering backend to use */
  backend?: RendererBackend;
  /** Anti-aliasing (canvas only) */
  antialias?: boolean;
  /** Device pixel ratio override */
  devicePixelRatio?: number;
}

// ---------------------------------------------------------------------------
// 16. Sankey-Specific Types
// ---------------------------------------------------------------------------

export interface SankeyNode {
  id: string;
  name: string;
  color?: ColorValue;
  /** Column position (0-based) */
  column?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: ColorValue;
}

export interface SankeyConfig {
  nodes: SankeyNode[];
  links: SankeyLink[];
  nodeWidth?: number;
  nodePadding?: number;
  /** Alignment: left, right, center, justify */
  nodeAlignment?: 'left' | 'right' | 'center' | 'justify';
  /** Curvature of links 0–1 */
  curvature?: number;
}

// ---------------------------------------------------------------------------
// 17. Heatmap-Specific Types
// ---------------------------------------------------------------------------

export interface HeatmapConfig {
  /** Color scale range */
  colorScale?: {
    min: ColorValue;
    max: ColorValue;
    /** Number of color buckets (for discrete scale) */
    steps?: number;
  };
  /** Cell border */
  cellBorderColor?: ColorValue;
  cellBorderWidth?: number;
  cellBorderRadius?: number;
}

// ---------------------------------------------------------------------------
// 18. Gauge-Specific Types
// ---------------------------------------------------------------------------

export interface GaugeConfig {
  min?: number;
  max?: number;
  /** Bands / zones */
  bands?: GaugeBand[];
  /** Start angle in degrees */
  startAngle?: number;
  /** End angle in degrees */
  endAngle?: number;
  /** Show numeric value */
  showValue?: boolean;
  /** Value format */
  valueFormat?: string | ((v: number) => string);
}

export interface GaugeBand {
  from: number;
  to: number;
  color: ColorValue;
  label?: string;
}

// ---------------------------------------------------------------------------
// 19. Graph 3D Types
// ---------------------------------------------------------------------------

export interface Graph3DLink {
  source: string;
  target: string;
  weight?: number;
  color?: ColorValue;
  kind?: string;
}

export interface Graph3DWalkConfig {
  enabled?: boolean;
  count?: number;
  speed?: number;
  trailLength?: number;
}

export interface Graph3DConfig {
  /** Layout strategy. "auto" uses provided xyz positions when present and falls back to force layout. */
  layout?: 'auto' | 'fixed' | 'force';
  /** Externally controlled selected node id for linked workbench state. */
  selectedNodeId?: string;
  /** Explicit edge list. If omitted, links are inferred from point meta.edges and from/to fields. */
  links?: Graph3DLink[];
  /** Base node size multiplier. */
  nodeBaseSize?: number;
  /** Hover/selection size multiplier. */
  hoverScale?: number;
  /** Camera distance on first mount. */
  initialDistance?: number;
  /** Orbit auto-rotation when idle. */
  autoRotate?: boolean;
  /** Minimum wheel-zoom distance. */
  minDistance?: number;
  /** Maximum wheel-zoom distance. */
  maxDistance?: number;
  /** Background tint for the scene. Defaults to the chart theme background. */
  backgroundColor?: ColorValue;
  /** Edge opacity. */
  edgeOpacity?: number;
  /** Enable animated walkers and phosphor trails. */
  walks?: Graph3DWalkConfig;
}

// ---------------------------------------------------------------------------
// 20. Master Chart Configuration
// ---------------------------------------------------------------------------

export interface ChartConfig {
  /** Container element or CSS selector */
  container?: string | HTMLElement;
  /** Chart title */
  title?: {
    text: string;
    align?: 'left' | 'center' | 'right';
    color?: ColorValue;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    margin?: Partial<Spacing>;
  };
  /** Chart subtitle */
  subtitle?: {
    text: string;
    align?: 'left' | 'center' | 'right';
    color?: ColorValue;
    fontSize?: number;
  };
  /** Width (auto if not set) */
  width?: number | string;
  /** Height (auto if not set) */
  height?: number | string;
  /** Chart padding */
  padding?: Partial<Spacing>;
  /** Renderer configuration */
  renderer?: RendererConfig;
  /** All axes configurations */
  axes?: AxisConfig[];
  /** All series configurations */
  series: SeriesConfig[];
  /** Legend */
  legend?: LegendConfig;
  /** Tooltip */
  tooltip?: TooltipConfig;
  /** Animation defaults */
  animation?: AnimationConfig;
  /** Timeline / playback over time */
  timeline?: TimelineConfig;
  /** Interaction settings */
  interaction?: InteractionConfig;
  /** Annotations */
  annotations?: AnnotationConfig[];
  /** Export settings */
  export?: ExportConfig;
  /** Responsive rules */
  responsive?: ResponsiveRule[];
  /** Accessibility */
  accessibility?: AccessibilityConfig;
  /** Theme (id or full config) */
  theme?: string | ThemeConfig;
  /** Plugins */
  plugins?: RiskLabPlugin[];
  /** Sankey-specific config (when using sankey chart type) */
  sankey?: SankeyConfig;
  /** Heatmap-specific config */
  heatmap?: HeatmapConfig;
  /** Calendar heatmap-specific config (GitHub-style contribution graph) */
  calendarHeatmap?: import('../charts/CalendarHeatmap').CalendarHeatmapConfig;
  /** Gauge-specific config */
  gauge?: GaugeConfig;
  /**
   * Drill-down chart configs, keyed by point id / x value.
   * When a point with a matching id is clicked, the chart drills into this config.
   */
  drilldown?: Record<string, Partial<ChartConfig>>;
  /** Statistics overlays (regression, moving averages, etc.) */
  statistics?: import('../plugins/StatisticsPlugin').StatisticsPluginConfig;
  /** Data table configuration */
  dataTable?: import('../plugins/DataTablePlugin').DataTableConfig;
  /** Event listeners */
  events?: Partial<Record<ChartEventType, ChartEventHandler>>;
  /** Locale / i18n */
  locale?: string;
  /** Number formatting */
  numberFormat?: Intl.NumberFormatOptions;
  /** Date formatting */
  dateFormat?: Intl.DateTimeFormatOptions;
  /** Debug mode */
  debug?: boolean;
  /** Word cloud layout config */
  wordCloud?: import('../charts/WordCloudChart').WordCloudConfig;
  /** Dependency wheel config */
  dependencyWheel?: import('../charts/DependencyWheelChart').DependencyWheelConfig;
  /** Org chart config */
  orgChart?: import('../charts/OrgChart').OrgChartConfig;
  /** Packed bubble config */
  packedBubble?: import('../charts/PackedBubbleChart').PackedBubbleConfig;
  /** Marimekko / mosaic config */
  marimekko?: import('../charts/MarimekkoChart').MarimekkoConfig;
  /** Venn diagram config */
  venn?: import('../charts/VennDiagram').VennConfig;
  /** Item / parliament config */
  item?: import('../charts/ItemChart').ItemChartConfig;
  /** Solid gauge config */
  solidGauge?: import('../charts/SolidGaugeChart').SolidGaugeConfig;
  /** Progress ring config */
  progressRing?: import('../charts/SolidGaugeChart').SolidGaugeConfig;
  /** Radial bar config */
  radialBar?: import('../charts/SolidGaugeChart').SolidGaugeConfig;
  /** Tilemap config */
  tilemap?: import('../charts/TilemapChart').TilemapConfig;
  /** Tree graph config */
  treegraph?: import('../charts/TreeGraph').TreeGraphConfig;
  /** Map chart config */
  map?: import('../charts/MapChart').MapChartConfig;
  /** Streamgraph config */
  streamgraph?: { baseline?: 'silhouette' | 'wiggle' | 'zero'; smooth?: boolean };
  /** X-Range chart config */
  xrange?: import('../charts/XRangeChart').XRangeConfig;
  /** Column range chart config */
  columnRange?: import('../charts/ColumnRangeChart').ColumnRangeConfig;
  /** Range area chart config */
  rangeArea?: import('../charts/RangeAreaChart').RangeAreaConfig;
  /** Dumbbell chart config */
  dumbbell?: import('../charts/ColumnRangeChart').DumbbellConfig;
  /** Bell curve chart config */
  bellCurve?: import('../charts/BellCurveChart').BellCurveConfig;
  /** Native WebGL graph field config */
  graph3d?: Graph3DConfig;
  /** Navigator config (stock chart-style mini chart) */
  navigator?: import('../charts/advanced/NavigatorChart').NavigatorConfig;
  /** Range selector config (preset date buttons) */
  rangeSelector?: import('../charts/advanced/RangeSelector').RangeSelectorConfig;
  /** OHLC chart config */
  ohlc?: { colorUp?: string; colorDown?: string; tickWidth?: number };
  /** Pareto chart config */
  pareto?: { lineColor?: string };
  /** Lollipop chart config */
  lollipop?: { horizontal?: boolean; dotRadius?: number; stemWidth?: number };
  /** Print / export-to-print config */
  print?: import('../plugins/PrintPlugin').PrintConfig;
  /** Data labels config */
  dataLabels?: import('../plugins/DataLabelsPlugin').DataLabelsConfig;
}

// ---------------------------------------------------------------------------
// 21. Internal State Types (used by engine)
// ---------------------------------------------------------------------------

export interface ResolvedScale {
  type: ScaleType;
  domain: [number, number] | string[];
  range: [number, number];
  convert: (value: DataValue) => number;
  invert: (pixel: number) => DataValue;
  ticks: (count?: number) => DataValue[];
  bandwidth?: number;
}

export interface ChartState {
  /** Resolved dimensions */
  width: number;
  height: number;
  /** Inner chart area after padding / axes */
  chartArea: Rect;
  /** Resolved scales per axis id */
  scales: Map<string, ResolvedScale>;
  /** Active series (visible only) */
  activeSeries: SeriesConfig[];
  /** Currently hovered point */
  hoveredPoint?: { seriesId: string; index: number };
  /** Currently selected points */
  selectedPoints: Array<{ seriesId: string; index: number }>;
  /** Zoom level */
  zoomLevel: { x: number; y: number };
  /** Pan offset */
  panOffset: Point;
  /** Current timeline frame (if timeline enabled) */
  timelineFrame?: number;
  /** Tooltip currently visible */
  tooltipVisible: boolean;
  /** Is currently animating */
  animating: boolean;
  /** Estimated pixel footprint of bottom axis (labels + title) — set by Engine for Legend use */
  axisBottomFootprint?: number;
  /** Estimated pixel footprint of top axis (labels + title) — set by Engine for Legend use */
  axisTopFootprint?: number;
}
