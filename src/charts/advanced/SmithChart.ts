// ============================================================================
// RiskLab Charts — Smith Chart
// Impedance / RF engineering chart — polar display of complex impedance
// Used by radio engineers, antenna designers, microwave engineers
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

const PI = Math.PI;

export function renderSmithChart(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const radius = Math.min(ca.width, ca.height) / 2 - 30;

  // Outer boundary circle (|Γ| = 1)
  r.drawCircle(cx, cy, radius, {
    fill: 'none',
    stroke: theme.axis.lineColor as string,
    strokeWidth: 1.5,
  });

  // Resistance circles (constant r) — brighter for visibility
  const gridColor = theme.axis.gridColor as string;
  const gridStroke = 1.4;
  const rValues = [0, 0.2, 0.5, 1, 2, 5];
  for (const rVal of rValues) {
    const cr = radius / (1 + rVal);
    const ccx = cx + radius - cr;
    r.drawCircle(ccx, cy, cr, {
      fill: 'none',
      stroke: gridColor,
      strokeWidth: gridStroke,
    });
    // Label
    if (rVal > 0) {
      r.drawText(ccx + cr + 3, cy - 4, String(rVal), {
        fill: theme.axis.labelColor as string,
        fontSize: 9,
        textAnchor: 'start',
      });
    }
  }

  // Reactance arcs (constant x) — positive & negative
  const xValues = [0.2, 0.5, 1, 2, 5];
  for (const xVal of xValues) {
    const arcR = radius / xVal;
    for (const sign of [1, -1]) {
      const arcCy = cy + sign * arcR;
      // Clip to unit circle — draw partial arc
      drawClippedReactanceArc(r, cx, cy, radius, arcR, arcCy, sign, gridColor, gridStroke);
    }
  }

  // Center line (real axis)
  r.drawLine(cx - radius, cy, cx + radius, cy, {
    stroke: gridColor,
    strokeWidth: 1.2,
  });

  // Plot data points
  // Data may contain:
  //  - pre-computed Γ (reflection coefficient) in x/y  → |Γ| ≤ 1
  //  - normalized impedance Z = r + jx                 → |Γ| computed
  // Heuristic: if all |point| ≤ 1 treat as Γ directly.
  const data = series.data.filter(d => d.x != null && d.y != null);
  const isGamma = data.length > 0 && data.every(d => {
    const mag = Math.sqrt(Number(d.x) ** 2 + Number(d.y) ** 2);
    return mag <= 1.05; // small tolerance
  });

  const points: Array<{ px: number; py: number }> = [];

  for (const d of data) {
    let gammaR: number;
    let gammaI: number;
    if (isGamma) {
      // Data is already Γ
      gammaR = Number(d.x);
      gammaI = Number(d.y);
    } else {
      // Data is normalized impedance Z = r + jx → Γ = (Z-1)/(Z+1)
      const zr = Number(d.x);
      const zi = Number(d.y);
      const denom = (zr + 1) ** 2 + zi ** 2 || 1;
      gammaR = (zr ** 2 + zi ** 2 - 1) / denom;
      gammaI = (2 * zi) / denom;
    }

    const px = cx + gammaR * radius;
    const py = cy - gammaI * radius;
    points.push({ px, py });

    r.drawCircle(px, py, 4, { fill: color, stroke: '#fff', strokeWidth: 1 });
  }

  // Connect points with line
  if (points.length > 1) {
    for (let i = 1; i < points.length; i++) {
      r.drawLine(points[i - 1].px, points[i - 1].py, points[i].px, points[i].py, {
        stroke: color,
        strokeWidth: 1.5,
        strokeOpacity: 0.7,
      });
    }
  }
}

function drawClippedReactanceArc(
  r: BaseRenderer,
  cx: number, cy: number,
  unitR: number, arcR: number, arcCy: number,
  sign: number,
  strokeColor: string,
  strokeWidth: number = 1.4,
): void {
  // Sample arc points and clip to unit circle
  const steps = 120;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * PI;
    const px = cx + unitR + Math.cos(t) * arcR;
    const py = arcCy + Math.sin(t) * arcR;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    if (dist <= unitR + 0.5) {
      pts.push({ x: px, y: py });
    }
  }

  if (pts.length < 2) return;
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    path += ` L ${pts[i].x} ${pts[i].y}`;
  }
  r.drawPath(path, { fill: 'none', stroke: strokeColor, strokeWidth });
}
