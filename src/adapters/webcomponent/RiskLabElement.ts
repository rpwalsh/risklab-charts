// ============================================================================
// RiskLab — Web Component (<risklab-chart>)
// Standards-based Custom Element wrapper — works in any framework or vanilla JS.
//
// Usage:
//   <risklab-chart
//     type="line"
//     theme="dark"
//     height="400"
//     title="Revenue"
//   ></risklab-chart>
//
//   <script>
//     const el = document.querySelector('risklab-chart');
//     el.series = [{ id: 's1', type: 'line', name: 'Sales', data: [...] }];
//   </script>
// ============================================================================

import { Engine } from '../../core/Engine';
import type { ChartConfig, SeriesConfig } from '../../core/types';

const OBSERVED_ATTRS = [
  'type', 'theme', 'title', 'subtitle', 'width', 'height',
  'renderer', 'legend', 'animation',
] as const;

type ObservedAttr = typeof OBSERVED_ATTRS[number];

/**
 * `<risklab-chart>` custom element.
 *
 * Attributes (reflected as properties):
 * - `type` — default chart type string
 * - `theme` — theme name
 * - `title` — chart title
 * - `subtitle` — chart subtitle
 * - `width` / `height` — dimensions
 * - `renderer` — 'svg' | 'canvas'
 *
 * Properties (set via JS):
 * - `series` — SeriesConfig[]
 * - `config` — full ChartConfig (merges with attributes)
 *
 * Events dispatched:
 * - `uc:ready` — engine is initialized
 * - `uc:click`, `uc:hover`, `uc:zoom`, `uc:select`
 */
export class RiskLabChartElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRS;
  }

  private _engine: Engine | null = null;
  private _series: SeriesConfig[] = [];
  private _config: Partial<ChartConfig> = {};
  private _shadow: ShadowRoot;
  private _container: HTMLDivElement;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });

    // Styles scoped inside shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; position: relative; }
      .uc-wc-root { width: 100%; height: 100%; }
    `;
    this._container = document.createElement('div');
    this._container.className = 'uc-wc-root';
    this._shadow.appendChild(style);
    this._shadow.appendChild(this._container);
  }

  connectedCallback() {
    this._init();
  }

  disconnectedCallback() {
    this._engine?.destroy();
    this._engine = null;
  }

  attributeChangedCallback(name: ObservedAttr, _old: string | null, value: string | null) {
    if (this._engine && value !== null) {
      this._syncAttrs();
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Get the underlying Engine instance */
  get engine(): Engine | null {
    return this._engine;
  }

  /** Set series data */
  set series(value: SeriesConfig[]) {
    this._series = value;
    if (this._engine) {
      this._engine.setData(value);
    } else {
      this._init();
    }
  }

  get series(): SeriesConfig[] {
    return this._series;
  }

  /** Merge in a full config object */
  set config(value: Partial<ChartConfig>) {
    this._config = { ...this._config, ...value };
    if (this._engine) {
      this._engine.update(this._config);
    }
  }

  get config(): Partial<ChartConfig> {
    return this._config;
  }

  /** Update chart — equivalent to engine.update() */
  update(config: Partial<ChartConfig>) {
    this._config = { ...this._config, ...config };
    this._engine?.update(config);
  }

  /** Export chart */
  async export(format: 'png' | 'svg' | 'jpeg' = 'png'): Promise<Blob | string> {
    if (!this._engine) throw new Error('Chart not ready');
    return this._engine.export(format);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _buildConfig(): ChartConfig {
    const width = this.getAttribute('width');
    const height = this.getAttribute('height');
    const renderer = (this.getAttribute('renderer') ?? 'svg') as 'svg' | 'canvas';
    const theme = this.getAttribute('theme') ?? 'default';
    const title = this.getAttribute('title');
    const subtitle = this.getAttribute('subtitle');

    return {
      series: this._series,
      container: this._container,
      renderer: { backend: renderer },
      theme,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      title: title ? { text: title } : undefined,
      subtitle: subtitle ? { text: subtitle } : undefined,
      ...this._config,
    } as ChartConfig;
  }

  private _init() {
    if (this._engine) {
      this._syncAttrs();
      return;
    }
    if (!this._container) return;

    const cfg = this._buildConfig();
    const engine = new Engine(cfg);
    this._engine = engine;

    // Wire events
    for (const ev of ['click', 'hover', 'zoom', 'select'] as const) {
      engine.on(ev, (payload) => {
        this.dispatchEvent(new CustomEvent(`uc:${ev}`, {
          detail: payload,
          bubbles: true,
          composed: true,
        }));
      });
    }

    this.dispatchEvent(new CustomEvent('uc:ready', {
      detail: { engine },
      bubbles: true,
      composed: true,
    }));
  }

  private _syncAttrs() {
    if (!this._engine) return;
    this._engine.update(this._buildConfig());
  }
}

/**
 * Register `<risklab-chart>` as a custom element.
 * Call once at app startup (idempotent).
 */
export function defineRiskLabElement(tagName = 'risklab-chart'): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, RiskLabChartElement);
  }
}
