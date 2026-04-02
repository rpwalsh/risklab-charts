// ============================================================================
// RiskLab Charts — React: useChartStore Hook
// Modern React 18/19 hook using useSyncExternalStore for tear-free reads
// of chart state. Works with concurrent rendering & React Server Components.
// ============================================================================

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Engine } from '../../core/Engine';
import type { ChartState, ThemeConfig, ChartEventType } from '../../core/types';

// ---------------------------------------------------------------------------
// Snapshot shapes
// ---------------------------------------------------------------------------

export interface ChartSnapshot {
  width: number;
  height: number;
  chartArea: ChartState['chartArea'];
  activeSeries: ChartState['activeSeries'];
  hoveredPoint: ChartState['hoveredPoint'];
  selectedPoints: readonly ChartState['selectedPoints'][number][];
  zoomLevel: ChartState['zoomLevel'];
  panOffset: ChartState['panOffset'];
  tooltipVisible: boolean;
  animating: boolean;
  theme: ThemeConfig;
}

const EMPTY_SNAPSHOT: ChartSnapshot = {
  width: 0,
  height: 0,
  chartArea: { x: 0, y: 0, width: 0, height: 0 },
  activeSeries: [],
  hoveredPoint: undefined,
  selectedPoints: [],
  zoomLevel: { x: 1, y: 1 },
  panOffset: { x: 0, y: 0 },
  tooltipVisible: false,
  animating: false,
  theme: {
    id: 'empty', name: 'Empty', palette: [],
    backgroundColor: '#fff', textColor: '#000',
    fontFamily: 'sans-serif', fontSize: 14,
    axis: { lineColor: '#ccc', gridColor: '#eee', labelColor: '#666', titleColor: '#333' },
    tooltip: { backgroundColor: '#fff', borderColor: '#ccc', textColor: '#333', shadow: { enabled: false } },
    legend: { textColor: '#333', hoverColor: '#000', inactiveColor: '#999' },
  },
};

// ---------------------------------------------------------------------------
// Shallow equality for snapshot caching
// ---------------------------------------------------------------------------

function shallowEqual(a: ChartSnapshot, b: ChartSnapshot): boolean {
  if (a === b) return true;
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.chartArea === b.chartArea &&
    a.activeSeries === b.activeSeries &&
    a.hoveredPoint === b.hoveredPoint &&
    a.selectedPoints === b.selectedPoints &&
    a.zoomLevel === b.zoomLevel &&
    a.panOffset === b.panOffset &&
    a.tooltipVisible === b.tooltipVisible &&
    a.animating === b.animating &&
    a.theme === b.theme
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to chart state changes using React 18+'s `useSyncExternalStore`.
 * This provides tear-free reads that work correctly with concurrent features,
 * `useTransition`, and `Suspense`.
 *
 * ```tsx
 * function ChartOverlay({ engine }: { engine: Engine | null }) {
 *   const snap = useChartStore(engine);
 *
 *   return (
 *     <div>
 *       {snap.width}×{snap.height} | Series: {snap.activeSeries.length}
 *       {snap.tooltipVisible && <span>Tooltip open</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useChartStore(engine: Engine | null): ChartSnapshot {
  const prevRef = useRef<ChartSnapshot>(EMPTY_SNAPSHOT);

  // Subscribe to engine events that signal state changes
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!engine) return () => {};

      const bus = engine.getEventBus();
      const events: ChartEventType[] = [
        'afterRender',
        'resize',
        'dataUpdate',
        'zoom',
        'pan',
        'select',
        'deselect',
        'hover',
        'leave',
        'themeChange',
      ];

      const unsubs = events.map((type) => bus.on(type, onStoreChange));
      return () => unsubs.forEach((u) => u());
    },
    [engine],
  );

  // Take a snapshot of the current state, reusing previous if unchanged
  const getSnapshot = useCallback((): ChartSnapshot => {
    if (!engine) return EMPTY_SNAPSHOT;

    const state = engine.getState();
    const theme = engine.getTheme();

    const next: ChartSnapshot = {
      width: state.width,
      height: state.height,
      chartArea: state.chartArea,
      activeSeries: state.activeSeries,
      hoveredPoint: state.hoveredPoint,
      selectedPoints: state.selectedPoints,
      zoomLevel: state.zoomLevel,
      panOffset: state.panOffset,
      tooltipVisible: state.tooltipVisible,
      animating: state.animating,
      theme,
    };

    if (shallowEqual(prevRef.current, next)) {
      return prevRef.current;
    }
    prevRef.current = next;
    return next;
  }, [engine]);

  // SSR snapshot — safe default for server-side rendering
  const getServerSnapshot = useCallback((): ChartSnapshot => EMPTY_SNAPSHOT, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---------------------------------------------------------------------------
// Selector variant for fine-grained subscriptions
// ---------------------------------------------------------------------------

/**
 * Select a specific slice of chart state. Only triggers re-render when
 * the selected value changes (compared by `Object.is`).
 *
 * ```tsx
 * const isAnimating = useChartSelector(engine, s => s.animating);
 * const seriesCount = useChartSelector(engine, s => s.activeSeries.length);
 * ```
 */
export function useChartSelector<T>(
  engine: Engine | null,
  selector: (snapshot: ChartSnapshot) => T,
): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!engine) return () => {};
      const bus = engine.getEventBus();
      const events: ChartEventType[] = [
        'afterRender', 'resize', 'dataUpdate', 'zoom', 'pan',
        'select', 'deselect', 'hover', 'leave', 'themeChange',
      ];
      const unsubs = events.map((type) => bus.on(type, onStoreChange));
      return () => unsubs.forEach((u) => u());
    },
    [engine],
  );

  const prevSnapRef = useRef<ChartSnapshot>(EMPTY_SNAPSHOT);
  const prevResultRef = useRef<T>(selector(EMPTY_SNAPSHOT));

  const getSnapshot = useCallback((): T => {
    if (!engine) return selector(EMPTY_SNAPSHOT);
    const state = engine.getState();
    const theme = engine.getTheme();
    const next: ChartSnapshot = {
      width: state.width,
      height: state.height,
      chartArea: state.chartArea,
      activeSeries: state.activeSeries,
      hoveredPoint: state.hoveredPoint,
      selectedPoints: state.selectedPoints,
      zoomLevel: state.zoomLevel,
      panOffset: state.panOffset,
      tooltipVisible: state.tooltipVisible,
      animating: state.animating,
      theme,
    };

    // Reuse cached snapshot if fields haven't changed
    let snap: ChartSnapshot;
    if (shallowEqual(prevSnapRef.current, next)) {
      snap = prevSnapRef.current;
    } else {
      prevSnapRef.current = next;
      snap = next;
    }

    const result = selector(snap);
    // Only return a new reference if the selected value changed
    if (Object.is(prevResultRef.current, result)) {
      return prevResultRef.current;
    }
    prevResultRef.current = result;
    return result;
  }, [engine, selector]);

  const getServerSnapshot = useCallback((): T => selector(EMPTY_SNAPSHOT), [selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
