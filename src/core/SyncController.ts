// ============================================================================
// RiskLab Charts — SyncController
// Synchronize pan, zoom, hover, crosshair, and selection across multiple chart
// instances. Equivalent to (but more powerful than) Highcharts Boost sync.
// ============================================================================

import type { Engine, SyncableChart } from '../core/Engine';
import type { ChartState } from '../core/types';

export interface SyncOptions {
  /** Synchronize zoom/pan across charts (default: true) */
  zoom?: boolean;
  /** Synchronize vertical crosshair / hover position (default: true) */
  crosshair?: boolean;
  /** Synchronize tooltip (all charts show tooltip at same x) */
  tooltip?: boolean;
  /** Which axis to use for synchronization: 'x' | 'y' | 'both' (default: 'x') */
  axis?: 'x' | 'y' | 'both';
  /** Debounce ms for zoom/pan sync (default: 0 — immediate) */
  debounce?: number;
}

type SyncEventType = 'zoom' | 'crosshair' | 'tooltip' | 'clearCrosshair';

interface SyncPayload {
  type: SyncEventType;
  /** Source engine instance (to avoid echo) */
  source: Engine;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  /** Screen-space x fraction 0-1 for crosshair */
  xFraction?: number;
  /** Screen-space y fraction 0-1 */
  yFraction?: number;
}

/**
 * SyncController binds multiple `Engine` instances so their views stay
 * synchronized. It works by subscribing to each engine's events and
 * re-broadcasting the relevant information to all peers.
 *
 * @example
 * ```ts
 * const sync = new SyncController({ zoom: true, crosshair: true });
 * sync.add(chart1);
 * sync.add(chart2);
 * sync.add(chart3);
 * // All three charts will pan/zoom together and show a synchronized crosshair.
 * ```
 */
export class SyncController {
  private engines: Set<Engine> = new Set();
  private unsubscribers = new WeakMap<Engine, Array<() => void>>();
  private options: Required<SyncOptions>;
  private broadcasting = false; // re-entrancy guard

  constructor(options: SyncOptions = {}) {
    this.options = {
      zoom: options.zoom ?? true,
      crosshair: options.crosshair ?? true,
      tooltip: options.tooltip ?? true,
      axis: options.axis ?? 'x',
      debounce: options.debounce ?? 0,
    };
  }

  /** Add a chart to the sync group */
  add(engine: Engine): this {
    if (this.engines.has(engine)) return this;
    this.engines.add(engine);
    this.bindEngine(engine);
    return this;
  }

  /** Remove a chart from the sync group */
  remove(engine: Engine): this {
    if (!this.engines.has(engine)) return this;
    this.unsubscribers.get(engine)?.forEach(fn => fn());
    this.unsubscribers.delete(engine);
    this.engines.delete(engine);
    return this;
  }

  /** Remove all charts and clean up */
  destroy(): void {
    for (const engine of this.engines) {
      this.remove(engine);
    }
    this.engines.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private bindEngine(source: Engine): void {
    const unsubs: Array<() => void> = [];

    if (this.options.zoom) {
      // Listen for zoom/pan → broadcast axis range to peers.
      // Handles two payload shapes:
      //   1. Engine internal: { axisId, min, max }
      //   2. User/direct:     { xMin, xMax } or { yMin, yMax }
      const zoomPayload = (ev: unknown): Partial<SyncPayload> => {
        const p = (ev as { payload?: Record<string, unknown> }).payload ?? {};
        // Shape 1: axisId-based (Engine internals)
        const axisId = p.axisId as string | undefined;
        if (axisId) {
          return axisId.startsWith('y')
            ? { yMin: p.min as number, yMax: p.max as number }
            : { xMin: p.min as number, xMax: p.max as number };
        }
        // Shape 2: direct xMin/xMax (user API and tests)
        return {
          ...(p.xMin !== undefined ? { xMin: p.xMin as number } : {}),
          ...(p.xMax !== undefined ? { xMax: p.xMax as number } : {}),
          ...(p.yMin !== undefined ? { yMin: p.yMin as number } : {}),
          ...(p.yMax !== undefined ? { yMax: p.yMax as number } : {}),
        };
      };
      unsubs.push(source.on('zoom', (ev) => {
        this.broadcast({ type: 'zoom', source, ...zoomPayload(ev) });
      }));
      unsubs.push(source.on('pan', (ev) => {
        this.broadcast({ type: 'zoom', source, ...zoomPayload(ev) });
      }));
    }

    if (this.options.crosshair || this.options.tooltip) {
      // Listen for hover → sync crosshair to peers. We use internal mousemove
      // events; Engine emits 'hover' with point info
      unsubs.push(source.on('hover', (ev) => {
        const src = source as unknown as SyncableChart;
        const state: ChartState = src.state;
        if (!state?.chartArea) return;
        // Hover events carry the cursor position as top-level chartX/chartY,
        // NOT wrapped in a payload object.
        const pixelX = ev.chartX ?? 0;
        const pixelY = ev.chartY ?? 0;
        const xFrac = (pixelX - state.chartArea.x) / (state.chartArea.width || 1);
        const yFrac = (pixelY - state.chartArea.y) / (state.chartArea.height || 1);
        this.broadcast({ type: 'crosshair', source, xFraction: xFrac, yFraction: yFrac });
      }));

      unsubs.push(source.on('leave', () => {
        this.broadcast({ type: 'clearCrosshair', source });
      }));
    }

    this.unsubscribers.set(source, unsubs);
  }

  private broadcast(payload: SyncPayload): void {
    if (this.broadcasting) return;
    this.broadcasting = true;
    try {
      for (const target of this.engines) {
        if (target === payload.source) continue;
        this.applyToTarget(target, payload);
      }
    } finally {
      this.broadcasting = false;
    }
  }

  private applyToTarget(target: Engine, payload: SyncPayload): void {
    const t = target as unknown as SyncableChart;
    switch (payload.type) {
      case 'zoom': {
        const state: ChartState = t.state;
        if (!state) return;

        const xScale = state.scales.get('x0');
        const yScale = state.scales.get('y0');

        if (this.options.axis !== 'y' && xScale && payload.xMin !== undefined && payload.xMax !== undefined) {
          t.zoomToRange('x0', payload.xMin, payload.xMax);
        }
        if (this.options.axis !== 'x' && yScale && payload.yMin !== undefined && payload.yMax !== undefined) {
          t.zoomToRange('y0', payload.yMin, payload.yMax);
        }
        break;
      }

      case 'crosshair': {
        const state: ChartState = t.state;
        if (!state?.chartArea || payload.xFraction === undefined) return;
        const px = state.chartArea.x + payload.xFraction * state.chartArea.width;
        const py = state.chartArea.y + (payload.yFraction ?? 0.5) * state.chartArea.height;
        // Draw crosshair directly via internal method if available
        t._drawSyncCrosshair?.(px, py);
        // Otherwise use the public render-crosshair method
        t.renderCrosshairAt?.(px, py);
        break;
      }

      case 'clearCrosshair': {
        t._clearSyncCrosshair?.();
        t.clearCrosshair?.();
        break;
      }
    }
  }
}

// ── Convenience factory ────────────────────────────────────────────────────────

/**
 * Create a SyncController and immediately bind an initial set of charts.
 *
 * @example
 * const sync = syncCharts([chart1, chart2, chart3], { zoom: true, crosshair: true });
 */
export function syncCharts(engines: Engine[], options?: SyncOptions): SyncController {
  const ctrl = new SyncController(options);
  for (const eng of engines) ctrl.add(eng);
  return ctrl;
}
