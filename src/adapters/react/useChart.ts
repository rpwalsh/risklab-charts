// ============================================================================
// RiskLab Charts — React: useChart Hook
// Core React hook for creating and managing chart instances
// ============================================================================

import { useRef, useCallback, useEffect, useState } from 'react';
import { Engine } from '../../core/Engine';
import type { EngineInternalAPI } from '../../core/Engine';
import type { ChartConfig, ChartEventType, ChartEventHandler, SeriesConfig, ThemeConfig, DataPoint } from '../../core/types';

export type UseChartOptions = Omit<ChartConfig, 'container'>;

export interface UseChartReturn {
  /** Ref to attach to the chart container div */
  chartRef: React.RefObject<HTMLDivElement | null>;
  /** The engine instance (available after mount) */
  engine: Engine | null;
  /** Update chart configuration */
  update: (config: Partial<ChartConfig>) => void;
  /** Replace all series data */
  setData: (series: SeriesConfig[]) => void;
  /** Add a series */
  addSeries: (series: SeriesConfig) => void;
  /** Remove a series by id */
  removeSeries: (id: string) => void;
  /** Toggle series visibility */
  toggleSeries: (id: string) => void;
  /** Set theme */
  setTheme: (theme: string | ThemeConfig) => void;
  /** Export chart */
  exportChart: (format?: 'png' | 'svg' | 'jpeg') => Promise<Blob | string>;
  /** Subscribe to chart events */
  on: <T extends ChartEventType>(type: T, handler: ChartEventHandler<T>) => () => void;
  /** Resize chart */
  resize: (width?: number, height?: number) => void;
  /** Append a single data point (real-time streaming) */
  addPoint: (
    seriesId: string,
    point: DataPoint,
    options?: { shift?: boolean; redraw?: boolean; maxPoints?: number },
  ) => void;
  /** Append multiple data points in a single render */
  addPoints: (
    seriesId: string,
    points: DataPoint[],
    options?: { shift?: boolean; redraw?: boolean; maxPoints?: number },
  ) => void;
  /** Update a data point in-place */
  updatePoint: (seriesId: string, index: number, update: Partial<DataPoint>) => void;
  /** Trigger print dialog (requires PrintPlugin) */
  print: () => void;
  /** Is the chart mounted? */
  isMounted: boolean;
}

function hashString(input: string, seed = 2166136261): number {
  let hash = seed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fingerprintValue(
  value: unknown,
  seen: WeakSet<object>,
  seed = 2166136261,
): number {
  if (value == null) return hashString(String(value), seed);
  if (typeof value === 'function') return hashString('[fn]', seed);
  if (typeof value === 'string') return hashString(`s:${value}`, seed);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return hashString(`${typeof value}:${String(value)}`, seed);
  }
  if (Array.isArray(value)) {
    let hash = hashString(`[${value.length}]`, seed);
    for (let i = 0; i < value.length; i++) {
      hash = fingerprintValue(value[i], seen, hash);
    }
    return hash;
  }
  if (typeof value === 'object') {
    if (value instanceof Date) return hashString(`date:${value.toISOString()}`, seed);
    if (seen.has(value)) return hashString('[circular]', seed);
    seen.add(value);
    let hash = seed;
    for (const key of Object.keys(value).sort()) {
      hash = hashString(key, hash);
      hash = fingerprintValue((value as Record<string, unknown>)[key], seen, hash);
    }
    return hash;
  }
  return hashString(String(value), seed);
}

function fingerprintChartOptions(options: UseChartOptions): string {
  return fingerprintValue(options, new WeakSet()).toString(36);
}

/**
 * React hook for creating a RiskLab chart.
 *
 * Usage:
 * ```tsx
 * function MyChart() {
 *   const { chartRef } = useChart({
 *     series: [{ id: 's1', name: 'Revenue', type: 'line', data: [...] }],
 *     theme: 'dark',
 *   });
 *   return <div ref={chartRef} style={{ width: '100%', height: 400 }} />;
 * }
 * ```
 */
export function useChart(options: UseChartOptions): UseChartReturn {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const lastFingerprintRef = useRef<string | null>(null);
  const optionsFingerprint = fingerprintChartOptions(options);

  // Init engine on mount
  useEffect(() => {
    if (!chartRef.current) return;

    const engine = new Engine({
      ...options,
      container: chartRef.current,
    });

    engineRef.current = engine;
    lastFingerprintRef.current = optionsFingerprint;
    setIsMounted(true);

    return () => {
      engine.destroy();
      engineRef.current = null;
      lastFingerprintRef.current = null;
      setIsMounted(false);
    };
    // Only create once; subsequent option changes flow through engine.update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engineRef.current && isMounted && lastFingerprintRef.current !== optionsFingerprint) {
      lastFingerprintRef.current = optionsFingerprint;
      engineRef.current.update(options);
    }
  }, [isMounted, optionsFingerprint, options]);

  const update = useCallback((config: Partial<ChartConfig>) => {
    engineRef.current?.update(config);
  }, []);

  const setData = useCallback((series: SeriesConfig[]) => {
    engineRef.current?.setData(series);
  }, []);

  const addSeries = useCallback((series: SeriesConfig) => {
    engineRef.current?.addSeries(series);
  }, []);

  const removeSeries = useCallback((id: string) => {
    engineRef.current?.removeSeries(id);
  }, []);

  const toggleSeries = useCallback((id: string) => {
    engineRef.current?.toggleSeries(id);
  }, []);

  const setTheme = useCallback((theme: string | ThemeConfig) => {
    engineRef.current?.setTheme(theme);
  }, []);

  const exportChart = useCallback(async (format: 'png' | 'svg' | 'jpeg' = 'png') => {
    if (!engineRef.current) throw new Error('Chart not mounted');
    return engineRef.current.export(format);
  }, []);

  const on = useCallback(<T extends ChartEventType>(type: T, handler: ChartEventHandler<T>) => {
    return engineRef.current?.on(type, handler) ?? (() => {});
  }, []);

  const resize = useCallback((width?: number, height?: number) => {
    engineRef.current?.resize(width, height);
  }, []);

  const addPoint = useCallback((
    seriesId: string,
    point: DataPoint,
    opts?: { shift?: boolean; redraw?: boolean; maxPoints?: number },
  ) => {
    engineRef.current?.addPoint(seriesId, point, opts);
  }, []);

  const addPoints = useCallback((
    seriesId: string,
    points: DataPoint[],
    opts?: { shift?: boolean; redraw?: boolean; maxPoints?: number },
  ) => {
    engineRef.current?.addPoints(seriesId, points, opts);
  }, []);

  const updatePoint = useCallback((
    seriesId: string,
    index: number,
    update: Partial<DataPoint>,
  ) => {
    engineRef.current?.updatePoint(seriesId, index, update);
  }, []);

  const print = useCallback(() => {
    const eng = engineRef.current as unknown as EngineInternalAPI | null;
    if (eng?._printChart) eng._printChart();
  }, []);

  return {
    chartRef,
    engine: engineRef.current,
    update,
    setData,
    addSeries,
    removeSeries,
    toggleSeries,
    setTheme,
    exportChart,
    on,
    resize,
    addPoint,
    addPoints,
    updatePoint,
    print,
    isMounted,
  };
}
