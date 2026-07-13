// ============================================================================
// RiskLab Charts — Box Plot Chart Renderer
// Renders box-and-whisker plots showing statistical distributions
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders a box-and-whisker plot series showing statistical distributions.
 *
 * Each data point is expected to carry low, q1, median, q3, and high values.
 * Draws whisker lines with caps, a filled interquartile box, and a prominent
 * median line for each category.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param _theme - Active theme for styling (unused)
 * @param color - Resolved hex color for this series
 */
export function renderBoxPlotSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  _theme: ThemeConfig,
  color: string,
): void {
  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');
  if (!xScale || !yScale) return;

  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const bandwidth = xScale.bandwidth ?? Math.max(20, state.chartArea.width / data.length * 0.5);
  const halfWidth = bandwidth / 2;
  const whiskerWidth = bandwidth * 0.4;

  for (const d of data) {
    const raw = d as ProcessedDataPoint;
    // Expected format: low, q1, median, q3, high on data point
    const x = xScale.convert(d.x);
    const median = raw.median ?? d.yNum;
    // q1/q3 fall back to median only — y0/y1 are stacking baseline fields, not quartiles
    const q1 = raw.q1 ?? median;
    const q3 = raw.q3 ?? median;
    const low = raw.low ?? q1;
    const high = raw.high ?? q3;

    const lowY = yScale.convert(low);
    const q1Y = yScale.convert(q1);
    const medianY = yScale.convert(median);
    const q3Y = yScale.convert(q3);
    const highY = yScale.convert(high);

    // Whisker (low to q1)
    renderer.drawLine(x, lowY, x, q1Y, {
      stroke: color,
      strokeWidth: 1.5,
      clipPath: 'chart-clip',
    });
    // Whisker cap (low)
    renderer.drawLine(x - whiskerWidth / 2, lowY, x + whiskerWidth / 2, lowY, {
      stroke: color,
      strokeWidth: 1.5,
      clipPath: 'chart-clip',
    });

    // Box (q1 to q3)
    const boxTop = Math.min(q1Y, q3Y);
    const boxHeight = Math.abs(q3Y - q1Y);
    renderer.drawRect(x - halfWidth, boxTop, bandwidth, boxHeight, {
      fill: color,
      opacity: 0.3,
      stroke: color,
      strokeWidth: 1.5,
      clipPath: 'chart-clip',
    }, 2);

    // Median line
    renderer.drawLine(x - halfWidth, medianY, x + halfWidth, medianY, {
      stroke: color,
      strokeWidth: 2.5,
      clipPath: 'chart-clip',
    });

    // Whisker (q3 to high)
    renderer.drawLine(x, q3Y, x, highY, {
      stroke: color,
      strokeWidth: 1.5,
      clipPath: 'chart-clip',
    });
    // Whisker cap (high)
    renderer.drawLine(x - whiskerWidth / 2, highY, x + whiskerWidth / 2, highY, {
      stroke: color,
      strokeWidth: 1.5,
      clipPath: 'chart-clip',
    });
  }
}
