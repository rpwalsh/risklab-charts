// ============================================================================
// RiskLab Charts — React: ChartGroup Component
// Lays out multiple Chart instances in a grid/column and wires them together
// with a SyncController for synchronized zoom/pan/crosshair.
// ============================================================================

import React, {
  forwardRef,
  useRef,
  useEffect,
  useMemo,
  type CSSProperties,
} from 'react';
import { SyncController, type SyncOptions } from '../../core/SyncController';
import { Engine } from '../../core/Engine';
import { Chart, type ChartProps, type ChartHandle } from './Chart';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChartGroupItem extends ChartProps {
  /** Unique key used for React reconciliation */
  key: string;
  /** Optional individual height override */
  height?: number | string;
}

export interface ChartGroupProps {
  /** Array of chart configurations to render */
  charts: ChartGroupItem[];
  /** Sync options — pass `false` to disable sync entirely */
  sync?: SyncOptions | false;
  /** Layout direction (default: 'column') */
  layout?: 'column' | 'row' | 'grid';
  /** Number of columns when layout='grid' (default: 2) */
  columns?: number;
  /** Gap between charts in px (default: 12) */
  gap?: number;
  /** Container className */
  className?: string;
  /** Container style */
  style?: CSSProperties;
  /** Called when all charts are ready */
  onReady?: (engines: Engine[]) => void;
}

export type ChartGroupHandle = {
  engines: Array<Engine | null>;
  charts: Array<ChartHandle | null>;
  sync: SyncController | null;
};

/**
 * Renders multiple RiskLab charts in a synchronized layout.
 *
 * @example
 * ```tsx
 * <ChartGroup
 *   sync={{ zoom: true, crosshair: true }}
 *   layout="column"
 *   charts={[
 *     { key: 'price',  series: priceSeries,  height: 300, title: 'Price' },
 *     { key: 'volume', series: volumeSeries, height: 120, title: 'Volume' },
 *     { key: 'rsi',    series: rsiSeries,    height: 100, title: 'RSI' },
 *   ]}
 * />
 * ```
 */
export const ChartGroup = forwardRef<ChartGroupHandle, ChartGroupProps>(
  function ChartGroup({ charts, sync = {}, layout = 'column', columns = 2, gap = 12, className, style, onReady }, ref) {
    const syncRef = useRef<SyncController | null>(null);
    const chartRefs = useRef<Array<ChartHandle | null>>([]);
    const enginesRef = useRef<Array<Engine | null>>([]);
    const readyCount = useRef(0);

    // Create/destroy SyncController
    useEffect(() => {
      if (sync === false) return;
      syncRef.current = new SyncController(sync);
      return () => {
        syncRef.current?.destroy();
        syncRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Expose handle
    React.useImperativeHandle(ref, () => ({
      get engines() { return enginesRef.current; },
      get charts() { return chartRefs.current; },
      get sync() { return syncRef.current; },
    }), []);

    const containerStyle = useMemo<CSSProperties>(() => {
      const base: CSSProperties = { display: 'flex', gap, ...style };
      if (layout === 'column') return { ...base, flexDirection: 'column' };
      if (layout === 'row') return { ...base, flexDirection: 'row', flexWrap: 'wrap' };
      // grid
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      };
    }, [layout, columns, gap, style]);

    const handleReady = (index: number) => (engine: Engine) => {
      enginesRef.current[index] = engine;
      if (sync !== false && syncRef.current) {
        syncRef.current.add(engine);
      }
      readyCount.current++;
      if (readyCount.current === charts.length) {
        onReady?.(enginesRef.current.filter(Boolean) as Engine[]);
      }
    };

    return React.createElement(
      'div',
      { className: className ? `risklab-group ${className}` : 'risklab-group', style: containerStyle },
      charts.map((chartProps, i) => {
        const { key, ...rest } = chartProps;
        return React.createElement(Chart, {
          ...rest,
          key,
          ref: (handle: ChartHandle | null) => { chartRefs.current[i] = handle; },
          onReady: handleReady(i),
        } as ChartProps & { key: string; ref: (handle: ChartHandle | null) => void });
      }),
    );
  },
);

ChartGroup.displayName = 'RiskLab.ChartGroup';
