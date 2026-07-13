// ============================================================================
// RiskLab Charts — Vue 3 Adapter
// Composables for declarative chart usage in Vue 3.
// Vue 3 is a peer dependency — install vue@^3 separately.
// ============================================================================

import { Engine } from '../../core/Engine';
import { registry } from '../../core/Registry';
import { defaultTheme } from '../../themes/defaultTheme';
import { SyncController } from '../../core/SyncController';
import type {
  ChartConfig,
  SeriesConfig,
  ThemeConfig,
  DataPoint,
  ChartEventType,
  ChartEventHandler,
} from '../../core/types';
import type { SyncOptions } from '../../core/SyncController';

// ---------------------------------------------------------------------------
// Vue module cache — populated by initVueAdapter() or lazily on first use.
// ---------------------------------------------------------------------------

/**
 * Pre-loaded Vue module reference. When set, lifecycle hooks are registered
 * synchronously during component setup, which is required by Vue 3.
 *
 * **Call this once at your app entry point** (after `createApp`) to avoid
 * the async race condition present in the fallback dynamic-import path:
 *
 * ```ts
 * import * as Vue from 'vue';
 * import { initVueAdapter } from '@risklab/charts-vue';
 * initVueAdapter(Vue);
 * ```
 *
 * If you use a bundler (Vite / webpack / Rollup) with Vue as a direct
 * dependency, the cached module is usually already available and the adapter
 * self-initialises on the first `useChart` call before component setup runs —
 * but explicit initialisation is always the safest path.
 */
let _vue: Record<string, unknown> | undefined;

/**
 * Explicitly pre-load Vue for the adapter so that lifecycle hooks in
 * `useChart` are registered synchronously. Safe to call multiple times.
 */
export function initVueAdapter(vue: unknown): void {
  _vue = vue as Record<string, unknown>;
}

// Minimal proxy ref type for consumers who type-check against this file
export interface VueRef<T> { value: T }
export interface VueComputed<T> { readonly value: T }

export type VueChartOptions = Omit<ChartConfig, 'container'>;

export interface VueChartReturn {
  el: VueRef<HTMLElement | null>;
  engine: VueRef<Engine | null>;
  update: (config: Partial<ChartConfig>) => void;
  setData: (series: SeriesConfig[]) => void;
  addSeries: (series: SeriesConfig) => void;
  removeSeries: (id: string) => void;
  toggleSeries: (id: string) => void;
  setTheme: (theme: string | ThemeConfig) => void;
  exportChart: (format?: 'png' | 'svg' | 'jpeg') => Promise<Blob | string>;
  on: <T extends ChartEventType>(type: T, handler: ChartEventHandler<T>) => () => void;
  resize: (width?: number, height?: number) => void;
  addPoint: (seriesId: string, point: DataPoint, opts?: { shift?: boolean; maxPoints?: number }) => void;
  isMounted: VueComputed<boolean>;
}

// ---------------------------------------------------------------------------
// Internal: set up a chart with a synchronously-available Vue module.
// MUST be called during component setup() context.
// ---------------------------------------------------------------------------

function _setupChartSync(
  vue: Record<string, unknown>,
  options: VueChartOptions,
  elRef: VueRef<HTMLElement | null>,
  engineRef: VueRef<Engine | null>,
): void {
  const vueRef = vue.ref as (val: unknown) => VueRef<unknown>;
  const vueOnMounted = vue.onMounted as (cb: () => void) => void;
  const vueOnBeforeUnmount = vue.onBeforeUnmount as (cb: () => void) => void;
  const vueWatch = vue.watch as (
    source: () => unknown,
    cb: (val: unknown) => void,
    opts?: { deep?: boolean },
  ) => void;

  // Replace plain refs with Vue reactive refs so the template layer is reactive
  const reactiveEl = vueRef(null) as VueRef<HTMLElement | null>;
  const reactiveEngine = vueRef(null) as VueRef<Engine | null>;

  Object.defineProperty(elRef, 'value', {
    get: () => reactiveEl.value,
    set: (v) => { reactiveEl.value = v; },
    configurable: true,
  });
  Object.defineProperty(engineRef, 'value', {
    get: () => reactiveEngine.value,
    set: (v) => { reactiveEngine.value = v; },
    configurable: true,
  });

  // Lifecycle hooks MUST be called synchronously in setup() context.
  vueOnMounted(() => {
    if (!reactiveEl.value) return;
    reactiveEngine.value = new Engine({ ...options, container: reactiveEl.value });
  });

  vueOnBeforeUnmount(() => {
    reactiveEngine.value?.destroy();
    reactiveEngine.value = null;
  });

  vueWatch(
    () => options,
    (newOpts) => { reactiveEngine.value?.update(newOpts as VueChartOptions); },
    { deep: true },
  );
}

/**
 * Vue 3 composable that creates and manages a RiskLab chart.
 * Must be called inside a Vue component setup() function.
 *
 * For reliable lifecycle hook registration, call `initVueAdapter(Vue)` once
 * at your application entry point before using this composable.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useChart } from '@risklab/charts-vue';
 * const { el, engine, setTheme } = useChart({ series: [...], theme: 'dark' });
 * </script>
 * <template><div :ref="el" style="width:100%;height:400px" /></template>
 * ```
 */
export function useChart(options: VueChartOptions): VueChartReturn {
  const elRef: VueRef<HTMLElement | null> = { value: null };
  const engineRef: VueRef<Engine | null> = { value: null };
  const isMounted: VueComputed<boolean> = { get value() { return engineRef.value !== null; } };

  if (_vue) {
    // ── Synchronous path (preferred) ──────────────────────────────────────
    // Vue module already cached — lifecycle hooks register during setup().
    _setupChartSync(_vue, options, elRef, engineRef);
  } else {
    // ── Async fallback path ───────────────────────────────────────────────
    // Dynamic import resolves in the next microtask tick, which means onMounted /
    // onBeforeUnmount are called AFTER this setup() returns and the Vue component
    // instance is no longer current. This can silently fail in Vue 3.
    //
    // To fix: call initVueAdapter(Vue) at your app entry point so the sync
    // path above is used instead.
    void (async () => {
      let vue: Record<string, unknown>;
      try {
        vue = await import(/* @vite-ignore */ 'vue' as string) as Record<string, unknown>;
        _vue = vue; // cache for future calls
      } catch {
        console.error(
          '[RiskLab] Vue 3 not found. Install vue@^3 as a peer dependency, ' +
          'then call initVueAdapter(Vue) at your app entry point.',
        );
        return;
      }

      // At this point we are outside the component setup() context. In Vue 3,
      // calling onMounted here will produce a warning and may not work.
      // This is a known limitation of the async fallback path.
      const vueRef = vue.ref as (val: unknown) => VueRef<unknown>;
      const vueOnMounted = vue.onMounted as (cb: () => void) => void | undefined;
      const vueOnBeforeUnmount = vue.onBeforeUnmount as (cb: () => void) => void | undefined;
      const vueWatch = vue.watch as (
        source: () => unknown,
        cb: (val: unknown) => void,
        opts?: { deep?: boolean },
      ) => void | undefined;

      const reactiveEl = vueRef(null) as VueRef<HTMLElement | null>;
      const reactiveEngine = vueRef(null) as VueRef<Engine | null>;

      Object.defineProperty(elRef, 'value', {
        get: () => reactiveEl.value,
        set: (v) => { reactiveEl.value = v; },
        configurable: true,
      });
      Object.defineProperty(engineRef, 'value', {
        get: () => reactiveEngine.value,
        set: (v) => { reactiveEngine.value = v; },
        configurable: true,
      });

      vueOnMounted?.(() => {
        if (!reactiveEl.value) return;
        reactiveEngine.value = new Engine({ ...options, container: reactiveEl.value });
      });

      vueOnBeforeUnmount?.(() => {
        reactiveEngine.value?.destroy();
        reactiveEngine.value = null;
      });

      vueWatch?.(() => options, (newOpts) => {
        reactiveEngine.value?.update(newOpts as VueChartOptions);
      }, { deep: true });
    })();
  }

  return {
    el: elRef,
    engine: engineRef,
    update: (cfg) => engineRef.value?.update(cfg),
    setData: (s) => engineRef.value?.setData(s),
    addSeries: (s) => engineRef.value?.addSeries(s),
    removeSeries: (id) => engineRef.value?.removeSeries(id),
    toggleSeries: (id) => engineRef.value?.toggleSeries(id),
    setTheme: (t) => engineRef.value?.setTheme(t),
    exportChart: async (fmt = 'png') => {
      if (!engineRef.value) throw new Error('Chart not mounted');
      return engineRef.value.export(fmt);
    },
    on: (type, handler) => engineRef.value?.on(type, handler) ?? (() => {}),
    resize: (w, h) => engineRef.value?.resize(w, h),
    addPoint: (sid, pt, opts) => engineRef.value?.addPoint(sid, pt, opts),
    isMounted,
  };
}

export function useTheme(initial: string | ThemeConfig = 'default') {
  const initialResolved = typeof initial === 'string'
    ? (registry.getTheme(initial) ?? defaultTheme)
    : initial;

  const theme: VueRef<ThemeConfig> = { value: initialResolved };
  const themeName: VueRef<string> = {
    value: typeof initial === 'string' ? initial : (initialResolved.id ?? 'custom'),
  };

  const setTheme = (t: string | ThemeConfig) => {
    const resolved = typeof t === 'string' ? (registry.getTheme(t) ?? defaultTheme) : t;
    theme.value = resolved;
    themeName.value = typeof t === 'string' ? t : (resolved.id ?? 'custom');
  };

  return { theme, themeName, setTheme };
}

export function useSync(options?: SyncOptions) {
  let ctrl: SyncController | null = null;
  const controller: VueRef<SyncController | null> = { value: null };

  const _mountFn = () => {
    ctrl = new SyncController(options ?? {});
    controller.value = ctrl;
  };
  const _unmountFn = () => {
    ctrl?.destroy();
    ctrl = null;
    controller.value = null;
  };

  if (_vue) {
    // ── Synchronous path (preferred) ────────────────────────────────────────
    // Vue module already cached via initVueAdapter() — lifecycle hooks register
    // synchronously during setup(), just like useChart does.
    const onMounted = _vue.onMounted as (cb: () => void) => void;
    const onBeforeUnmount = _vue.onBeforeUnmount as (cb: () => void) => void;
    onMounted(_mountFn);
    onBeforeUnmount(_unmountFn);
  } else {
    // ── Async fallback path ──────────────────────────────────────────────────
    // See useChart for a full explanation of why this path is unreliable.
    // Call initVueAdapter(Vue) at your app entry point to use the sync path.
    void (async () => {
      try {
        const vueModule = await import(/* @vite-ignore */ 'vue' as string) as Record<string, unknown>;
        const onMounted = vueModule.onMounted as (cb: () => void) => void;
        const onBeforeUnmount = vueModule.onBeforeUnmount as (cb: () => void) => void;
        onMounted(_mountFn);
        onBeforeUnmount(_unmountFn);
      } catch { /* no-op */ }
    })();
  }

  return {
    controller,
    syncEngine: (engine: Engine | null) => { if (engine) ctrl?.add(engine); },
  };
}

export { Engine, SyncController };
export type { SyncOptions };
