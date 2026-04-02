// ============================================================================
// RiskLab Charts — Stock Chart Wrapper
// Complete stock chart: OHLC/Candlestick + Volume + Navigator + Range Selector
// + Bollinger Bands + MACD/RSI overlays.
// Designed to beat Highcharts Stock out of the box.
// ============================================================================

import { Engine } from '../core/Engine';
import type { ChartConfig, SeriesConfig, AxisConfig } from '../core/types';
import type { NavigatorConfig } from './advanced/NavigatorChart';
import type { RangeSelectorConfig } from './advanced/RangeSelector';
import type { StatisticsPluginConfig } from '../plugins/StatisticsPlugin';

// ── Config ─────────────────────────────────────────────────────────────────

export interface IndicatorConfig {
  type: 'sma' | 'ema' | 'wma' | 'bollinger' | 'rsi' | 'macd' | 'volume';
  period?: number;
  color?: string;
  /** For Bollinger: std dev multiplier */
  stdDevMultiplier?: number;
  /** MACD signal period */
  signalPeriod?: number;
}

export interface StockChartConfig {
  /** Target container (CSS selector or HTMLElement) */
  container: string | HTMLElement;
  /** Series data */
  series: SeriesConfig[];
  /** 'ohlc' | 'candlestick' (default: candlestick) */
  seriesType?: 'ohlc' | 'candlestick';
  /** Chart dimensions */
  width?: number;
  height?: number;
  /** Theme */
  theme?: string | import('../core/types').ThemeConfig;
  /** Technical indicators to overlay */
  indicators?: IndicatorConfig[];
  /** Range selector buttons */
  rangeSelector?: RangeSelectorConfig;
  /** Navigator configuration */
  navigator?: NavigatorConfig;
  /** Chart title */
  title?: string;
  /** Stock chart events */
  onRangeChange?: (from: number, to: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildStockAxes(hasVolume: boolean): AxisConfig[] {
  const axes: AxisConfig[] = [
    {
      id: 'x0',
      type: 'time',
      position: 'bottom',
      gridLines: { enabled: true },
    },
    {
      id: 'y0',
      type: 'linear',
      position: 'left',
      gridLines: { enabled: true },
      title: { text: 'Price' },
    },
  ];

  if (hasVolume) {
    axes.push({
      id: 'y1',
      type: 'linear',
      position: 'right',
      title: { text: 'Volume' },
    });
  }

  return axes;
}

function buildStatisticsConfig(
  mainSeriesId: string,
  indicators: IndicatorConfig[],
): StatisticsPluginConfig {
  const movingAverages: StatisticsPluginConfig['movingAverages'] = [];

  for (const ind of indicators) {
    if (['sma', 'ema', 'wma', 'bollinger'].includes(ind.type)) {
      movingAverages.push({
        seriesId: mainSeriesId,
        type: ind.type as 'sma' | 'ema' | 'wma' | 'bollinger',
        period: ind.period ?? 20,
        color: ind.color,
        stdDevMultiplier: ind.stdDevMultiplier,
        fillOpacity: 0.1,
      });
    }
  }

  return { movingAverages };
}

// ── StockChart factory ────────────────────────────────────────────────────────

/**
 * Create a fully-featured stock chart.
 *
 * ```ts
 * const stock = createStockChart({
 *   container: '#chart',
 *   series: [{ id: 's1', name: 'AAPL', type: 'candlestick', data: [...] }],
 *   indicators: [{ type: 'sma', period: 20 }, { type: 'bollinger', period: 20 }],
 *   rangeSelector: {},
 *   navigator: {},
 * });
 * ```
 */
export function createStockChart(cfg: StockChartConfig): Engine {
  const mainSeries = cfg.series[0];
  const hasVolume = cfg.series.some(s => s.id.includes('volume') || s.isVolume);
  const mainSeriesId = mainSeries?.id ?? 's0';

  const statsCfg = cfg.indicators?.length
    ? buildStatisticsConfig(mainSeriesId, cfg.indicators)
    : undefined;

  const chartConfig: ChartConfig & {
    navigator?: NavigatorConfig;
    rangeSelector?: RangeSelectorConfig;
    statistics?: StatisticsPluginConfig;
  } = {
    container: cfg.container,
    width: cfg.width,
    height: cfg.height ?? 500,
    theme: cfg.theme,
    title: cfg.title ? { text: cfg.title } : undefined,
    series: cfg.series.map(s => ({
      ...s,
      type: s.type === 'ohlc' ? 'ohlc'
        : s.type === 'candlestick' ? 'candlestick'
        : s.type,
    })),
    axes: buildStockAxes(hasVolume),
    tooltip: {
      enabled: true,
      trigger: 'both',
      shared: true,
      crosshair: { enabled: true },
    },
    legend: { enabled: false },
    padding: { top: 50, right: 80, bottom: hasVolume ? 100 : 70, left: 60 },
    navigator: cfg.navigator ?? { enabled: true, height: 60 },
    rangeSelector: cfg.rangeSelector ?? { enabled: true },
    statistics: statsCfg,
  };

  return new Engine(chartConfig);
}
