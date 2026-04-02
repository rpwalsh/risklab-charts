// ============================================================================
// RiskLab Charts — Scatter Chart Renderer
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders a scatter series by plotting individual data points as shaped markers.
 *
 * Supports multiple marker symbols including circle, square, diamond, triangle, and
 * cross. Each point may override the series color with a per-point color value.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param _theme - Active theme for styling (unused)
 * @param color - Resolved hex color for this series
 */
export function renderScatterSeries(
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
  const markerSize = series.marker?.size ?? 5;
  const symbol = series.marker?.symbol ?? 'circle';

  for (const d of data) {
    const x = xScale.convert(d.x);
    const y = yScale.convert(d.yNum ?? d.y);
    const pointColor = (d.color as string) ?? color;

    switch (symbol) {
      case 'square':
        renderer.drawRect(x - markerSize, y - markerSize, markerSize * 2, markerSize * 2, {
          fill: pointColor,
          stroke: '#fff',
          strokeWidth: 1,
          clipPath: 'chart-clip',
        });
        break;
      case 'diamond':
        renderer.drawPolygon(
          [
            [x, y - markerSize],
            [x + markerSize, y],
            [x, y + markerSize],
            [x - markerSize, y],
          ],
          { fill: pointColor, stroke: '#fff', strokeWidth: 1, clipPath: 'chart-clip' },
        );
        break;
      case 'triangle':
        renderer.drawPolygon(
          [
            [x, y - markerSize],
            [x + markerSize, y + markerSize],
            [x - markerSize, y + markerSize],
          ],
          { fill: pointColor, stroke: '#fff', strokeWidth: 1, clipPath: 'chart-clip' },
        );
        break;
      case 'cross': {
        const s = markerSize;
        renderer.drawLine(x - s, y, x + s, y, { stroke: pointColor, strokeWidth: 2, clipPath: 'chart-clip' });
        renderer.drawLine(x, y - s, x, y + s, { stroke: pointColor, strokeWidth: 2, clipPath: 'chart-clip' });
        break;
      }
      default:
        renderer.drawCircle(x, y, markerSize, {
          fill: pointColor,
          stroke: '#fff',
          strokeWidth: 1.5,
          clipPath: 'chart-clip',
        });
        break;
    }
  }
}
