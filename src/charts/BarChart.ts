// ============================================================================
// RiskLab Charts — Bar / Column Chart Renderer
// Renders vertical bars, horizontal bars, stacked, and grouped
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Render a single bar / column series onto the chart.
 *
 * Supports vertical columns, horizontal bars, stacked, and grouped layouts.
 * Bar width is auto-calculated from scale bandwidth and series count.
 *
 * ### Axis conventions
 *
 * Data always uses `x` for the **category** (or independent variable) and `y`
 * for the **value** (dependent variable), regardless of visual orientation.
 *
 * - **column / stackedColumn** (vertical): the x-axis scale maps categories →
 *   horizontal pixel positions, the y-axis scale maps values → vertical pixel
 *   positions.  Both `xScale` and `yScale` are used as-is.
 *
 * - **bar / stackedBar** (horizontal): users typically configure the category
 *   (band) scale on the y-axis (`y0`, position `'left'`) and the value
 *   (linear) scale on the x-axis (`x0`, position `'bottom'`).  However the
 *   data still stores categories in `d.x` and values in `d.y`.
 *
 *   To reconcile this, the renderer **detects which resolved scale is the band
 *   scale** and assigns it as the *category scale* (providing bar positions
 *   along the y-pixel-axis) while the other scale becomes the *value scale*
 *   (providing bar lengths along the x-pixel-axis).  This makes every
 *   reasonable axis configuration "just work" without requiring users to
 *   mentally swap data fields.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param _theme - Active theme (unused — color is resolved externally)
 * @param color - Resolved hex color for this series
 * @param seriesIndex - Zero-based index of this series within the chart
 * @param totalSeries - Total number of bar/column series (for grouped width)
 *
 * @example
 * ```ts
 * renderBarSeries(renderer, processedSeries, state, theme, '#ec4899', 0, 3);
 * ```
 */
export function renderBarSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  _theme: ThemeConfig,
  color: string,
  seriesIndex: number,
  totalSeries: number,
): void {
  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');
  if (!xScale || !yScale) return;

  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const { chartArea } = state;
  const isHorizontal = series.type === 'bar' || series.type === 'stackedBar';
  const isStacked = series.type === 'stackedBar' || series.type === 'stackedColumn';

  // ── Resolve category & value scales ────────────────────────────────────
  // For horizontal bars the band scale lives on the y-axis and the value
  // (linear) scale on the x-axis.  Detect this automatically so that data
  // authored as { x: 'Category', y: 42 } renders correctly regardless of
  // which axis the user placed the band scale on.
  let catScale  = xScale;   // maps category label → pixel
  let valScale  = yScale;   // maps numeric value → pixel

  if (isHorizontal) {
    // Prefer the band scale for categories.  When both or neither are band
    // scales, fall back to yScale=cat, xScale=val (the conventional layout).
    const xIsBand = xScale.type === 'band' || xScale.type === 'ordinal' || xScale.type === 'point';
    const yIsBand = yScale.type === 'band' || yScale.type === 'ordinal' || yScale.type === 'point';

    if (yIsBand && !xIsBand) {
      // Standard horizontal-bar layout: y0 = band (left), x0 = linear (bottom)
      catScale = yScale;
      valScale = xScale;
    } else if (xIsBand && !yIsBand) {
      // User put band on x0 — keep as-is (catScale=xScale, valScale=yScale)
      catScale = xScale;
      valScale = yScale;
    } else {
      // Both band or both linear — default: y=cat, x=val
      catScale = yScale;
      valScale = xScale;
    }
  }

  // ── Bar sizing ─────────────────────────────────────────────────────────
  const bandwidth = catScale.bandwidth
    ?? ((isHorizontal ? chartArea.height : chartArea.width) / Math.max(data.length, 1)) * 0.6;
  const gap = 2;

  const groupCount = isStacked ? 1 : totalSeries;
  const barWidth = (bandwidth - gap * (groupCount - 1)) / groupCount;
  const offset = isStacked ? 0 : seriesIndex * (barWidth + gap) - (bandwidth / 2) + (barWidth / 2);

  // ── Draw bars ──────────────────────────────────────────────────────────
  for (const d of data) {
    const pointColor = (d.color as string) ?? color;

    if (isHorizontal) {
      // Category position along the Y pixel axis
      const catPos = catScale.convert(d.x);
      // Value positions along the X pixel axis
      const baseX = isStacked && d.y0 != null ? valScale.convert(d.y0) : valScale.convert(0);
      const topX  = isStacked && d.y1 != null ? valScale.convert(d.y1) : valScale.convert(d.yNum);

      const yPos     = catPos - barWidth / 2 + offset;
      const barLen   = Math.abs(topX - baseX);
      const startX   = Math.min(topX, baseX);

      renderer.drawRect(startX, yPos, barLen, barWidth, {
        fill: pointColor,
        stroke: pointColor,
        strokeWidth: 0.5,
        clipPath: 'chart-clip',
      }, 2);
    } else {
      // ── Vertical column (unchanged logic) ──────────────────────────────
      const xPos = catScale.convert(d.x);
      const baseY = isStacked && d.y0 != null ? valScale.convert(d.y0) : valScale.convert(0);
      const topY  = isStacked && d.y1 != null ? valScale.convert(d.y1) : valScale.convert(d.yNum);

      const xStart   = xPos - barWidth / 2 + offset;
      const barHeight = Math.abs(topY - baseY);
      const yStart   = Math.min(topY, baseY);

      renderer.drawRect(xStart, yStart, barWidth, barHeight, {
        fill: pointColor,
        stroke: pointColor,
        strokeWidth: 0.5,
        clipPath: 'chart-clip',
      }, 2);
    }
  }
}
