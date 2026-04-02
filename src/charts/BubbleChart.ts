// ============================================================================
// RiskLab Charts — Bubble Chart Renderer
// Like scatter but with z-dimension mapped to circle size
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders a bubble series where each point's z-dimension is mapped to circle radius.
 *
 * Computes a z-scale from the data range to size bubbles between a configurable
 * minimum and maximum radius. Larger bubbles are drawn first, and labels are
 * rendered inside bubbles that exceed a size threshold.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param _theme - Active theme for styling (unused)
 * @param color - Resolved hex color for this series
 */
export function renderBubbleSeries(
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

  // Compute z-scale (min/max)
  const zValues = data.map((d) => d.z ?? 1).filter(isFinite);
  const zMin = Math.min(...zValues);
  const zMax = Math.max(...zValues);
  const zRange = zMax - zMin || 1;
  const minRadius = 5;
  const maxRadius = 40;

  // Sort by z descending so larger bubbles are drawn first
  const sorted = [...data].sort((a, b) => (b.z ?? 1) - (a.z ?? 1));

  for (const d of sorted) {
    const x = xScale.convert(d.x);
    const y = yScale.convert(d.yNum ?? d.y);
    const z = d.z ?? 1;
    // Scale radius by sqrt so bubble AREA is proportional to z (perceptual accuracy)
    const tLinear = (z - zMin) / zRange;
    const tSqrt = Math.sqrt(Math.max(0, tLinear));
    const radius = minRadius + tSqrt * (maxRadius - minRadius);
    const pointColor = (d.color as string) ?? color;

    renderer.drawCircle(x, y, radius, {
      fill: pointColor,
      opacity: 0.65,
      stroke: pointColor,
      strokeWidth: 1.5,
      clipPath: 'chart-clip',
    });

    // Label inside large bubbles
    if (radius > 15 && d.label) {
      renderer.drawText(x, y, d.label, {
        fill: '#fff',
        fontSize: Math.min(10, radius * 0.4),
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        clipPath: 'chart-clip',
      });
    }
  }
}
