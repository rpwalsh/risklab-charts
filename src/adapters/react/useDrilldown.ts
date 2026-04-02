// ============================================================================
// RiskLab Charts — React: useDrilldown Hook
// Manages drill-down / drill-up navigation state for hierarchical charts.
// ============================================================================

import { useState, useCallback, useRef } from 'react';
import type { SeriesConfig } from '../../core/types';

export interface DrilldownLevel {
  /** Label shown in breadcrumb */
  label: string;
  /** Series displayed at this level */
  series: SeriesConfig[];
  /** Key that was clicked to reach this level */
  key?: string | number;
}

export interface UseDrilldownOptions {
  /** Root-level series (level 0) */
  rootSeries: SeriesConfig[];
  /**
   * Map from a data-point key to the series to drill into.
   * When the user clicks a point, the key (x value or explicit `drilldownId`)
   * is looked up here to decide what series to render next.
   */
  levels?: Record<string | number, DrilldownLevel>;
  /** Called whenever the active level changes */
  onChange?: (level: DrilldownLevel, depth: number) => void;
}

export interface UseDrilldownReturn {
  /** The series to render at the current level */
  activeSeries: SeriesConfig[];
  /** Depth — 0 is root */
  depth: number;
  /** Breadcrumb trail */
  breadcrumbs: DrilldownLevel[];
  /** Whether we can drill up */
  canDrillUp: boolean;
  /** Call with a point's key (x value / drilldownId) to drill down */
  drillDown: (key: string | number, label?: string) => void;
  /** Go back one level */
  drillUp: () => void;
  /** Jump to a specific breadcrumb index */
  drillTo: (depth: number) => void;
  /** Reset to root */
  reset: () => void;
}

/**
 * React hook for drill-down navigation in hierarchical charts.
 *
 * @example
 * ```tsx
 * const drilldown = useDrilldown({
 *   rootSeries: [{ id: 'countries', type: 'bar', ... }],
 *   levels: {
 *     'USA': { label: 'USA', series: [{ id: 'usa-states', type: 'bar', ... }] },
 *   },
 * });
 *
 * <Chart
 *   series={drilldown.activeSeries}
 *   onClick={(e) => drilldown.drillDown(e.point?.x ?? 0)}
 * />
 * ```
 */
export function useDrilldown(options: UseDrilldownOptions): UseDrilldownReturn {
  const { rootSeries, levels = {}, onChange } = options;

  const rootLevel: DrilldownLevel = { label: 'Home', series: rootSeries };
  const [stack, setStack] = useState<DrilldownLevel[]>([rootLevel]);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const current = stack[stack.length - 1]!;

  const drillDown = useCallback((key: string | number, fallbackLabel?: string) => {
    const level = levelsRef.current[key];
    if (!level) return;
    const resolved: DrilldownLevel = {
      ...level,
      label: level.label ?? fallbackLabel ?? String(key),
      key,
    };
    setStack(prev => {
      const next = [...prev, resolved];
      onChange?.(resolved, next.length - 1);
      return next;
    });
  }, [onChange]);

  const drillUp = useCallback(() => {
    setStack(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      onChange?.(next[next.length - 1]!, next.length - 1);
      return next;
    });
  }, [onChange]);

  const drillTo = useCallback((depth: number) => {
    setStack(prev => {
      if (depth < 0 || depth >= prev.length) return prev;
      const next = prev.slice(0, depth + 1);
      onChange?.(next[next.length - 1]!, depth);
      return next;
    });
  }, [onChange]);

  const reset = useCallback(() => {
    setStack([rootLevel]);
    onChange?.(rootLevel, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    activeSeries: current.series,
    depth: stack.length - 1,
    breadcrumbs: stack,
    canDrillUp: stack.length > 1,
    drillDown,
    drillUp,
    drillTo,
    reset,
  };
}
