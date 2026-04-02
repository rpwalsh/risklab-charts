// ============================================================================
// RiskLab Charts — Chord Diagram
// Bidirectional flow relationships — migration, trade, dependency analysis
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

const TAU = Math.PI * 2;

export function renderChordDiagram(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const outerR = Math.min(ca.width, ca.height) / 2 - 30;
  const innerR = outerR - 16;

  // Data format: meta.from, meta.to as group names; y = flow value
  const data = series.data.filter(d => d.y != null && d.meta?.from && d.meta?.to);
  if (!data.length) return;

  // Determine which groups are hovered (if any)
  const hp = state.hoveredPoint;
  let hoveredGroups: Set<string> | null = null;
  if (hp?.seriesId === series.id && hp.index != null && hp.index < data.length) {
    const hd = data[hp.index];
    if (hd) {
      hoveredGroups = new Set([String(hd.meta!.from), String(hd.meta!.to)]);
    }
  }

  // Collect groups and totals
  const groups = new Map<string, number>();
  for (const d of data) {
    const from = String(d.meta!.from);
    const to = String(d.meta!.to);
    groups.set(from, (groups.get(from) ?? 0) + Number(d.y));
    groups.set(to, (groups.get(to) ?? 0) + Number(d.y));
  }

  const totalValue = [...groups.values()].reduce((s, v) => s + v, 0) || 1;
  const pad = 0.02; // gap between arcs
  const usableAngle = TAU - pad * groups.size;

  // Assign angular spans
  const groupArcs = new Map<string, { start: number; end: number; color: string }>();
  let currentAngle = -Math.PI / 2;
  let colorIdx = 0;

  for (const [name, value] of groups) {
    const span = (value / totalValue) * usableAngle;
    const hue = (colorIdx * 137.508) % 360; // golden angle for max spread
    groupArcs.set(name, {
      start: currentAngle,
      end: currentAngle + span,
      color: `hsl(${hue}, 65%, 55%)`,
    });
    currentAngle += span + pad;
    colorIdx++;
  }

  // Draw outer arcs (groups)
  for (const [name, arc] of groupArcs) {
    const ox1 = cx + Math.cos(arc.start) * outerR;
    const oy1 = cy + Math.sin(arc.start) * outerR;
    const ox2 = cx + Math.cos(arc.end) * outerR;
    const oy2 = cy + Math.sin(arc.end) * outerR;
    const ix2 = cx + Math.cos(arc.end) * innerR;
    const iy2 = cy + Math.sin(arc.end) * innerR;
    const ix1 = cx + Math.cos(arc.start) * innerR;
    const iy1 = cy + Math.sin(arc.start) * innerR;
    const large = arc.end - arc.start > Math.PI ? 1 : 0;

    const isDimmed = hoveredGroups && !hoveredGroups.has(name);
    r.drawPath(
      `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2}
       L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`,
      { fill: arc.color, fillOpacity: isDimmed ? 0.2 : 0.9, stroke: 'rgba(0,0,0,0.2)', strokeWidth: 0.5 },
    );

    // Label
    const midAngle = (arc.start + arc.end) / 2;
    const labelR = outerR + 14;
    r.drawText(cx + Math.cos(midAngle) * labelR, cy + Math.sin(midAngle) * labelR + 4, name, {
      fill: theme.textColor as string, fontSize: 10, textAnchor: 'middle', fontWeight: 'bold',
      opacity: isDimmed ? 0.3 : 1,
    });
  }

  // Draw chords (flows)
  // Track consumed angle per group
  const consumed = new Map<string, number>();
  for (const [name, arc] of groupArcs) consumed.set(name, arc.start);

  for (const d of data) {
    const from = String(d.meta!.from);
    const to = String(d.meta!.to);
    const value = Number(d.y);
    const fromArc = groupArcs.get(from);
    const toArc = groupArcs.get(to);
    if (!fromArc || !toArc) continue;

    const fromTotal = groups.get(from) ?? 1;
    const toTotal = groups.get(to) ?? 1;
    const fromSpan = (value / fromTotal) * (fromArc.end - fromArc.start);
    const toSpan = (value / toTotal) * (toArc.end - toArc.start);

    const fStart = consumed.get(from)!;
    const fEnd = Math.min(fStart + fromSpan, fromArc.end);
    consumed.set(from, fEnd);

    const tStart = consumed.get(to)!;
    const tEnd = Math.min(tStart + toSpan, toArc.end);
    consumed.set(to, tEnd);

    // Is this chord connected to a hovered group?
    const isChordHighlighted = hoveredGroups && (hoveredGroups.has(from) || hoveredGroups.has(to));
    const isChordDimmed = hoveredGroups && !isChordHighlighted;
    const chordOpacity = isChordDimmed ? 0.06 : isChordHighlighted ? 0.65 : 0.35;

    // Chord as two arcs + two bezier curves
    const p1 = { x: cx + Math.cos(fStart) * innerR, y: cy + Math.sin(fStart) * innerR };
    const p2 = { x: cx + Math.cos(fEnd) * innerR, y: cy + Math.sin(fEnd) * innerR };
    const p3 = { x: cx + Math.cos(tStart) * innerR, y: cy + Math.sin(tStart) * innerR };
    const p4 = { x: cx + Math.cos(tEnd) * innerR, y: cy + Math.sin(tEnd) * innerR };

    const path = `M ${p1.x} ${p1.y}
      A ${innerR} ${innerR} 0 0 1 ${p2.x} ${p2.y}
      Q ${cx} ${cy} ${p3.x} ${p3.y}
      A ${innerR} ${innerR} 0 0 1 ${p4.x} ${p4.y}
      Q ${cx} ${cy} ${p1.x} ${p1.y} Z`;

    r.drawPath(path, { fill: fromArc.color, fillOpacity: chordOpacity, stroke: fromArc.color, strokeWidth: 0.5, strokeOpacity: isChordDimmed ? 0.1 : 0.5 });
  }
}
