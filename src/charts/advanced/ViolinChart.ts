// ============================================================================
// RiskLab Charts — Violin Chart
// Distribution visualization — combines box plot with kernel density
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderViolinChart(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string, idx: number, total: number,
): void {
  const { chartArea: ca } = state;
  const data = series.data.filter(d => d.y != null);
  if (data.length < 2) return;

  const violinW = Math.min(80, (ca.width - 20) / Math.max(total, 1));
  const cx = ca.x + (idx + 0.5) * (ca.width / total);

  const values = data.map(d => Number(d.y)).sort((a, b) => a - b);
  const minV = values[0], maxV = values[values.length - 1];
  const rangeV = maxV - minV || 1;

  // Prefer the y-scale from state (supports zoom/pan); fall back to manual mapping
  const yScale = state.scales?.get('y0');
  const toY = yScale
    ? (v: number) => yScale.convert(v)
    : (v: number) => ca.y + ca.height - ((v - minV) / rangeV) * ca.height;

  // Kernel density estimation — Silverman's rule-of-thumb bandwidth:
  // h = 1.06 * σ * n^(-1/5)
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || rangeV * 0.1;
  const bandwidth = Math.max(rangeV * 0.02, 1.06 * stdDev * Math.pow(n, -0.2));
  const steps = 40;
  const density: Array<{ v: number; d: number }> = [];
  let maxDensity = 0;

  for (let i = 0; i <= steps; i++) {
    const v = minV + (i / steps) * rangeV;
    let d = 0;
    for (const val of values) {
      const u = (v - val) / bandwidth;
      d += Math.exp(-0.5 * u * u);
    }
    d /= values.length * bandwidth * Math.sqrt(2 * Math.PI);
    if (d > maxDensity) maxDensity = d;
    density.push({ v, d });
  }

  // Build mirrored violin shape: left side forward, right side reversed
  const halfW = violinW * 0.45;
  let combinedPath = '';
  for (let i = 0; i < density.length; i++) {
    const y = toY(density[i].v);
    const w = (density[i].d / maxDensity) * halfW;
    combinedPath += i === 0 ? `M ${cx - w} ${y}` : ` L ${cx - w} ${y}`;
  }
  for (let i = density.length - 1; i >= 0; i--) {
    const y = toY(density[i].v);
    const w = (density[i].d / maxDensity) * halfW;
    combinedPath += ` L ${cx + w} ${y}`;
  }
  combinedPath += ' Z';

  r.drawPath(combinedPath, { fill: color, fillOpacity: 0.3, stroke: color, strokeWidth: 1.5 });

  // Box plot inside
  const q1 = percentile(values, 25);
  const median = percentile(values, 50);
  const q3 = percentile(values, 75);

  const boxW = 8;
  r.drawRect(cx - boxW / 2, toY(q3), boxW, toY(q1) - toY(q3), {
    fill: color, fillOpacity: 0.5, stroke: color, strokeWidth: 1,
  });
  r.drawLine(cx - boxW / 2, toY(median), cx + boxW / 2, toY(median), {
    stroke: '#fff', strokeWidth: 2,
  });

  // Whiskers
  r.drawLine(cx, toY(q3), cx, toY(maxV), { stroke: color, strokeWidth: 1 });
  r.drawLine(cx, toY(q1), cx, toY(minV), { stroke: color, strokeWidth: 1 });

  // Label
  const violinLabelY = ca.y + ca.height + 16;
  r.drawText(cx, violinLabelY, series.name, {
    fill: theme.textColor as string, fontSize: 10, textAnchor: 'middle',
    clipPath: 'chart-clip',
  });
}

function percentile(sorted: number[], p: number): number {
  const i = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
