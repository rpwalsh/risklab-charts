// ============================================================================
// RiskLab Charts — Waterfall Chart Renderer
// Shows cumulative effect of sequential positive/negative values
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders a waterfall chart showing the cumulative effect of sequential values.
 *
 * Positive and negative increments are color-coded, with optional total bars.
 * Dashed connector lines link consecutive bars, and value labels are drawn
 * above each bar.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param _theme - Active theme for styling (unused)
 * @param color - Resolved hex color for this series (used for total bars)
 */
export function renderWaterfallSeries(
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

  const bandwidth = xScale.bandwidth ?? Math.max(20, state.chartArea.width / data.length * 0.6);
  const positiveColor = '#10B981';
  const negativeColor = '#EF4444';
  const totalColor = color;

  let cumulative = 0;

  for (let i = 0; i < data.length; i++) {
    const d = data[i]!;
    const x = xScale.convert(d.x);
    const value = d.yNum ?? 0;
    const isTotal = d.meta?.isTotal === true;

    let barTop: number;
    let barBottom: number;
    let barColor: string;

    if (isTotal) {
      barTop = yScale.convert(Math.max(cumulative, 0));
      barBottom = yScale.convert(Math.min(cumulative, 0));
      barColor = totalColor;
    } else {
      const prevCum = cumulative;
      cumulative += value;
      barTop = yScale.convert(Math.max(prevCum, cumulative));
      barBottom = yScale.convert(Math.min(prevCum, cumulative));
      barColor = value >= 0 ? positiveColor : negativeColor;
    }

    renderer.drawRect(
      x - bandwidth / 2,
      barTop,
      bandwidth,
      Math.max(1, barBottom - barTop),
      {
        fill: (d.color as string) ?? barColor,
        stroke: (d.color as string) ?? barColor,
        strokeWidth: 0.5,
        clipPath: 'chart-clip',
      },
      2,
    );

    // Connector line to next bar
    if (i < data.length - 1 && !isTotal) {
      const nextX = xScale.convert((data[i + 1] as ProcessedDataPoint).x);
      const connY = yScale.convert(cumulative);
      renderer.drawLine(x + bandwidth / 2, connY, nextX - bandwidth / 2, connY, {
        stroke: '#9CA3AF',
        strokeWidth: 1,
        dashArray: [3, 3],
      });
    }

    // Value label — for total bars show the cumulative sum, for incremental bars show ±value
    // Drawn WITHOUT clipPath so labels above the tallest bar remain visible
    const labelValue = isTotal ? cumulative : value;
    const labelY = Math.max(state.chartArea.y + 4, barTop - 8);
    renderer.drawText(x, labelY, String(labelValue >= 0 ? `+${labelValue}` : labelValue), {
      fill: barColor,
      fontSize: 10,
      textAnchor: 'middle',
    });
  }
}
