// ============================================================================
// RiskLab Charts — Wind Rose Chart
// Directional frequency distribution — weather, environmental, aviation
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

const TAU = Math.PI * 2;

export function renderWindRose(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const maxR = Math.min(ca.width, ca.height) / 2 - 30;

  // Data: each point x = direction (N,NNE,NE,...or degrees), y = frequency/speed
  // If multiple series, they stack as speed bands
  const data = series.data.filter(d => d.x != null && d.y != null);
  if (!data.length) return;

  const n = data.length;
  const sliceAngle = TAU / n;
  const maxVal = Math.max(...data.map(d => Number(d.y))) || 1;

  // Map direction labels to angles (degrees, clockwise from N)
  const directionAngles: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };

  const parseDirection = (x: unknown): number => {
    const str = String(x).toUpperCase().trim();
    if (str in directionAngles) return directionAngles[str];
    const num = Number(x);
    return isNaN(num) ? 0 : num;
  };

  // Grid rings
  for (let ring = 1; ring <= 5; ring++) {
    const ringR = (maxR / 5) * ring;
    r.drawCircle(cx, cy, ringR, { fill: 'none', stroke: theme.axis.gridColor as string, strokeWidth: 0.5 });
    r.drawText(
      cx + 3, cy - ringR + 10,
      String(Math.round((maxVal / 5) * ring)),
      { fill: theme.axis.labelColor as string, fontSize: 8, textAnchor: 'start' },
    );
  }

  // Direction lines and labels — one spoke per data direction (not always 16)
  for (let i = 0; i < n; i++) {
    const dirDeg = parseDirection(data[i].x);
    const a = (dirDeg - 90) * Math.PI / 180;
    const isCardinal = dirDeg % 90 === 0;
    const isIntercardinal = dirDeg % 45 === 0;
    r.drawLine(cx, cy, cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR, {
      stroke: theme.axis.gridColor as string, strokeWidth: isCardinal ? 0.8 : 0.3,
    });
    const labelR = maxR + 14;
    let wlx = cx + Math.cos(a) * labelR;
    let wly = cy + Math.sin(a) * labelR + 4;
    // Clamp within chartArea
    wlx = Math.max(ca.x + 4, Math.min(ca.x + ca.width - 4, wlx));
    wly = Math.max(ca.y + 8, Math.min(ca.y + ca.height - 4, wly));
    r.drawText(wlx, wly, String(data[i].x), {
      fill: theme.axis.labelColor as string,
      fontSize: isCardinal ? 12 : isIntercardinal ? 10 : 9,
      fontWeight: isCardinal ? 'bold' : 'normal',
      textAnchor: 'middle',
    });
  }

  // Speed bands (colored gradient from center to edge)
  const bandColors = ['#22c55e', '#84cc16', '#f59e0b', '#ef4444', '#b91c1c'];

  for (let i = 0; i < n; i++) {
    const val = Number(data[i].y);
    const normR = (val / (maxVal || 1)) * maxR;
    const dirDeg = parseDirection(data[i].x);
    // Convert: 0° = North (up), clockwise; SVG: 0 = East, CCW → offset by -90° and negate
    const centerAngle = (dirDeg - 90) * Math.PI / 180;
    const halfSlice = sliceAngle / 2;
    const startAngle = centerAngle - halfSlice;
    const endAngle = centerAngle + halfSlice;
    const gap = 0.008; // small gap between petals

    // Draw stacked bands
    const bands = Math.min(5, Math.ceil(normR / (maxR / 5)));
    for (let b = 0; b < bands; b++) {
      const innerR = (b / bands) * normR;
      const outerR = ((b + 1) / bands) * normR;
      drawArcSector(r, cx, cy, innerR, outerR, startAngle + gap, endAngle - gap, bandColors[b] ?? color);
    }
  }
}

function drawArcSector(
  r: BaseRenderer, cx: number, cy: number,
  innerR: number, outerR: number, startAngle: number, endAngle: number, fillColor: string,
): void {
  const ix1 = cx + Math.cos(startAngle) * innerR;
  const iy1 = cy + Math.sin(startAngle) * innerR;
  const ox1 = cx + Math.cos(startAngle) * outerR;
  const oy1 = cy + Math.sin(startAngle) * outerR;
  const ox2 = cx + Math.cos(endAngle) * outerR;
  const oy2 = cy + Math.sin(endAngle) * outerR;
  const ix2 = cx + Math.cos(endAngle) * innerR;
  const iy2 = cy + Math.sin(endAngle) * innerR;
  const large = endAngle - startAngle > Math.PI ? 1 : 0;

  const path = innerR < 1
    ? `M ${cx} ${cy} L ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} Z`
    : `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2}
       L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`;

  r.drawPath(path, { fill: fillColor, fillOpacity: 0.8, stroke: 'rgba(0,0,0,0.15)', strokeWidth: 0.5 });
}
