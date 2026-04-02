// ============================================================================
// RiskLab Charts — Range Area Chart Renderer
// Renders a filled band between low/high values at each x position.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

export interface RangeAreaConfig {
  /** Fill opacity for the band. */
  fillOpacity?: number;
  /** Smooth the upper and lower bounds. */
  smooth?: boolean;
  /** Draw upper and lower boundary lines. */
  showRangeLines?: boolean;
}

export function renderRangeAreaSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
  config?: Partial<ChartConfig>,
): void {
  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');
  if (!xScale || !yScale) return;

  const rangeConfig = config?.rangeArea ?? {};
  const fillOpacity = rangeConfig.fillOpacity ?? series.fillOpacity ?? 0.22;
  const smooth = rangeConfig.smooth !== false;
  const showRangeLines = rangeConfig.showRangeLines !== false;
  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);

  const rangedPoints = data
    .map((point) => {
      const lower = resolveLowerBound(point);
      const upper = resolveUpperBound(point, lower);

      if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;

      const low = Math.min(lower, upper);
      const high = Math.max(lower, upper);

      return {
        x: xScale.convert(point.x),
        low: yScale.convert(low),
        high: yScale.convert(high),
      };
    })
    .filter((point): point is { x: number; low: number; high: number } => point !== null);

  if (rangedPoints.length === 0) return;

  const topPoints = rangedPoints.map((point) => ({ x: point.x, y: point.high }));
  const bottomPoints = rangedPoints.map((point) => ({ x: point.x, y: point.low }));

  const gradientId = `range-area-grad-${series.id}`;
  renderer.defineLinearGradient(gradientId, 0, 0, 0, 1, [
    { offset: 0, color, opacity: fillOpacity },
    { offset: 1, color, opacity: Math.max(fillOpacity * 0.18, 0.03) },
  ]);

  renderer.drawPath(renderer.buildAreaPath(topPoints, bottomPoints, smooth), {
    fill: `url(#${gradientId})`,
    clipPath: 'chart-clip',
  });

  if (showRangeLines) {
    renderer.drawPath(renderer.buildLinePath(topPoints, smooth), {
      stroke: color,
      strokeWidth: series.lineWidth ?? 2,
      fill: 'none',
      clipPath: 'chart-clip',
    });

    renderer.drawPath(renderer.buildLinePath(bottomPoints, smooth), {
      stroke: color,
      strokeWidth: Math.max((series.lineWidth ?? 2) - 0.5, 1),
      strokeOpacity: 0.55,
      fill: 'none',
      clipPath: 'chart-clip',
    });
  }

  if (series.marker?.enabled) {
    const markerRadius = series.marker.size ?? 3;
    for (const point of topPoints) {
      renderer.drawCircle(point.x, point.y, markerRadius, {
        fill: color,
        stroke: '#fff',
        strokeWidth: 1.5,
        clipPath: 'chart-clip',
      });
    }
  }

}

function resolveLowerBound(point: ProcessedDataPoint): number {
  return resolveNumericValue(point.rangeLow, point.low, point.y);
}

function resolveUpperBound(point: ProcessedDataPoint, fallback: number): number {
  return resolveNumericValue(point.rangeHigh, point.high, point.y2, point.y1, point.y, fallback);
}

function resolveNumericValue(...values: Array<unknown>): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return Number.NaN;
}
