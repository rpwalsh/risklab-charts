// ============================================================================
// RiskLab — Svelte Adapter
// Drop-in Svelte 4/5 integration with full reactivity and lifecycle.
// No Svelte peer dep at compile time — safe to import in any project.
//
// Usage:
//   <script>
//     import { createSvelteChart } from '@risklab/charts-svelte';
//     import { onMount, onDestroy } from 'svelte';
//
//     let el;
//     let chartRef;
//     onMount(() => { chartRef = createSvelteChart(el, config); });
//     onDestroy(() => chartRef?.destroy());
//   </script>
//   <div bind:this={el} style="width:100%;height:400px" />
//
// OR use the emitted Svelte component source via getSvelteComponentSource().
// ============================================================================

import type {
  ChartConfig, ThemeConfig, SeriesConfig, DataPoint,
  ChartEventType, ChartEventHandler,
} from '../../core/types';
import { Engine } from '../../core/Engine';

// ── Imperative API ────────────────────────────────────────────────────────────

export interface SvelteChartRef {
  engine: Engine | null;
  destroy(): void;
  update(config: Partial<ChartConfig>): void;
  setData(series: SeriesConfig[]): void;
  addSeries(series: SeriesConfig): void;
  removeSeries(id: string): void;
  setTheme(theme: string | ThemeConfig): void;
  addPoint(seriesId: string, point: DataPoint, opts?: { shift?: boolean; maxPoints?: number }): void;
  exportChart(format?: 'png' | 'svg' | 'jpeg'): Promise<Blob | string>;
  on<T extends ChartEventType>(type: T, handler: ChartEventHandler<T>): () => void;
}

export function createSvelteChart(el: HTMLElement, config: ChartConfig): SvelteChartRef {
  let engine: Engine | null = new Engine({ ...config, container: el });

  return {
    get engine() { return engine; },
    destroy() { engine?.destroy(); engine = null; },
    update(cfg) { engine?.update(cfg); },
    setData(series) { engine?.setData(series); },
    addSeries(series) { engine?.addSeries(series); },
    removeSeries(id) { engine?.removeSeries(id); },
    setTheme(theme) { engine?.setTheme(theme); },
    addPoint(seriesId, point, opts) { engine?.addPoint(seriesId, point, opts); },
    async exportChart(format = 'png') {
      if (!engine) throw new Error('Chart destroyed');
      return engine.export(format);
    },
    on(type, handler) {
      return engine?.on(type, handler) ?? (() => {});
    },
  };
}

// ── Svelte 4 component source (emitted as string) ─────────────────────────────

/**
 * Returns the Svelte SFC source for `<Chart>` component.
 * Copy into `Chart.svelte` in your project.
 *
 * Features:
 * - Reactive `config` and `theme` props (updates chart on change)
 * - Dispatches `ready` event with engine ref
 * - `use:enhance` action pattern supported
 * - Auto-resize via ResizeObserver
 * - Full cleanup on destroy
 */
export function getSvelteComponentSource(): string {
  return `
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { createSvelteChart } from '@risklab/charts-svelte';

  /** @type {import('@risklab/charts').ChartConfig} */
  export let config;
  /** @type {string | import('@risklab/charts').ThemeConfig | undefined} */
  export let theme = undefined;
  /** Additional inline style */
  export let style = 'width:100%;height:400px';

  const dispatch = createEventDispatcher();

  let el;
  let chartRef;
  let observer;

  onMount(() => {
    chartRef = createSvelteChart(el, {
      ...config,
      ...(theme ? { theme } : {}),
    });

    observer = new ResizeObserver(() => chartRef?.engine?.resize());
    observer.observe(el);

    dispatch('ready', chartRef);
  });

  onDestroy(() => {
    observer?.disconnect();
    chartRef?.destroy();
  });

  // Reactive updates
  $: if (chartRef && config) {
    chartRef.update(config);
  }
  $: if (chartRef && theme) {
    chartRef.setTheme(theme);
  }

  // Expose methods via bind:this
  export const update    = (cfg) => chartRef?.update(cfg);
  export const setData   = (s) => chartRef?.setData(s);
  export const setTheme  = (t) => chartRef?.setTheme(t);
  export const addPoint  = (...args) => chartRef?.addPoint(...args);
  export const exportChart = (...args) => chartRef?.exportChart(...args);
</script>

<div bind:this={el} {style}></div>
`.trim();
}

// ── Svelte 5 runes-based source ───────────────────────────────────────────────

export function getSvelte5ComponentSource(): string {
  return `
<script>
  import { onMount } from 'svelte';
  import { createSvelteChart } from '@risklab/charts-svelte';
  import type { ChartConfig, ThemeConfig } from '@risklab/charts';

  let { config, theme, style = 'width:100%;height:400px', onReady }: {
    config: ChartConfig;
    theme?: string | ThemeConfig;
    style?: string;
    onReady?: (ref: ReturnType<typeof createSvelteChart>) => void;
  } = $props();

  let el = $state<HTMLElement | null>(null);
  let chartRef = $state<ReturnType<typeof createSvelteChart> | null>(null);

  $effect(() => {
    if (!el) return;
    const ref = createSvelteChart(el, { ...config, ...(theme ? { theme } : {}) });
    chartRef = ref;
    onReady?.(ref);

    const obs = new ResizeObserver(() => ref.engine?.resize());
    obs.observe(el);

    return () => { obs.disconnect(); ref.destroy(); };
  });

  $effect(() => {
    if (chartRef && config) chartRef.update(config);
  });

  $effect(() => {
    if (chartRef && theme) chartRef.setTheme(theme);
  });
</script>

<div bind:this={el} style={style}></div>
`.trim();
}

// ── Svelte store helper ───────────────────────────────────────────────────────

/**
 * Returns source for a Svelte-store-powered chart data helper.
 * Allows reactive data binding: `$chartData = newSeries` re-renders chart.
 */
export function getSvelteStoreSource(): string {
  return `
import { writable, derived } from 'svelte/store';
import type { SeriesConfig, ChartConfig } from '@risklab/charts';

/**
 * Create a reactive chart data store.
 *
 * @example
 * const { series, config, addSeries, setTheme } = createChartStore({
 *   series: [{ id: 's1', name: 'Revenue', type: 'line', data: [] }],
 *   theme: 'dark',
 * });
 *
 * // In template: <Chart config={$config} />
 */
export function createChartStore(initial: ChartConfig) {
  const series = writable<SeriesConfig[]>(initial.series ?? []);
  const theme = writable<string | undefined>(
    typeof initial.theme === 'string' ? initial.theme : undefined
  );
  const extra = writable<Partial<ChartConfig>>(initial);

  const config = derived([series, theme, extra], ([$s, $t, $e]) => ({
    ...$e,
    series: $s,
    ...(($t) ? { theme: $t } : {}),
  }));

  return {
    series,
    theme,
    config,
    setTheme: (t: string) => theme.set(t),
    addSeries: (s: SeriesConfig) => series.update(list => [...list, s]),
    removeSeries: (id: string) => series.update(list => list.filter(s => s.id !== id)),
    setData: (data: SeriesConfig[]) => series.set(data),
    updateSeries: (id: string, patch: Partial<SeriesConfig>) =>
      series.update(list => list.map(s => s.id === id ? { ...s, ...patch } : s)),
  };
}
`.trim();
}
