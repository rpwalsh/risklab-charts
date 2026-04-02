// ============================================================================
// RiskLab Charts — React: <StockChart /> Component
// Pre-configured stock/financial chart with Navigator, RangeSelector, OHLC,
// Volume panel, and synchronized Statistics plugin. Zero config required.
// ============================================================================

import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  type CSSProperties,
} from 'react';
import { Engine } from '../../core/Engine';
import type {
  SeriesConfig,
  ThemeConfig,
  AxisConfig,
  TooltipConfig,
  InteractionConfig,
  RiskLabPlugin,
  ChartEventHandler,
  ChartEventType,
  AnnotationConfig,
} from '../../core/types';
import type { NavigatorConfig } from '../../charts/advanced/NavigatorChart';
import type { RangeSelectorConfig } from '../../charts/advanced/RangeSelector';
import type { StatisticsPluginConfig } from '../../plugins/StatisticsPlugin';
import { Chart, type ChartHandle, type ChartProps } from './Chart';

export interface StockChartProps {
  /** OHLC or line series */
  series: SeriesConfig[];
  /** Optional volume series (rendered in sub-pane automatically) */
  volumeSeries?: SeriesConfig[];
  /** Chart title */
  title?: string;
  /** Theme */
  theme?: string | ThemeConfig;
  /** Width */
  width?: number | string;
  /** Height (total including navigator, default: 500) */
  height?: number | string;
  /** Navigator configuration */
  navigator?: NavigatorConfig;
  /** Range selector buttons */
  rangeSelector?: RangeSelectorConfig;
  /** Statistics / indicators config */
  indicators?: StatisticsPluginConfig;
  /** Interaction overrides */
  interaction?: InteractionConfig;
  /** Tooltip config */
  tooltip?: TooltipConfig;
  /** Annotations */
  annotations?: AnnotationConfig[];
  /** Extra plugins */
  plugins?: RiskLabPlugin[];
  /** CSS class */
  className?: string;
  /** Container style */
  style?: CSSProperties;
  /** Called when chart is ready */
  onReady?: (engine: Engine) => void;
  onClick?: ChartEventHandler<'click'>;
  onHover?: ChartEventHandler<'hover'>;
  events?: Partial<Record<ChartEventType, ChartEventHandler>>;
}

export type StockChartHandle = ChartHandle;

/**
 * High-level stock/financial chart component — batteries included.
 *
 * @example
 * ```tsx
 * <StockChart
 *   title="AAPL"
 *   series={[{ id: 'ohlc', type: 'candlestick', data: ohlcData }]}
 *   volumeSeries={[{ id: 'vol', type: 'bar', data: volumeData }]}
 *   rangeSelector={{ buttons: DEFAULT_RANGE_BUTTONS }}
 *   indicators={{ movingAverages: [{ seriesId: 'ohlc', type: 'sma', period: 20 }] }}
 * />
 * ```
 */
export const StockChart = forwardRef<StockChartHandle, StockChartProps>(
  function StockChart(props, ref) {
    const {
      series,
      volumeSeries,
      title,
      theme = 'default',
      width = '100%',
      height = 500,
      navigator = { enabled: true, height: 60, showSeries: true },
      rangeSelector = { enabled: true },
      indicators,
      interaction,
      tooltip,
      annotations,
      plugins = [],
      className,
      style,
      onReady,
      onClick,
      onHover,
      events,
    } = props;

    // Merge volume series in (as a separate sub-pane series)
    const allSeries: SeriesConfig[] = [
      ...series,
      ...(volumeSeries ?? []).map(vs => ({
        ...vs,
        yAxisId: vs.yAxisId ?? 'y-volume',
      })),
    ];

    // Build axes — infer from series types if not specified
    const axes: AxisConfig[] = [
      { id: 'x0', position: 'bottom', type: 'time' },
      { id: 'y0', position: 'left', type: 'linear' },
      ...(volumeSeries?.length
        ? [{ id: 'y-volume', position: 'right', type: 'linear', height: 0.2, offset: 0, opposite: true } as AxisConfig]
        : []),
    ];

    const defaultInteraction: InteractionConfig = {
      ...interaction,
    };

    const defaultTooltip: TooltipConfig = {
      enabled: true,
      trigger: 'both',
      shared: true,
      crosshair: { enabled: true },
      ...tooltip,
    };

    const chartRef = useRef<ChartHandle | null>(null);
    useImperativeHandle(ref, () => chartRef.current!, []);

    return React.createElement(Chart, {
      ref: chartRef,
      series: allSeries,
      title,
      theme,
      width,
      height,
      axes,
      interaction: defaultInteraction,
      tooltip: defaultTooltip,
      annotations,
      plugins,
      className: className ? `risklab-stock ${className}` : 'risklab-stock',
      style,
      onReady,
      onClick,
      onHover,
      events,
      navigator,
      rangeSelector,
      statistics: indicators,
    } as ChartProps & { navigator?: NavigatorConfig; rangeSelector?: RangeSelectorConfig; statistics?: StatisticsPluginConfig });
  },
);

StockChart.displayName = 'RiskLab.StockChart';
