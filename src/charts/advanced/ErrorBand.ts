// ============================================================================
// RiskLab Charts — Error Band / Confidence Interval Chart
// Shaded uncertainty region with center line — scientific, financial
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderErrorBand(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string,
): void {
  const { chartArea: _ca } = state;
  // Data: y = center, meta.upper/lower = band edges (or high/low fields)
  const data = series.data.filter(d => d.y != null);
  if (data.length < 2) return;

  const xScale = state.scales.get(series.xAxisId ?? 'x0');
  const yScale = state.scales.get(series.yAxisId ?? 'y0');
  if (!xScale || !yScale) return;

  // Build band polygon: upper forward, lower reverse
  let bandPath = '';

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const px = xScale.convert(d.x);
    const yVal = Number(d.y);
    const upper = Number(d.meta?.upper ?? d.high ?? (yVal >= 0 ? yVal * 1.1 : yVal * 0.9));
    const py = yScale.convert(upper);
    bandPath += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
  }
  for (let i = data.length - 1; i >= 0; i--) {
    const d = data[i];
    const px = xScale.convert(d.x);
    const yVal = Number(d.y);
    const lower = Number(d.meta?.lower ?? d.low ?? (yVal >= 0 ? yVal * 0.9 : yVal * 1.1));
    const py = yScale.convert(lower);
    bandPath += ` L ${px} ${py}`;
  }
  bandPath += ' Z';

  // Band fill
  r.drawPath(bandPath, { fill: color, fillOpacity: 0.15, stroke: 'none' });

  // Center line
  let linePath = '';
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const px = xScale.convert(d.x);
    const py = yScale.convert(d.y);
    linePath += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
  }
  r.drawPath(linePath, { fill: 'none', stroke: color, strokeWidth: 2 });

  // Upper & lower boundary lines (dashed)
  let upperLine = '', lowerLine = '';
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const px = xScale.convert(d.x);
    const yVal2 = Number(d.y);
    const uy = yScale.convert(Number(d.meta?.upper ?? d.high ?? (yVal2 >= 0 ? yVal2 * 1.1 : yVal2 * 0.9)));
    const ly = yScale.convert(Number(d.meta?.lower ?? d.low ?? (yVal2 >= 0 ? yVal2 * 0.9 : yVal2 * 1.1)));
    upperLine += i === 0 ? `M ${px} ${uy}` : ` L ${px} ${uy}`;
    lowerLine += i === 0 ? `M ${px} ${ly}` : ` L ${px} ${ly}`;
  }
  r.drawPath(upperLine, { fill: 'none', stroke: color, strokeWidth: 0.8, strokeOpacity: 0.5 });
  r.drawPath(lowerLine, { fill: 'none', stroke: color, strokeWidth: 0.8, strokeOpacity: 0.5 });

  // Data point markers
  for (const d of data) {
    const px = xScale.convert(d.x);
    const py = yScale.convert(d.y);
    r.drawCircle(px, py, 3, { fill: color, stroke: '#fff', strokeWidth: 1 });
  }
}
