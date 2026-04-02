// ============================================================================
// RiskLab Charts — Funnel Chart Renderer
// Renders a tapered funnel showing progressive reduction in values
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

/**
 * Renders a funnel chart as a series of tapered trapezoids showing progressive reduction.
 *
 * Each stage is drawn as a trapezoid whose top and bottom widths derive from the
 * current and next data values. Labels and percentage annotations are centered
 * inside each section.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 */
export function renderFunnelSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
): void {
  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const { chartArea } = state;
  const horizontal = series.funnel?.orientation === 'horizontal';
  const maxValue = Math.max(...data.map((d) => Math.abs(d.yNum ?? 0)), 1);
  const gap = 3;

  if (horizontal) {
    // ── Horizontal funnel: trapezoids taper left → right ──────────────
    const maxHeight = chartArea.height * 0.8;
    const sectionWidth = chartArea.width / data.length;
    const cy = chartArea.y + chartArea.height / 2;

    for (let i = 0; i < data.length; i++) {
      const d = data[i]!;
      const value = Math.abs(d.yNum ?? 0);
      const nextValue = i < data.length - 1
        ? Math.abs((data[i + 1] as ProcessedDataPoint).yNum ?? 0)
        : value * 0.5;

      const leftHeight = (value / maxValue) * maxHeight;
      const rightHeight = (nextValue / maxValue) * maxHeight;
      const x = chartArea.x + i * sectionWidth + gap / 2;
      const w = sectionWidth - gap;
      const color = (d.color as string) ?? getSeriesColor(theme, i);

      // Trapezoid (horizontal)
      renderer.drawPolygon(
        [
          [x, cy - leftHeight / 2],
          [x + w, cy - rightHeight / 2],
          [x + w, cy + rightHeight / 2],
          [x, cy + leftHeight / 2],
        ],
        {
          fill: color,
          stroke: theme.backgroundColor as string,
          strokeWidth: 2,
        },
      );

      // Label
      const label = d.label ?? String(d.x ?? '');
      const percent = ((value / Math.abs(data[0]!.yNum ?? 1)) * 100).toFixed(0);
      renderer.drawText(x + w / 2, cy - 6, label, {
        fill: '#fff',
        fontSize: 12,
        fontFamily: theme.fontFamily,
        fontWeight: '600',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
      renderer.drawText(x + w / 2, cy + 10, `${percent}% (${value})`, {
        fill: '#fff',
        fontSize: 10,
        fontFamily: theme.fontFamily,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        opacity: 0.8,
      });
    }
  } else {
    // ── Vertical funnel (default): trapezoids taper top → bottom ──────
    const maxWidth = chartArea.width * 0.8;
    const sectionHeight = chartArea.height / data.length;
    const cx = chartArea.x + chartArea.width / 2;

    for (let i = 0; i < data.length; i++) {
      const d = data[i]!;
      const value = Math.abs(d.yNum ?? 0);
      const nextValue = i < data.length - 1
        ? Math.abs((data[i + 1] as ProcessedDataPoint).yNum ?? 0)
        : value * 0.5;

      const topWidth = (value / maxValue) * maxWidth;
      const bottomWidth = (nextValue / maxValue) * maxWidth;
      const y = chartArea.y + i * sectionHeight + gap / 2;
      const h = sectionHeight - gap;
      const color = (d.color as string) ?? getSeriesColor(theme, i);

      // Trapezoid (vertical)
      renderer.drawPolygon(
        [
          [cx - topWidth / 2, y],
          [cx + topWidth / 2, y],
          [cx + bottomWidth / 2, y + h],
          [cx - bottomWidth / 2, y + h],
        ],
        {
          fill: color,
          stroke: theme.backgroundColor as string,
          strokeWidth: 2,
        },
      );

      // Label
      const label = d.label ?? String(d.x ?? '');
      const percent = ((value / Math.abs(data[0]!.yNum ?? 1)) * 100).toFixed(0);
      renderer.drawText(cx, y + h / 2 - 6, label, {
        fill: '#fff',
        fontSize: 12,
        fontFamily: theme.fontFamily,
        fontWeight: '600',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
      renderer.drawText(cx, y + h / 2 + 10, `${percent}% (${value})`, {
        fill: '#fff',
        fontSize: 10,
        fontFamily: theme.fontFamily,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        opacity: 0.8,
      });
    }
  }
}
