// ============================================================================
// RiskLab Charts — Attitude Indicator (Artificial Horizon)
// Aviation instrument — pitch & roll visualization
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderAttitudeIndicator(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  _theme: ThemeConfig,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const radius = Math.min(ca.width, ca.height) / 2 - 10;

  const d0 = series.data[0];
  const pitch = Number(d0?.meta?.pitch ?? d0?.y ?? 0); // degrees
  const roll = Number(d0?.meta?.roll ?? d0?.x ?? 0);  // degrees
  const pitchPx = (pitch / 90) * radius;

  // Roll rotation helpers: rotate a point around (cx, cy) by the roll angle
  const rollRad = (roll * Math.PI) / 180;
  const cosR = Math.cos(rollRad);
  const sinR = Math.sin(rollRad);
  const rot = (px: number, py: number): [number, number] => {
    const dx = px - cx, dy = py - cy;
    return [cx + dx * cosR - dy * sinR, cy + dx * sinR + dy * cosR];
  };

  // Outer bezel / clip circle
  r.drawCircle(cx, cy, radius, { fill: '#1a1a2e', stroke: '#555', strokeWidth: 3 });

  // Sky & ground — draw a large rotated split through the centre, offset by pitch.
  // We define the horizon line and two large quads that extend well beyond the clip circle.
  const ext = radius * 2; // extend far enough to fill circle even when rotated
  const hy = cy + pitchPx; // horizon y before rotation

  // Four corners of sky rect (before rotation)
  const skyTL: [number, number] = [cx - ext, hy - ext * 2];
  const skyTR: [number, number] = [cx + ext, hy - ext * 2];
  const skyBL: [number, number] = [cx - ext, hy];
  const skyBR: [number, number] = [cx + ext, hy];

  // Four corners of ground rect (before rotation)
  const gndTL: [number, number] = [cx - ext, hy];
  const gndTR: [number, number] = [cx + ext, hy];
  const gndBL: [number, number] = [cx - ext, hy + ext * 2];
  const gndBR: [number, number] = [cx + ext, hy + ext * 2];

  // Rotate and draw sky
  const [s1x, s1y] = rot(...skyTL);
  const [s2x, s2y] = rot(...skyTR);
  const [s3x, s3y] = rot(...skyBR);
  const [s4x, s4y] = rot(...skyBL);
  r.drawPath(
    `M ${s1x} ${s1y} L ${s2x} ${s2y} L ${s3x} ${s3y} L ${s4x} ${s4y} Z`,
    { fill: '#1565C0', fillOpacity: 0.9 },
  );

  // Rotate and draw ground
  const [g1x, g1y] = rot(...gndTL);
  const [g2x, g2y] = rot(...gndTR);
  const [g3x, g3y] = rot(...gndBR);
  const [g4x, g4y] = rot(...gndBL);
  r.drawPath(
    `M ${g1x} ${g1y} L ${g2x} ${g2y} L ${g3x} ${g3y} L ${g4x} ${g4y} Z`,
    { fill: '#5D4037', fillOpacity: 0.9 },
  );

  // Horizon line (rotated)
  const [hlx1, hly1] = rot(cx - ext, hy);
  const [hlx2, hly2] = rot(cx + ext, hy);
  r.drawLine(hlx1, hly1, hlx2, hly2, { stroke: '#fff', strokeWidth: 2 });

  // Pitch ladder lines (every 10°) — rotated with the horizon
  for (let p = -40; p <= 40; p += 10) {
    if (p === 0) continue;
    const py = cy + pitchPx - (p / 90) * radius;
    const half = p % 20 === 0 ? 30 : 18;
    const [lx1, ly1] = rot(cx - half, py);
    const [lx2, ly2] = rot(cx + half, py);
    r.drawLine(lx1, ly1, lx2, ly2, { stroke: '#fff', strokeWidth: 1, strokeOpacity: 0.7 });
    if (p % 20 === 0) {
      const [tx1, ty1] = rot(cx - half - 16, py + 4);
      const [tx2, ty2] = rot(cx + half + 6, py + 4);
      r.drawText(tx1, ty1, String(Math.abs(p)), {
        fill: '#fff', fontSize: 9, textAnchor: 'end',
      });
      r.drawText(tx2, ty2, String(Math.abs(p)), {
        fill: '#fff', fontSize: 9, textAnchor: 'start',
      });
    }
  }

  // Roll indicator triangle at top (fixed to frame, does NOT rotate)
  const triSize = 10;
  r.drawPath(
    `M ${cx} ${cy - radius + 6} L ${cx - triSize} ${cy - radius + 6 + triSize * 1.5} L ${cx + triSize} ${cy - radius + 6 + triSize * 1.5} Z`,
    { fill: '#f59e0b' },
  );

  // Roll arc with tick marks (fixed to frame)
  for (let deg = -60; deg <= 60; deg += 10) {
    const a = (-90 + deg) * Math.PI / 180;
    const inner = radius - 8;
    const outer = radius - (deg % 30 === 0 ? 20 : 14);
    r.drawLine(
      cx + Math.cos(a) * outer, cy + Math.sin(a) * outer,
      cx + Math.cos(a) * inner, cy + Math.sin(a) * inner,
      { stroke: '#fff', strokeWidth: deg % 30 === 0 ? 2 : 1 },
    );
  }

  // Aircraft symbol (center wings — fixed to frame)
  const wingW = 40;
  r.drawLine(cx - wingW, cy, cx - 8, cy, { stroke: '#f59e0b', strokeWidth: 3 });
  r.drawLine(cx + 8, cy, cx + wingW, cy, { stroke: '#f59e0b', strokeWidth: 3 });
  r.drawCircle(cx, cy, 4, { fill: '#f59e0b', stroke: 'none' });

  // Outer ring mask
  r.drawCircle(cx, cy, radius, { fill: 'none', stroke: '#333', strokeWidth: 6 });
}
