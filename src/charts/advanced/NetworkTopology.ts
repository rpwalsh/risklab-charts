// ============================================================================
// RiskLab Charts — Network Topology Graph
// Force-directed node-link diagram — network monitoring, infrastructure maps
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

interface LayoutNode { id: string; x: number; y: number; vx: number; vy: number; label: string; size: number; color?: string }
interface LayoutEdge { source: string; target: string; weight: number }

export function renderNetworkTopology(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string,
): void {
  const { chartArea: ca } = state;
  const data = series.data;
  if (!data.length) return;

  // Build nodes & edges from data
  // Supports two data shapes:
  //   1. meta.edges = [{target, weight}]           — explicit edge list
  //   2. meta.id + meta.from (parent link style)   — parent→child edges
  const nodeMap = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];
  const nodeCount = data.length;

  for (let di = 0; di < data.length; di++) {
    const d = data[di];
    const id = String(d.meta?.id ?? d.label ?? d.x ?? '');
    // Deterministic initial positions: distribute nodes in a circle
    const angle = (di / Math.max(nodeCount, 1)) * Math.PI * 2 - Math.PI / 2;
    const initR = Math.min(ca.width, ca.height) * 0.3;
    nodeMap.set(id, {
      id,
      x: ca.x + ca.width / 2 + Math.cos(angle) * initR,
      y: ca.y + ca.height / 2 + Math.sin(angle) * initR,
      vx: 0, vy: 0, label: d.label ?? id, size: Number(d.z ?? d.y ?? 8),
      color: d.color as string | undefined,
    });

    // Explicit edge list
    const edgeList = (d.meta?.edges as Array<{ target: string; weight?: number }>) ?? [];
    for (const e of edgeList) {
      edges.push({ source: id, target: e.target, weight: e.weight ?? 1 });
    }

    // Parent-link style: meta.from = parent node id
    if (d.meta?.from && typeof d.meta.from === 'string') {
      edges.push({ source: String(d.meta.from), target: id, weight: 1 });
    }
    // Explicit forward-link (edge node): only when no meta.from parent-link
    if (d.meta?.to && typeof d.meta.to === 'string' && !d.meta?.from) {
      edges.push({ source: id, target: String(d.meta.to), weight: 1 });
    }
  }

  const nodes = [...nodeMap.values()];

  // Simple force layout (50 iterations)
  for (let iter = 0; iter < 50; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 5000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx += fx; nodes[i].vy += fy;
        nodes[j].vx -= fx; nodes[j].vy -= fy;
      }
    }
    // Attraction along edges
    for (const e of edges) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - 100) * 0.02 * e.weight;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx; s.vy += fy;
      t.vx -= fx; t.vy -= fy;
    }
    // Center gravity
    for (const n of nodes) {
      n.vx += (ca.x + ca.width / 2 - n.x) * 0.01;
      n.vy += (ca.y + ca.height / 2 - n.y) * 0.01;
      n.x += n.vx * 0.3; n.y += n.vy * 0.3;
      n.vx *= 0.8; n.vy *= 0.8;
      n.x = Math.max(ca.x + 20, Math.min(ca.x + ca.width - 20, n.x));
      n.y = Math.max(ca.y + 20, Math.min(ca.y + ca.height - 20, n.y));
    }
  }

  // Draw edges
  for (const e of edges) {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    if (!s || !t) continue;
    r.drawLine(s.x, s.y, t.x, t.y, {
      stroke: theme.axis.gridColor as string, strokeWidth: 1 + e.weight * 0.8, strokeOpacity: 0.8,
    });
  }

  // Draw nodes
  for (const n of nodes) {
    const fill = n.color ?? color;
    const sz = Math.max(6, Math.min(24, n.size));
    r.drawCircle(n.x, n.y, sz, { fill, fillOpacity: 0.85, stroke: '#fff', strokeWidth: 1.5 });
    // Clamp label y to stay within chartArea bounds
    const labelY = Math.min(n.y + sz + 12, ca.y + ca.height - 4);
    r.drawText(n.x, labelY, n.label, {
      fill: theme.textColor as string, fontSize: 10, textAnchor: 'middle',
    });
  }
}
