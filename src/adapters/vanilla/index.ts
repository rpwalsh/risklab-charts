// ============================================================================
// RiskLab Charts — Vanilla JS / No-Framework Adapter
// The complete zero-dependency, zero-framework integration layer.
//
// Works in: plain HTML, Alpine.js, Ember.js, HTMX, Stimulus, vanilla ES
// modules, Preact, Solid.js, Qwik, Astro, Next.js, Nuxt, Remix, etc.
//
// All you need:
//   <div id="chart"></div>
//   <script type="module">
//     import { mount } from '@risklab/charts';
//     const chart = mount('#chart', { type: 'line', series: [...] });
//   </script>
// ============================================================================

import type {
  ChartConfig, ThemeConfig, SeriesConfig, DataPoint,
  ChartEventType, ChartEventHandler,
} from '../../core/types';
import { Engine } from '../../core/Engine';
import type { EngineChartConfig } from '../../core/Engine';

// ── Core mount ────────────────────────────────────────────────────────────────

export interface VanillaChartInstance {
  /** The underlying Engine — use for advanced operations. */
  readonly engine: Engine;
  /** The container element. */
  readonly container: HTMLElement;

  /** Update chart options. Partial update — only specified keys change. */
  update(config: Partial<ChartConfig>): VanillaChartInstance;

  /** Replace series data completely. */
  setData(series: SeriesConfig[]): VanillaChartInstance;

  /** Add a new series. */
  addSeries(series: SeriesConfig): VanillaChartInstance;

  /** Remove a series by id. */
  removeSeries(id: string): VanillaChartInstance;

  /** Toggle series visibility by id. */
  toggleSeries(id: string): VanillaChartInstance;

  /** Switch theme by name or full config. */
  setTheme(theme: string | ThemeConfig): VanillaChartInstance;

  /** Stream a single point onto a series (real-time). */
  addPoint(
    seriesId: string,
    point: DataPoint,
    opts?: { shift?: boolean; redraw?: boolean; maxPoints?: number },
  ): VanillaChartInstance;

  /** Subscribe to chart events. Returns unsubscribe function. */
  on<T extends ChartEventType>(
    eventType: T,
    handler: ChartEventHandler<T>,
  ): () => void;

  /** Export chart. Returns a Blob (image) or string (svg/csv/json). */
  exportChart(format?: 'png' | 'svg' | 'jpeg' | 'csv'): Promise<Blob | string>;

  /** Resize (call after container size changes if no ResizeObserver). */
  resize(width?: number, height?: number): VanillaChartInstance;

  /** Get current config snapshot. */
  getConfig(): ChartConfig;

  /** Destroy and clean up all resources. */
  destroy(): void;
}

/**
 * Mount a RiskLab chart into an element.
 *
 * @param container CSS selector or HTMLElement
 * @param config    Full or partial ChartConfig
 *
 * @example
 * ```js
 * import { mount } from '@risklab/charts';
 *
 * const chart = mount('#revenue-chart', {
 *   series: [{ id: 's1', name: 'Revenue', type: 'bar', data: [...] }],
 *   title: { text: 'Annual Revenue' },
 *   theme: 'dark',
 * });
 *
 * // Later — live update:
 * chart.addPoint('s1', { x: Date.now(), y: 42000 });
 *
 * // Cleanup:
 * chart.destroy();
 * ```
 */
export function mount(
  container: string | HTMLElement,
  config: Partial<ChartConfig> & { series: SeriesConfig[] },
): VanillaChartInstance {
  const el = resolveContainer(container);
  // Pass _disableResize so the Engine's internal ResizeObserver is suppressed —
  // the vanilla adapter manages resizing itself via its own ResizeObserver below.
  const engine = new Engine({ ...config, container: el, _disableResize: true } as EngineChartConfig);

  // Auto-resize
  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => engine.resize())
    : null;
  resizeObserver?.observe(el);

  const instance: VanillaChartInstance = {
    get engine() { return engine; },
    get container() { return el; },

    update(cfg) { engine.update(cfg); return instance; },
    setData(s) { engine.setData(s); return instance; },
    addSeries(s) { engine.addSeries(s); return instance; },
    removeSeries(id) { engine.removeSeries(id); return instance; },
    toggleSeries(id) { engine.toggleSeries(id); return instance; },
    setTheme(t) { engine.setTheme(t); return instance; },
    addPoint(sid, pt, opts) { engine.addPoint(sid, pt, opts); return instance; },
    on(type, handler) { return engine.on(type, handler) ?? (() => {}); },
    async exportChart(fmt = 'png') { return engine.export(fmt as 'png' | 'svg' | 'jpeg'); },
    resize(w, h) { engine.resize(w, h); return instance; },
    getConfig() { return engine.getConfig(); },
    destroy() {
      resizeObserver?.disconnect();
      engine.destroy();
    },
  };

  return instance;
}

// ── Alpine.js magic directive ─────────────────────────────────────────────────

/**
 * Alpine.js Plugin. Register with `Alpine.plugin(RiskLabAlpine)`.
 *
 * Usage in HTML:
 * ```html
 * <div x-data="{ cfg: {...} }" x-chart="cfg" style="height:400px"></div>
 * ```
 */
export const RiskLabAlpine = {
  start() {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.Alpine === 'undefined') return;
    const Alpine = g.Alpine as { directive: (name: string, callback: (...args: unknown[]) => void) => void };
    Alpine.directive('chart', (el: unknown, directiveInfo: unknown, utilities: unknown) => {
      const htmlEl = el as HTMLElement;
      const { expression } = directiveInfo as { expression: string };
      const { evaluateLater, effect, cleanup } = utilities as {
        evaluateLater: (expr: string) => (cb: (val: unknown) => void) => void;
        effect: (cb: () => void) => void;
        cleanup: (cb: () => void) => void;
      };
      const getConfig = evaluateLater(expression);
      let instance: VanillaChartInstance | null = null;

      effect(() => {
        getConfig((config: unknown) => {
          const cfg = config as ChartConfig & { series: SeriesConfig[] };
          if (!instance) {
            instance = mount(htmlEl, cfg);
          } else {
            instance.update(cfg);
          }
        });
      });

      cleanup(() => instance?.destroy());
    });
  },
};

// ── Stimulus controller source ────────────────────────────────────────────────

/**
 * Returns a Stimulus controller source string.
 * Used in Rails / Django / conventional MPA stacks.
 *
 * Register with: `application.register('chart', RiskLabController)`
 */
export function getStimulusControllerSource(): string {
  return `
import { Controller } from '@hotwired/stimulus';
import { mount } from '@risklab/charts';

export default class RiskLabController extends Controller {
  static values = { config: Object, theme: String };

  #chart = null;

  connect() {
    const config = this.configValue ?? {};
    if (this.hasThemeValue) config.theme = this.themeValue;
    this.#chart = mount(this.element, config);
  }

  disconnect() {
    this.#chart?.destroy();
    this.#chart = null;
  }

  configValueChanged(config) {
    this.#chart?.update(config);
  }

  themeValueChanged(theme) {
    this.#chart?.setTheme(theme);
  }

  // Action: data-action="click->chart#export"
  export({ params: { format = 'png' } = {} } = {}) {
    this.#chart?.exportChart(format);
  }
}
`.trim();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector(container) as HTMLElement | null;
    if (!el) throw new Error(`[RiskLab] container not found: "${container}"`);
    return el;
  }
  return container;
}

// ── Global auto-init ──────────────────────────────────────────────────────────

/**
 * Scan the DOM for `[data-chart]` attributes and auto-mount charts.
 * Call after DOM ready.
 *
 * ```html
 * <div data-chart='{"type":"bar","series":[...]}' style="height:300px"></div>
 * <script>
 *   import { autoInit } from '@risklab/charts';
 *   document.addEventListener('DOMContentLoaded', autoInit);
 * </script>
 * ```
 */
export function autoInit(root: Document | HTMLElement = document): void {
  const elements = root.querySelectorAll<HTMLElement>('[data-chart]');
  for (const el of elements) {
    try {
      const config = JSON.parse(el.dataset['chart']!) as ChartConfig & { series: SeriesConfig[] };
      const instance = mount(el, config);
      (el as unknown as Record<string, unknown>).__riskLabInstance = instance;
    } catch (e) {
      console.error('[RiskLab] autoInit parse error:', e, el);
    }
  }
}
