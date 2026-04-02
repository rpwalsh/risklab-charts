// ============================================================================
// RiskLab Charts — Radar (Spider) Chart Renderer
// Renders a radar/spider chart with polygon grid and filled data areas
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders a radar (spider) chart series as a filled polygon over a radial grid.
 *
 * Draws a multi-level polygon grid and axis spokes for the first series, then
 * plots each series' values as a closed polygon with optional point markers.
 * Requires at least three data points to form a meaningful shape.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 * @param color - Resolved hex color for this series
 * @param seriesIndex - Zero-based index of this series (controls grid drawing)
 */
export function renderRadarSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
  seriesIndex: number,
): void {
  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length < 3) return;

  const { chartArea } = state;
  const cx = chartArea.x + chartArea.width / 2;
  const cy = chartArea.y + chartArea.height / 2;
  const radius = Math.min(chartArea.width, chartArea.height) / 2 - 40;
  const n = data.length;
  const angleStep = (Math.PI * 2) / n;

  // Determine value range — use global max across ALL active series so the grid
  // scale stays consistent when multiple series with different magnitudes are rendered
  const globalMax = (state.activeSeries ?? []).reduce((max, s) => {
    const vals = (s.data ?? []).map(d => Math.abs(Number(d.y) || 0));
    return Math.max(max, ...vals);
  }, 1);
  const maxVal = Math.max(globalMax, ...data.map((d) => Math.abs(d.yNum ?? 0)), 1);

  // Draw grid (only for first series to avoid overdrawing)
  if (seriesIndex === 0) {
    const levels = 5;
    for (let l = 1; l <= levels; l++) {
      const r = (radius * l) / levels;
      const gridPoints: Array<[number, number]> = [];
      for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        gridPoints.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
      }
      renderer.drawPolygon(gridPoints, {
        fill: 'none',
        stroke: theme.axis.gridColor as string,
        strokeWidth: 1,
      });
    }

    // Draw axes and labels
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      renderer.drawLine(cx, cy, x, y, {
        stroke: theme.axis.gridColor as string,
        strokeWidth: 1,
      });

      // Labels
      const label = data[i]?.label ?? String(data[i]?.x ?? i);
      let lx = cx + (radius + 16) * Math.cos(angle);
      let ly = cy + (radius + 16) * Math.sin(angle);
      // Clamp within chartArea
      lx = Math.max(chartArea.x + 4, Math.min(chartArea.x + chartArea.width - 4, lx));
      ly = Math.max(chartArea.y + 8, Math.min(chartArea.y + chartArea.height - 4, ly));
      renderer.drawText(lx, ly, label, {
        fill: theme.axis.labelColor as string,
        fontSize: 11,
        fontFamily: theme.fontFamily,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
  }

  // Draw data polygon
  const points: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const value = Math.abs(data[i]?.yNum ?? 0);
    const r = (value / maxVal) * radius;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  renderer.drawPolygon(points, {
    fill: color,
    opacity: 0.2,
    stroke: color,
    strokeWidth: 2,
  });

  // Data point markers
  for (const [px, py] of points) {
    renderer.drawCircle(px, py, 4, {
      fill: color,
      stroke: '#fff',
      strokeWidth: 2,
    });
  }
}
