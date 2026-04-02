// ============================================================================
// RiskLab Charts — Candlestick / OHLC Chart Renderer
// Renders financial OHLC data as candlesticks or OHLC bars
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders financial OHLC data as either candlestick bodies or OHLC bar ticks.
 *
 * Each data point is expected to carry open, high, low, and close values. Bullish
 * and bearish candles are distinguished by color. When the isOHLC flag is set,
 * the renderer draws tick-style bars instead of filled candlestick bodies.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param _theme - Active theme for styling (unused)
 * @param isOHLC - Whether to render as OHLC bars instead of candlesticks
 */
export function renderCandlestickSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  _theme: ThemeConfig,
  isOHLC: boolean,
): void {
  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');
  if (!xScale || !yScale) return;

  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const bandwidth = xScale.bandwidth ?? Math.max(4, state.chartArea.width / data.length * 0.6);
  const halfWidth = bandwidth / 2;

  for (const d of data) {
    const open = d.open ?? d.yNum;
    const high = d.high ?? d.yNum;
    const low = d.low ?? d.yNum;
    const close = d.close ?? d.yNum;
    if (open == null || close == null || high == null || low == null) continue;

    const x = xScale.convert(d.x);
    const openY = yScale.convert(open);
    const closeY = yScale.convert(close);
    const highY = yScale.convert(high);
    const lowY = yScale.convert(low);

    const bullish = close >= open;
    const color = bullish ? '#10B981' : '#EF4444';
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.abs(closeY - openY) || 1;

    if (isOHLC) {
      // OHLC bars
      // Vertical line (high to low)
      renderer.drawLine(x, highY, x, lowY, {
        stroke: color,
        strokeWidth: 1.5,
        clipPath: 'chart-clip',
      });
      // Open tick (left)
      renderer.drawLine(x - halfWidth * 0.6, openY, x, openY, {
        stroke: color,
        strokeWidth: 1.5,
        clipPath: 'chart-clip',
      });
      // Close tick (right)
      renderer.drawLine(x, closeY, x + halfWidth * 0.6, closeY, {
        stroke: color,
        strokeWidth: 1.5,
        clipPath: 'chart-clip',
      });
    } else {
      // Candlestick
      // Wick
      renderer.drawLine(x, highY, x, lowY, {
        stroke: color,
        strokeWidth: 1,
        clipPath: 'chart-clip',
      });
      // Body — bullish: hollow (unfilled), bearish: solid fill (standard convention)
      renderer.drawRect(x - halfWidth, bodyTop, bandwidth, bodyHeight, {
        fill: bullish ? 'none' : color,
        stroke: color,
        strokeWidth: 1.5,
        opacity: 1,
        clipPath: 'chart-clip',
      }, 1);
    }
  }
}
