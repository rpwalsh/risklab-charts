// ============================================================================
// RiskLab Charts — Pareto Chart
// Sorted descending bars with cumulative percentage line (80/20 rule analysis)
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';

export function renderParetoChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  config: ChartConfig,
  theme: ThemeConfig,
): void {
  const { chartArea: ca } = state;
  const xScale = state.scales.get('x0');
  const yScale = state.scales.get('y0');
  if (!xScale || !yScale) return;

  // Collect and sort all points descending by value
  const allPoints: Array<{ label: string; value: number; seriesId: string; index: number }> = [];
  for (const s of series) {
    if (s.visible === false) continue;
    for (let i = 0; i < s.data.length; i++) {
      const d = s.data[i]!;
      allPoints.push({
        label: String(d.x ?? ''),
        value: Math.abs(Number(d.y) || 0),
        seriesId: s.id,
        index: i,
      });
    }
  }

  if (allPoints.length === 0) return;

  // Sort descending
  allPoints.sort((a, b) => b.value - a.value);

  const total = allPoints.reduce((s, p) => s + p.value, 0);

  const n = allPoints.length;
  const barColor = (series[0]?.color as string) ?? theme.palette[0] ?? '#4f46e5';
  const lineColor = config.pareto?.lineColor ?? '#ef4444';
  const fontFamily = theme.fontFamily;

  // Determine bar width from chart area
  const barGap = 0.1;
  const totalWidth = ca.width / n;
  const barW = totalWidth * (1 - barGap);

  renderer.beginGroup('pareto', 'uc-pareto');

  // Draw bars
  let cumulVal = 0;
  const linePoints: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < n; i++) {
    const pt = allPoints[i]!;

    const cx = ca.x + i * totalWidth + totalWidth / 2;
    const bx = cx - barW / 2;
    const barTop = yScale.convert(pt.value);
    const barBot = yScale.convert(0);
    const barH = Math.abs(barBot - barTop);

    const isHovered = state.hoveredPoint?.seriesId === pt.seriesId && state.hoveredPoint.index === pt.index;
    const isSelected = state.selectedPoints.some(p => p.seriesId === pt.seriesId && p.index === pt.index);

    renderer.drawRect(bx, barTop, barW, barH, {
      fill: barColor,
      opacity: isHovered ? 1 : isSelected ? 0.95 : 0.82,
      stroke: '#fff',
      strokeWidth: 0.5,
    }, 2);

    // Cumulative % line points (at right edge of each bar)
    cumulVal += pt.value;
    const cumPct = cumulVal / total;
    const lineX = bx + barW;
    // Map cumPct to y-axis on the right (we use secondary scale via 0–1 on yScale if auto)
    // Simple approach: map 0–1 onto chart area height
    const lineY = ca.y + ca.height - cumPct * ca.height;
    linePoints.push({ x: lineX, y: lineY });
  }

  // Draw 80% reference line
  const pct80Y = ca.y + ca.height - 0.8 * ca.height;
  renderer.drawLine(ca.x, pct80Y, ca.x + ca.width, pct80Y, {
    stroke: 'rgba(239,68,68,0.3)',
    strokeWidth: 1,
    dashArray: [4, 4],
  });
  renderer.drawText(ca.x + 4, pct80Y - 4, '80%', {
    fontSize: 9,
    fontFamily,
    fill: lineColor,
    textAnchor: 'start',
  });

  // Draw cumulative % line
  if (linePoints.length > 0) {
    const d = linePoints.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    renderer.drawPath(d, { stroke: lineColor, strokeWidth: 2, fill: 'none' });

    // Dots
    for (const pt of linePoints) {
      renderer.drawCircle(pt.x, pt.y, 3, { fill: lineColor, stroke: '#fff', strokeWidth: 1 });
    }
  }

  renderer.endGroup();
}

