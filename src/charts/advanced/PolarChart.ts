// ============================================================================
// RiskLab Charts — Polar / Rose Chart
// Renders data in polar coordinates — ideal for cyclical & directional data
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

const TAU = Math.PI * 2;

export function renderPolarChart(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
  _idx: number,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const maxR = Math.min(ca.width, ca.height) / 2 - 30;
  const data = series.data.filter(d => d.y != null);
  if (!data.length) return;

  // Use global max across every active series so all overlapping roses share the same grid scale
  const globalMax = (state.activeSeries ?? []).reduce((max, s) => {
    const vals = (s.data ?? []).map(d => Math.abs(Number(d.y) || 0));
    return Math.max(max, ...vals);
  }, 0);
  const maxVal = Math.max(globalMax, ...data.map(d => Math.abs(Number(d.y))), 1);
  const sliceAngle = TAU / data.length;

  // Grid rings
  for (let ring = 1; ring <= 4; ring++) {
    const ringR = (maxR / 4) * ring;
    r.drawCircle(cx, cy, ringR, {
      fill: 'none',
      stroke: theme.axis.gridColor as string,
      strokeWidth: 0.5,
    });
  }

  // Spokes
  data.forEach((_, i) => {
    const angle = i * sliceAngle - Math.PI / 2;
    r.drawLine(
      cx, cy,
      cx + Math.cos(angle) * maxR,
      cy + Math.sin(angle) * maxR,
      { stroke: theme.axis.gridColor as string, strokeWidth: 0.5 },
    );
  });

  // Filled sectors
  data.forEach((d, i) => {
    const val = Math.abs(Number(d.y));
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;
    const sR = (val / maxVal) * maxR;

    const x1 = cx + Math.cos(startAngle) * sR;
    const y1 = cy + Math.sin(startAngle) * sR;
    const x2 = cx + Math.cos(endAngle) * sR;
    const y2 = cy + Math.sin(endAngle) * sR;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${sR} ${sR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    r.drawPath(path, { fill: color, fillOpacity: 0.6, stroke: color, strokeWidth: 1.5 });

    // Label
    const labelAngle = startAngle + sliceAngle / 2;
    const labelR = maxR + 14;
    let plx = cx + Math.cos(labelAngle) * labelR;
    let ply = cy + Math.sin(labelAngle) * labelR;
    // Clamp within chartArea
    plx = Math.max(ca.x + 4, Math.min(ca.x + ca.width - 4, plx));
    ply = Math.max(ca.y + 8, Math.min(ca.y + ca.height - 4, ply));
    r.drawText(
      plx,
      ply,
      String(d.label ?? d.x ?? ''),
      { fill: theme.axis.labelColor as string, fontSize: 10, textAnchor: 'middle' },
    );
  });
}
