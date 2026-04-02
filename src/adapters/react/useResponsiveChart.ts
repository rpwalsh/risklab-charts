// ============================================================================
// RiskLab Charts — React: useResponsiveChart Hook
// Automatically resize chart on container resize via ResizeObserver
// ============================================================================

import { useEffect, useRef } from 'react';
import type { Engine } from '../../core/Engine';

export interface UseResponsiveChartOptions {
  /** The engine instance */
  engine: Engine | null;
  /** The container element ref */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Debounce interval in ms (default 100) */
  debounce?: number;
  /** Minimum width before chart collapses */
  minWidth?: number;
  /** Minimum height before chart collapses */
  minHeight?: number;
}

export function useResponsiveChart(options: UseResponsiveChartOptions): void {
  const { engine, containerRef, debounce = 100, minWidth = 200, minHeight = 150 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!engine || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width >= minWidth && height >= minHeight) {
            engine.resize(width, height);
          }
        }
      }, debounce);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [engine, containerRef, debounce, minWidth, minHeight]);
}
