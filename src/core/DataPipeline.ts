// ============================================================================
// RiskLab Charts — Data Pipeline
// Transforms raw SeriesConfig[] into render-ready processed data
// Handles stacking, sorting, filtering, aggregation, and time-slicing
// ============================================================================

import type { SeriesConfig, DataPoint, ChartConfig, DataValue } from './types';

export interface ProcessedSeries extends SeriesConfig {
  /** Processed data points (after stacking, sorting, etc.) */
  processedData: ProcessedDataPoint[];
  /** Stack baseline values (for stacked charts) */
  stackBaseline?: number[];
}

export interface ProcessedDataPoint extends DataPoint {
  /** Numeric x for plotting */
  xNum: number;
  /** Numeric y for plotting */
  yNum: number;
  /** Stack base y value */
  y0?: number;
  /** Stack top y value */
  y1?: number;
}

export type DataTransform = (
  series: SeriesConfig[],
  config: ChartConfig,
) => SeriesConfig[];

/**
 * The DataPipeline runs a chain of transforms over the raw series data,
 * producing render-ready processed output.
 */
export class DataPipeline {
  private transforms: Array<{ id: string; fn: DataTransform; order: number }> = [];

  constructor() {
    // Register built-in transforms in order.
    // IMPORTANT: numeric conversion (order 1) must run before decimation (order 5)
    // so that LTTB/MinMax have valid xNum/yNum values to work with.
    this.register('numeric-convert', convertToNumeric, 1);
    this.register('filter-visible', filterVisibleSeries, 2);
    this.register('decimate', applyDecimation, 5);
    this.register('sort-data', sortSeriesData, 10);
    this.register('compute-stacks', computeStacks, 20);
  }

  /**
   * Register a custom transform.
   * Lower order = runs first.
   */
  register(id: string, fn: DataTransform, order: number): void {
    // Remove existing with same id
    this.transforms = this.transforms.filter((t) => t.id !== id);
    this.transforms.push({ id, fn, order });
    this.transforms.sort((a, b) => a.order - b.order);
  }

  /**
   * Remove a transform by id.
   */
  unregister(id: string): void {
    this.transforms = this.transforms.filter((t) => t.id !== id);
  }

  /**
   * Run the full pipeline, returning processed series.
   */
  process(series: SeriesConfig[], config: ChartConfig): ProcessedSeries[] {
    let data = structuredClone(series);

    for (const transform of this.transforms) {
      const result = transform.fn(data, config);
      if (result) data = result;
    }

    return data as ProcessedSeries[];
  }

  /**
   * Slice data for timeline playback — returns only data up to `frameTime`.
   */
  sliceForTimeline(
    series: SeriesConfig[],
    timeKey: string,
    frameTime: DataValue,
  ): SeriesConfig[] {
    const frameNum = toNumber(frameTime);
    return series.map((s) => ({
      ...s,
      data: s.data.filter((d) => {
        // Prefer explicit meta[timeKey]; fall back to d.x only when it's numeric/Date
        const raw = d.meta?.[timeKey];
        if (raw !== undefined) return toNumber(raw as DataValue) <= frameNum;
        if (typeof d.x === 'number' || d.x instanceof Date) return toNumber(d.x) <= frameNum;
        // String x-values have no numeric time meaning — keep the point
        return true;
      }),
    }));
  }
}

// ---------------------------------------------------------------------------
// Built-in Transforms
// ---------------------------------------------------------------------------

function filterVisibleSeries(series: SeriesConfig[]): SeriesConfig[] {
  return series.filter((s) => s.visible !== false);
}

function sortSeriesData(series: SeriesConfig[]): SeriesConfig[] {
  return series.map((s) => {
    // Only sort for continuous chart types
    const sortable = ['line', 'area', 'stackedArea', 'scatter', 'bubble'];
    if (!sortable.includes(s.type)) return s;
    return {
      ...s,
      data: [...s.data].sort((a, b) => toNumber(a.x) - toNumber(b.x)),
    };
  });
}

function computeStacks(series: SeriesConfig[], _config: ChartConfig): SeriesConfig[] {
  // Group by stackGroup while preserving original order
  const groups = new Map<string, SeriesConfig[]>();

  for (const s of series) {
    if (s.stackGroup) {
      const group = groups.get(s.stackGroup) ?? [];
      group.push(s);
      groups.set(s.stackGroup, group);
    }
  }

  // For each stack group, compute cumulative values
  for (const [, group] of groups) {
    const xValues = new Set<string>();
    for (const s of group) {
      for (const d of s.data) {
        xValues.add(String(d.x));
      }
    }

    const cumulative = new Map<string, number>();
    for (const xv of xValues) {
      cumulative.set(xv, 0);
    }

    for (const s of group) {
      const processedData: ProcessedDataPoint[] = [];
      for (const d of s.data) {
        const xKey = String(d.x);
        const base = cumulative.get(xKey) ?? 0;
        const yVal = toNumber(d.y);
        processedData.push({
          ...d,
          xNum: toNumber(d.x),
          yNum: yVal,
          y0: base,
          y1: base + yVal,
        });
        cumulative.set(xKey, base + yVal);
      }
      // Store processed data on the series object in-place (by group reference)
      (s as SeriesConfig & { data: ProcessedDataPoint[] }).data = processedData;
    }
  }

  // Return ALL series in original order (stacked series were mutated in-place)
  return series;
}

function convertToNumeric(series: SeriesConfig[]): SeriesConfig[] {
  return series.map((s) => ({
    ...s,
    data: s.data.map((d) => ({
      ...d,
      xNum: (d as ProcessedDataPoint).xNum ?? toNumber(d.x),
      yNum: (d as ProcessedDataPoint).yNum ?? toNumber(d.y),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toNumber(val: DataValue): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  const n = Number(val);
  if (!Number.isNaN(n)) return n;
  // Fall back to date-string parsing (covers ISO-8601 and similar formats)
  if (typeof val === 'string') {
    const ts = Date.parse(val);
    if (!Number.isNaN(ts)) return ts;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Data Decimation — Largest-Triangle-Three-Buckets (LTTB)
// Reference: Steinn Gudmundsson, "Downsampling Time Series for Visual Representation" (2013)
// ---------------------------------------------------------------------------

/**
 * Downsample an array of {xNum, yNum} points to at most `threshold` points
 * using the LTTB algorithm, which preserves the visual shape of the data.
 */
export function decimateLTTB<T extends { xNum: number; yNum: number }>(
  data: T[],
  threshold: number,
): T[] {
  const n = data.length;
  if (n <= threshold || threshold < 3) return data;

  const sampled: T[] = [];
  // Always keep first point
  sampled.push(data[0]!);

  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0; // Previous selected point index

  for (let i = 0; i < threshold - 2; i++) {
    // Calculate bucket boundaries
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n - 1);

    // Point A (already selected, used for triangle area calculation)
    const ax = data[a]!.xNum;
    const ay = data[a]!.yNum;

    // Average of next bucket (point C)
    const nextBucketStart = bucketEnd;
    const nextBucketEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, n);
    let avgX = 0, avgY = 0, count = 0;
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += data[j]!.xNum;
      avgY += data[j]!.yNum;
      count++;
    }
    if (count > 0) { avgX /= count; avgY /= count; }

    // Find point in current bucket with max triangle area
    let maxArea = -1;
    let maxIdx = bucketStart;
    for (let j = bucketStart; j < bucketEnd; j++) {
      const bx = data[j]!.xNum;
      const by = data[j]!.yNum;
      // Triangle area = 0.5 * |ax*(by-avgY) + bx*(avgY-ay) + avgX*(ay-by)|
      const area = Math.abs(ax * (by - avgY) + bx * (avgY - ay) + avgX * (ay - by)) * 0.5;
      if (area > maxArea) { maxArea = area; maxIdx = j; }
    }

    sampled.push(data[maxIdx]!);
    a = maxIdx;
  }

  // Always keep last point
  sampled.push(data[n - 1]!);
  return sampled;
}

/**
 * Downsample using min-max method: split into buckets, keep min+max per bucket.
 * Faster than LTTB, retains extreme values (peaks/troughs).
 */
export function decimateMinMax<T extends { xNum: number; yNum: number }>(
  data: T[],
  threshold: number,
): T[] {
  const n = data.length;
  if (n <= threshold || threshold < 4) return data;

  const sampled: T[] = [data[0]!];
  const buckets = Math.floor(threshold / 2);
  const bucketSize = (n - 2) / buckets;

  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * bucketSize) + 1;
    const end = Math.min(Math.floor((i + 1) * bucketSize) + 1, n - 1);
    if (start >= end) continue;

    let minIdx = start, maxIdx = start;
    for (let j = start + 1; j < end; j++) {
      if (data[j]!.yNum < data[minIdx]!.yNum) minIdx = j;
      if (data[j]!.yNum > data[maxIdx]!.yNum) maxIdx = j;
    }
    // Add in chronological order
    if (minIdx < maxIdx) { sampled.push(data[minIdx]!); sampled.push(data[maxIdx]!); }
    else if (minIdx > maxIdx) { sampled.push(data[maxIdx]!); sampled.push(data[minIdx]!); }
    else { sampled.push(data[minIdx]!); }
  }

  sampled.push(data[n - 1]!);
  return sampled;
}

/** @internal DataTransform that applies LTTB decimation per series when configured */
function applyDecimation(series: SeriesConfig[]): SeriesConfig[] {
  return series.map((s) => {
    const dec = s.decimation;
    if (!dec || dec.enabled === false) return s;
    const threshold = dec.threshold ?? 1000;
    const data = s.data as (DataPoint & { xNum: number; yNum: number })[];
    if (data.length <= threshold) return s;

    const decimated = dec.algorithm === 'minmax'
      ? decimateMinMax(data, threshold)
      : decimateLTTB(data, threshold);
    return { ...s, data: decimated as DataPoint[] };
  });
}

export default DataPipeline;
