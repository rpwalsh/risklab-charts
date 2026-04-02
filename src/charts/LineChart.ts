// ============================================================================
// RiskLab Charts — Line Chart Renderer
// Renders line series with markers, smooth curves, and data labels
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Render a single line series onto the chart.
 *
 * Plots data points as a connected path with optional markers, smooth curves,
 * and data labels. Supports stacking via `d.y0`/`d.y1` and multiple Y-axes.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 * @param color - Resolved hex color for this series
 *
 * @example
 * ```ts
 * renderLineSeries(renderer, processedSeries, state, theme, '#6366f1');
 * ```
 */
export function renderLineSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');
  if (!xScale || !yScale) return;

  const data = series.type === 'connectedScatter'
    ? (series.data as ProcessedDataPoint[])
    : (series.processedData ?? (series.data as ProcessedDataPoint[]));
  if (data.length === 0) return;

  // Map data to pixel coordinates
  const points = data
    .filter((d) => d.x != null && d.y != null)
    .map((d) => ({
      x: xScale.convert(d.x),
      y: yScale.convert(resolveLineValue(d)),
    }));

  if (points.length === 0) return;

  // Draw line
  const lineWidth = series.lineWidth ?? 2;
  const path = buildLineVariantPath(renderer, points, series.type);

  renderer.drawPath(path, {
    stroke: color,
    strokeWidth: lineWidth,
    fill: 'none',
    dashArray: series.dashArray,
    clipPath: 'chart-clip',
  });

  // Draw markers
  if (series.marker?.enabled !== false) {
    const markerSize = series.marker?.size ?? 4;
    const markerColor = (series.marker?.color as string) ?? color;
    const borderColor = (series.marker?.borderColor as string) ?? '#fff';
    const borderWidth = series.marker?.borderWidth ?? 2;

    for (const pt of points) {
      renderer.drawCircle(pt.x, pt.y, markerSize, {
        fill: markerColor,
        stroke: borderColor,
        strokeWidth: borderWidth,
        clipPath: 'chart-clip',
      });
    }
  }
}

function buildLineVariantPath(
  renderer: BaseRenderer,
  points: Array<{ x: number; y: number }>,
  type: ProcessedSeries['type'],
): string {
  if (type === 'stepLine') {
    return buildStepLinePath(points);
  }

  const smooth = type === 'spline' || type === 'line';
  return renderer.buildLinePath(points, smooth);
}

function buildStepLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;

  let path = `M${points[0]!.x},${points[0]!.y}`;

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    path += `L${current.x},${previous.y}L${current.x},${current.y}`;
  }

  return path;
}

function resolveLineValue(point: ProcessedDataPoint): number {
  return point.y1 ?? point.yNum ?? Number(point.y);
}
