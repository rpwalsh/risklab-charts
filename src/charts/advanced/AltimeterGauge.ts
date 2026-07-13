// ============================================================================
// RiskLab Charts — Altimeter Gauge (Aviation)
// Three-pointer altimeter with barometric subscale
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

const TAU = Math.PI * 2;

export function renderAltimeterGauge(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const radius = Math.min(ca.width, ca.height) / 2 - 10;

  const altitude = Number(series.data[0]?.y ?? 0);
  const accentColor = color || '#f59e0b';

  // Bezel
  r.drawCircle(cx, cy, radius, { fill: '#1a1a1a', stroke: '#555', strokeWidth: 3 });
  r.drawCircle(cx, cy, radius - 4, { fill: '#111', stroke: '#333', strokeWidth: 1 });

  // Tick marks — every 20ft small, every 100ft large
  for (let i = 0; i < 100; i++) {
    const angle = (i / 100) * TAU - Math.PI / 2;
    const isHundred = i % 10 === 0;
    const isFifty = i % 5 === 0;
    const innerR = radius - (isHundred ? 30 : isFifty ? 22 : 16);
    const outerR = radius - 8;

    r.drawLine(
      cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR,
      cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR,
      { stroke: '#ccc', strokeWidth: isHundred ? 2 : 0.8 },
    );

    if (isHundred) {
      const numR = radius - 38;
      r.drawText(cx + Math.cos(angle) * numR, cy + Math.sin(angle) * numR + 4, String(i / 10), {
        fill: '#eee', fontSize: 14, fontWeight: 'bold', textAnchor: 'middle',
      });
    }
  }

  // Three needles
  const hundreds = (altitude % 1000) / 1000;
  const thousands = (altitude % 10000) / 10000;
  const tenThousands = (altitude % 100000) / 100000;

  // 100ft hand (long, thin)
  drawNeedle(r, cx, cy, hundreds * TAU - Math.PI / 2, radius - 20, 2, '#eee');
  // 1000ft hand (medium, with triangle tip)
  drawTriangleNeedle(r, cx, cy, thousands * TAU - Math.PI / 2, radius - 35, '#eee');
  // 10000ft hand (short, striped)
  drawNeedle(r, cx, cy, tenThousands * TAU - Math.PI / 2, radius * 0.55, 3, accentColor);

  // Center cap
  r.drawCircle(cx, cy, 6, { fill: '#444', stroke: '#666', strokeWidth: 1 });

  // Digital altitude readout
  const readoutW = 60, readoutH = 20;
  r.drawRect(cx - readoutW / 2, cy + radius * 0.35, readoutW, readoutH, {
    fill: '#0a0a0a', stroke: '#444', strokeWidth: 1,
  });
  r.drawText(
    cx, cy + radius * 0.35 + readoutH / 2 + 5,
    String(Math.round(altitude)).padStart(5, '0'),
    { fill: '#0f0', fontSize: 13, fontWeight: 'bold', textAnchor: 'middle', fontFamily: 'monospace' },
  );
}

function drawNeedle(
  r: BaseRenderer, cx: number, cy: number,
  angle: number, length: number, width: number, color: string,
): void {
  const ex = cx + Math.cos(angle) * length;
  const ey = cy + Math.sin(angle) * length;
  const tx = cx + Math.cos(angle + Math.PI) * 15;
  const ty = cy + Math.sin(angle + Math.PI) * 15;
  r.drawLine(tx, ty, ex, ey, { stroke: color, strokeWidth: width });
}

function drawTriangleNeedle(
  r: BaseRenderer, cx: number, cy: number,
  angle: number, length: number, color: string,
): void {
  const tipX = cx + Math.cos(angle) * length;
  const tipY = cy + Math.sin(angle) * length;
  const baseLen = 8;
  const perpAngle = angle + Math.PI / 2;
  const b1x = cx + Math.cos(angle) * (length - 20) + Math.cos(perpAngle) * baseLen;
  const b1y = cy + Math.sin(angle) * (length - 20) + Math.sin(perpAngle) * baseLen;
  const b2x = cx + Math.cos(angle) * (length - 20) - Math.cos(perpAngle) * baseLen;
  const b2y = cy + Math.sin(angle) * (length - 20) - Math.sin(perpAngle) * baseLen;

  r.drawPath(
    `M ${tipX} ${tipY} L ${b1x} ${b1y} L ${b2x} ${b2y} Z`,
    { fill: color },
  );
  // Shaft
  const tx = cx + Math.cos(angle + Math.PI) * 15;
  const ty = cy + Math.sin(angle + Math.PI) * 15;
  r.drawLine(tx, ty, cx + Math.cos(angle) * (length - 20), cy + Math.sin(angle) * (length - 20), {
    stroke: color, strokeWidth: 2.5,
  });
}
