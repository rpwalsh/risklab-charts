// ============================================================================
// RiskLab Charts — React: useRealtime Hook
// High-frequency data streaming with automatic throttling and ring-buffer.
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import type { Engine } from '../../core/Engine';
import type { DataPoint } from '../../core/types';

export interface UseRealtimeOptions {
  /** Target series id */
  seriesId: string;
  /** Max points to keep in the rolling window (default: 300) */
  maxPoints?: number;
  /** Throttle ms between renders (default: 16 = ~60fps) */
  throttleMs?: number;
  /** Whether to shift old points off as new arrive (default: true) */
  shift?: boolean;
  /** Engine instance — can also come from ref */
  engine?: Engine | null;
}

export interface UseRealtimeReturn {
  /** Push one or more points; will throttle rendering automatically */
  push: (points: DataPoint | DataPoint[]) => void;
  /** Flush any pending points immediately */
  flush: () => void;
  /** Clear all queued points */
  clear: () => void;
  /** Attach to an engine (call from onReady) */
  attachEngine: (engine: Engine | null) => void;
}

/**
 * Efficient real-time data streaming hook with throttled rendering.
 * Uses a ring buffer to accumulate points between frames.
 *
 * @example
 * ```tsx
 * const rt = useRealtime({ seriesId: 'live', maxPoints: 500, throttleMs: 33 });
 * <Chart onReady={rt.attachEngine} series={initialSeries} />
 *
 * // In a WebSocket handler:
 * ws.onmessage = (e) => rt.push({ x: Date.now(), y: parseFloat(e.data) });
 * ```
 */
export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const { seriesId, maxPoints = 300, throttleMs = 16, shift: _shift = true } = options;

  const engineRef = useRef<Engine | null>(options.engine ?? null);
  const queueRef = useRef<DataPoint[]>([]);
  const lastFlushRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Flush pending queue to the engine
  const flush = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || queueRef.current.length === 0) return;
    const points = queueRef.current.splice(0);
    engine.addPoints(seriesId, points, { maxPoints, redraw: true });
    lastFlushRef.current = Date.now();
  }, [seriesId, maxPoints]);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    const delay = Math.max(0, throttleMs - (Date.now() - lastFlushRef.current));
    if (delay === 0) {
      flush();
    } else {
      rafRef.current = window.setTimeout(() => {
        rafRef.current = null;
        flush();
      }, delay) as unknown as number;
    }
  }, [flush, throttleMs]);

  const push = useCallback((incoming: DataPoint | DataPoint[]) => {
    const pts = Array.isArray(incoming) ? incoming : [incoming];
    queueRef.current.push(...pts);
    scheduleFlush();
  }, [scheduleFlush]);

  const clear = useCallback(() => {
    queueRef.current = [];
    if (rafRef.current !== null) {
      clearTimeout(rafRef.current as unknown as number);
      rafRef.current = null;
    }
  }, []);

  const attachEngine = useCallback((engine: Engine | null) => {
    engineRef.current = engine;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) clearTimeout(rafRef.current as unknown as number);
    };
  }, []);

  return { push, flush, clear, attachEngine };
}
