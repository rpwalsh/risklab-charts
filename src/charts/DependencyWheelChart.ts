// ============================================================================
// RiskLab Charts — Dependency Wheel Chart (Chord Diagram)
// Renders directional flows between nodes arranged in a circle.
// Each node is a radial arc; flows are drawn as Bezier chords scaled to
// the relative weight of each connection — matching commercial charting' premium
// dependencywheel series type.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

// ---- Public config -- -------------------------------------------------------

export interface DependencyWheelNode {
  /** Unique id — must match keys used in links. */
  id: string;
  /** Display name (defaults to id). */
  name?: string;
  /** Override node arc color. */
  color?: string;
}

export interface DependencyWheelLink {
  from: string;
  to: string;
  /** Weight / flow volume. */
  weight: number;
  /** Override chord fill color. */
  color?: string;
}

export interface DependencyWheelConfig {
  /** Node metadata. If omitted, nodes are inferred from links. */
  nodes?: DependencyWheelNode[];
  links: DependencyWheelLink[];
  /** Inner-radius fraction, 0–1 (default 0.6). */
  innerRadiusFraction?: number;
  /** Gap between node arcs in radians (default 0.008). */
  nodePaddingAngle?: number;
  /** Show labels on node arcs (default true). */
  showLabels?: boolean;
  /** Font size for labels (default 11). */
  labelFontSize?: number;
  /** Chord fill opacity (default 0.45). */
  chordOpacity?: number;
  /** Rotate diagram so first node starts at this angle in degrees (default -90). */
  startAngleDeg?: number;
}

// ---- Internal layout --------------------------------------------------------

interface NodeLayout {
  id: string;
  name: string;
  color: string;
  /** Arc start angle (radians). */
  startAngle: number;
  /** Arc end angle (radians). */
  endAngle: number;
  /** Total weight = sum of all links to/from this node. */
  totalWeight: number;
  /** Current fill position used when assigning chord slots. */
  fillPos: number;
}

interface ChordLayout {
  fromId: string;
  toId: string;
  /** Angle range on the source arc [start, end]. */
  srcAngles: [number, number];
  /** Angle range on the target arc [start, end]. */
  dstAngles: [number, number];
  weight: number;
  color: string;
}

// ---- Geometry helpers -------------------------------------------------------

function polarToCart(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/**
 * SVG arc segment path "d" string.
 */
function arcSegmentPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startA: number, endA: number,
): string {
  const sinStart = Math.sin(startA), cosStart = Math.cos(startA);
  const sinEnd = Math.sin(endA), cosEnd = Math.cos(endA);
  const largeArc = endA - startA > Math.PI ? 1 : 0;

  const x1 = cx + outerR * cosStart; const y1 = cy + outerR * sinStart;
  const x2 = cx + outerR * cosEnd;   const y2 = cy + outerR * sinEnd;
  const x3 = cx + innerR * cosEnd;   const y3 = cy + innerR * sinEnd;
  const x4 = cx + innerR * cosStart; const y4 = cy + innerR * sinStart;

  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * Chord cubic-bezier path between two arc ranges.
 * Uses the midpoint of each arc range as the anchor direction.
 */
function chordPath(
  cx: number, cy: number, r: number,
  srcStart: number, srcEnd: number,
  dstStart: number, dstEnd: number,
): string {
  const srcMid = (srcStart + srcEnd) / 2;
  const dstMid = (dstStart + dstEnd) / 2;

  const [sx1, sy1] = polarToCart(cx, cy, r, srcStart);
  const [sx2, sy2] = polarToCart(cx, cy, r, srcEnd);
  const [dx1, dy1] = polarToCart(cx, cy, r, dstEnd);
  const [dx2, dy2] = polarToCart(cx, cy, r, dstStart);

  // Control points aimed at chart center (bezier curves toward origin)
  const pull = r * 0.15;
  const [csx, csy] = polarToCart(cx, cy, pull, srcMid);
  const [cdx, cdy] = polarToCart(cx, cy, pull, dstMid);

  return [
    `M ${sx1} ${sy1}`,
    `A ${r} ${r} 0 ${srcEnd - srcStart > Math.PI ? 1 : 0} 1 ${sx2} ${sy2}`,
    `C ${csx} ${csy} ${cdx} ${cdy} ${dx1} ${dy1}`,
    `A ${r} ${r} 0 ${dstEnd - dstStart > Math.PI ? 1 : 0} 1 ${dx2} ${dy2}`,
    `C ${cdx} ${cdy} ${csx} ${csy} ${sx1} ${sy1}`,
    'Z',
  ].join(' ');
}

// ---- Layout computation -----------------------------------------------------

function buildLayout(
  cfg: DependencyWheelConfig,
  theme: ThemeConfig,
): { nodes: NodeLayout[]; chords: ChordLayout[] } {
  const links = cfg.links;
  const startAngle = ((cfg.startAngleDeg ?? -90) * Math.PI) / 180;
  const gap = cfg.nodePaddingAngle ?? 0.008;

  // Collect unique node ids
  const nodeIds: string[] = [];
  const nodeIdSet = new Set<string>();
  if (cfg.nodes) {
    for (const n of cfg.nodes) { nodeIds.push(n.id); nodeIdSet.add(n.id); }
  }
  for (const l of links) {
    if (!nodeIdSet.has(l.from)) { nodeIds.push(l.from); nodeIdSet.add(l.from); }
    if (!nodeIdSet.has(l.to))   { nodeIds.push(l.to);   nodeIdSet.add(l.to); }
  }

  const nodeMetaMap = new Map<string, DependencyWheelNode>(
    (cfg.nodes ?? []).map(n => [n.id, n]),
  );

  // Compute total weight per node (sum of links in both directions)
  const weightMap = new Map<string, number>();
  for (const id of nodeIds) weightMap.set(id, 0);
  for (const l of links) {
    weightMap.set(l.from, (weightMap.get(l.from) ?? 0) + l.weight);
    weightMap.set(l.to,   (weightMap.get(l.to)   ?? 0) + l.weight);
  }

  const totalWeight = [...weightMap.values()].reduce((a, b) => a + b, 0);
  const totalArc = 2 * Math.PI - gap * nodeIds.length;

  // Assign arc slices
  let cursor = startAngle;
  const nodesOut: NodeLayout[] = nodeIds.map((id, i) => {
    const tw = weightMap.get(id) ?? 0;
    const arcSpan = totalWeight > 0 ? (tw / totalWeight) * totalArc : totalArc / nodeIds.length;
    const meta = nodeMetaMap.get(id);
    const color = (meta?.color as string | undefined) ?? getSeriesColor(theme, i);
    const layout: NodeLayout = {
      id,
      name: meta?.name ?? id,
      color,
      startAngle: cursor,
      endAngle: cursor + arcSpan,
      totalWeight: tw,
      fillPos: cursor,
    };
    cursor += arcSpan + gap;
    return layout;
  });

  const nodeByIdMap = new Map<string, NodeLayout>(nodesOut.map(n => [n.id, n]));

  // Build chord slot allocations
  const chords: ChordLayout[] = [];
  for (let li = 0; li < links.length; li++) {
    const l = links[li];
    const src = nodeByIdMap.get(l.from);
    const dst = nodeByIdMap.get(l.to);
    if (!src || !dst || l.weight <= 0) continue;

    const srcSpan = src.totalWeight > 0
      ? (l.weight / src.totalWeight) * (src.endAngle - src.startAngle)
      : 0;
    const dstSpan = dst.totalWeight > 0
      ? (l.weight / dst.totalWeight) * (dst.endAngle - dst.startAngle)
      : 0;

    const srcAngles: [number, number] = [src.fillPos, src.fillPos + srcSpan];
    const dstAngles: [number, number] = [dst.fillPos, dst.fillPos + dstSpan];

    src.fillPos += srcSpan;
    dst.fillPos += dstSpan;

    const color = (l.color as string | undefined) ?? src.color;
    chords.push({ fromId: l.from, toId: l.to, srcAngles, dstAngles, weight: l.weight, color });
  }

  return { nodes: nodesOut, chords };
}

// ---- Main render function ---------------------------------------------------

export function renderDependencyWheel(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const dwCfg = (config as ChartConfig & { dependencyWheel?: DependencyWheelConfig })?.dependencyWheel;
  if (!dwCfg) return;

  const { chartArea } = state;
  const cx = chartArea.x + chartArea.width / 2;
  const cy = chartArea.y + chartArea.height / 2;
  const outerR = Math.min(chartArea.width, chartArea.height) / 2 - 16;
  const innerFrac = dwCfg.innerRadiusFraction ?? 0.6;
  const innerR = outerR * innerFrac;
  const chordR = innerR - 2;
  const opacity = dwCfg.chordOpacity ?? 0.45;
  const showLabels = dwCfg.showLabels !== false;
  const labelFontSize = dwCfg.labelFontSize ?? 11;

  const { nodes, chords } = buildLayout(dwCfg, theme);

  renderer.beginGroup('dw-chords', 'uc-dw-chords');

  // Draw chords (underneath arcs)
  for (const chord of chords) {
    const path = chordPath(
      cx, cy, chordR,
      chord.srcAngles[0], chord.srcAngles[1],
      chord.dstAngles[0], chord.dstAngles[1],
    );
    renderer.drawPath(path, {
      fill: chord.color,
      opacity,
      stroke: chord.color,
      strokeWidth: 0.5,
    });
  }

  renderer.endGroup();
  renderer.beginGroup('dw-nodes', 'uc-dw-nodes');

  // Draw node arcs
  for (const node of nodes) {
    if (node.endAngle <= node.startAngle) continue;
    const path = arcSegmentPath(cx, cy, innerR, outerR, node.startAngle, node.endAngle);
    renderer.drawPath(path, {
      fill: node.color,
      stroke: (theme.backgroundColor as string) ?? '#fff',
      strokeWidth: 1.5,
    });
  }

  renderer.endGroup();

  if (showLabels) {
    renderer.beginGroup('dw-labels', 'uc-dw-labels');
    const labelR = outerR + 14;
    for (const node of nodes) {
      const midAngle = (node.startAngle + node.endAngle) / 2;
      let [lx, ly] = polarToCart(cx, cy, labelR, midAngle);
      // Clamp within chartArea
      lx = Math.max(chartArea.x + 4, Math.min(chartArea.x + chartArea.width - 4, lx));
      ly = Math.max(chartArea.y + 8, Math.min(chartArea.y + chartArea.height - 4, ly));
      // Flip label on left half so text reads outward
      const rightHalf = Math.cos(midAngle) >= 0;
      renderer.drawText(lx, ly, node.name, {
        fontSize: labelFontSize,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: (theme.textColor as string) ?? '#333',
        textAnchor: rightHalf ? 'start' : 'end',
        dominantBaseline: 'middle',
      });
    }
    renderer.endGroup();
  }
}
