// ============================================================================
// RiskLab Charts — Strip Chart (categorical dot strip / jitter plot)
// Shows individual data points along a numeric axis grouped by category
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderStripChart(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string, idx: number,
): void {
  const { chartArea: ca } = state;
  const data = series.data.filter(d => d.y != null);
  if (!data.length) return;

  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');

  if (xScale && yScale) {
    // Band-axis categorical strip plot — jittered dots
    const bandwidth = xScale.bandwidth ?? 40;
    const jitterW = bandwidth * 0.6;

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const cx = xScale.convert(d.x);
      const cy = yScale.convert(d.y);
      // Deterministic jitter based on index
      const jitter = ((i * 7919 + 13) % 100) / 100 * jitterW - jitterW / 2;

      r.drawCircle(cx + jitter, cy, 3, {
        fill: color,
        fillOpacity: 0.65,
        stroke: color,
        strokeWidth: 0.5,
      });
    }

    // Channel label
    r.drawText(ca.x + 8, ca.y + 14 + idx * 16, series.name, {
      fill: color, fontSize: 10, fontWeight: 'bold', textAnchor: 'start',
    });
  } else {
    // Fallback: rolling time-series style (EKG)
    const values = data.map(d => Number(d.y));
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const rangeY = maxY - minY || 1;

    const xDivisor = Math.max(data.length - 1, 1);
    let path = '';
    for (let i = 0; i < data.length; i++) {
      const px = ca.x + (i / xDivisor) * ca.width;
      const py = ca.y + ca.height - ((Number(data[i].y) - minY) / rangeY) * ca.height;
      path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    r.drawPath(path, { fill: 'none', stroke: color, strokeWidth: 1.5, strokeOpacity: 0.9 });
  }
}
