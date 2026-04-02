// ============================================================================
// RiskLab Charts — Boost Module
// Web Worker–based data downsampling and processing for 1M+ point datasets.
// Surpasses Highcharts Boost: no GL artifacts, no series limit, pure TS.
// ============================================================================

import type { DataPoint } from '../core/types';
import type { ProcessedDataPoint } from '../core/DataPipeline';

// ─── Worker script (inlined as blob URL) ─────────────────────────────────────

const WORKER_CODE = `
// RiskLab Boost Worker
// Receives: { type, id, data, options }
// Sends back: { type, id, result }

function lttb(data, threshold) {
  const n = data.length;
  if (threshold >= n || threshold <= 2) return data;

  const sampled = [];
  let sampledIdx = 0;
  const every = (n - 2) / (threshold - 2);

  sampled[sampledIdx++] = data[0];

  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0, avgY = 0;
    const start = Math.floor((i + 1) * every) + 1;
    const end   = Math.min(Math.floor((i + 2) * every) + 1, n);
    const len   = end - start;
    for (let j = start; j < end; j++) {
      avgX += data[j].x;
      avgY += (data[j].y1 ?? data[j].y);
    }
    avgX /= len;
    avgY /= len;

    let maxArea = -1, nextA = a;
    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd   = Math.min(Math.floor((i + 1) * every) + 1, n);
    for (let j = rangeStart; j < rangeEnd; j++) {
      const ay = data[a].y1 ?? data[a].y;
      const jy = data[j].y1 ?? data[j].y;
      const area = Math.abs(
        (data[a].x - avgX) * (jy - ay) -
        (data[a].x - data[j].x) * (avgY - ay)
      ) * 0.5;
      if (area > maxArea) { maxArea = area; nextA = j; }
    }

    sampled[sampledIdx++] = data[nextA];
    a = nextA;
  }

  sampled[sampledIdx++] = data[n - 1];
  return sampled;
}

function minMaxDecimate(data, pixelWidth) {
  if (data.length <= pixelWidth * 2) return data;
  let xMin = Infinity, xMax = -Infinity;
  for (let _i = 0; _i < data.length; _i++) {
    const v = data[_i].x;
    if (v < xMin) xMin = v;
    if (v > xMax) xMax = v;
  }
  const buckets = new Array(pixelWidth).fill(null).map(() => ({ min: Infinity, max: -Infinity, minD: null, maxD: null }));
  for (const d of data) {
    const bi = Math.min(Math.floor((d.x - xMin) / (xMax - xMin) * pixelWidth), pixelWidth - 1);
    const b = buckets[bi];
    const y = d.y1 ?? d.y;
    if (y < b.min) { b.min = y; b.minD = d; }
    if (y > b.max) { b.max = y; b.maxD = d; }
  }
  const result = [];
  for (const b of buckets) {
    if (b.minD) result.push(b.minD);
    if (b.maxD && b.maxD !== b.minD) result.push(b.maxD);
  }
  result.sort((a, b) => a.x - b.x);
  return result;
}

function sortData(data) {
  return [...data].sort((a, b) => a.x - b.x);
}

self.onmessage = function(e) {
  const { type, id, data, options } = e.data;
  try {
    let result;
    switch (type) {
      case 'lttb':
        result = lttb(data, options.threshold ?? 1000);
        break;
      case 'minmax':
        result = minMaxDecimate(data, options.pixelWidth ?? 800);
        break;
      case 'sort':
        result = sortData(data);
        break;
      default:
        result = data;
    }
    self.postMessage({ type: 'result', id, result });
  } catch(err) {
    self.postMessage({ type: 'error', id, error: err.message });
  }
};
`;

// ─── BoostWorker ─────────────────────────────────────────────────────────────

export type BoostOperation = 'lttb' | 'minmax' | 'sort';

export interface BoostOptions {
  /** For lttb: number of output points (default: 1000) */
  threshold?: number;
  /** For minmax: chart pixel width (default: 800) */
  pixelWidth?: number;
  /** Default operation when data length > threshold (default: 'lttb') */
  defaultOp?: BoostOperation;
  /** Auto-trigger threshold: only run if data.length > this (default: 5000) */
  autoThreshold?: number;
}

/**
 * Boost worker wraps expensive data operations in a Web Worker so the main
 * thread never blocks. Falls back to synchronous execution if Workers are
 * unavailable (SSR / Node).
 *
 * @example
 * ```ts
 * const boost = new BoostWorker();
 * const decimated = await boost.lttb(rawData, { threshold: 2000 });
 * ```
 */
export class BoostWorker {
  private worker: Worker | null = null;
  private pending = new Map<number, { resolve: (v: DataPoint[]) => void; reject: (e: Error) => void }>();
  private nextId = 1;

  constructor(private options: BoostOptions = {}) {
    if (typeof Worker !== 'undefined') {
      try {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.worker = new Worker(url);
        this.worker.onmessage = this._onMessage.bind(this);
        this.worker.onerror = (e) => {
          console.warn('[RiskLab Boost] Worker error:', e.message);
        };
        // Clean up object URL after worker is created
        URL.revokeObjectURL(url);
      } catch {
        this.worker = null;
      }
    }
  }

  /** Larsson-Tobler-Thiemann-Buchs (LTTB) downsampling */
  lttb(data: DataPoint[], opts?: Pick<BoostOptions, 'threshold'>): Promise<DataPoint[]> {
    return this._dispatch('lttb', data, { threshold: opts?.threshold ?? this.options.threshold ?? 1000 });
  }

  /** Min-Max bucket decimation (preserves peaks and troughs) */
  minmax(data: DataPoint[], opts?: Pick<BoostOptions, 'pixelWidth'>): Promise<DataPoint[]> {
    return this._dispatch('minmax', data, { pixelWidth: opts?.pixelWidth ?? this.options.pixelWidth ?? 800 });
  }

  /** Sort data by x ascending */
  sort(data: DataPoint[]): Promise<DataPoint[]> {
    return this._dispatch('sort', data, {});
  }

  /**
   * Auto-decimate: only runs if data.length > autoThreshold (default 5000).
   * Uses lttb by default.
   */
  async auto(data: DataPoint[], opts?: BoostOptions): Promise<DataPoint[]> {
    const threshold = opts?.autoThreshold ?? this.options.autoThreshold ?? 5000;
    if (data.length <= threshold) return data;
    const op = opts?.defaultOp ?? this.options.defaultOp ?? 'lttb';
    return this._dispatch(op, data, (opts ?? {}) as Record<string, unknown>);
  }

  /** Terminate the worker — call when the chart is destroyed */
  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [, p] of this.pending) p.reject(new Error('BoostWorker destroyed'));
    this.pending.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _dispatch(type: BoostOperation, data: DataPoint[], options: Record<string, unknown>): Promise<DataPoint[]> {
    if (!this.worker) {
      // Synchronous fallback
      return Promise.resolve(this._syncFallback(type, data, options));
    }

    const id = this.nextId++;
    return new Promise<DataPoint[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ type, id, data, options });
    });
  }

  private _onMessage(e: MessageEvent) {
    const { type, id, result, error } = e.data;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    if (type === 'error') {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  }

  private _syncFallback(type: BoostOperation, data: DataPoint[], options: Record<string, unknown>): DataPoint[] {
    switch (type) {
      case 'lttb': return lttbSync(data, (options.threshold as number) ?? 1000);
      case 'minmax': return minMaxSync(data, (options.pixelWidth as number) ?? 800);
      case 'sort': return [...data].sort((a, b) => (a.x as number) - (b.x as number));
      default: return data;
    }
  }
}

// ─── Synchronous implementations (used as fallbacks) ─────────────────────────

export function lttbSync(data: DataPoint[], threshold: number): DataPoint[] {
  const n = data.length;
  if (threshold >= n || threshold <= 2) return data;

  const sampled: DataPoint[] = [];
  let a = 0;
  const every = (n - 2) / (threshold - 2);

  sampled.push(data[0]!);

  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0, avgY = 0;
    const start = Math.floor((i + 1) * every) + 1;
    const end = Math.min(Math.floor((i + 2) * every) + 1, n);
    const len = end - start;
    for (let j = start; j < end; j++) {
      avgX += Number(data[j]!.x);
      avgY += Number((data[j] as ProcessedDataPoint).y1 ?? data[j]!.y);
    }
    avgX /= len;
    avgY /= len;

    let maxArea = -1, nextA = a;
    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd = Math.min(Math.floor((i + 1) * every) + 1, n);
    for (let j = rangeStart; j < rangeEnd; j++) {
      const ay = Number((data[a] as ProcessedDataPoint).y1 ?? data[a]!.y);
      const jy = Number((data[j] as ProcessedDataPoint).y1 ?? data[j]!.y);
      const ax = Number(data[a]!.x);
      const jx = Number(data[j]!.x);
      const area = Math.abs((ax - avgX) * (jy - ay) - (ax - jx) * (avgY - ay)) * 0.5;
      if (area > maxArea) { maxArea = area; nextA = j; }
    }
    sampled.push(data[nextA]!);
    a = nextA;
  }

  sampled.push(data[n - 1]!);
  return sampled;
}

export function minMaxSync(data: DataPoint[], pixelWidth: number): DataPoint[] {
  if (data.length <= pixelWidth * 2) return data;
  let xMin = Infinity, xMax = -Infinity;
  for (let _i = 0; _i < data.length; _i++) {
    const v = Number(data[_i]!.x);
    if (v < xMin) xMin = v;
    if (v > xMax) xMax = v;
  }
  const span = xMax - xMin || 1;

  interface Bucket { min: number; max: number; minD: DataPoint | null; maxD: DataPoint | null }
  const buckets: Bucket[] = Array.from({ length: pixelWidth }, () => ({
    min: Infinity, max: -Infinity, minD: null, maxD: null,
  }));

  for (const d of data) {
    const bi = Math.min(Math.floor((Number(d.x) - xMin) / span * pixelWidth), pixelWidth - 1);
    const b = buckets[bi]!;
    const y = Number((d as ProcessedDataPoint).y1 ?? d.y);
    if (y < b.min) { b.min = y; b.minD = d; }
    if (y > b.max) { b.max = y; b.maxD = d; }
  }

  const result: DataPoint[] = [];
  for (const b of buckets) {
    if (b.minD) result.push(b.minD);
    if (b.maxD && b.maxD !== b.minD) result.push(b.maxD);
  }
  return result.sort((a, b) => Number(a.x) - Number(b.x));
}

// ─── DataPipeline integration hook ───────────────────────────────────────────

/**
 * Create a plugin-compatible decimation function for the DataPipeline.
 * Used internally when `series.decimation = { enabled: true, algorithm: 'boost' }`.
 */
export function createBoostDecimator(opts: BoostOptions = {}): (data: DataPoint[]) => DataPoint[] {
  const threshold = opts.threshold ?? 1000;
  const autoThreshold = opts.autoThreshold ?? 5000;
  const op = opts.defaultOp ?? 'lttb';
  return (data: DataPoint[]) => {
    if (data.length <= autoThreshold) return data;
    return op === 'minmax'
      ? minMaxSync(data, opts.pixelWidth ?? 800)
      : lttbSync(data, threshold);
  };
}
