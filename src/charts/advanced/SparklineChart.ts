// ============================================================================
// RiskLab Charts — Sparkline Chart
// Minimal inline data visualization — tables, cards, dashboards
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderSparklineChart(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string,
): void {
  const { chartArea: ca } = state;
  const data = series.data.filter(d => d.y != null);
  if (data.length < 2) return;

  const values = data.map(d => Number(d.y));
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const rangeY = maxY - minY || 1;
  const pad = 2;

  // Area fill
  let areaPath = `M ${ca.x + pad} ${ca.y + ca.height - pad}`;
  let linePath = '';
  for (let i = 0; i < data.length; i++) {
    const px = ca.x + pad + (i / (data.length - 1)) * (ca.width - pad * 2);
    const py = ca.y + pad + (1 - (values[i] - minY) / rangeY) * (ca.height - pad * 2);
    areaPath += ` L ${px} ${py}`;
    linePath += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
  }
  areaPath += ` L ${ca.x + ca.width - pad} ${ca.y + ca.height - pad} Z`;

  r.drawPath(areaPath, { fill: color, fillOpacity: 0.1, stroke: 'none' });
  r.drawPath(linePath, { fill: 'none', stroke: color, strokeWidth: 1.5 });

  // End-point dot
  const lastX = ca.x + ca.width - pad;
  const lastY = ca.y + pad + (1 - (values[values.length - 1] - minY) / rangeY) * (ca.height - pad * 2);
  r.drawCircle(lastX, lastY, 3, { fill: color, stroke: '#fff', strokeWidth: 1 });

  // Min/max dots
  const minI = values.indexOf(minY);
  const maxI = values.indexOf(maxY);
  const minPx = ca.x + pad + (minI / (data.length - 1)) * (ca.width - pad * 2);
  const maxPx = ca.x + pad + (maxI / (data.length - 1)) * (ca.width - pad * 2);
  r.drawCircle(minPx, ca.y + ca.height - pad, 2.5, { fill: '#ef4444', stroke: 'none' });
  r.drawCircle(maxPx, ca.y + pad, 2.5, { fill: '#22c55e', stroke: 'none' });
}
