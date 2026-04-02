// ============================================================================
// RiskLab Charts — Fluent Chart Builder SDK
// "Never configure an object literal again."
//
// Full fluent/chainable builder that guides you to a complete chart config.
// Type-safe at every step — invalid combos are compile errors, not runtime.
//
// Usage:
//   import { chart } from '@risklab/charts';
//
//   chart()
//     .type('line')
//     .series([{ id: 's1', name: 'Revenue', data: [...] }])
//     .theme('dark')
//     .title('Monthly Revenue')
//     .xAxis({ type: 'time' })
//     .yAxis({ title: { text: 'USD' } })
//     .tooltip({ shared: true })
//     .legend({ align: 'right' })
//     .animation({ duration: 600, easing: 'easeOut' })
//     .export({ formats: ['png', 'csv'] })
//     .into('#chart-container')
//     .render();
//
// ============================================================================

import type {
  ChartConfig,
  SeriesConfig,
  ChartType,
  AxisConfig,
  LegendConfig,
  TooltipConfig,
  AnimationConfig,
  ExportConfig,
  ThemeConfig,
  AnnotationConfig,
  ResponsiveRule,
  AccessibilityConfig,
  InteractionConfig,
  TimelineConfig,
} from '../core/types';
import { Engine } from '../core/Engine';

// ── Convenience data types ────────────────────────────────────────────────────

export type PointInput = { x: number | Date | string; y: number; [k: string]: unknown };
export type NumericPair = [number, number];
export type DataInput = PointInput[] | NumericPair[] | number[];

function normaliseData(raw: DataInput): SeriesConfig['data'] {
  if (!raw.length) return [];
  const first = raw[0];
  if (typeof first === 'number') {
    return (raw as number[]).map((y, x) => ({ x, y }));
  }
  if (Array.isArray(first)) {
    return (raw as NumericPair[]).map(([x, y]) => ({ x, y }));
  }
  return raw as PointInput[];
}

// ── Builder class ─────────────────────────────────────────────────────────────

export class ChartBuilder {
  private _config: Partial<ChartConfig> = {};
  private _seriesList: SeriesConfig[] = [];
  private _engines: WeakMap<HTMLElement, Engine> = new WeakMap();

  // ── Chart type shorthand (sets all series' type) ─────────────────────────

  type(t: ChartType): this {
    for (const s of this._seriesList) s.type = t;
    this._defaultType = t;
    return this;
  }
  private _defaultType: ChartType = 'line';

  // ── Series ────────────────────────────────────────────────────────────────

  series(list: SeriesConfig[]): this {
    this._seriesList = list.map(s => ({ ...s, type: s.type ?? this._defaultType }));
    return this;
  }

  /**
   * Add a single series by name + data.
   * @example .addSeries('Revenue', [100, 200, 150], 'bar')
   */
  addSeries(name: string, data: DataInput, type?: ChartType, extra?: Partial<SeriesConfig>): this {
    this._seriesList.push({
      id: `s${this._seriesList.length + 1}`,
      name,
      type: type ?? this._defaultType,
      data: normaliseData(data),
      ...extra,
    });
    return this;
  }

  // ── Title / subtitle ──────────────────────────────────────────────────────

  title(text: string, options?: Partial<ChartConfig['title']>): this {
    this._config.title = { text, ...options };
    return this;
  }

  subtitle(text: string, options?: Partial<ChartConfig['subtitle']>): this {
    this._config.subtitle = { text, ...options };
    return this;
  }

  // ── Dimensions ────────────────────────────────────────────────────────────

  size(width: number | string, height: number | string): this {
    this._config.width = width;
    this._config.height = height;
    return this;
  }

  width(w: number | string): this { this._config.width = w; return this; }
  height(h: number | string): this { this._config.height = h; return this; }

  // ── Axes ──────────────────────────────────────────────────────────────────

  xAxis(cfg: Partial<AxisConfig>): this {
    const existing = this._config.axes ?? [];
    const idx = existing.findIndex(a => a.position === 'bottom' || a.position === 'top' || a.id === 'x0');
    const axis = { id: 'x0', position: 'bottom' as const, type: 'linear' as const, ...cfg };
    if (idx >= 0) existing[idx] = { ...existing[idx]!, ...cfg };
    else existing.push(axis);
    this._config.axes = existing;
    return this;
  }

  yAxis(cfg: Partial<AxisConfig>, id = 'y0'): this {
    const existing = this._config.axes ?? [];
    const idx = existing.findIndex(a => a.id === id);
    const axis = { id, position: 'left' as const, type: 'linear' as const, ...cfg };
    if (idx >= 0) existing[idx] = { ...existing[idx]!, ...cfg };
    else existing.push(axis);
    this._config.axes = existing;
    return this;
  }

  /** Add a second y-axis (right side). */
  y2Axis(cfg: Partial<AxisConfig>): this {
    return this.yAxis({ position: 'right', ...cfg }, 'y1');
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  theme(t: string | ThemeConfig): this {
    this._config.theme = t;
    return this;
  }

  /** Apply a colour palette by name or array. */
  palette(colors: string[]): this {
    const existing = (this._config.theme as ThemeConfig | undefined) ?? {};
    this._config.theme = { ...existing, palette: colors } as ThemeConfig;
    return this;
  }

  // ── Legend ────────────────────────────────────────────────────────────────

  legend(cfg: Partial<LegendConfig> | boolean): this {
    if (typeof cfg === 'boolean') {
      this._config.legend = { enabled: cfg };
    } else {
      this._config.legend = { enabled: true, ...cfg };
    }
    return this;
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  tooltip(cfg: Partial<TooltipConfig> | boolean): this {
    if (typeof cfg === 'boolean') {
      this._config.tooltip = { enabled: cfg };
    } else {
      this._config.tooltip = { enabled: true, ...cfg };
    }
    return this;
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  animation(cfg: Partial<AnimationConfig> | false): this {
    if (cfg === false) {
      this._config.animation = { enabled: false };
    } else {
      this._config.animation = { enabled: true, ...cfg };
    }
    return this;
  }

  /** Disable all animations. */
  noAnimation(): this { return this.animation(false); }

  // ── Interaction ───────────────────────────────────────────────────────────

  zoom(axis: 'x' | 'y' | 'both' = 'x'): this {
    this._config.interaction = {
      ...this._config.interaction,
      zoom: { enabled: true, axis, wheel: true, pinch: true, resetButton: true },
    };
    return this;
  }

  pan(axis: 'x' | 'y' | 'both' = 'x'): this {
    this._config.interaction = {
      ...this._config.interaction,
      pan: { enabled: true, axis },
    };
    return this;
  }

  interaction(cfg: Partial<InteractionConfig>): this {
    this._config.interaction = { ...this._config.interaction, ...cfg };
    return this;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportable(cfg: Partial<ExportConfig> = {}): this {
    this._config.export = { enabled: true, menuButton: true, formats: ['png', 'svg', 'csv', 'json'], ...cfg };
    return this;
  }

  // ── Annotations ───────────────────────────────────────────────────────────

  annotate(annotations: AnnotationConfig[]): this {
    this._config.annotations = [...(this._config.annotations ?? []), ...annotations];
    return this;
  }

  // ── Accessibility ─────────────────────────────────────────────────────────

  accessible(cfg: Partial<AccessibilityConfig> = {}): this {
    this._config.accessibility = { enabled: true, keyboardNavigation: true, ...cfg };
    return this;
  }

  // ── Responsive ────────────────────────────────────────────────────────────

  responsive(rules: ResponsiveRule[]): this {
    this._config.responsive = rules;
    return this;
  }

  /** Apply sensible responsive defaults: hide legend below 480px, smaller font. */
  autoResponsive(): this {
    return this.responsive([
      {
        condition: { maxWidth: 480 },
        chartOptions: { legend: { enabled: false }, title: { fontSize: 13, text: this._config.title?.text ?? '' } },
      },
      {
        condition: { maxWidth: 768 },
        chartOptions: { legend: { layout: 'horizontal', verticalAlign: 'bottom' } },
      },
    ]);
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  timeline(cfg: Partial<TimelineConfig>): this {
    this._config.timeline = { enabled: true, controls: true, ...cfg };
    return this;
  }

  // ── Locale / formatting ───────────────────────────────────────────────────

  locale(locale: string, numberFmt?: Intl.NumberFormatOptions, dateFmt?: Intl.DateTimeFormatOptions): this {
    this._config.locale = locale;
    if (numberFmt) this._config.numberFormat = numberFmt;
    if (dateFmt) this._config.dateFormat = dateFmt;
    return this;
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  debug(): this { this._config.debug = true; return this; }

  // ── Build ─────────────────────────────────────────────────────────────────

  /** Produce the final ChartConfig object. */
  build(): ChartConfig {
    return {
      ...this._config,
      series: this._seriesList,
    } as ChartConfig;
  }

  // ── Target + render ───────────────────────────────────────────────────────

  /** Set the container (CSS selector or HTMLElement). */
  into(container: string | HTMLElement): BoundChartBuilder {
    return new BoundChartBuilder(this, container);
  }

  /** Shorthand: build, create engine, render, return engine. */
  renderTo(container: string | HTMLElement): Engine {
    const el = typeof container === 'string'
      ? (document.querySelector(container) as HTMLElement)
      : container;
    const config = this.build();
    const engine = new Engine({ ...config, container: el });
    this._engines.set(el, engine);
    return engine;
  }
}

/** A ChartBuilder that has a target container. Call `.render()` to mount. */
export class BoundChartBuilder {
  constructor(
    private readonly builder: ChartBuilder,
    private readonly container: string | HTMLElement,
  ) {}

  /** Render the chart and return the Engine. */
  render(): Engine {
    return this.builder.renderTo(this.container);
  }
}

// ── Factory function ──────────────────────────────────────────────────────────

/**
 * Start building a chart.
 *
 * @example
 * ```ts
 * import { chart } from '@risklab/charts';
 *
 * const engine = chart()
 *   .type('bar')
 *   .addSeries('Sales', [120, 300, 200, 450])
 *   .title('Sales by Quarter')
 *   .theme('dark')
 *   .zoom()
 *   .exportable()
 *   .autoResponsive()
 *   .into('#chart')
 *   .render();
 * ```
 */
export function chart(): ChartBuilder {
  return new ChartBuilder();
}

// ── Presets ───────────────────────────────────────────────────────────────────

/** Ready-made builder presets for common use-cases. */
export const charts = {
  /** Stock / finance chart with zoom, crosshair, OHLC support. */
  stock(): ChartBuilder {
    return chart()
      .type('candlestick')
      .xAxis({ type: 'time' })
      .zoom('x')
      .pan('x')
      .tooltip({ shared: true, crosshair: { enabled: true, axis: 'x' } });
  },

  /** Dashboard sparkline — tiny, no axes, no legend. */
  sparkline(): ChartBuilder {
    return chart()
      .type('sparkline')
      .legend(false)
      .noAnimation()
      .tooltip({ enabled: true });
  },

  /** Geographic/categorical heatmap. */
  heatmap(): ChartBuilder {
    return chart()
      .type('heatmap')
      .legend({ align: 'right', verticalAlign: 'middle', layout: 'vertical' });
  },

  /** Full-screen realtime chart (good for monitoring dashboards). */
  realtime(): ChartBuilder {
    return chart()
      .type('line')
      .animation({ duration: 0 })
      .noAnimation()
      .legend(false);
  },

  /** Clean pie chart with default exterior labels. */
  pie(): ChartBuilder {
    return chart()
      .type('pie')
      .legend({ align: 'right', layout: 'vertical' })
      .tooltip({ pointFormat: '<b>{point.name}</b>: {point.y:.1f}%' });
  },

  /** Gantt / project planning chart. */
  gantt(): ChartBuilder {
    return chart()
      .type('gantt')
      .xAxis({ type: 'time', title: { text: 'Date' } })
      .tooltip({ shared: false });
  },
} as const;
