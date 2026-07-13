// ============================================================================
// RiskLab Charts — Sunburst Chart
// Hierarchical radial visualization — file systems, org charts, analytics
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

interface _SunburstNode { label: string; value: number; depth: number; color?: string; startAngle: number; endAngle: number }

export function renderSunburstChart(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, _theme: ThemeConfig,
): void {
  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;
  const maxR = Math.min(ca.width, ca.height) / 2 - 16;

  // data: meta.parent links to parent x-value; y = value
  const data = series.data.filter(d => d.y != null);
  if (!data.length) return;

  // Build hierarchy
  const nodes = new Map<string, { label: string; value: number; parent: string | null; children: string[]; color?: string }>();
  for (const d of data) {
    const id = String(d.x ?? d.label ?? '');
    nodes.set(id, {
      label: d.label ?? id,
      value: Number(d.y),
      parent: d.meta?.parent ? String(d.meta.parent) : null,
      children: [],
      color: d.color as string | undefined,
    });
  }
  // Link children
  for (const [id, node] of nodes) {
    if (node.parent && nodes.has(node.parent)) {
      nodes.get(node.parent)!.children.push(id);
    }
  }

  // Find roots
  const roots = [...nodes.entries()].filter(([, n]) => !n.parent || !nodes.has(n.parent));
  const totalValue = roots.reduce((s, [, n]) => s + n.value, 0) || 1;

  // Compute depths
  const getDepth = (id: string, d: number): number => {
    const node = nodes.get(id);
    if (!node || !node.children.length) return d;
    return Math.max(d, ...node.children.map(c => getDepth(c, d + 1)));
  };
  const maxDepth = roots.length
    ? Math.max(...roots.map(([id]) => getDepth(id, 0))) + 1
    : 1;
  const ringW = maxR / maxDepth;

  // Layout & render recursively
  const layoutAndDraw = (id: string, depth: number, startAngle: number, endAngle: number) => {
    const node = nodes.get(id);
    if (!node) return;

    const innerR = depth * ringW;
    const outerR = (depth + 1) * ringW;
    const hue = hashHue(node.label);
    const light = 50 + depth * 8;
    const fillColor = node.color ?? `hsl(${hue}, 65%, ${light}%)`;

    drawArcSector(r, cx, cy, innerR, outerR, startAngle, endAngle, fillColor);

    // Label (if arc is wide enough)
    const arcLen = (endAngle - startAngle) * ((innerR + outerR) / 2);
    if (arcLen > 20 && outerR - innerR > 14) {
      const midAngle = (startAngle + endAngle) / 2;
      const midR = (innerR + outerR) / 2;
      const lx = cx + Math.cos(midAngle) * midR;
      const ly = cy + Math.sin(midAngle) * midR;
      const maxChars = Math.max(3, Math.floor(arcLen / 7));
      const truncated = node.label.length > maxChars ? node.label.slice(0, maxChars - 1) + '…' : node.label;
      // Show name
      r.drawText(lx, ly, truncated, {
        fill: '#fff', fontSize: 9, textAnchor: 'middle', fontWeight: 'bold',
        dominantBaseline: 'middle',
      });
      // Show value below name
      if (arcLen > 36) {
        r.drawText(lx, ly + 11, String(node.value), {
          fill: '#fff', fontSize: 8, textAnchor: 'middle',
          dominantBaseline: 'middle', opacity: 0.85,
        });
      }
    }

    // Layout children
    if (node.children.length) {
      const childTotal = node.children.reduce((s, cid) => s + (nodes.get(cid)?.value ?? 0), 0) || 1;
      let childStart = startAngle;
      for (const cid of node.children) {
        const child = nodes.get(cid);
        if (!child) continue;
        const childAngle = ((child.value / childTotal) * (endAngle - startAngle));
        layoutAndDraw(cid, depth + 1, childStart, childStart + childAngle);
        childStart += childAngle;
      }
    }
  };

  let rootStart = -Math.PI / 2;
  for (const [id, node] of roots) {
    const rootAngle = (node.value / totalValue) * Math.PI * 2;
    layoutAndDraw(id, 0, rootStart, rootStart + rootAngle);
    rootStart += rootAngle;
  }
}

function drawArcSector(
  r: BaseRenderer, cx: number, cy: number,
  innerR: number, outerR: number, startAngle: number, endAngle: number, fillColor: string,
): void {
  if (endAngle - startAngle < 0.005) return;
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

  r.drawPath(path, { fill: fillColor, fillOpacity: 0.85, stroke: 'rgba(0,0,0,0.25)', strokeWidth: 0.8 });
}

function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}
