/**
 * @module risklab/sdk/RiskLab
 *
 * The single top-level namespace for the entire RiskLab charting library.
 *
 * @example
 * import { RiskLab } from '@risklab/charts';
 *
 * // Fluent chart
 * RiskLab.chart().type('bar').addSeries('Revenue', [...]).into('#app').render();
 *
 * // Vanilla mount
 * RiskLab.mount('#chart', { series: [...] });
 *
 * // Live data
 * const feed = RiskLab.data.ws('wss://stream.example.com', { ... });
 *
 * // Sync multiple charts
 * const sync = RiskLab.sync([engine1, engine2]);
 *
 * // Pivot a flat dataset
 * const config = RiskLab.pivot({ rows, rowField: 'region', columnField: 'year', valueField: 'sales' });
 */

import { chart, charts } from './ChartBuilder';
import { mount, autoInit, RiskLabAlpine, getStimulusControllerSource } from '../adapters/vanilla/index';
import { syncCharts } from '../core/SyncController';
import { createTheme, resolveTheme, getSeriesColor } from '../themes/ThemeEngine';
import { defaultTheme } from '../themes/defaultTheme';
import { darkTheme } from '../themes/darkTheme';
import { pivotToChartConfig, pivotToMultiView, crossTabulate } from '../charts/PivotChart';
import { createAngularChart, getAngularComponentSource, getAngularServiceSource } from '../adapters/angular/index';
import { createSvelteChart, getSvelteComponentSource, getSvelte5ComponentSource, getSvelteStoreSource } from '../adapters/svelte/index';
import { createLitChart, getLitComponentSource } from '../adapters/lit/index';
import { parseCSV, fetchCSV, fetchJSON, mapJSON, createRestConnector, createWebSocketConnector, createSseConnector } from '../data/connectors';
import pkg from '../../package.json';

// ─── Version ──────────────────────────────────────────────────────────────────

const VERSION: string = pkg.version;

// ─── Namespace ────────────────────────────────────────────────────────────────

/**
 * The `RiskLab` namespace is the single entry point to the entire library.
 * Everything you need is available as a property of this object.
 */
export const RiskLab = {
  /**
   * Library version.
   */
  version: VERSION,

  // ── Fluent builder ──────────────────────────────────────────────────────────
  /**
   * Create a new fluent chart builder.
   * @example
   * RiskLab.chart().type('line').addSeries('Temp', temps).into('#el').render();
   */
  chart,

  /**
   * Preset chart builders for common chart types.
   * @example
   * RiskLab.charts.stock().addCandlestick('AAPL', ohlcData).into('#chart').render();
   */
  charts,

  // ── Vanilla mounting ────────────────────────────────────────────────────────
  /**
   * Mount a chart into a DOM element imperatively.
   * @example
   * const chart = RiskLab.mount('#my-chart', config);
   * chart.update({ series: newSeries });
   */
  mount,

  /**
   * Auto-initialize all `[data-chart]` elements in the document.
   */
  autoInit,

  /**
   * Alpine.js plugin — registers `x-chart` directive.
   * @example
   * Alpine.plugin(RiskLab.alpine);
   */
  alpine: RiskLabAlpine,

  /**
   * Get the source code for a Stimulus controller.
   */
  stimulusController: getStimulusControllerSource,

  // ── Sync ────────────────────────────────────────────────────────────────────
  /**
   * Sync multiple chart engines' zoom, pan and crosshair.
   * @example
   * const sync = RiskLab.sync([engine1, engine2]);
   * // later:
   * sync.destroy();
   */
  sync: syncCharts,

  // ── Pivot / multi-view ──────────────────────────────────────────────────────
  /**
   * Convert a flat dataset into a chart config via cross-tabulation.
   */
  pivot: pivotToChartConfig,

  /**
   * Convert a flat dataset to 4 chart configs (bar, line, heatmap, pie).
   */
  multiView: pivotToMultiView,

  /**
   * Raw cross-tabulate — returns data only (no chart config).
   */
  crossTab: crossTabulate,

  // ── Theming ─────────────────────────────────────────────────────────────────
  theme: {
    /**
     * Built-in light (default) theme.
     */
    light: defaultTheme,

    /**
     * Built-in dark theme.
     */
    dark: darkTheme,

    /**
     * Resolve a partial theme into a complete theme.
     */
    resolve: resolveTheme,

    /**
     * Create and register a new theme.
     * @example
     * const myTheme = RiskLab.theme.create('ocean', 'Ocean Theme', 'default', { colors: { background: '#001e3c' } });
     */
    create: createTheme,

    /**
     * Pick a series color from a theme by index.
     */
    seriesColor: getSeriesColor,
  },

  // ── Data connectors ─────────────────────────────────────────────────────────
  data: {
    /**
     * Parse a CSV string into SeriesConfig[].
     * @example
     * RiskLab.data.parseCSV(csvText, { xField: 'date', yFields: ['revenue'] });
     */
    parseCSV,

    /**
     * Fetch and parse a CSV URL.
     */
    fetchCSV,

    /**
     * Fetch JSON from a URL and map to SeriesConfig[].
     */
    fetchJSON,

    /**
     * Map an already-fetched JSON value to SeriesConfig[].
     */
    mapJSON,

    /**
     * Create a polling REST connector (DataFeed).
     */
    rest: createRestConnector,

    /**
     * Create a WebSocket streaming connector (DataFeed).
     */
    ws: createWebSocketConnector,

    /**
     * Create a Server-Sent Events connector (DataFeed).
     */
    sse: createSseConnector,
  },

  // ── Framework adapters ──────────────────────────────────────────────────────
  adapters: {
    /**
     * Angular adapter utilities — imperative factory + source code generators.
     */
    angular: {
      create: createAngularChart,
      componentSource: getAngularComponentSource,
      serviceSource: getAngularServiceSource,
    },

    /**
     * Svelte adapter utilities — imperative factory + SFC source generators.
     */
    svelte: {
      create: createSvelteChart,
      componentSource: getSvelteComponentSource,
      svelte5Source: getSvelte5ComponentSource,
      storeSource: getSvelteStoreSource,
    },

    /**
     * Lit (Web Components) adapter utilities.
     */
    lit: {
      create: createLitChart,
      componentSource: getLitComponentSource,
    },
  },
} as const;

export type RiskLabNamespace = typeof RiskLab;
