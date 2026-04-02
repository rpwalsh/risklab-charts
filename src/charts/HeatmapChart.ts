// ============================================================================
// RiskLab Charts — Heatmap Chart Renderer
// Renders a 2D grid of colored cells based on value intensity
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { interpolateColor } from '../utils/color';

/**
 * Renders a heatmap series as a 2D grid of color-interpolated cells.
 *
 * Derives grid dimensions from unique x/y values, maps each cell's value to a
 * color between the configured min and max scale colors, and optionally renders
 * value labels inside cells that are large enough.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 * @param config - Full chart configuration including heatmap-specific options
 */
export function renderHeatmapSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  config: ChartConfig,
): void {
  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const { chartArea } = state;
  const heatConfig = config.heatmap;
  const minColor = (heatConfig?.colorScale?.min as string) ?? '#EFF6FF';
  const maxColor = (heatConfig?.colorScale?.max as string) ?? '#1D4ED8';
  const borderColor = (heatConfig?.cellBorderColor as string) ?? (theme.backgroundColor as string);
  const borderWidth = heatConfig?.cellBorderWidth ?? 1;
  const borderRadius = heatConfig?.cellBorderRadius ?? 2;

  // Compute grid dimensions from data using ORIGINAL x/y values (may be strings for band axes)
  // Sort so rows/columns appear in consistent numeric-then-alpha order
  const xStrings = [...new Set(data.map((d) => String(d.x)))].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const yStrings = [...new Set(data.map((d) => String(d.y)))].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const cols = xStrings.length || 1;
  const rows = yStrings.length || 1;

  const cellWidth = chartArea.width / cols;
  const cellHeight = chartArea.height / rows;

  // Value range
  const values = data.map((d) => d.z ?? d.yNum ?? 0);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1;

  // Build lookup
  const xIndex = new Map<string, number>();
  xStrings.forEach((v, i) => xIndex.set(v, i));
  const yIndex = new Map<string, number>();
  yStrings.forEach((v, i) => yIndex.set(v, i));

  for (const d of data) {
    const col = xIndex.get(String(d.x)) ?? 0;
    const row = yIndex.get(String(d.y)) ?? 0;
    const value = d.z ?? d.yNum ?? 0;
    const t = (value - minVal) / valRange;
    const color = (d.color as string) ?? interpolateColor(minColor, maxColor, t);

    const x = chartArea.x + col * cellWidth;
    const y = chartArea.y + row * cellHeight;

    renderer.drawRect(
      x + borderWidth / 2,
      y + borderWidth / 2,
      cellWidth - borderWidth,
      cellHeight - borderWidth,
      {
        fill: color,
        stroke: borderColor,
        strokeWidth: borderWidth,
      },
      borderRadius,
    );

    // Value label (if cells are big enough)
    if (cellWidth > 30 && cellHeight > 20) {
      // Preserve decimal precision: show integer if whole, else up to 2 decimal places
      const labelText = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
      renderer.drawText(x + cellWidth / 2, y + cellHeight / 2, labelText, {
        fill: t > 0.5 ? '#fff' : (theme.textColor as string),
        fontSize: Math.min(11, cellHeight * 0.4),
        fontFamily: theme.fontFamily,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
  }
}
