// ============================================================================
// RiskLab Charts — Area Chart Renderer
// Renders filled area series, including stacked areas with baselines
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders a filled area series with gradient fill, optional stacking, and baseline support.
 *
 * Builds top and bottom point arrays from the processed data, draws a gradient-filled
 * area polygon between them, overlays a stroke line, and optionally renders point markers.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 * @param color - Resolved hex color for this series
 */
export function renderAreaSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');
  if (!xScale || !yScale) return;

  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const { chartArea } = state;
  const fillOpacity = series.fillOpacity ?? 0.2;

  // Top line points
  const topPoints = data
    .filter((d) => d.x != null && d.y != null)
    .map((d) => ({
      x: xScale.convert(d.x),
      y: yScale.convert(d.y1 ?? d.yNum),
    }));

  // Bottom line points (baseline — either stack base or bottom of chart)
  // Filter must match topPoints exactly so both arrays stay the same length
  const bottomPoints = data
    .filter((d) => d.x != null && d.y != null)
    .map((d) => ({
      x: xScale.convert(d.x),
      y: d.y0 != null ? yScale.convert(d.y0) : chartArea.y + chartArea.height,
    }));

  if (topPoints.length === 0) return;

  // Draw gradient fill
  const gradientId = `area-grad-${series.id}`;
  renderer.defineLinearGradient(gradientId, 0, 0, 0, 1, [
    { offset: 0, color, opacity: fillOpacity },
    { offset: 1, color, opacity: 0.02 },
  ]);

  // Draw area fill
  const areaPath = renderer.buildAreaPath(topPoints, bottomPoints, true);
  renderer.drawPath(areaPath, {
    fill: `url(#${gradientId})`,
    clipPath: 'chart-clip',
  });

  // Draw line on top
  const linePath = renderer.buildLinePath(topPoints, true);
  renderer.drawPath(linePath, {
    stroke: color,
    strokeWidth: series.lineWidth ?? 2,
    fill: 'none',
    clipPath: 'chart-clip',
  });

  // Markers
  if (series.marker?.enabled) {
    for (const pt of topPoints) {
      renderer.drawCircle(pt.x, pt.y, series.marker?.size ?? 3, {
        fill: color,
        stroke: '#fff',
        strokeWidth: 2,
      });
    }
  }
}
