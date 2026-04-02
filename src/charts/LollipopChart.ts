// ============================================================================
// RiskLab Charts — Lollipop (Dot-Plot / Dumbbell) Chart
// Slender stem lines topped with circle markers — cleaner than bar charts
// for sparse categorical comparisons. Also supports dumbbell (two-value) mode.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../core/types';
import type { ProcessedDataPoint, ProcessedSeries } from '../core/DataPipeline';

export function renderLollipopChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  config: ChartConfig,
  theme: ThemeConfig,
): void {
  const { chartArea: _ca } = state;
  const xScale = state.scales.get('x0');
  const yScale = state.scales.get('y0');
  if (!xScale || !yScale) return;

  const isHorizontal = config.lollipop?.horizontal === true;
  const dotRadius = config.lollipop?.dotRadius ?? 6;
  const stemWidth = config.lollipop?.stemWidth ?? 2;
  const _fontFamily = theme.fontFamily;
  const _fontSize = 11;

  renderer.beginGroup('lollipop', 'uc-lollipop');

  let colorIndex = 0;
  for (const s of series) {
    if (s.visible === false) { colorIndex++; continue; }

    const color = (s.color as string) ?? theme.palette[colorIndex % theme.palette.length] ?? '#4f46e5';
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];

    for (let i = 0; i < data.length; i++) {
      const d = data[i]!;
      const isHovered = state.hoveredPoint?.seriesId === s.id && state.hoveredPoint.index === i;
      const isSelected = state.selectedPoints.some(p => p.seriesId === s.id && p.index === i);

      const cx = xScale.convert(d.x);
      const cy = yScale.convert(d.yNum ?? d.y);
      const baseY = yScale.convert(0);
      // For horizontal lollipop the y-scale maps values to X-axis positions (same convention
      // as horizontal bar chart where yScale drives the horizontal extent)
      const baseX = yScale.convert(0);

      if (!isHorizontal) {
        // Vertical lollipop: stem from baseline up to dot
        renderer.drawLine(cx, baseY, cx, cy, {
          stroke: color,
          strokeWidth: isHovered ? stemWidth + 1 : stemWidth,
          opacity: 0.6,
        });

        // Dumbbell second value
        if (d.y2 !== undefined && isFinite(Number(d.y2))) {
          const cy2 = yScale.convert(d.y2);
          renderer.drawLine(cx, cy, cx, cy2, {
            stroke: color,
            strokeWidth: isHovered ? stemWidth + 1 : stemWidth,
            opacity: 0.4,
          });
          renderer.drawCircle(cx, cy2, dotRadius * 0.8, {
            fill: '#fff',
            stroke: color,
            strokeWidth: isHovered ? 2.5 : 1.5,
          });
        }

        // Main dot
        renderer.drawCircle(cx, cy, isHovered ? dotRadius + 2 : dotRadius, {
          fill: color,
          stroke: isSelected ? '#fff' : 'none',
          strokeWidth: isSelected ? 2 : 0,
        });
      } else {
        // Horizontal lollipop
        // cx = xScale(d.x) = category position → used as Y coordinate
        // cy = yScale(d.yNum) = value position  → used as X coordinate
        renderer.drawLine(baseX, cx, cy, cx, {
          stroke: color,
          strokeWidth: isHovered ? stemWidth + 1 : stemWidth,
          opacity: 0.6,
        });

        if (d.y2 !== undefined && isFinite(Number(d.y2))) {
          const cx2 = yScale.convert(Number(d.y2));
          renderer.drawLine(cy, cx, cx2, cx, {
            stroke: color,
            strokeWidth: isHovered ? stemWidth + 1 : stemWidth,
            opacity: 0.4,
          });
          renderer.drawCircle(cx2, cx, dotRadius * 0.8, {
            fill: '#fff',
            stroke: color,
            strokeWidth: isHovered ? 2.5 : 1.5,
          });
        }

        renderer.drawCircle(cy, cx, isHovered ? dotRadius + 2 : dotRadius, {
          fill: color,
          stroke: isSelected ? '#fff' : 'none',
          strokeWidth: isSelected ? 2 : 0,
        });
      }
    }

    colorIndex++;
  }

  renderer.endGroup();
}
