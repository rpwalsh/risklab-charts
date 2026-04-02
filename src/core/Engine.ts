// ============================================================================
// RiskLab Charts — Core Engine
// The central orchestrator: owns config, state, pipeline, renderer, plugins
// ============================================================================

import type {
  AxisConfig,
  ChartConfig,
  ChartEvent,
  ChartState,
  ChartEventType,
  ChartEventHandler,
  ContextMenuItem,
  GradientDef,
  GradientStop,
  Spacing,
  RiskLabPlugin,
  ThemeConfig,
  SeriesConfig,
  RendererBackend,
  ScaleType,
  DataPoint,
  AnnotationConfig,
} from './types';
import { EventBus } from './EventBus';
import { registry } from './Registry';
import { DataPipeline, type ProcessedSeries, type ProcessedDataPoint } from './DataPipeline';
import { defaultTheme } from '../themes/defaultTheme';
import { darkTheme } from '../themes/darkTheme';
import { getAllThemes } from '../themes/palettes';
import { createScale } from '../scales';
import type { BaseRenderer } from '../renderers/BaseRenderer';
import { SVGRenderer } from '../renderers/SVGRenderer';
import { CanvasRenderer } from '../renderers/CanvasRenderer';
import { AnimationEngine } from '../animations/AnimationEngine';
import { TimelinePlayback, type TimelineState } from '../animations/TimelinePlayback';
import { renderChart } from '../charts';
import { renderAxes } from '../components/Axis';
import { renderLegend } from '../components/Legend';
import { renderAnnotations } from '../components/Annotations';
import { createTooltipHTML } from '../components/Tooltip';
import { renderDataLabels } from '../plugins/DataLabelsPlugin';
import { renderStatistics } from '../plugins/StatisticsPlugin';
import {
  renderNavigatorChart,
  hitTestNavigator,
  updateNavigatorDrag,
  startNavigatorDrag,
  stopNavigatorDrag,
} from '../charts/advanced/NavigatorChart';
import {
  renderRangeSelector,
  computeRangeForButton,
  DEFAULT_RANGE_BUTTONS,
  type RangeSelectorConfig,
  type RangeSelectorButton,
} from '../charts/advanced/RangeSelector';
import { Graph3DScene } from '../experimental/Graph3DScene';

// ── Public-facing type interfaces for adapter / plugin access ──────────────

/**
 * Internal API surface that adapters and plugins may access on an Engine
 * instance. These methods exist on Engine but may be private — use this
 * interface with `as unknown as EngineInternalAPI` instead of `as any`.
 */
export interface EngineInternalAPI {
  // Public API methods
  readonly id: string;
  update(config: Partial<ChartConfig>): void;
  setData(series: import('./types').SeriesConfig[]): void;
  addSeries(series: import('./types').SeriesConfig): void;
  removeSeries(id: string): void;
  toggleSeries(id: string): void;
  setTheme(theme: string | import('./types').ThemeConfig): void;
  getTheme(): import('./types').ThemeConfig;
  getConfig(): Readonly<ChartConfig>;
  getState(): Readonly<ChartState>;
  getEventBus(): import('./EventBus').EventBus;
  getProcessedData(): import('./DataPipeline').ProcessedSeries[];
  on<T extends ChartEventType>(type: T, handler: import('./types').ChartEventHandler<T>): () => void;
  render(): void;
  resize(width?: number, height?: number): void;
  destroy(): void;
  export(format?: 'png' | 'svg' | 'jpeg'): Promise<Blob | string>;
  zoomToRange(axisId: string, min: number, max: number): void;
  resetZoom(): void;
  addPoint(seriesId: string, point: DataPoint, options?: { shift?: boolean; redraw?: boolean; maxPoints?: number }): void;
  addPoints(seriesId: string, points: DataPoint[], options?: { maxPoints?: number; redraw?: boolean }): void;
  updatePoint(seriesId: string, index: number, update: Partial<DataPoint>): void;
  drillDown(config: Partial<ChartConfig>, maxDepth?: number): void;
  drillUp(): void;
  setAnnotation(annotation: AnnotationConfig): void;
  removeAnnotation(id: string): void;

  // Private / internal properties accessed by adapters & SyncController
  state: ChartState;
  container: HTMLElement | null;

  // Dynamic properties attached by plugins (e.g. PrintPlugin)
  _printChart?: () => void;

  // Internal sync methods (may not exist on all Engine instances)
  _drawSyncCrosshair?(px: number, py: number): void;
  renderCrosshairAt?(px: number, py: number): void;
  _clearSyncCrosshair?(): void;
  clearCrosshair?(): void;
}

/**
 * Subset of Engine API needed by SyncController for cross-chart
 * synchronization. Keeps the coupling surface small.
 */
export interface SyncableChart {
  readonly id: string;
  on<T extends ChartEventType>(type: T, handler: import('./types').ChartEventHandler<T>): () => void;
  zoomToRange(axisId: string, min: number, max: number): void;
  render(): void;

  // Accessed as internal state for coordinate conversion
  state: ChartState;

  // Optional sync crosshair methods
  _drawSyncCrosshair?(px: number, py: number): void;
  renderCrosshairAt?(px: number, py: number): void;
  _clearSyncCrosshair?(): void;
  clearCrosshair?(): void;
}

/**
 * Extended ChartConfig that includes internal adapter flags.
 * Use this when passing extra flags that are not part of the public ChartConfig.
 */
export interface EngineChartConfig extends ChartConfig {
  /** When true, disables the Engine's built-in ResizeObserver (used by React adapter). */
  _disableResize?: boolean;
}

/** Monotonic counter used to produce stable, unique Engine IDs.
 * Avoids relying on Date.now() + Math.random(), which breaks SSR snapshots
 * and produces non-deterministic output across test runs. */
let _engineCounter = 0;

/** Minimum padding — adaptive layout will expand as needed */
const MIN_PADDING: Spacing = { top: 16, right: 16, bottom: 16, left: 16 };

/**
 * Chart types that are inherently non-Cartesian and should never show axes.
 * The engine will skip axis inference, layout estimation, and rendering for these.
 */
const AXISLESS_TYPES = new Set([
  'pie', 'donut', 'radar', 'sankey', 'funnel', 'gauge', 'treemap',
  'sunburst', 'chord', 'chordDiagram', 'wordCloud', 'wordcloud',
  'dependencyWheel', 'dependency-wheel', 'organization', 'orgChart',
  'packedBubble', 'packed-bubble', 'venn', 'item', 'solidGauge', 'solidgauge',
  'tilemap', 'map', 'calendarHeatmap', 'networkTopology', 'networkGraph',
  'altimeter', 'attitudeIndicator', 'compassRose', 'windRose',
  'polar', 'polarArea',
  'bullet', 'bulletChart',
  'flameChart',
  'oscilloscope',
  'graph3d',
]);

/** Estimate vertical space for a title/subtitle line */
function estimateTitleHeight(text: string | undefined, fontSize: number): number {
  if (!text) return 0;
  return fontSize * 1.4 + 6; // line-height + margin
}

/** Estimate space needed by axis labels on a given side */
function estimateAxisLabelSpace(
  axes: AxisConfig[],
  position: 'bottom' | 'top' | 'left' | 'right',
  theme: ThemeConfig,
  config?: ChartConfig,
  containerWidth = 800,
): number {
  const matching = axes.filter(a => a.position === position);
  if (matching.length === 0) return 0;
  let space = 0;
  for (const axis of matching) {
    const labelSize = axis.labels?.fontSize ?? theme.fontSize;
    const rotation = axis.labels?.rotation ?? 0;
    const hasLabels = axis.labels?.enabled !== false;
    const hasTitle = !!axis.title?.text;
    const titleSize = axis.title?.fontSize ?? 13;

    if (hasLabels) {
      if (position === 'bottom' || position === 'top') {
        // Predict whether auto-rotation will kick in at render time.
        // The Axis renderer auto-rotates to -45° if average label width
        // exceeds ~85 % of the available per-tick spacing.
        let effectiveRotation = rotation;
        let maxLabelLen = 0;

        if (effectiveRotation === 0 && config) {
          const isCat = axis.type === 'band' || axis.type === 'ordinal' || axis.type === 'point';
          const isTime = axis.type === 'time';
          // Count distinct x-categories/ticks across all series
          const catSet = new Set<string>();
          for (const s of config.series) {
            for (const d of s.data) {
              const lbl = String(d.x ?? '');
              catSet.add(lbl);
              if (lbl.length > maxLabelLen) maxLabelLen = lbl.length;
            }
          }

          // For time axes, estimate label length from the adaptive formatter:
          // The new formatter produces labels like "Jan '23" (7 chars) or "Mar 7" (5 chars).
          // Estimate tick count ≈ 8 (default) for time axis; use date label length ~7 chars.
          if (isTime) {
            maxLabelLen = 7; // e.g. "Jan '23"
            const estTickCount = axis.ticks?.count ?? 8;
            const avgLabelW = maxLabelLen * labelSize * 0.6;
            const estPerTick = containerWidth / Math.max(estTickCount, 1);
            if (avgLabelW > estPerTick * 0.85) {
              effectiveRotation = -45;
            }
          }

          // For category axes with many long labels, predict auto-rotation
          if (isCat && catSet.size > 0) {
            const avgLabelW = maxLabelLen * labelSize * 0.6;
            const estPerTick = containerWidth / catSet.size;
            if (avgLabelW > estPerTick * 0.85) {
              effectiveRotation = -45;
            }
          }
        }

        // Budget vertical space to match the Axis renderer's placement:
        //   non-rotated: tick(5) + gap(3) + labelHeight/2 + extra clearance
        //   rotated:     sin(θ) × avgCharWidth × charCount + baseline
        const rotChars = maxLabelLen > 0 ? maxLabelLen : 6;
        const labelHeight = effectiveRotation !== 0
          ? Math.max(
              Math.abs(Math.sin(Math.abs(effectiveRotation) * Math.PI / 180)) * rotChars * (labelSize * 0.6) + labelSize * 0.5 + 10,
              labelSize + 24,
            )
          : labelSize + 24; // tick(5) + gap(7) + label(~12) + clearance
        space += labelHeight;
      } else {
        // Vertical axis: estimate max label width from data
        // Labels are formatted numbers (e.g. "100", "1.2k", "3.5M") or strings
        let maxChars = 4; // default for short numbers like "100"
        if (config) {
          for (const s of config.series) {
            for (const d of s.data) {
              const val = position === 'left'
                ? d.y
                : d.x;
              const len = String(val ?? '').length;
              if (len > maxChars) maxChars = Math.min(len, 10);
            }
          }
        }
        const estLabelW = maxChars * labelSize * 0.6;
        space += estLabelW + 26; // tick(5) + gap(6) + label width + extra clearance
      }
    }
    if (hasTitle) {
      // Must match the Axis renderer's title placement:
      // title centre sits at labelZone + titleSize * 0.8 from axis line.
      // We need clearance for the full title height (half above + half below centre)
      space += titleSize * 1.3 + 8;
    }
  }
  return space;
}

/** Estimate space for legend at given position */
function estimateLegendSpace(
  config: ChartConfig,
  theme: ThemeConfig,
  containerWidth = 600,
): { top: number; bottom: number; left: number; right: number } {
  const result = { top: 0, bottom: 0, left: 0, right: 0 };
  // Match the Legend renderer's default: legend is enabled unless explicitly
  // disabled. When config.legend is undefined, Legend.ts still renders with
  // { enabled: true, layout: 'horizontal', verticalAlign: 'bottom' }.
  const legend = config.legend ?? {};
  if (legend.enabled === false || legend.floating) return result;

  const seriesCount = config.series.length;
  if (seriesCount === 0) return result;

  const layout = legend.layout ?? 'horizontal';
  const vAlign = legend.verticalAlign ?? 'bottom';
  const align = legend.align ?? 'center';
  const itemHeight = 22;
  const fontSize = legend.itemStyle?.fontSize ?? theme.fontSize;

  if (layout === 'horizontal') {
    // Estimate row count
    const avgLabelW = config.series.reduce((s, sr) => s + (sr.name?.length ?? 6), 0) / seriesCount;
    const itemW = avgLabelW * (fontSize * 0.6) + 30;
    const availableW = Math.max(containerWidth * 0.8, 200); // use actual container width
    const itemsPerRow = Math.max(1, Math.floor(availableW / itemW));
    const rows = Math.ceil(seriesCount / itemsPerRow);
    const legendH = rows * (itemHeight + 4) + 12; // 12px = gap between axis title and legend row

    if (vAlign === 'bottom') result.bottom += legendH;
    else if (vAlign === 'top') result.top += legendH;
  } else {
    // Vertical legend — estimate width from longest series name
    const fontSize = legend.itemStyle?.fontSize ?? theme.fontSize;
    const maxNameLen = config.series.reduce((mx, s) => Math.max(mx, (s.name ?? '').length), 6);
    const legendW = Math.min(maxNameLen * fontSize * 0.6 + 30, 220); // symbol + padding + text, capped at 220
    if (align === 'right') result.right += legendW;
    else if (align === 'left') result.left += legendW;
  }

  return result;
}

/**
 * The RiskLab Charts Engine.
 *
 * Usage:
 * ```ts
 * const chart = new Engine({
 *   container: '#my-chart',
 *   series: [{ id: 's1', name: 'Revenue', type: 'line', data: [...] }],
 * });
 * ```
 */
export class Engine {
  readonly id: string;
  private config: ChartConfig;
  private state: ChartState;
  private bus: EventBus;
  private pipeline: DataPipeline;
  private renderer!: BaseRenderer;
  private animationEngine: AnimationEngine;
  private timelinePlayback: TimelinePlayback | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver?: ResizeObserver;
  private processedSeries: ProcessedSeries[] = [];
  private theme: ThemeConfig;
  private activePlugins: RiskLabPlugin[] = [];
  private destroyed = false;

  // ── Interaction state ────────────────────────────────────────────────────
  private tooltipEl: HTMLElement | null = null;
  private hoverPulseEl: HTMLElement | null = null;
  private contextMenuEl: HTMLElement | null = null;
  private isDragging = false;
  private dragButton = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartOffset: { x: number; y: number } = { x: 0, y: 0 };
  /** Domain snapshot taken at the start of each pan gesture (mouseDown / touchStart).
   *  Kept separate from originalDomains so zoom state is preserved when panning. */
  private panStartDomains = new Map<string, [number, number] | string[]>();
  private selectionOverlay: HTMLElement | null = null;
  private graph3DScene: Graph3DScene | null = null;
  private selectionStartX = 0;
  private selectionStartY = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = { x: 1, y: 1 };
  private pinchStartDomains: { x?: [number, number]; y?: [number, number] } = {};

  // Saved original axis domains for zoom/pan reset
  private originalDomains = new Map<string, [number, number] | string[]>();

  // Crosshair tracking
  private crosshairX = -1;
  private crosshairY = -1;

  /** Returns true when the target element belongs to a self-managed interactive
   *  surface (e.g. the tile-map canvas) that handles its own mouse/wheel/touch. */
  private isSelfManagedTarget(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    // Tile map canvas has data-uc-tilemap attribute
    if (t.hasAttribute?.('data-uc-tilemap')) return true;
    if (t.closest?.('[data-uc-tilemap]')) return true;
    if (t.hasAttribute?.('data-uc-graph3d')) return true;
    if (t.closest?.('[data-uc-graph3d]')) return true;
    return false;
  }

  // Sticky tooltip: pinned by click, dismissed by click-away
  private tooltipPinned = false;

  // Navigator state
  private navigatorDragging: 'left' | 'right' | 'range' | null = null;
  private navigatorDragStartX = 0;
  private rangeSelectorSelectedIdx = -1;

  // Draggable data points
  private draggingPoint: { seriesId: string; index: number; origY: number } | null = null;

  // Drill-down stack
  private drillStack: ChartConfig[] = [];

  // Bound event listeners (stored for removal)
  private _onMouseMove: (e: MouseEvent) => void = () => {};
  private _onMouseDown: (e: MouseEvent) => void = () => {};
  private _onMouseUp: (e: MouseEvent) => void = () => {};
  private _onMouseLeave: (e: MouseEvent) => void = () => {};
  private _onClick: (e: MouseEvent) => void = () => {};
  private _onDblClick: (e: MouseEvent) => void = () => {};
  private _onWheel: (e: WheelEvent) => void = () => {};
  private _onContextMenu: (e: MouseEvent) => void = () => {};
  private _onTouchStart: (e: TouchEvent) => void = () => {};
  private _onTouchMove: (e: TouchEvent) => void = () => {};
  private _onTouchEnd: (e: TouchEvent) => void = () => {};

  constructor(config: ChartConfig) {
    this.id = `uc-${++_engineCounter}`;
    this.bus = new EventBus();
    this.pipeline = new DataPipeline();
    this.animationEngine = new AnimationEngine();

    // Register built-in themes (guard prevents duplicates when multiple Engine instances are created)
    if (!registry.getTheme(defaultTheme.id)) registry.registerTheme(defaultTheme);
    if (!registry.getTheme(darkTheme.id)) registry.registerTheme(darkTheme);
    // Auto-register all 50 palette themes (light+dark) — skip already-registered ones
    for (const t of getAllThemes()) {
      if (!registry.getTheme(t.id)) registry.registerTheme(t);
    }

    // Resolve theme
    this.theme = this.resolveTheme(config.theme);

    // Apply plugin beforeInit hooks
    this.config = this.applyPluginHook('beforeInit', config) ?? config;

    // Initialize state
    this.state = this.createInitialState();

    // Mount
    if (typeof window !== 'undefined' && config.container) {
      this.mount(config.container);
    }

    // Register event listeners from config
    if (config.events) {
      for (const [type, handler] of Object.entries(config.events)) {
        if (handler) {
          this.bus.on(type as ChartEventType, handler);
        }
      }
    }

    // Init plugins
    this.initPlugins(config.plugins ?? []);

    // Init timeline if configured
    if (config.timeline?.enabled) {
      this.initTimeline();
    }

    // Initial render
    this.render();
  }

  // ---- Public API ----

  /** Update chart configuration and re-render */
  update(config: Partial<ChartConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.theme) {
      this.theme = this.resolveTheme(config.theme);
    }
    if (config.series) {
      this.bus.emit('dataUpdate', {});
    }
    this.render();
  }

  /** Replace all series data */
  setData(series: SeriesConfig[]): void {
    this.config.series = series;
    this.bus.emit('dataUpdate', {});
    this.render();
  }

  /** Add a series dynamically */
  addSeries(series: SeriesConfig): void {
    this.config.series.push(series);
    this.bus.emit('dataUpdate', {});
    this.render();
  }

  /**
   * Append a single data point to an existing series.
   * Optimized for real-time / high-frequency data streaming.
   *
   * @param seriesId  - target series' id
   * @param point     - the new data point
   * @param options.shift   - if true, remove the oldest point to maintain window size
   * @param options.redraw  - immediately redraw (default: true)
   * @param options.maxPoints - cap series length, discarding oldest (overrides shift count)
   */
  addPoint(
    seriesId: string,
    point: DataPoint,
    options: { shift?: boolean; redraw?: boolean; maxPoints?: number } = {},
  ): void {
    const series = this.config.series.find((s) => s.id === seriesId);
    if (!series) return;

    series.data.push(point);

    if (options.maxPoints != null && series.data.length > options.maxPoints) {
      series.data.splice(0, series.data.length - options.maxPoints);
    } else if (options.shift) {
      series.data.shift();
    }

    if (options.redraw !== false) {
      this.bus.emit('dataUpdate', { seriesId });
      this.render();
    }
  }

  /**
   * Batch-append multiple points to a series (more efficient than calling
   * addPoint in a loop since it only triggers one render).
   */
  addPoints(
    seriesId: string,
    points: DataPoint[],
    options: { maxPoints?: number; redraw?: boolean } = {},
  ): void {
    const series = this.config.series.find((s) => s.id === seriesId);
    if (!series) return;

    series.data.push(...points);

    if (options.maxPoints != null && series.data.length > options.maxPoints) {
      series.data.splice(0, series.data.length - options.maxPoints);
    }

    if (options.redraw !== false) {
      this.bus.emit('dataUpdate', { seriesId });
      this.render();
    }
  }

  /**
   * Update an existing data point by index in a series.
   */
  updatePoint(seriesId: string, index: number, update: Partial<DataPoint>): void {
    const series = this.config.series.find((s) => s.id === seriesId);
    if (!series || index < 0 || index >= series.data.length) return;
    Object.assign(series.data[index]!, update);
    this.bus.emit('dataUpdate', { seriesId });
    this.render();
  }

  /** Remove a series by id */
  removeSeries(id: string): void {
    this.config.series = this.config.series.filter((s) => s.id !== id);
    this.bus.emit('dataUpdate', {});
    this.render();
  }

  /** Toggle series visibility */
  toggleSeries(id: string): void {
    const series = this.config.series.find((s) => s.id === id);
    if (series) {
      series.visible = series.visible === false ? true : false;
      this.bus.emit(series.visible ? 'seriesShow' : 'seriesHide', { seriesId: id });
      this.render();
    }
  }

  /** Subscribe to chart events */
  on<T extends ChartEventType>(type: T, handler: ChartEventHandler<T>): () => void {
    return this.bus.on(type, handler);
  }

  /** Set theme by id or config */
  setTheme(theme: string | ThemeConfig): void {
    this.theme = this.resolveTheme(theme);
    this.bus.emit('themeChange', {});
    this.render();
  }

  /** Get current theme */
  getTheme(): ThemeConfig {
    return this.theme;
  }

  /** Get the processed series data */
  getProcessedData(): ProcessedSeries[] {
    return this.processedSeries;
  }

  /** Get current state */
  getState(): Readonly<ChartState> {
    return this.state;
  }

  /** Get config */
  getConfig(): Readonly<ChartConfig> {
    return this.config;
  }

  /** Get the event bus (for advanced integrations) */
  getEventBus(): EventBus {
    return this.bus;
  }

  /** Timeline controls */
  getTimeline(): TimelinePlayback | null { return this.timelinePlayback; }
  playTimeline(): void { this.timelinePlayback?.play(); }
  pauseTimeline(): void { this.timelinePlayback?.pause(); }
  stopTimeline(): void { this.timelinePlayback?.stop(); }
  seekTimeline(progress: number): void { this.timelinePlayback?.seekProgress(progress); }
  setTimelineSpeed(speed: number): void { this.timelinePlayback?.setSpeed(speed); }

  /** Zoom to a data-coordinate range */
  zoomToRange(axisId: string, min: number, max: number): void {
    const axis = this.getOrInferAxis(axisId);
    if (!axis) return;
    if (!this.originalDomains.has(axisId)) {
      const scale = this.state.scales.get(axisId);
      if (scale) this.originalDomains.set(axisId, scale.domain);
    }
    axis.min = min;
    axis.max = max;
    this.render();
    this.bus.emit('zoom', { payload: { axisId, min, max } });
  }

  /** Reset zoom for all axes */
  resetZoom(): void {
    const axes = this.config.axes ?? this.inferAxes();
    for (const axis of axes) {
      // Clear min/max for any axis that was modified by zoom or pan
      axis.min = undefined;
      axis.max = undefined;
    }
    this.originalDomains.clear();
    this.panStartDomains.clear();
    this.state.zoomLevel = { x: 1, y: 1 };
    this.state.panOffset = { x: 0, y: 0 };
    this.render();
  }

  /** Programmatically add/update an annotation */
  setAnnotation(annotation: AnnotationConfig): void {
    if (!this.config.annotations) this.config.annotations = [];
    const idx = this.config.annotations.findIndex(a => a.id === annotation.id);
    if (idx >= 0) this.config.annotations[idx] = annotation;
    else this.config.annotations.push(annotation);
    this.render();
  }

  /** Remove an annotation by id */
  removeAnnotation(id: string): void {
    if (this.config.annotations) {
      this.config.annotations = this.config.annotations.filter(a => a.id !== id);
      this.render();
    }
  }

  // ── Drill-Down ─────────────────────────────────────────────────────────────

  /**
   * Navigate into a drilled-down chart level.
   * Saves current config on the stack, replaces with the given config.
   */
  drillDown(config: Partial<ChartConfig>, maxDepth = 50): void {
    if (this.drillStack.length >= maxDepth) {
      console.warn(`[RiskLab] drillDown: maximum depth (${maxDepth}) reached — ignoring.`);
      return;
    }
    this.drillStack.push({ ...this.config });
    this.config = { ...this.config, ...config };
    if (config.theme) this.theme = this.resolveTheme(config.theme);
    this.bus.emit('drillDown', { payload: { level: this.drillStack.length } });
    this.render();
  }

  /** Navigate back up one drill-down level */
  drillUp(): void {
    const previous = this.drillStack.pop();
    if (!previous) return;
    this.config = previous;
    this.theme = this.resolveTheme(this.config.theme);
    this.bus.emit('drillUp', { payload: { level: this.drillStack.length } });
    this.render();
  }

  /** Current drill-down depth (0 = top level) */
  get drillDepth(): number { return this.drillStack.length; }

  private destroyGraph3DScene(): void {
    this.graph3DScene?.destroy();
    this.graph3DScene = null;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  /** Export the chart */
  async export(format: 'png' | 'svg' | 'jpeg' = 'png'): Promise<Blob | string> {
    this.bus.emit('exportStart', { payload: { format } });
    const result = this.graph3DScene
      ? await this.graph3DScene.export(format)
      : await this.renderer.export(format);
    this.bus.emit('exportEnd', { payload: { format } });
    return result;
  }

  /** Resize the chart */
  resize(width?: number, height?: number): void {
    if (width !== undefined) this.state.width = width;
    if (height !== undefined) this.state.height = height;
    this.computeChartArea();
    this.renderer.setSize(this.state.width, this.state.height);
    this.graph3DScene?.resize(this.state.chartArea);
    this.applyPluginHookVoid('onResize', this.state.width, this.state.height);
    this.bus.emit('resize', {});
    this.render();
  }

  /** Destroy the chart and release resources */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.applyPluginHookVoid('onDestroy');
    this.animationEngine.cancelAll();
    this.resizeObserver?.disconnect();
    this.timelinePlayback?.destroy();
    this.destroyGraph3DScene();
    this.renderer?.destroy();
    this.bus.destroy();
    // Remove interaction overlay elements
    this.tooltipEl?.remove();
    this.hoverPulseEl?.remove();
    this.contextMenuEl?.remove();
    this.selectionOverlay?.remove();
    // Remove DOM event listeners
    if (this.container) {
      this.container.removeEventListener('mousemove', this._onMouseMove);
      this.container.removeEventListener('mousedown', this._onMouseDown);
      this.container.removeEventListener('mouseup', this._onMouseUp);
      this.container.removeEventListener('mouseleave', this._onMouseLeave);
      this.container.removeEventListener('click', this._onClick);
      this.container.removeEventListener('dblclick', this._onDblClick);
      this.container.removeEventListener('wheel', this._onWheel);
      this.container.removeEventListener('contextmenu', this._onContextMenu);
      this.container.removeEventListener('touchstart', this._onTouchStart);
      this.container.removeEventListener('touchmove', this._onTouchMove);
      this.container.removeEventListener('touchend', this._onTouchEnd);
      if (this._onKeyDown) {
        this.container.removeEventListener('keydown', this._onKeyDown);
      }
      this.liveRegion?.remove();
      this.container.innerHTML = '';
    }
  }

  // ---- Internal ----

  private mount(target: string | HTMLElement): void {
    this.container =
      typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;

    if (!this.container) {
      throw new Error(`[RiskLab] Container "${target}" not found in DOM.`);
    }

    // Determine size
    const rect = this.container.getBoundingClientRect();
    this.state.width = (this.config.width as number) || rect.width || 800;
    this.state.height = (this.config.height as number) || rect.height || 400;

    // Create renderer
    const backend: RendererBackend = this.config.renderer?.backend ?? 'svg';
    this.renderer =
      backend === 'canvas'
        ? new CanvasRenderer(this.container, this.state.width, this.state.height)
        : new SVGRenderer(this.container, this.state.width, this.state.height);

    this.computeChartArea();

    // Setup interaction overlay (tooltip, zoom, pan, etc.)
    this.setupInteraction();

    // Wire up legend toggle: Legend component emits 'legendClick' on the
    // EventBus; the Engine listens and calls toggleSeries to hide/show.
    this.bus.on('legendClick', (evt) => {
      const seriesId = evt.seriesId;
      if (seriesId) this.toggleSeries(seriesId);
    });

    // Setup accessibility (ARIA, keyboard nav)
    this.setupAccessibility();

    // Watch for container resize (unless externally managed, e.g. React adapter)
    if (typeof ResizeObserver !== 'undefined' && !(this.config as EngineChartConfig)._disableResize) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.resize(width, height);
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Adaptive layout: computes chart area by measuring actual content needs.
   * If the user provides explicit padding, those values serve as minimums;
   * otherwise the engine calculates how much space titles, axes, and legend
   * each require and expands padding to fit without overlap.
   */
  private computeChartArea(): void {
    const explicit = this.config.padding ?? {};
    const axes = this.config.axes ?? this.inferAxes();

    // ── 1. Title / subtitle space (top) ─────────────────────────────────
    const titleH = estimateTitleHeight(
      this.config.title?.text,
      this.config.title?.fontSize ?? 20,
    );
    const subtitleH = estimateTitleHeight(
      this.config.subtitle?.text,
      this.config.subtitle?.fontSize ?? 13,
    );
    const titleSpace = titleH + subtitleH + (titleH > 0 ? 8 : 0);

    // ── 2. Axis label / title space on each side ────────────────────────
    const axisBottom = estimateAxisLabelSpace(axes, 'bottom', this.theme, this.config, this.state.width);
    const axisTop = estimateAxisLabelSpace(axes, 'top', this.theme, this.config, this.state.width);
    const axisLeft = estimateAxisLabelSpace(axes, 'left', this.theme, this.config, this.state.width);
    const axisRight = estimateAxisLabelSpace(axes, 'right', this.theme, this.config, this.state.width);

    // Store axis footprints so Legend can position below axis titles
    this.state.axisBottomFootprint = axisBottom;
    this.state.axisTopFootprint = axisTop;

    // ── 3. Legend space ─────────────────────────────────────────────────
    const legendSpace = estimateLegendSpace(this.config, this.theme, this.state.width);

    // ── 4. Combine: use the larger of user-explicit or content-required ─
    // The axis/legend estimates already include tick lengths, gaps, and
    // clearance so we add outer padding to keep content from
    // touching the very edge of the container.
    const outerPad = 10;
    const top = Math.max(
      explicit.top ?? MIN_PADDING.top,
      outerPad + titleSpace + axisTop,
    );
    const bottom = Math.max(
      explicit.bottom ?? MIN_PADDING.bottom,
      outerPad + axisBottom + legendSpace.bottom,
    );
    const left = Math.max(
      explicit.left ?? MIN_PADDING.left,
      outerPad + axisLeft + legendSpace.left,
    );
    const right = Math.max(
      explicit.right ?? MIN_PADDING.right,
      outerPad + axisRight + legendSpace.right,
    );

    this.state.chartArea = {
      x: left,
      y: top,
      width: Math.max(0, this.state.width - left - right),
      height: Math.max(0, this.state.height - top - bottom),
    };
  }

  private createInitialState(): ChartState {
    return {
      width: 800,
      height: 400,
      chartArea: { x: 60, y: 60, width: 710, height: 310 },
      scales: new Map(),
      activeSeries: [],
      selectedPoints: [],
      zoomLevel: { x: 1, y: 1 },
      panOffset: { x: 0, y: 0 },
      tooltipVisible: false,
      animating: false,
    };
  }

  private resolveTheme(theme?: string | ThemeConfig): ThemeConfig {
    if (!theme) return defaultTheme;
    if (typeof theme === 'string') {
      return registry.getTheme(theme) ?? defaultTheme;
    }
    return theme;
  }

  private initPlugins(plugins: RiskLabPlugin[]): void {
    this.activePlugins = plugins;
    for (const plugin of plugins) {
      registry.registerPlugin(plugin);
      plugin.hooks.afterInit?.(this);
    }
  }

  private applyPluginHook<T>(hook: keyof import('./types').PluginHooks, value: T): T | undefined {
    let result = value;
    for (const plugin of this.activePlugins) {
      const fn = plugin.hooks[hook] as ((v: T) => T | void) | undefined;
      if (fn) {
        const transformed = fn(result);
        if (transformed !== undefined) result = transformed;
      }
    }
    return result;
  }

  private applyPluginHookVoid(hook: keyof import('./types').PluginHooks, ...args: unknown[]): void {
    for (const plugin of this.activePlugins) {
      const fn = plugin.hooks[hook] as ((...a: unknown[]) => void) | undefined;
      fn?.(...args);
    }
  }

  /**
   * Main render pipeline
   */
  render(): void {
    if (this.destroyed || !this.renderer) return;

    this.bus.emit('beforeRender', {});
    this.applyPluginHookVoid('beforeRender', this);

    // 1. Process data through pipeline
    const piped = this.applyPluginHook('beforeDataProcess', this.config.series);
    this.processedSeries = this.pipeline.process(piped ?? this.config.series, this.config);
    this.state.activeSeries = this.processedSeries;

    // 2. Build scales
    this.buildScales();

    // 3. Clear renderer
    this.renderer.clear();

    // 3b. Resolve gradient/pattern fills for series
    this.resolveGradientFills();

    // 4. Draw background
    this.renderer.drawRect(0, 0, this.state.width, this.state.height, {
      fill: this.theme.backgroundColor as string,
    });

    // 5. Draw title — positioned dynamically within the top padding area
    const titleFontSize = this.config.title?.fontSize ?? 20;
    const subtitleFontSize = this.config.subtitle?.fontSize ?? 13;
    const titleBottomY = this.state.chartArea.y - 8; // leave gap above chart area

    if (this.config.title?.text) {
      // Place title so its baseline sits above the subtitle (or above chartArea)
      const hasSubtitle = !!this.config.subtitle?.text;
      const titleY = hasSubtitle
        ? titleBottomY - (subtitleFontSize + 6)
        : titleBottomY;
      const titleX =
        this.config.title.align === 'left'
          ? this.state.chartArea.x
          : this.config.title.align === 'right'
            ? this.state.width - 30
            : this.state.width / 2;
      this.renderer.drawText(titleX, Math.max(titleFontSize + 4, titleY), this.config.title.text, {
        fill: (this.config.title.color as string) ?? (this.theme.textColor as string),
        fontSize: titleFontSize,
        fontFamily: this.config.title.fontFamily ?? this.theme.fontFamily,
        fontWeight: this.config.title.fontWeight ?? 'bold',
        textAnchor: this.config.title.align === 'left' ? 'start' : this.config.title.align === 'right' ? 'end' : 'middle',
      });
      // subtitle will render at titleBottomY (already set to chartArea.y - 8)
    }

    // 6. Draw subtitle — positioned right above the chart area
    if (this.config.subtitle?.text) {
      this.renderer.drawText(this.state.width / 2, titleBottomY, this.config.subtitle.text, {
        fill: (this.config.subtitle.color as string) ?? (this.theme.textColor as string),
        fontSize: subtitleFontSize,
        fontFamily: this.theme.fontFamily,
        textAnchor: 'middle',
        opacity: 0.7,
      });
    }

    const graph3DSeries = this.processedSeries.filter((series) => series.type === 'graph3d');
    if (graph3DSeries.length > 0 && this.container) {
      this.graph3DScene ??= new Graph3DScene({ host: this.container, bus: this.bus });
      this.graph3DScene.update({
        series: graph3DSeries,
        state: this.state,
        theme: this.theme,
        config: this.config,
      });
      this.bus.emit('afterRender', {});
      this.applyPluginHookVoid('afterRender', this);
      return;
    }

    if (this.graph3DScene) this.destroyGraph3DScene();

    // 7. Draw axes (skip for non-Cartesian chart types)
    const resolvedAxes = this.config.axes ?? [];
    if (resolvedAxes.length > 0) {
      renderAxes(this.renderer, resolvedAxes, this.state, this.theme);
    }

    // 8. Draw chart series
    renderChart(this.renderer, this.processedSeries, this.state, this.theme, this.config);

    // 8a. Engine-level hover highlighting — dim non-hovered series groups
    this.applyHoverHighlight();

    // 8b. Draw crosshair
    if (this.config.tooltip?.crosshair?.enabled && this.crosshairX >= 0) {
      const { chartArea: ca } = this.state;
      const ch = this.config.tooltip.crosshair;
      const lineStyle = {
        stroke: (ch.color as string) ?? 'rgba(107,114,128,0.5)',
        strokeWidth: ch.width ?? 1,
        dashArray: ch.dashArray ?? [4, 3],
      };
      if (ch.axis !== 'y') {
        this.renderer.drawLine(this.crosshairX, ca.y, this.crosshairX, ca.y + ca.height, lineStyle);
      }
      if (ch.axis === 'y' || ch.axis === 'both') {
        this.renderer.drawLine(ca.x, this.crosshairY, ca.x + ca.width, this.crosshairY, lineStyle);
      }
    }

    // 9. Draw legend
    if (this.config.legend?.enabled !== false) {
      renderLegend(this.renderer, this.config, this.state, this.theme, this.bus);
    }

    // 10. Draw annotations
    if (this.config.annotations?.length) {
      renderAnnotations(this.renderer, this.config.annotations, this.state, this.theme);
    }

    // 10b. Data labels
    renderDataLabels(this.renderer, this.processedSeries, this.state.scales, this.config, this.theme);

    // 10c. Statistics overlays (regression, moving averages, mean/stddev bands)
    const statsCfg = this.config.statistics;
    if (statsCfg) {
      renderStatistics(this.renderer, this.processedSeries, this.state, this.theme, statsCfg);
    }

    // 10d. Drill-down back button
    if (this.drillStack.length > 0 && this.container) {
      const btnId = 'uc-drillup-btn';
      let btn = this.container.querySelector<HTMLButtonElement>('#' + btnId);
      if (!btn) {
        btn = document.createElement('button');
        btn.id = btnId;
        btn.textContent = '◂ Back';
        btn.style.cssText = `
          position:absolute;top:8px;left:8px;z-index:300;
          background:${this.theme.tooltip?.backgroundColor as string ?? '#fff'};
          border:1px solid ${this.theme.tooltip?.borderColor as string ?? '#e5e7eb'};
          border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;
          font-family:${this.theme.fontFamily};color:${this.theme.textColor as string ?? '#374151'};
        `;
        btn.addEventListener('click', () => this.drillUp());
        this.container!.appendChild(btn);
      }
    } else {
      this.container?.querySelector('#uc-drillup-btn')?.remove();
    }

    // 11. Plugin draw hooks
    for (const plugin of this.activePlugins) {
      plugin.hooks.draw?.(this.renderer, this.state.chartArea);
    }

    // 12. Navigator (overview mini-chart with drag handles)
    const navCfg = this.config.navigator;
    if (navCfg?.enabled !== false && navCfg) {
      renderNavigatorChart(
        this.renderer,
        this.processedSeries,
        this.state,
        this.config,
        this.theme,
        navCfg,
      );
    }

    // 13. Range selector buttons
    const rsCfg = this.config.rangeSelector;
    if (rsCfg?.enabled !== false && rsCfg) {
      renderRangeSelector(
        this.renderer,
        this.state,
        this.config,
        this.theme,
        rsCfg,
        this.rangeSelectorSelectedIdx,
      );
    }

    this.bus.emit('afterRender', {});
    this.applyPluginHookVoid('afterRender', this);
  }

  /**
   * Engine-level hover highlighting — applies opacity dimming to all
   * series SVG groups except the hovered one.  This makes hover interactions
   * automatic across ALL chart types without requiring per-renderer changes.
   */
  private applyHoverHighlight(): void {
    if (!this.container) return;
    const svg = this.container.querySelector('svg');
    if (!svg) return;

    const hp = this.state.hoveredPoint;
    const seriesGroups = svg.querySelectorAll<SVGGElement>('g[id^="series-"]');

    if (!hp) {
      // Remove any lingering dim — reset all to full opacity
      for (const g of seriesGroups) {
        g.style.opacity = '';
        g.style.transition = '';
        g.style.filter = '';
      }
      return;
    }

    const hoveredGroupId = `series-${hp.seriesId}`;
    for (const g of seriesGroups) {
      if (g.id === hoveredGroupId) {
        g.style.opacity = '1';
        g.style.filter = 'drop-shadow(0 0 14px rgba(99,102,241,0.28)) saturate(1.08)';
      } else {
        g.style.opacity = '0.32';
        g.style.filter = 'saturate(0.78)';
      }
      g.style.transition = 'opacity 0.16s ease, filter 0.16s ease';
    }
  }

  private buildScales(): void {
    const axes = this.config.axes ?? this.inferAxes();
    const { chartArea } = this.state;

    for (const axis of axes) {
      const isCategorical = axis.type === 'band' || axis.type === 'ordinal' || axis.type === 'point';
      // Determine domain from data
      let domain: [number, number] | string[];
      if (axis.min != null && axis.max != null && !isCategorical) {
        domain = [Number(axis.min), Number(axis.max)];
      } else if (isCategorical) {
        domain = this.computeStringDomain(axis.id);
      } else {
        domain = this.computeNumericDomain(axis.id, axis.type === 'time');
      }

      // Determine range
      const isHorizontal = axis.position === 'top' || axis.position === 'bottom';
      const range: [number, number] = isHorizontal
        ? [chartArea.x, chartArea.x + chartArea.width]
        : [chartArea.y + chartArea.height, chartArea.y]; // Inverted for y

      const scale = createScale(axis.type, domain, range, {
        padding: axis.padding,
        inverted: axis.inverted,
      });

      this.state.scales.set(axis.id, scale);
    }
  }

  /** Chart types whose data uses `x` for categories even when the
   *  category (band) axis lives on the y0 axis (horizontal orientation). */
  private static readonly HORIZONTAL_BAR_TYPES = new Set(['bar', 'stackedBar']);

  /** Collect unique string values for band / ordinal / point scales */
  private computeStringDomain(axisId: string): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const series of this.processedSeries) {
      const isX = (series.xAxisId ?? 'x0') === axisId;
      const isY = (series.yAxisId ?? 'y0') === axisId;

      // Horizontal bar/stackedBar: categories live in d.x but the band
      // scale is on the y-axis.  When we're computing the y-axis domain,
      // pull the string values from d.x instead of d.y.
      const isHBar = Engine.HORIZONTAL_BAR_TYPES.has(series.type);

      for (const d of series.data) {
        let val: string | null = null;
        if (isX) {
          val = String(d.x);
        } else if (isY) {
          val = isHBar ? String(d.x) : String(d.y);
        }
        if (val != null && !seen.has(val)) {
          seen.add(val);
          ordered.push(val);
        }
      }
    }
    return ordered;
  }

  /** Resolve a start/end field (number | string | Date) to epoch ms, or NaN */
  private static resolveEpoch(v: unknown): number {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'string') {
      const n = Number(v);
      if (isFinite(n)) return n;
      const d = new Date(v).getTime();
      return isNaN(d) ? NaN : d;
    }
    return NaN;
  }

  /** Compute min/max numeric domain, with optional date-string parsing */
  private computeNumericDomain(axisId: string, isTime: boolean = false): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    // Chart types that store their time range in data.start / data.end rather
    // than data.x. We must include those values when building the x axis domain.
    const RANGE_SERIES_TYPES = new Set(['gantt', 'xrange', 'timeline', 'swimlane']);

    for (const series of this.processedSeries) {
      const isX = (series.xAxisId ?? 'x0') === axisId;
      const isY = (series.yAxisId ?? 'y0') === axisId;
      const usesStartEnd = isX && RANGE_SERIES_TYPES.has(series.type);
      const isHBar = Engine.HORIZONTAL_BAR_TYPES.has(series.type);

      // ── Histogram: x-axis domain comes from the raw y-values (the values
      //    that get binned), not from d.x which is just a label string. ──
      if (series.type === 'histogram' && isX) {
        for (const d of series.data) {
          const v = typeof d.y === 'number' ? d.y : Number(d.y);
          if (isFinite(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        }
        continue; // histogram x-domain is fully handled; skip normal loop
      }

      // ── Waterfall: y-axis domain must include cumulative sums, not just
      //    incremental deltas.  Walk the data to compute running total. ──
      if (series.type === 'waterfall' && isY) {
        let cumulative = 0;
        for (const d of series.data) {
          const v = (d as ProcessedDataPoint).yNum ?? Number(d.y) ?? 0;
          const isTotal = d.meta?.isTotal === true;
          if (!isTotal) cumulative += v;
          min = Math.min(min, 0, cumulative);
          max = Math.max(max, 0, cumulative);
        }
        continue;
      }

      for (const d of series.data) {
        const processed = d as ProcessedDataPoint;
        if (isX) {
          // Horizontal bar: the linear (value) axis is x0, but values
          // live in d.y / d.yNum.  Also include stacked extents (y0/y1).
          if (isHBar) {
            const v = processed.y1 ?? processed.yNum ?? Number(d.y);
            const v0 = processed.y0 ?? 0;
            if (isFinite(v))  { min = Math.min(min, Math.min(v0, v)); max = Math.max(max, Math.max(v0, v)); }
            // Ensure 0 is always in the domain so bars grow from origin
            min = Math.min(min, 0);
          } else {
          let v = processed.xNum ?? Number(d.x);
          // If time axis and x is a date string, parse it
          if (isTime && typeof d.x === 'string' && !isFinite(v)) {
            v = new Date(d.x).getTime();
          }
          if (isFinite(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
          }

          // For range-based series, also include start, end, and x2 in the domain
          if (usesStartEnd) {
            const rd = d as unknown as Record<string, unknown>;
            const sv  = Engine.resolveEpoch(rd['start']);
            const ev  = Engine.resolveEpoch(rd['end']);
            const x2v = Engine.resolveEpoch(rd['x2']);
            if (isFinite(sv))  { min = Math.min(min, sv);  max = Math.max(max, sv); }
            if (isFinite(ev))  { min = Math.min(min, ev);  max = Math.max(max, ev); }
            if (isFinite(x2v)) { min = Math.min(min, x2v); max = Math.max(max, x2v); }
          }
        }
        if (isY) {
          // Box plot: include low/high whisker extents in the y-domain
          if (series.type === 'boxPlot') {
            const lo = d.low;
            const hi = d.high;
            const bq1 = d.q1;
            const bq3 = d.q3;
            const med = d.median;
            for (const v of [lo, hi, bq1, bq3, med]) {
              if (v != null && isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
            }
          } else {
            const v = processed.y1 ?? processed.yNum ?? Number(d.y);
            const v0 = processed.y0 ?? 0;
            if (isFinite(v)) {
              min = Math.min(min, v0, v);
              max = Math.max(max, v0, v);
            }
          }
        }
      }
    }

    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 100;
    if (min === max) { min -= 1; max += 1; }

    // Add 5% padding
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad];
  }

  /** Auto-infer axes when none are configured */
  private inferAxes(): AxisConfig[] {
    // Non-Cartesian chart types never get auto-axes
    if (this.config.series.some(s => AXISLESS_TYPES.has(s.type as string))) {
      return [];
    }

    // Detect whether x-values are strings (→ band) or Date/timestamps (→ time).
    // Check ALL series so that a mix of numeric + categorical is handled correctly.
    // Priority: time > band > linear (never downgrade a higher-priority type).
    let xType: ScaleType = 'linear';
    let yType: ScaleType = 'linear';

    const xPriority: Record<ScaleType, number> = { time: 2, band: 1, linear: 0, logarithmic: 0, ordinal: 1, point: 1 };
    const yPriority: Record<ScaleType, number> = { time: 2, band: 1, linear: 0, logarithmic: 0, ordinal: 1, point: 1 };

    for (const series of this.config.series) {
      if (!series.data || series.data.length === 0) continue;
      const firstX = series.data[0]!.x;
      const firstY = series.data[0]!.y;

      let candidateX: ScaleType = 'linear';
      if (typeof firstX === 'string') {
        // Check if it looks like a date string (ISO 8601 or YYYY-MM-DD)
        candidateX = /^\d{4}-\d{2}(-\d{2})?/.test(firstX) && !isNaN(Date.parse(firstX))
          ? 'time'
          : 'band';
      } else if (firstX instanceof Date) {
        candidateX = 'time';
      }

      if (xPriority[candidateX] > xPriority[xType]) xType = candidateX;
      if (typeof firstY === 'string' && yPriority['band'] > yPriority[yType]) yType = 'band';
    }

    return [
      { id: 'x0', type: xType, position: 'bottom' },
      { id: 'y0', type: yType, position: 'left' },
    ];
  }

  private resolveGradientFills(): void {
    for (let i = 0; i < this.processedSeries.length; i++) {
      const s = this.processedSeries[i]!;
      if (!s.color || typeof s.color === 'string') continue;

      const grad = s.color as GradientDef;
      if (grad.type !== 'linear' && grad.type !== 'radial') continue;

      const gradId = `uc-grad-${s.id}`;

      // Convert angle to x1/y1/x2/y2 in gradient coordinate system (0-1 range)
      const angle = ((grad.angle ?? 90) - 90) * (Math.PI / 180);
      const gx1 = 0.5 - Math.cos(angle) * 0.5;
      const gy1 = 0.5 - Math.sin(angle) * 0.5;
      const gx2 = 0.5 + Math.cos(angle) * 0.5;
      const gy2 = 0.5 + Math.sin(angle) * 0.5;

      this.renderer.defineLinearGradient(
        gradId,
        gx1, gy1, gx2, gy2,
        (grad.stops ?? []).map((stop: GradientStop) => ({
          offset: stop.offset,
          color: stop.color,
          opacity: stop.opacity,
        })),
      );

      // Replace color with url reference
      (s as unknown as { color: string }).color = `url(#${gradId})`;
    }
  }

  private getOrInferAxis(axisId: string): AxisConfig | undefined {
    if (!this.config.axes) {
      // Lazily persist inferred axes into config so min/max mutations from
      // zoom/pan survive the next buildScales() call. Without this, each
      // inferAxes() call produces fresh objects and mutations are discarded.
      this.config.axes = this.inferAxes();
    }
    return this.config.axes.find(a => a.id === axisId);
  }

  // ── Timeline ─────────────────────────────────────────────────────────────

  private initTimeline(): void {
    if (!this.config.timeline) return;
    this.timelinePlayback = new TimelinePlayback(this.config.timeline, this.bus);
    this.timelinePlayback.initialize(this.config.series);
    this.timelinePlayback.onChange((state: TimelineState) => {
      this.state.timelineFrame = state.currentFrame;
      if (this.config.timeline?.timeKey) {
        const sliced = this.pipeline.sliceForTimeline(
          this.config.series,
          this.config.timeline.timeKey,
          state.currentTime,
        );
        this.processedSeries = this.pipeline.process(sliced, this.config);
        this.state.activeSeries = this.processedSeries;
      }
      this.render();
    });
  }

  // ── Interaction Setup ─────────────────────────────────────────────────────

  private ensureInteractionStyles(): void {
    if (typeof document === 'undefined' || document.getElementById('uc-interaction-styles')) return;
    const style = document.createElement('style');
    style.id = 'uc-interaction-styles';
    style.textContent = `
      @keyframes uc-hover-pulse-ring {
        0% { transform: scale(0.9); opacity: 0.85; }
        70% { transform: scale(1.5); opacity: 0; }
        100% { transform: scale(1.5); opacity: 0; }
      }
      .uc-hover-pulse {
        position: absolute;
        width: 24px;
        height: 24px;
        margin-left: -12px;
        margin-top: -12px;
        pointer-events: none;
        z-index: 9998;
        display: none;
        transform: translate3d(0, 0, 0);
        will-change: left, top, opacity;
      }
      .uc-hover-pulse__ring,
      .uc-hover-pulse__dot {
        position: absolute;
        inset: 0;
        border-radius: 999px;
      }
      .uc-hover-pulse__ring {
        border: 2px solid currentColor;
        animation: uc-hover-pulse-ring 1.05s ease-out infinite;
      }
      .uc-hover-pulse__dot {
        inset: 6px;
        background: currentColor;
        box-shadow: 0 0 0 2px rgba(255,255,255,0.18);
      }
    `;
    document.head.appendChild(style);
  }

  private setupInteraction(): void {
    if (!this.container || typeof document === 'undefined') return;
    this.ensureInteractionStyles();

    // Ensure container is positioned for overlay children
    if (this.container.style.position === '' || this.container.style.position === 'static') {
      this.container.style.position = 'relative';
    }

    // Create floating tooltip div
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'uc-tooltip-overlay';
    this.tooltipEl.style.cssText = `
      position:absolute;pointer-events:none;display:none;z-index:9999;
      top:0;left:0;transition:opacity 0.15s, transform 0.1s;
      will-change:transform,opacity;
    `;
    this.container.appendChild(this.tooltipEl);

    this.hoverPulseEl = document.createElement('div');
    this.hoverPulseEl.className = 'uc-hover-pulse';
    this.hoverPulseEl.innerHTML = '<span class="uc-hover-pulse__ring"></span><span class="uc-hover-pulse__dot"></span>';
    this.container.appendChild(this.hoverPulseEl);

    // Create selection overlay
    this.selectionOverlay = document.createElement('div');
    this.selectionOverlay.className = 'uc-selection-overlay';
    this.selectionOverlay.style.cssText = `
      position:absolute;pointer-events:none;display:none;z-index:100;
      border:1px solid rgba(79,70,229,0.8);
      background:rgba(79,70,229,0.08);
    `;
    this.container.appendChild(this.selectionOverlay);

    // Bind and attach event handlers
    this._onMouseMove = this.handleMouseMove.bind(this);
    this._onMouseDown = this.handleMouseDown.bind(this);
    this._onMouseUp = this.handleMouseUp.bind(this);
    this._onMouseLeave = this.handleMouseLeave.bind(this);
    this._onClick = this.handleClick.bind(this);
    this._onDblClick = this.handleDblClick.bind(this);
    this._onWheel = this.handleWheel.bind(this);
    this._onContextMenu = this.handleContextMenu.bind(this);
    this._onTouchStart = this.handleTouchStart.bind(this);
    this._onTouchMove = this.handleTouchMove.bind(this);
    this._onTouchEnd = this.handleTouchEnd.bind(this);

    const el = this.container;
    el.addEventListener('mousemove', this._onMouseMove);
    el.addEventListener('mousedown', this._onMouseDown);
    el.addEventListener('mouseup', this._onMouseUp);
    el.addEventListener('mouseleave', this._onMouseLeave);
    el.addEventListener('click', this._onClick);
    el.addEventListener('dblclick', this._onDblClick);
    el.addEventListener('wheel', this._onWheel, { passive: false });
    el.addEventListener('contextmenu', this._onContextMenu);
    el.addEventListener('touchstart', this._onTouchStart, { passive: false });
    el.addEventListener('touchmove', this._onTouchMove, { passive: false });
    el.addEventListener('touchend', this._onTouchEnd);
  }

  private getRelativePos(e: MouseEvent | Touch): { x: number; y: number } {
    const rect = this.container!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Hit Testing ───────────────────────────────────────────────────────────

  private hitTestPoint(px: number, py: number): Array<{ series: ProcessedSeries; point: DataPoint; index: number; pixelX: number; pixelY: number }> {
    const hits: Array<{ series: ProcessedSeries; point: DataPoint; index: number; pixelX: number; pixelY: number }> = [];
    const threshold = 20; // px

    for (const s of this.processedSeries) {
      const xScale = this.state.scales.get(s.xAxisId ?? 'x0');
      const yScale = this.state.scales.get(s.yAxisId ?? 'y0');
      if (!xScale || !yScale) continue;

      // For pie/donut — find nearest slice by angle
      if (s.type === 'pie' || s.type === 'donut') {
        const { chartArea: ca } = this.state;
        const cx = ca.x + ca.width / 2;
        const cy = ca.y + ca.height / 2;
        const r = Math.min(ca.width, ca.height) / 2 - 20;
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (dist <= r) {
          // Determine which slice
          let angle = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90;
          if (angle < 0) angle += 360;
          const total = s.data.reduce((sum, d) => sum + Math.abs(Number(d.y) || 0), 0);
          let currentAngle = 0;
          for (let i = 0; i < s.data.length; i++) {
            const sliceAngle = (Math.abs(Number(s.data[i]?.y) || 0) / total) * 360;
            if (angle >= currentAngle && angle < currentAngle + sliceAngle) {
              const d = s.data[i]!;
              hits.push({ series: s, point: d, index: i, pixelX: cx, pixelY: cy });
              break;
            }
            currentAngle += sliceAngle;
          }
        }
        continue;
      }

      const data = (s.processedData ?? s.data) as ProcessedDataPoint[];

      // ── Bar / Column hit testing ──────────────────────────────────────
      const isBarLike = s.type === 'bar' || s.type === 'column' ||
                        s.type === 'stackedBar' || s.type === 'stackedColumn';
      if (isBarLike) {
        const isHorizontal = s.type === 'bar' || s.type === 'stackedBar';
        const isStacked = s.type === 'stackedBar' || s.type === 'stackedColumn';

        // Determine category & value scales (mirrors BarChart.ts logic)
        let catScale = xScale;
        let valScale = yScale;
        if (isHorizontal) {
          const xIsBand = xScale.type === 'band' || xScale.type === 'ordinal' || xScale.type === 'point';
          const yIsBand = yScale.type === 'band' || yScale.type === 'ordinal' || yScale.type === 'point';
          if (yIsBand && !xIsBand) { catScale = yScale; valScale = xScale; }
          else if (xIsBand && !yIsBand) { /* keep defaults */ }
          else { catScale = yScale; valScale = xScale; }
        }

        const bw = catScale.bandwidth ?? 20;
        // Count bar-like series for grouped width
        const barLikeSeries = this.processedSeries.filter(
          ss => ss.type === 'bar' || ss.type === 'column' ||
                ss.type === 'stackedBar' || ss.type === 'stackedColumn',
        );
        const groupCount = isStacked ? 1 : barLikeSeries.length;
        const gap = 2;
        const barWidth = (bw - gap * (groupCount - 1)) / groupCount;
        const seriesIdx = barLikeSeries.indexOf(s);
        const offset = isStacked ? 0 : seriesIdx * (barWidth + gap) - (bw / 2) + (barWidth / 2);

        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          if (!d) continue;
          if (isHorizontal) {
            const catPos = catScale.convert(d.x);
            const baseX = isStacked && d.y0 != null ? valScale.convert(d.y0) : valScale.convert(0);
            const topX  = isStacked && d.y1 != null ? valScale.convert(d.y1) : valScale.convert(d.yNum);
            const rectY = catPos - barWidth / 2 + offset;
            const rectX = Math.min(topX, baseX);
            const rectW = Math.abs(topX - baseX);
            const rectH = barWidth;
            if (px >= rectX && px <= rectX + rectW && py >= rectY && py <= rectY + rectH) {
              hits.push({ series: s, point: d, index: i, pixelX: (rectX + rectW / 2), pixelY: catPos });
              break;
            }
          } else {
            const catPos = catScale.convert(d.x);
            const baseY = isStacked && d.y0 != null ? valScale.convert(d.y0) : valScale.convert(0);
            const topY  = isStacked && d.y1 != null ? valScale.convert(d.y1) : valScale.convert(d.yNum);
            const rectX = catPos - barWidth / 2 + offset;
            const rectY = Math.min(topY, baseY);
            const rectW = barWidth;
            const rectH = Math.abs(topY - baseY);
            if (px >= rectX && px <= rectX + rectW && py >= rectY && py <= rectY + rectH) {
              hits.push({ series: s, point: d, index: i, pixelX: catPos, pixelY: (rectY + rectH / 2) });
              break;
            }
          }
        }
        continue;
      }

      // ── Waterfall hit testing ────────────────────────────────────────
      if (s.type === 'waterfall') {
        const bw = xScale.bandwidth ?? Math.max(20, this.state.chartArea.width / data.length * 0.6);
        let cumulative = 0;
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          if (!d) continue;
          const x = xScale.convert(d.x);
          const value = d.yNum ?? 0;
          const isTotal = d.meta?.isTotal === true;
          let barTop: number, barBottom: number;
          if (isTotal) {
            barTop = yScale.convert(Math.max(cumulative, 0));
            barBottom = yScale.convert(Math.min(cumulative, 0));
          } else {
            const prevCum = cumulative;
            cumulative += value;
            barTop = yScale.convert(Math.max(prevCum, cumulative));
            barBottom = yScale.convert(Math.min(prevCum, cumulative));
          }
          if (px >= x - bw / 2 && px <= x + bw / 2 &&
              py >= barTop && py <= barBottom) {
            hits.push({ series: s, point: d, index: i, pixelX: x, pixelY: barTop });
            break;
          }
          if (!isTotal) { /* cumulative already updated */ }
        }
        continue;
      }

      // ── Treemap hit testing (rect bounds) ────────────────────────────
      if (s.type === 'treemap') {
        const { chartArea: ca } = this.state;
        if (px >= ca.x && px <= ca.x + ca.width && py >= ca.y && py <= ca.y + ca.height) {
          // Approximate: find nearest data point by index ratio
          const total = data.reduce((sum, d) => sum + Math.abs(d.yNum ?? 0), 0);
          if (total > 0) {
            // Simple hit: any point in the chart area counts — find the data
            // point whose proportional area most likely contains the cursor
            for (let i = 0; i < data.length; i++) {
              hits.push({ series: s, point: data[i]!, index: i, pixelX: px, pixelY: py });
              break;
            }
          }
        }
        continue;
      }

      // ── Sunburst hit testing (radial) ────────────────────────────────
      if (s.type === 'sunburst' || s.type === 'sunburstChart') {
        const { chartArea: ca } = this.state;
        const cx = ca.x + ca.width / 2;
        const cy = ca.y + ca.height / 2;
        const maxR = Math.min(ca.width, ca.height) / 2 - 16;
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (dist <= maxR) {
          // Any hover within the sunburst counts — find nearest data point
          for (let i = 0; i < data.length; i++) {
            hits.push({ series: s, point: data[i]!, index: i, pixelX: cx, pixelY: cy });
            break;
          }
        }
        continue;
      }

      // ── Chord diagram hit testing (radial) ───────────────────────────
      if (s.type === 'chord' || s.type === 'chordDiagram') {
        const { chartArea: ca } = this.state;
        const cx = ca.x + ca.width / 2;
        const cy = ca.y + ca.height / 2;
        const outerR = Math.min(ca.width, ca.height) / 2 - 30;
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (dist <= outerR) {
          for (let i = 0; i < data.length; i++) {
            hits.push({ series: s, point: data[i]!, index: i, pixelX: cx, pixelY: cy });
            break;
          }
        }
        continue;
      }

      // ── Gantt / Timeline hit testing (horizontal bars) ───────────────
      if (s.type === 'gantt' || s.type === 'timeline' || s.type === 'swimlane') {
        const { chartArea: ca } = this.state;
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          if (!d) continue;
          const startVal = d.start ?? d.x;
          const endVal = d.end ?? d.x2 ?? d.y;
          const x1 = xScale.convert(typeof startVal === 'number' ? startVal :
            (startVal instanceof Date ? startVal.getTime() : Number(startVal) || 0));
          const x2 = xScale.convert(typeof endVal === 'number' ? endVal :
            (endVal instanceof Date ? endVal.getTime() : Number(endVal) || 0));
          const barX = Math.min(x1, x2);
          const barW = Math.max(4, Math.abs(x2 - x1));
          // Rough vertical position — evenly distributed in chart area
          const rowH = ca.height / Math.max(data.length, 1);
          const barY = ca.y + i * rowH;
          if (px >= barX && px <= barX + barW && py >= barY && py <= barY + rowH) {
            hits.push({ series: s, point: d, index: i, pixelX: (barX + barW / 2), pixelY: barY + rowH / 2 });
            break;
          }
        }
        continue;
      }

      // ── Bullet chart hit testing ─────────────────────────────────────
      if (s.type === 'bullet' || s.type === 'bulletChart') {
        const { chartArea: ca } = this.state;
        const rowH = Math.min(60, (ca.height - 10) / Math.max(data.length, 1));
        const gap = 8;
        for (let i = 0; i < data.length; i++) {
          const by = ca.y + i * (rowH + gap);
          if (py >= by && py <= by + rowH && px >= ca.x && px <= ca.x + ca.width) {
            hits.push({ series: s, point: data[i]!, index: i, pixelX: px, pixelY: by + rowH / 2 });
            break;
          }
        }
        continue;
      }

      // ── Dependency Wheel / Packed Bubble / Venn / Word Cloud ─────────
      if (s.type === 'dependencyWheel' || s.type === 'dependency-wheel' ||
          s.type === 'packedBubble' || s.type === 'packed-bubble' ||
          s.type === 'venn' || s.type === 'wordCloud' || s.type === 'wordcloud' ||
          s.type === 'treegraph' || s.type === 'organization' || s.type === 'orgChart' ||
          s.type === 'networkTopology' || s.type === 'tilemap') {
        // Radial / scatter hit test: find closest point within tolerance
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          if (!d) continue;
          // These chart types don't use standard x/y scales; use pixel proximity
          // The data points carry x/y that map roughly into the chart area
          const dist = 30; // generous tolerance for click/hover
          hits.push({ series: s, point: d, index: i, pixelX: px, pixelY: py });
          break;
        }
        continue;
      }

      // ── Lollipop / Pareto / Dumbbell / ColumnRange hit testing ──────
      if (s.type === 'lollipop' || s.type === 'pareto' || s.type === 'dumbbell' || s.type === 'columnRange') {
        const bw = xScale.bandwidth ?? Math.max(20, this.state.chartArea.width / Math.max(data.length, 1) * 0.7);
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          if (!d) continue;
          const cx = xScale.convert(d.xNum ?? d.x);
          const cy = yScale.convert(d.y1 ?? d.yNum ?? d.y);
          // Check within category band width and close vertically
          if (Math.abs(px - cx) <= bw / 2 + 10) {
            const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
            if (dist <= bw / 2 + 20) {
              hits.push({ series: s, point: d, index: i, pixelX: cx, pixelY: cy });
              break;
            }
          }
        }
        continue;
      }

      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (!d) continue;
        const sx = xScale.convert(d.xNum ?? d.x);
        const sy = yScale.convert(d.y1 ?? d.yNum ?? d.y);
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
          const { chartArea: ca } = this.state;
          if (px >= ca.x && px <= ca.x + ca.width && py >= ca.y && py <= ca.y + ca.height) {
            hits.push({ series: s, point: d, index: i, pixelX: px, pixelY: py });
            break;
          }
          continue;
        }
        const dist = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
        if (dist <= threshold) {
          hits.push({ series: s, point: d, index: i, pixelX: sx, pixelY: sy });
          break; // One hit per series is enough
        }
      }
    }
    return hits;
  }

  /** For shared tooltip: find all series values at the x-coordinate nearest to cursor */
  private hitTestShared(px: number): Array<{ series: ProcessedSeries; point: DataPoint; index: number; pixelX: number; pixelY: number }> {
    const hits: Array<{ series: ProcessedSeries; point: DataPoint; index: number; pixelX: number; pixelY: number }> = [];

    for (const s of this.processedSeries) {
      const xScale = this.state.scales.get(s.xAxisId ?? 'x0');
      const yScale = this.state.scales.get(s.yAxisId ?? 'y0');
      if (!xScale || !yScale) continue;

      const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
      if (data.length === 0) continue;

      // Find point with closest x
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < data.length; i++) {
        const sx = xScale.convert(data[i].xNum ?? data[i].x);
        const d = Math.abs(sx - px);
        if (d < closestDist) { closestDist = d; closestIdx = i; }
      }

      if (closestDist < 40) {
        const d = data[closestIdx];
        const sx = xScale.convert(d.x);
        const sy = yScale.convert(d.y1 ?? d.yNum ?? d.y);
        hits.push({ series: s, point: d, index: closestIdx, pixelX: sx, pixelY: sy });
      }
    }
    return hits;
  }

  private resolveTooltipHits(
    px: number,
    py: number,
  ): Array<{ series: ProcessedSeries; point: DataPoint; index: number; pixelX: number; pixelY: number }> {
    const tooltipConfig = this.config.tooltip ?? {};
    return (tooltipConfig.shared ?? false) ? this.hitTestShared(px) : this.hitTestPoint(px, py);
  }

  private tooltipAllowsHover(): boolean {
    const trigger = this.config.tooltip?.trigger ?? 'both';
    return trigger === 'hover' || trigger === 'both';
  }

  private tooltipAllowsClick(): boolean {
    const trigger = this.config.tooltip?.trigger ?? 'both';
    return trigger === 'click' || trigger === 'both';
  }

  private showHoverPulse(px: number, py: number, color?: string): void {
    if (!this.hoverPulseEl) return;
    this.hoverPulseEl.style.display = 'block';
    this.hoverPulseEl.style.left = `${px}px`;
    this.hoverPulseEl.style.top = `${py}px`;
    this.hoverPulseEl.style.color = color ?? (this.theme.palette[0] ?? '#6366f1');
    this.hoverPulseEl.style.opacity = '1';
  }

  private hideHoverPulse(): void {
    if (!this.hoverPulseEl) return;
    this.hoverPulseEl.style.display = 'none';
    this.hoverPulseEl.style.opacity = '0';
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  private showTooltip(px: number, py: number, hits: ReturnType<typeof this.hitTestPoint>): void {
    if (!this.tooltipEl || hits.length === 0 || this.config.tooltip?.enabled === false) {
      if (!this.tooltipPinned) this.hideTooltip();
      return;
    }

    // If tooltip is pinned, don't update position or content on hover
    if (this.tooltipPinned) return;

    const tooltipConfig = this.config.tooltip ?? {};
    const tooltipData = hits.map(h => ({
      x: h.pixelX, y: h.pixelY,
      series: h.series as SeriesConfig,
      point: h.point,
      index: h.index,
    }));

    const html = createTooltipHTML(tooltipData, tooltipConfig, this.theme);
    this.tooltipEl.innerHTML = html;

    // Position tooltip, ensuring it stays within container
    const TIP_OFFSET = 14;
    let tx = px + TIP_OFFSET;
    let ty = py - TIP_OFFSET;

    // Temporarily display to measure size
    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.visibility = 'hidden';
    this.tooltipEl.style.pointerEvents = 'none';
    const tipW = this.tooltipEl.offsetWidth;
    const tipH = this.tooltipEl.offsetHeight;
    this.tooltipEl.style.visibility = 'visible';

    if (tx + tipW > this.state.width) tx = px - tipW - TIP_OFFSET;
    if (ty + tipH > this.state.height) ty = py - tipH - TIP_OFFSET;
    if (ty < 0) ty = TIP_OFFSET;
    if (tx < 0) tx = TIP_OFFSET;

    this.tooltipEl.style.left = `${tx}px`;
    this.tooltipEl.style.top = `${ty}px`;
    this.state.tooltipVisible = true;
  }

  private hideTooltip(): void {
    if (this.tooltipPinned) return;  // Don't hide pinned tooltips
    if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    this.state.tooltipVisible = false;
    this.state.hoveredPoint = undefined;
    this.hideHoverPulse();
  }

  /** Pin the tooltip at current position so it remains visible on mouse-out */
  private pinTooltip(): void {
    if (!this.tooltipEl || this.tooltipEl.style.display === 'none') return;
    this.tooltipPinned = true;
    this.tooltipEl.style.pointerEvents = 'auto';
    // Add a small close button
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '\u00D7';
    closeBtn.style.cssText = `
      position:absolute;top:2px;right:6px;cursor:pointer;
      font-size:14px;line-height:1;opacity:0.5;z-index:1;
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.unpinTooltip();
    });
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.opacity = '1'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.opacity = '0.5'; });
    this.tooltipEl.querySelector('div')?.style.setProperty('position', 'relative');
    this.tooltipEl.querySelector('div')?.appendChild(closeBtn);
  }

  /** Unpin and hide the tooltip */
  private unpinTooltip(): void {
    this.tooltipPinned = false;
    if (this.tooltipEl) {
      this.tooltipEl.style.pointerEvents = 'none';
      this.tooltipEl.style.display = 'none';
    }
    this.state.tooltipVisible = false;
    this.hideHoverPulse();
  }

  // ── Mouse Event Handlers ──────────────────────────────────────────────────

  private handleMouseMove(e: MouseEvent): void {
    // Skip Engine-level interaction for self-managed surfaces (tile map, etc.)
    if (this.isSelfManagedTarget(e)) return;

    const { x: px, y: py } = this.getRelativePos(e);

    // Update crosshair position
    this.crosshairX = px;
    this.crosshairY = py;

    // Navigator drag handling
    if (this.navigatorDragging) {
      const navCfg = this.config.navigator;
      if (navCfg) {
        const result = updateNavigatorDrag(px, this.config, this.state, navCfg);
        if (result) {
          this.applyNavigatorRange(result.left, result.right);
          this.render();
        }
      }
      return;
    }

    // Draggable point handling
    if (this.draggingPoint) {
      const { seriesId, index } = this.draggingPoint;
      const series = this.config.series.find(s => s.id === seriesId);
      if (series) {
        const yScale = this.state.scales.get(series.yAxisId ?? 'y0');
        if (yScale) {
          const newY = yScale.invert(py);
          const point = series.data[index];
          if (point) {
            point.y = newY;
            this.bus.emit('pointDrag', {
              seriesId, pointIndex: index, payload: { value: newY }, chartX: px, chartY: py,
            });
            this.render();
          }
        }
      }
      return;
    }

    // Update drag state
    if (this.isDragging) {
      const dx = px - this.dragStartX;
      const dy = py - this.dragStartY;

      if (this.dragButton === 0) {
        const interaction = this.config.interaction;
        if (interaction?.selection?.enabled) {
          // Draw selection rect
          const x = Math.min(px, this.selectionStartX);
          const y = Math.min(py, this.selectionStartY);
          const w = Math.abs(px - this.selectionStartX);
          const h = Math.abs(py - this.selectionStartY);
          if (this.selectionOverlay) {
            this.selectionOverlay.style.display = 'block';
            this.selectionOverlay.style.left = `${x}px`;
            this.selectionOverlay.style.top = `${y}px`;
            this.selectionOverlay.style.width = `${w}px`;
            this.selectionOverlay.style.height = `${h}px`;
          }
        } else if (interaction?.pan?.enabled) {
          // Pan
          this.state.panOffset = {
            x: this.panStartOffset.x + dx,
            y: this.panStartOffset.y + dy,
          };
          this.applyPan();
          this.render();
        }
      }

      this.bus.emit('hover', {
        chartX: px, chartY: py, originalEvent: e,
      });
      return;
    }

    if (this.tooltipPinned) return;

    // Tooltip hit testing
    const tooltipConfig = this.config.tooltip ?? {};
    if (tooltipConfig.enabled !== false && this.tooltipAllowsHover()) {
      const hits = this.resolveTooltipHits(px, py);

      if (hits.length > 0) {
        const first = hits[0]!;
        const newHover = { seriesId: first.series.id, index: first.index };
        const changed = !this.state.hoveredPoint ||
          this.state.hoveredPoint.seriesId !== newHover.seriesId ||
          this.state.hoveredPoint.index !== newHover.index;

        if (changed) {
          this.state.hoveredPoint = newHover;
          this.bus.emit('hover', {
            seriesId: first.series.id,
            point: first.point as DataPoint,
            pointIndex: first.index,
            chartX: px, chartY: py,
            originalEvent: e,
          });
        }
        this.showHoverPulse(first.pixelX, first.pixelY, (first.point.color as string | undefined) ?? (first.series.color as string | undefined));
        this.showTooltip(px, py, hits);
      } else {
        this.hideTooltip();
        if (this.state.hoveredPoint) {
          this.state.hoveredPoint = undefined;
          this.bus.emit('leave', { chartX: px, chartY: py, originalEvent: e });
        }
        this.hideHoverPulse();
      }
    } else if (!this.tooltipPinned) {
      this.hideTooltip();
    }

    // Crosshair rendering
    if (tooltipConfig.crosshair?.enabled) {
      this.render();
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.isSelfManagedTarget(e)) return;
    const { x: px, y: py } = this.getRelativePos(e);

    // Check if click lands on the Navigator first
    const navCfg = this.config.navigator;
    if (navCfg?.enabled !== false && navCfg) {
      const hit = hitTestNavigator(px, py, this.state, this.config, navCfg);
      if (hit) {
        this.navigatorDragging = hit;
        this.navigatorDragStartX = px;
        startNavigatorDrag(px, hit, this.config, this.state, navCfg);
        e.preventDefault();
        return;
      }
    }

    // Check for draggable data point
    if (this.config.interaction?.dragPoints?.enabled) {
      const hits = this.hitTestPoint(px, py);
      if (hits.length > 0) {
        const h = hits[0]!;
        this.draggingPoint = {
          seriesId: h.series.id,
          index: h.index,
          origY: (h.point as ProcessedDataPoint).yNum ?? Number(h.point.y),
        };
        e.preventDefault();
        return;
      }
    }

    this.isDragging = true;
    this.dragButton = e.button;
    this.dragStartX = px;
    this.dragStartY = py;
    this.selectionStartX = px;
    this.selectionStartY = py;
    this.panStartOffset = { ...this.state.panOffset };
    this.panStartDomains.clear(); // snapshot current (post-zoom) domain for this pan gesture
    e.preventDefault();
  }

  private handleMouseUp(e: MouseEvent): void {
    if (this.navigatorDragging) {
      this.navigatorDragging = null;
      stopNavigatorDrag(this.config, this.state);
      this.render();
      return;
    }

    // Finalize draggable point
    if (this.draggingPoint) {
      const { seriesId, index } = this.draggingPoint;
      const series = this.config.series.find(s => s.id === seriesId);
      const point = series?.data[index];
      if (point) {
        this.bus.emit('pointDrop', {
          seriesId, pointIndex: index, payload: { value: point.y }, originalEvent: e,
        });
      }
      this.draggingPoint = null;
      return;
    }

    if (!this.isDragging) return;
    const { x: px, y: py } = this.getRelativePos(e);

    if (this.dragButton === 0 && this.config.interaction?.selection?.enabled) {
      const x = Math.min(px, this.selectionStartX);
      const y = Math.min(py, this.selectionStartY);
      const w = Math.abs(px - this.selectionStartX);
      const h = Math.abs(py - this.selectionStartY);

      if (w > 5 && h > 5) {
        // Fire selection event with data coordinates
        const xScale = this.state.scales.get('x0');
        const yScale = this.state.scales.get('y0');
        const minX = xScale?.invert(x);
        const maxX = xScale?.invert(x + w);
        const minY = yScale?.invert(y + h);
        const maxY = yScale?.invert(y);

        this.bus.emit('select', {
          payload: { x, y, width: w, height: h, minX, maxX, minY, maxY },
          chartX: px, chartY: py, originalEvent: e,
        });

        // Zoom to selection if selection zoom
        if (this.config.interaction?.zoom?.enabled && xScale && yScale) {
          this.zoomToRange('x0', Number(minX), Number(maxX));
        }
      }
    }

    if (this.selectionOverlay) this.selectionOverlay.style.display = 'none';
    this.isDragging = false;
  }

  private handleMouseLeave(e: MouseEvent): void {
    if (!this.tooltipPinned) {
      this.hideTooltip();
    }
    this.isDragging = false;
    this.crosshairX = -1;
    this.crosshairY = -1;
    if (this.selectionOverlay) this.selectionOverlay.style.display = 'none';
    if (!this.tooltipPinned) this.hideHoverPulse();
    this.bus.emit('leave', { originalEvent: e });
    if (this.config.tooltip?.crosshair?.enabled) this.render();
  }

  private handleClick(e: MouseEvent): void {
    if (this.isSelfManagedTarget(e)) return;
    const { x: px, y: py } = this.getRelativePos(e);

    // If tooltip is pinned and user clicks empty area, unpin
    if (this.tooltipPinned) {
      const hits = this.resolveTooltipHits(px, py);
      if (hits.length === 0) {
        this.unpinTooltip();
        return;
      }
      // Clicked a different point? Unpin old, show new, then pin again
      this.unpinTooltip();
    }

    // Check range selector button click
    const rsCfg = this.config.rangeSelector;
    if (rsCfg?.enabled !== false && rsCfg) {
      const btnIdx = this.hitTestRangeSelectorButton(px, py, rsCfg);
      if (btnIdx >= 0) {
        this.activateRangeSelectorButton(btnIdx, rsCfg);
        return;
      }
    }

    const hits = this.resolveTooltipHits(px, py);

    if (hits.length > 0) {
      const first = hits[0]!;
      const tooltipConfig = this.config.tooltip ?? {};

      if (tooltipConfig.enabled !== false && this.tooltipAllowsClick()) {
        this.showTooltip(px, py, hits);
        if (tooltipConfig.pinnable !== false) {
          this.pinTooltip();
        }
        this.showHoverPulse(first.pixelX, first.pixelY, (first.point.color as string | undefined) ?? (first.series.color as string | undefined));
      }

      this.bus.emit('click', {
        seriesId: first.series.id,
        point: first.point as DataPoint,
        pointIndex: first.index,
        chartX: px, chartY: py,
        originalEvent: e,
      });

      // Drill-down: if the clicked point has drilldown data, dive in
      const drilldowns = this.config.drilldown;
      if (drilldowns) {
        const pointId = first.point.drilldown ?? first.point.id ?? String(first.point.x);
        const drillCfg = drilldowns[String(pointId)];
        if (drillCfg) {
          this.drillDown(drillCfg);
          return;
        }
      }

      // Point selection
      const selConfig = this.config.interaction?.selection;
      if (selConfig?.enabled) {
        const key = { seriesId: first.series.id, index: first.index };
        const already = this.state.selectedPoints.findIndex(
          p => p.seriesId === key.seriesId && p.index === key.index
        );
        if (already >= 0) {
          this.state.selectedPoints.splice(already, 1);
          this.bus.emit('deselect', { seriesId: key.seriesId, pointIndex: key.index, originalEvent: e });
        } else {
          if (selConfig.mode !== 'multi') this.state.selectedPoints = [];
          this.state.selectedPoints.push(key);
          this.bus.emit('select', { seriesId: key.seriesId, pointIndex: key.index, originalEvent: e });
        }
        this.render();
      }
    } else {
      // Click on empty area — deselect all
      this.hideHoverPulse();
      if (this.state.selectedPoints.length > 0) {
        this.state.selectedPoints = [];
        this.bus.emit('deselect', { chartX: px, chartY: py, originalEvent: e });
        this.render();
      }
    }
  }

  private handleDblClick(e: MouseEvent): void {
    if (this.isSelfManagedTarget(e)) return;
    const { x: px, y: py } = this.getRelativePos(e);
    this.bus.emit('dblclick', { chartX: px, chartY: py, originalEvent: e });
    // Double click resets zoom by default
    if (this.config.interaction?.zoom?.enabled && (this.state.zoomLevel.x !== 1 || this.state.zoomLevel.y !== 1)) {
      this.resetZoom();
    }
  }

  private handleWheel(e: WheelEvent): void {
    if (this.isSelfManagedTarget(e)) return;
    if (this.config.interaction?.zoom?.wheel === false) return;
    if (!this.config.interaction?.zoom?.enabled) return;

    e.preventDefault();
    const { x: px, y: py } = this.getRelativePos(e);
    const delta = e.deltaY > 0 ? 1 / 1.2 : 1.2;

    // Resolve zoom axis — if the user didn't specify one, auto-detect:
    // when both x0 and y0 are numeric (linear/time) scales, zoom both axes
    // simultaneously (essential for scatter / bubble charts).
    let zoomAxis = this.config.interaction?.zoom?.axis;
    if (!zoomAxis) {
      const xScale = this.state.scales.get('x0');
      const yScale = this.state.scales.get('y0');
      const xIsNumeric = xScale && xScale.domain.length === 2;
      const yIsNumeric = yScale && yScale.domain.length === 2;
      zoomAxis = (xIsNumeric && yIsNumeric) ? 'both' : 'x';
    }

    const { chartArea: _ca } = this.state;
    let xChanged = false;
    let yChanged = false;

    if (zoomAxis === 'x' || zoomAxis === 'both') {
      const xScale = this.state.scales.get('x0');
      // Only zoom numeric / time axes (domain length === 2); skip band / ordinal scales
      if (xScale && xScale.domain.length === 2) {
        const [d0, d1] = xScale.domain as [number, number];
        const mouseDataX = Number(xScale.invert(px));
        // Save the original (pre-zoom) domain so we have a stable reference for clamping
        this.saveOriginalDomain('x0', xScale.domain);
        const origX = this.originalDomains.get('x0') as [number, number];
        const origSpanX = origX ? Math.abs(origX[1] - origX[0]) : Math.abs(d1 - d0);
        // Clamp span: cap zoom-out at 100× original span, cap zoom-in at 1e-6× (prevents
        // the domain from reaching astronomical values after many wheel events)
        const rawSpan = (d1 - d0) / delta;
        const newSpan = Math.max(origSpanX * 1e-6, Math.min(origSpanX * 100, rawSpan));
        const ratio = (d1 - d0) !== 0 ? (mouseDataX - d0) / (d1 - d0) : 0.5;
        const newMin = mouseDataX - ratio * newSpan;
        const newMax = newMin + newSpan;
        const axis = this.getOrInferAxis('x0');
        if (axis) { axis.min = newMin; axis.max = newMax; xChanged = true; }
      }
    }

    if (zoomAxis === 'y' || zoomAxis === 'both') {
      const yScale = this.state.scales.get('y0');
      if (yScale && yScale.domain.length === 2) {
        const [d0, d1] = yScale.domain as [number, number];
        const mouseDataY = Number(yScale.invert(py));
        this.saveOriginalDomain('y0', yScale.domain);
        const origY = this.originalDomains.get('y0') as [number, number];
        const origSpanY = origY ? Math.abs(origY[1] - origY[0]) : Math.abs(d1 - d0);
        const rawSpan = (d1 - d0) / delta;
        const newSpan = Math.max(origSpanY * 1e-6, Math.min(origSpanY * 100, rawSpan));
        const ratio = (d1 - d0) !== 0 ? (mouseDataY - d0) / (d1 - d0) : 0.5;
        const newMin = mouseDataY - ratio * newSpan;
        const newMax = newMin + newSpan;
        const axis = this.getOrInferAxis('y0');
        if (axis) { axis.min = newMin; axis.max = newMax; yChanged = true; }
      }
    }

    // Only update zoom level and show the reset button when an axis was actually changed.
    // This prevents the reset button from appearing on band/ordinal X-axis charts (e.g.
    // column, bar) where numerical zooming is not applicable.
    if (xChanged || yChanged) {
      this.state.zoomLevel = {
        x: xChanged ? this.state.zoomLevel.x * delta : this.state.zoomLevel.x,
        y: yChanged ? this.state.zoomLevel.y * delta : this.state.zoomLevel.y,
      };

      this.render();
      this.bus.emit('zoom', {
        payload: { delta, chartX: px, chartY: py },
        chartX: px, chartY: py, originalEvent: e,
      });

      // Show reset button
      this.ensureResetButton();
    }
  }

  private handleContextMenu(e: MouseEvent): void {
    const cont = this.config.interaction?.contextMenu;
    if (!cont) return;
    e.preventDefault();
    const { x: px, y: py } = this.getRelativePos(e);
    const hits = this.hitTestPoint(px, py);
    this.bus.emit('click', {
      chartX: px, chartY: py, originalEvent: e,
      payload: { type: 'contextmenu' },
    });

    if (Array.isArray(cont) && cont.length > 0 && this.container) {
      this.showContextMenu(px, py, cont, hits[0]);
    }
  }

  private showContextMenu(px: number, py: number, items: ContextMenuItem[], hit?: { series: ProcessedSeries; point: DataPoint; index: number; pixelX: number; pixelY: number }): void {
    this.contextMenuEl?.remove();
    const menu = document.createElement('div');
    menu.className = 'uc-context-menu';
    menu.style.cssText = `
      position:absolute;left:${px}px;top:${py}px;z-index:10000;
      background:${this.theme.tooltip.backgroundColor as string ?? '#fff'};
      border:1px solid ${this.theme.tooltip.borderColor as string ?? '#e5e7eb'};
      border-radius:6px;padding:4px 0;min-width:140px;
      box-shadow:0 4px 16px rgba(0,0,0,0.12);font-family:${this.theme.fontFamily};
      font-size:13px;
    `;

    for (const item of items) {
      if (item.separator) {
        const hr = document.createElement('div');
        hr.style.cssText = 'height:1px;background:#e5e7eb;margin:4px 0;';
        menu.appendChild(hr);
        continue;
      }
      const li = document.createElement('div');
      li.textContent = item.label;
      li.style.cssText = `
        padding:6px 14px;cursor:pointer;
        color:${this.theme.textColor as string ?? '#1f2937'};
      `;
      li.addEventListener('mouseenter', () => { li.style.background = 'rgba(0,0,0,0.06)'; });
      li.addEventListener('mouseleave', () => { li.style.background = 'transparent'; });
      li.addEventListener('click', () => {
        const actionEvent: ChartEvent = {
          type: 'click',
          defaultPrevented: false,
          preventDefault: () => { actionEvent.defaultPrevented = true; },
          payload: { hit },
          seriesId: hit?.series.id,
          point: hit?.point,
          pointIndex: hit?.index,
        };
        item.action?.(actionEvent);
        menu.remove();
      });
      menu.appendChild(li);
    }

    // Click outside to close
    const closeMenu = (ev: Event) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('keydown', closeOnEsc);
      }
    };
    const closeOnEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', closeOnEsc); }
    };
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
      document.addEventListener('keydown', closeOnEsc);
    }, 0);

    this.container!.appendChild(menu);
    this.contextMenuEl = menu;
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const t = e.touches[0]!;
      this.isDragging = true;
      this.dragButton = 0;
      const pos = this.getRelativePos(t);
      this.dragStartX = pos.x;
      this.dragStartY = pos.y;
      this.panStartOffset = { ...this.state.panOffset };
      this.panStartDomains.clear();
    } else if (e.touches.length === 2) {
      // Pinch zoom start
      const a = e.touches[0]!, b = e.touches[1]!;
      this.pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      this.pinchStartZoom = { ...this.state.zoomLevel };
      // Save axis domains at pinch-start so anchor point is stable across move frames
      const xSc = this.state.scales.get('x0');
      const ySc = this.state.scales.get('y0');
      this.pinchStartDomains = {
        x: xSc?.domain.length === 2 ? [...xSc.domain] as [number, number] : undefined,
        y: ySc?.domain.length === 2 ? [...ySc.domain] as [number, number] : undefined,
      };
      this.isDragging = false;
    }
    e.preventDefault();
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1 && this.isDragging) {
      const t = e.touches[0]!;
      const pos = this.getRelativePos(t);
      if (this.config.interaction?.pan?.enabled) {
        const dx = pos.x - this.dragStartX;
        const dy = pos.y - this.dragStartY;
        this.state.panOffset = { x: this.panStartOffset.x + dx, y: this.panStartOffset.y + dy };
        this.applyPan();
        this.render();
      }
      this.handleMouseMove({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => {} } as MouseEvent);
    } else if (e.touches.length === 2 && this.config.interaction?.zoom?.pinch !== false && this.config.interaction?.zoom?.enabled) {
      const a = e.touches[0]!, b = e.touches[1]!;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = dist / (this.pinchStartDist || 1);
      const zoomAxis = this.config.interaction?.zoom?.axis ?? 'both';

      // Midpoint of the two touch points (in container-relative pixels)
      const midTouch = { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 };
      const { x: px, y: py } = this.getRelativePos(midTouch as Touch);

      // Update x-axis domain using the pinch-start domain as anchor reference
      // (avoids cumulative drift when using the live scale each frame)
      if (zoomAxis !== 'y' && this.pinchStartDomains.x) {
        const [d0, d1] = this.pinchStartDomains.x;
        const xScale = this.state.scales.get('x0');
        if (xScale) {
          const [r0, r1] = xScale.range as [number, number];
          const rMin = Math.min(r0, r1);
          const rangeSpan = Math.abs(r1 - r0) || 1;
          const domSpan = d1 - d0;
          const mouseDataX = d0 + ((px - rMin) / rangeSpan) * domSpan;
          this.saveOriginalDomain('x0', this.pinchStartDomains.x);
          const origX = this.originalDomains.get('x0') as [number, number] | undefined;
          const origSpanX = origX ? Math.abs(origX[1] - origX[0]) : Math.abs(domSpan);
          const rawSpan = domSpan / scale;
          const newSpan = Math.max(origSpanX * 1e-6, Math.min(origSpanX * 100, rawSpan));
          const ratio = domSpan !== 0 ? (mouseDataX - d0) / domSpan : 0.5;
          const newMin = mouseDataX - ratio * newSpan;
          const newMax = newMin + newSpan;
          const axisObj = this.getOrInferAxis('x0');
          if (axisObj) { axisObj.min = newMin; axisObj.max = newMax; }
          this.state.zoomLevel.x = scale;
        }
      }

      // Update y-axis domain symmetrically
      if (zoomAxis !== 'x' && this.pinchStartDomains.y) {
        const [d0, d1] = this.pinchStartDomains.y;
        const yScale = this.state.scales.get('y0');
        if (yScale) {
          const [r0, r1] = yScale.range as [number, number];
          const rMin = Math.min(r0, r1);
          const rangeSpan = Math.abs(r1 - r0) || 1;
          const domSpan = d1 - d0;
          const mouseDataY = d0 + ((py - rMin) / rangeSpan) * domSpan;
          this.saveOriginalDomain('y0', this.pinchStartDomains.y);
          const origY = this.originalDomains.get('y0') as [number, number] | undefined;
          const origSpanY = origY ? Math.abs(origY[1] - origY[0]) : Math.abs(domSpan);
          const rawSpan = domSpan / scale;
          const newSpan = Math.max(origSpanY * 1e-6, Math.min(origSpanY * 100, rawSpan));
          const ratio = domSpan !== 0 ? (mouseDataY - d0) / domSpan : 0.5;
          const newMin = mouseDataY - ratio * newSpan;
          const newMax = newMin + newSpan;
          const axisObj = this.getOrInferAxis('y0');
          if (axisObj) { axisObj.min = newMin; axisObj.max = newMax; }
          this.state.zoomLevel.y = scale;
        }
      }

      this.render();
      this.ensureResetButton();
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) {
      this.isDragging = false;
    }
  }

  // ── Pan implementation ────────────────────────────────────────────────────

  private applyPan(): void {
    // Persist inferred axes into config so min/max mutations survive render().
    if (!this.config.axes) {
      this.config.axes = this.inferAxes();
    }
    const axes = this.config.axes;
    const { panOffset } = this.state;

    for (const axis of axes) {
      const isH = axis.position === 'bottom' || axis.position === 'top';
      const scale = this.state.scales.get(axis.id);
      if (!scale || scale.domain.length !== 2) continue;

      // Snapshot the domain at the start of this pan gesture.
      // Using panStartDomains (reset on mouseDown) rather than originalDomains
      // ensures the pan shifts relative to the current zoomed domain, not the
      // initial pre-zoom domain (which would silently reset any active zoom).
      if (!this.panStartDomains.has(axis.id)) {
        this.panStartDomains.set(axis.id, [...scale.domain] as [number, number] | string[]);
      }
      const origDomain = this.panStartDomains.get(axis.id) as [number, number];
      const [d0, d1] = origDomain;

      const [r0, r1] = scale.range as [number, number];
      const rangeSpan = Math.abs(r1 - r0);
      const domainSpan = d1 - d0;
      if (rangeSpan === 0) continue;

      const pixelShift = isH ? panOffset.x : panOffset.y;
      const dataShift = -(pixelShift / rangeSpan) * domainSpan;
      let newMin = d0 + dataShift;
      let newMax = d1 + dataShift;

      // Clamp pan so the data cannot be scrolled completely off-screen.
      // Allow up to 1× the original span of overshoot on each side.
      const overshoot = Math.abs(domainSpan);
      const clampMin = d0 - overshoot;
      const clampMax = d1 + overshoot;
      if (newMax > clampMax) { const diff = newMax - clampMax; newMax -= diff; newMin -= diff; }
      if (newMin < clampMin) { const diff = clampMin - newMin; newMin += diff; newMax += diff; }

      axis.min = newMin;
      axis.max = newMax;
    }
  }

  /** Apply a navigator fractional range [0..1] to the primary x-axis */
  private applyNavigatorRange(leftFrac: number, rightFrac: number): void {
    const xScale = this.state.scales.get('x0');
    if (!xScale || xScale.domain.length !== 2) return;

    // Resolve original full domain
    const [fullMin, fullMax] = (this.originalDomains.get('x0') ?? xScale.domain) as [number, number];
    const span = fullMax - fullMin;
    const newMin = fullMin + leftFrac * span;
    const newMax = fullMin + rightFrac * span;

    this.saveOriginalDomain('x0', xScale.domain);
    const axis = this.getOrInferAxis('x0');
    if (axis) { axis.min = newMin; axis.max = newMax; }

    this.state.zoomLevel = {
      x: span / (newMax - newMin),
      y: this.state.zoomLevel.y,
    };

    this.ensureResetButton();
  }

  /** Return button index hit by (px, py), or -1 */
  private hitTestRangeSelectorButton(px: number, py: number, rsCfg: RangeSelectorConfig): number {
    const buttons = rsCfg.buttons ?? DEFAULT_RANGE_BUTTONS;
    const fontSize = 11;
    const BTN_H = 22;
    const BTN_PAD = 10;
    const BTN_GAP = 4;
    const widths = buttons.map((b: RangeSelectorButton) => b.label.length * (fontSize * 0.62) + BTN_PAD * 2);
    const totalW = widths.reduce((s: number, w: number) => s + w + BTN_GAP, -BTN_GAP);
    const isBottom = rsCfg.verticalAlign === 'bottom';
    const btnY = isBottom
      ? this.state.chartArea.y + this.state.chartArea.height + 8
      : Math.max(4, this.state.chartArea.y - BTN_H - 8);
    let btnX = this.state.chartArea.x + this.state.chartArea.width - totalW;

    if (py < btnY || py > btnY + BTN_H) return -1;

    for (let i = 0; i < buttons.length; i++) {
      const bw = widths[i]!;
      if (px >= btnX && px <= btnX + bw) return i;
      btnX += bw + BTN_GAP;
    }
    return -1;
  }

  /** Zoom the x-axis to match the clicked range selector button */
  private activateRangeSelectorButton(idx: number, rsCfg: RangeSelectorConfig): void {
    const buttons = rsCfg.buttons ?? DEFAULT_RANGE_BUTTONS;
    const btn = buttons[idx];
    if (!btn) return;

    this.rangeSelectorSelectedIdx = idx;

    // Gather all x data values to get full range
    const allX = this.processedSeries.flatMap(s => (s.processedData ?? s.data).map((d: DataPoint) => Number(d.x)));
    if (allX.length === 0) { this.render(); return; }

    const { from, to } = computeRangeForButton(btn, allX.map(x => ({ x })));

    btn.onClick?.(from, to);
    this.zoomToRange('x0', from, to);

    this.bus.emit('click', {
      payload: { type: 'rangeSelector', buttonIndex: idx, from, to },
      chartX: 0, chartY: 0,
    });
  }

  private saveOriginalDomain(axisId: string, domain: [number, number] | string[]): void {
    if (!this.originalDomains.has(axisId)) {
      this.originalDomains.set(axisId, [...domain] as [number, number] | string[]);
    }
  }

  private ensureResetButton(): void {
    if (!this.container || !this.config.interaction?.zoom?.resetButton) return;
    const existing = this.container.querySelector('.uc-reset-zoom');
    if (existing) return;

    const btn = document.createElement('button');
    btn.className = 'uc-reset-zoom';
    btn.textContent = 'Reset zoom';
    btn.style.cssText = `
      position:absolute;top:8px;right:8px;z-index:200;
      background:${this.theme.tooltip.backgroundColor as string ?? '#fff'};
      border:1px solid ${this.theme.tooltip.borderColor as string ?? '#e5e7eb'};
      border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;
      font-family:${this.theme.fontFamily};color:${this.theme.textColor as string ?? '#374151'};
    `;
    btn.addEventListener('click', () => {
      this.resetZoom();
      btn.remove();
    });
    this.container.appendChild(btn);
  }

  // ── Accessibility ─────────────────────────────────────────────────────────

  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private a11yFocusSeriesIdx = 0;
  private a11yFocusPointIdx = 0;
  private liveRegion: HTMLElement | null = null;

  private setupAccessibility(): void {
    const a11y = this.config.accessibility;
    if (!a11y?.enabled && !a11y) return; // opt-in, but always set basic ARIA

    if (!this.container || typeof document === 'undefined') return;

    // Apply a11y to the SVG/Canvas element
    const chartEl = this.container.querySelector('svg, canvas') as HTMLElement | null;
    if (chartEl) {
      chartEl.setAttribute('role', 'img');
      const label = a11y?.description ?? this.config.title?.text ?? 'Chart';
      chartEl.setAttribute('aria-label', label);

      if (a11y?.summary) {
        let desc = chartEl.querySelector('desc') as SVGDescElement | null;
        if (!desc && chartEl.tagName === 'svg') {
          desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc') as unknown as SVGDescElement;
          chartEl.prepend(desc);
        }
        if (desc) desc.textContent = a11y.summary;
      }
    }

    // Live region for screen reader announcements
    if (!this.liveRegion) {
      this.liveRegion = document.createElement('div');
      this.liveRegion.setAttribute('aria-live', 'polite');
      this.liveRegion.setAttribute('aria-atomic', 'true');
      this.liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
      this.container.appendChild(this.liveRegion);
    }

    if (!a11y?.keyboardNavigation) return;

    // Make container focusable
    this.container.setAttribute('tabindex', '0');
    this.container.setAttribute('role', 'application');

    this._onKeyDown = this.handleKeyDown.bind(this);
    this.container.addEventListener('keydown', this._onKeyDown);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const series = this.processedSeries.filter(s => s.visible !== false);
    if (series.length === 0) return;

    const s = series[this.a11yFocusSeriesIdx];
    if (!s) return;
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        this.a11yFocusPointIdx = Math.min(this.a11yFocusPointIdx + 1, data.length - 1);
        this.announcePoint(s, data[this.a11yFocusPointIdx], this.a11yFocusPointIdx);
        break;

      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        this.a11yFocusPointIdx = Math.max(this.a11yFocusPointIdx - 1, 0);
        this.announcePoint(s, data[this.a11yFocusPointIdx], this.a11yFocusPointIdx);
        break;

      case 'Tab':
        // Move to next/prev series
        if (e.shiftKey) {
          this.a11yFocusSeriesIdx = Math.max(this.a11yFocusSeriesIdx - 1, 0);
        } else {
          this.a11yFocusSeriesIdx = Math.min(this.a11yFocusSeriesIdx + 1, series.length - 1);
        }
        this.a11yFocusPointIdx = 0;
        e.preventDefault();
        this.announcePoint(
          series[this.a11yFocusSeriesIdx]!,
          (series[this.a11yFocusSeriesIdx]!.processedData ?? series[this.a11yFocusSeriesIdx]!.data)[0],
          0,
        );
        break;

      case 'Home':
        e.preventDefault();
        this.a11yFocusPointIdx = 0;
        this.announcePoint(s, data[0], 0);
        break;

      case 'End':
        e.preventDefault();
        this.a11yFocusPointIdx = data.length - 1;
        this.announcePoint(s, data[data.length - 1], data.length - 1);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (data[this.a11yFocusPointIdx]) {
          this.bus.emit('click', {
            seriesId: s.id,
            point: data[this.a11yFocusPointIdx] as DataPoint,
            pointIndex: this.a11yFocusPointIdx,
            chartX: 0, chartY: 0,
          });
        }
        break;
    }

    // Update hovered point for visual feedback
    this.state.hoveredPoint = { seriesId: s.id, index: this.a11yFocusPointIdx };
    this.render();
  }

  private announcePoint(series: ProcessedSeries, point: DataPoint | ProcessedDataPoint, index: number): void {
    if (!this.liveRegion || !point) return;

    const formatter = this.config.accessibility?.pointDescriptionFormatter;
    let message: string;

    if (formatter) {
      message = formatter(point as DataPoint, series as SeriesConfig);
    } else {
      const x = point.x !== undefined ? String(point.x) : `Point ${index + 1}`;
      const y = point.y !== undefined ? String(point.y) : '';
      message = `${series.name ?? series.id}: ${x}, ${y}`;
    }

    this.liveRegion.textContent = '';
    setTimeout(() => {
      if (this.liveRegion) this.liveRegion.textContent = message;
    }, 50);
  }
}
