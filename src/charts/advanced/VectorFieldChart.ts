// ============================================================================
// RiskLab Charts — Vector Field Chart
// Renders directional arrows on a 2D grid — wind, magnetic fields, flow
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderVectorFieldChart(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const { chartArea: ca } = state;
  // Each data point: x, y = position; meta.angle (rad), meta.magnitude
  const data = series.data.filter(d => d.x != null && d.y != null);
  if (!data.length) return;

  const xs = data.map(d => Number(d.x));
  const ys = data.map(d => Number(d.y));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  let maxMag = 0;
  for (const d of data) {
    const mag = Number(d.meta?.magnitude ?? d.z ?? 1);
    if (mag > maxMag) maxMag = mag;
  }
  if (maxMag === 0) maxMag = 1;

  const maxArrowLen = Math.min(ca.width, ca.height) / (Math.sqrt(data.length) * 1.2);

  for (const d of data) {
    const px = ca.x + ((Number(d.x) - minX) / rangeX) * ca.width;
    const py = ca.y + ca.height - ((Number(d.y) - minY) / rangeY) * ca.height;
    const angle = Number(d.meta?.angle ?? 0);
    const mag = Number(d.meta?.magnitude ?? d.z ?? 1);
    const normMag = mag / maxMag;
    const arrowLen = normMag * maxArrowLen;
    const headSize = Math.max(3, arrowLen * 0.25);

    // Arrow endpoint
    const ex = px + Math.cos(angle) * arrowLen;
    const ey = py - Math.sin(angle) * arrowLen;

    // Shaft
    r.drawLine(px, py, ex, ey, {
      stroke: color,
      strokeWidth: 1 + normMag * 1.5,
      strokeOpacity: 0.5 + normMag * 0.5,
      clipPath: 'chart-clip',
    });

    // Arrowhead
    const headAngle1 = angle + Math.PI + 0.4;
    const headAngle2 = angle + Math.PI - 0.4;
    const hx1 = ex + Math.cos(headAngle1) * headSize;
    const hy1 = ey - Math.sin(headAngle1) * headSize;
    const hx2 = ex + Math.cos(headAngle2) * headSize;
    const hy2 = ey - Math.sin(headAngle2) * headSize;

    r.drawPath(
      `M ${ex} ${ey} L ${hx1} ${hy1} L ${hx2} ${hy2} Z`,
      { fill: color, fillOpacity: 0.7 + normMag * 0.3, clipPath: 'chart-clip' },
    );
  }
}
