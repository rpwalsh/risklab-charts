// ============================================================================
// RiskLab Charts — Compass Rose / Heading Indicator
// Aviation & navigation — heading, waypoints, bearing display
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

const _TAU = Math.PI * 2;

export function renderCompassRose(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const radius = Math.min(ca.width, ca.height) / 2 - 20;

  const heading = Number(series.data[0]?.y ?? 0); // current heading in degrees

  // Background
  r.drawCircle(cx, cy, radius + 4, { fill: '#111', stroke: '#444', strokeWidth: 3 });
  r.drawCircle(cx, cy, radius, { fill: '#1a1a1a', stroke: '#555', strokeWidth: 1 });

  // Cardinal & intercardinal labels
  const cardinals: Array<[string, number]> = [
    ['N', 0], ['NE', 45], ['E', 90], ['SE', 135],
    ['S', 180], ['SW', 225], ['W', 270], ['NW', 315],
  ];

  // Tick marks every degree (long at 10°, medium at 5°)
  for (let deg = 0; deg < 360; deg++) {
    const a = ((deg - heading) * Math.PI) / 180 - Math.PI / 2;
    const isMajor = deg % 30 === 0;
    const isMedium = deg % 10 === 0;
    const isMinor = deg % 5 === 0;
    const inner = radius - (isMajor ? 22 : isMedium ? 16 : isMinor ? 10 : 6);
    const outer = radius - 2;

    if (deg % 5 !== 0 && deg % 2 !== 0) continue; // skip odd degrees for clarity
    r.drawLine(
      cx + Math.cos(a) * inner, cy + Math.sin(a) * inner,
      cx + Math.cos(a) * outer, cy + Math.sin(a) * outer,
      { stroke: isMajor ? '#eee' : '#888', strokeWidth: isMajor ? 2 : 0.8 },
    );
  }

  // Cardinal labels
  for (const [label, deg] of cardinals) {
    const a = ((deg - heading) * Math.PI) / 180 - Math.PI / 2;
    const labelR = radius - 36;
    const isMain = label.length === 1;
    r.drawText(cx + Math.cos(a) * labelR, cy + Math.sin(a) * labelR + 5, label, {
      fill: label === 'N' ? '#ef4444' : '#eee',
      fontSize: isMain ? 16 : 11,
      fontWeight: isMain ? 'bold' : 'normal',
      textAnchor: 'middle',
    });
  }

  // Numeric labels every 30°
  for (let deg = 0; deg < 360; deg += 30) {
    const a = ((deg - heading) * Math.PI) / 180 - Math.PI / 2;
    const numR = radius - 52;
    const label = String(deg / 10).padStart(2, '0');
    if (deg % 90 !== 0) {
      r.drawText(cx + Math.cos(a) * numR, cy + Math.sin(a) * numR + 4, label, {
        fill: '#aaa', fontSize: 11, textAnchor: 'middle',
      });
    }
  }

  // Bearing markers from series data (waypoints)
  for (let i = 1; i < series.data.length; i++) {
    const d = series.data[i];
    const bearing = Number(d.y ?? 0);
    const a = ((bearing - heading) * Math.PI) / 180 - Math.PI / 2;
    const markerR = radius + 10;
    const mSize = 6;

    r.drawPath(
      `M ${cx + Math.cos(a) * (markerR - mSize)} ${cy + Math.sin(a) * (markerR - mSize)}
       L ${cx + Math.cos(a) * (markerR + mSize)} ${cy + Math.sin(a) * (markerR + mSize)}
       L ${cx + Math.cos(a + 0.08) * markerR} ${cy + Math.sin(a + 0.08) * markerR} Z`,
      { fill: color, fillOpacity: 0.9 },
    );

    if (d.label) {
      let blx = cx + Math.cos(a) * (markerR + 18);
      let bly = cy + Math.sin(a) * (markerR + 18) + 4;
      // Clamp within chartArea
      blx = Math.max(ca.x + 4, Math.min(ca.x + ca.width - 4, blx));
      bly = Math.max(ca.y + 8, Math.min(ca.y + ca.height - 4, bly));
      r.drawText(blx, bly, d.label, {
        fill: color, fontSize: 9, fontWeight: 'bold', textAnchor: 'middle',
      });
    }
  }

  // Heading bug (fixed triangle at top)
  r.drawPath(
    `M ${cx} ${cy - radius - 2} L ${cx - 8} ${cy - radius - 14} L ${cx + 8} ${cy - radius - 14} Z`,
    { fill: '#f59e0b' },
  );

  // Center dot
  r.drawCircle(cx, cy, 4, { fill: '#888', stroke: '#aaa', strokeWidth: 1 });

  // Heading readout
  const headingY = Math.min(cy + radius + 8, ca.y + ca.height - 22);
  r.drawRect(cx - 24, headingY, 48, 20, {
    fill: '#0a0a0a', stroke: '#444', strokeWidth: 1,
  });
  r.drawText(
    cx, headingY + 15,
    `${Math.round(heading)}°`,
    { fill: '#0f0', fontSize: 13, fontWeight: 'bold', textAnchor: 'middle', fontFamily: 'monospace' },
  );
}
