// ============================================================================
// RiskLab Charts — Bullet Chart
// Compact comparison bars — KPI, performance metrics, dashboards
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderBulletChart(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string,
): void {
  const { chartArea: ca } = state;
  // Each data point: y=actual, meta.target, meta.ranges=[poor, satisfactory, good]
  const data = series.data.filter(d => d.y != null);
  if (!data.length) return;

  // Use full available height — compute row height from chart area
  const gap = Math.min(8, ca.height * 0.03);
  const totalGap = gap * Math.max(data.length - 1, 0);
  const rowH = Math.min(70, (ca.height - totalGap) / data.length);
  // Centre rows vertically in the chart area
  const totalH = data.length * rowH + totalGap;
  const startY = ca.y + (ca.height - totalH) / 2;
  const radius = 3;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const by = startY + i * (rowH + gap);
    const actual = Number(d.y);
    const target = Number(d.meta?.target ?? actual * 0.9);
    // Derive fallback qualitative thresholds from the higher of actual vs target
    // so the scale never collapses when actual is zero, and thresholds are
    // independent of which exact value was measured.
    const base = Math.max(actual, target, 1);
    const ranges = (d.meta?.ranges as number[]) ?? [base * 0.5, base * 0.75, base * 1.1];
    const maxVal = Math.max(actual, target, ...ranges);

    const toX = (v: number) => ca.x + (v / maxVal) * ca.width;

    // Background ranges (qualitative scale)
    const rangeColors = ['rgba(150,150,150,0.3)', 'rgba(150,150,150,0.2)', 'rgba(150,150,150,0.1)'];
    const sortedRanges = [...ranges].sort((a, b) => b - a);
    for (let ri = 0; ri < sortedRanges.length; ri++) {
      r.drawRect(ca.x, by, toX(sortedRanges[ri]!) - ca.x, rowH, {
        fill: rangeColors[ri] ?? rangeColors[2]!, stroke: 'none',
      }, radius);
    }

    // Actual value bar
    const barH = rowH * 0.4;
    r.drawRect(ca.x, by + (rowH - barH) / 2, toX(actual) - ca.x, barH, {
      fill: color, fillOpacity: 0.9,
    }, radius);

    // Target marker
    const targetX = toX(target);
    r.drawLine(targetX, by + rowH * 0.12, targetX, by + rowH * 0.88, {
      stroke: theme.textColor as string, strokeWidth: 2.5,
    });

    // Label (left of chart area, with text vertically centered)
    r.drawText(ca.x - 10, by + rowH / 2, String(d.label ?? d.x ?? ''), {
      fill: theme.textColor as string, fontSize: 12, fontWeight: '500', textAnchor: 'end',
      dominantBaseline: 'middle',
    });

    // Value text (right of actual bar)
    r.drawText(toX(actual) + 8, by + rowH / 2, String(actual), {
      fill: theme.textColor as string, fontSize: 11, fontWeight: 'bold', textAnchor: 'start',
      dominantBaseline: 'middle',
    });
  }
}
