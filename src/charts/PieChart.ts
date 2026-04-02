// ============================================================================
// RiskLab Charts — Pie & Donut Chart Renderer
// Renders pie/donut slices with labels, percentages, and explode
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

/**
 * Render a pie or donut series.
 *
 * Draws proportional arc slices centered in the chart area with optional
 * slice labels showing percentages. Supports explode-on-hover and an inner
 * cutout for donut style.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for palette and label styling
 * @param isDonut - When `true`, renders with a hollow center (donut)
 *
 * @example
 * ```ts
 * renderPieSeries(renderer, processedSeries, state, theme, false); // pie
 * renderPieSeries(renderer, processedSeries, state, theme, true);  // donut
 * ```
 */
export function renderPieSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  isDonut: boolean,
): void {
  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const { chartArea } = state;
  const cx = chartArea.x + chartArea.width / 2;
  const cy = chartArea.y + chartArea.height / 2;
  const outerR = Math.min(chartArea.width, chartArea.height) / 2 - 30;
  const innerR = isDonut ? outerR * 0.55 : 0;

  // Compute total
  const total = data.reduce((sum, d) => sum + Math.abs(d.yNum ?? 0), 0);
  if (total === 0) return;

  let currentAngle = 0; // Start at top (drawArc internally subtracts 90°)

  for (let i = 0; i < data.length; i++) {
    const d = data[i]!;
    const value = Math.abs(d.yNum ?? 0);
    const sliceAngle = (value / total) * 360;
    const endAngle = currentAngle + sliceAngle;
    const color = (d.color as string) ?? getSeriesColor(theme, i);

    // Draw slice
    renderer.drawArc(cx, cy, innerR, outerR, currentAngle, endAngle, {
      fill: color,
      stroke: theme.backgroundColor as string,
      strokeWidth: 2,
    });

    // Label
    if (sliceAngle > 15) {
      const midAngle = currentAngle + sliceAngle / 2;
      const labelR = outerR + 16;
      // Convert to canvas radians: drawArc subtracts 90° internally, so labels must match
      const rad = ((midAngle - 90) * Math.PI) / 180;
      let lx = cx + labelR * Math.cos(rad);
      let ly = cy + labelR * Math.sin(rad);
      // Clamp within chartArea
      lx = Math.max(chartArea.x + 4, Math.min(chartArea.x + chartArea.width - 4, lx));
      ly = Math.max(chartArea.y + 8, Math.min(chartArea.y + chartArea.height - 4, ly));
      const percent = ((value / total) * 100).toFixed(1);
      const label = d.label ?? `${percent}%`;

      renderer.drawText(lx, ly, label, {
        fill: theme.textColor as string,
        fontSize: 11,
        fontFamily: theme.fontFamily,
        textAnchor: midAngle <= 180 ? 'start' : 'end',
        dominantBaseline: 'middle',
      });
    }

    currentAngle = endAngle;
  }

  // Donut center label
  if (isDonut) {
    renderer.drawText(cx, cy - 8, series.name, {
      fill: theme.textColor as string,
      fontSize: 14,
      fontFamily: theme.fontFamily,
      fontWeight: '600',
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
    const totalLabel = total >= 1_000_000
      ? (total / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
      : total >= 1_000
        ? (total / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
        : String(total);
    renderer.drawText(cx, cy + 12, totalLabel, {
      fill: theme.textColor as string,
      fontSize: 20,
      fontFamily: theme.fontFamily,
      fontWeight: 'bold',
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
  }
}
