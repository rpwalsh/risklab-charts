// ============================================================================
// RiskLab Charts — Organization Chart Renderer
// Renders hierarchical tree layouts for org charts, family trees, process flows.
// Equivalent to commercial charting premium "organization" series — and open-source.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

// ---- Public config ----------------------------------------------------------

export type OrgLayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface OrgNode {
  /** Unique identifier. */
  id: string;
  /** Display title (large text). */
  title?: string;
  /** Subtitle / position label (smaller text). */
  description?: string;
  /** URL or base-64 for avatar image (rendered as clip circle). */
  image?: string;
  /** Override background fill. */
  color?: string;
  /** Override text color. */
  textColor?: string;
  /** Mark as collapsed (children hidden). */
  collapsed?: boolean;
}

export interface OrgEdge {
  from: string;
  to: string;
  /** Optional label on the connector. */
  label?: string;
  /** Override stroke color. */
  color?: string;
}

export interface OrgChartConfig {
  nodes: OrgNode[];
  edges: OrgEdge[];
  /** Layout direction (default 'TB' — top to bottom). */
  direction?: OrgLayoutDirection;
  /** Node width in px (default 140). */
  nodeWidth?: number;
  /** Node height in px (default 52). */
  nodeHeight?: number;
  /** Horizontal gap between siblings (default 24). */
  hGap?: number;
  /** Vertical gap between levels (default 48). */
  vGap?: number;
  /** Corner radius of node boxes (default 6). */
  cornerRadius?: number;
  /** Show connector labels (default true). */
  showEdgeLabels?: boolean;
  /** Connector line style (default 'elbow'). */
  lineStyle?: 'elbow' | 'straight' | 'curved';
}

// ---- Internal ---------------------------------------------------------------

interface LayoutNode {
  data: OrgNode;
  children: LayoutNode[];
  parent: LayoutNode | null;
  depth: number;
  x: number;
  y: number;
  /** Subtree width (used by Reingold-Tilford pass) */
  subtreeWidth: number;
}

function buildTree(nodes: OrgNode[], edges: OrgEdge[]): LayoutNode[] {
  const byId = new Map<string, LayoutNode>();
  for (const n of nodes) {
    byId.set(n.id, { data: n, children: [], parent: null, depth: 0, x: 0, y: 0, subtreeWidth: 0 });
  }

  const childSet = new Set<string>();
  for (const e of edges) {
    const src = byId.get(e.from);
    const dst = byId.get(e.to);
    if (!src || !dst) continue;
    if (!src.data.collapsed) {
      src.children.push(dst);
      dst.parent = src;
      childSet.add(e.to);
    }
  }

  // Roots = nodes with no parent in any edge
  const roots: LayoutNode[] = [];
  for (const [id, ln] of byId) {
    if (!childSet.has(id)) roots.push(ln);
  }
  return roots;
}

function setDepths(roots: LayoutNode[], depth = 0): void {
  for (const r of roots) {
    r.depth = depth;
    setDepths(r.children, depth + 1);
  }
}

function computeSubtreeWidth(node: LayoutNode, nw: number, hGap: number): number {
  if (!node.children.length) {
    node.subtreeWidth = nw;
    return nw;
  }
  let total = 0;
  for (const c of node.children) {
    total += computeSubtreeWidth(c, nw, hGap);
    total += hGap;
  }
  total -= hGap;
  node.subtreeWidth = Math.max(total, nw);
  return node.subtreeWidth;
}

function assignPositions(
  node: LayoutNode,
  x: number,
  y: number,
  nw: number,
  nh: number,
  hGap: number,
  vGap: number,
  dir: OrgLayoutDirection,
): void {
  // Place node at center of its allocated slot
  node.x = x + (node.subtreeWidth - nw) / 2;
  node.y = y;

  if (!node.children.length) return;

  // Lay out children left to right (or top to bottom for LR)
  let cursor = x;
  for (const child of node.children) {
    const childY = dir === 'LR' || dir === 'RL'
      ? y + nw + vGap
      : y + nh + vGap;
    assignPositions(child, cursor, childY, nw, nh, hGap, vGap, dir);
    cursor += child.subtreeWidth + hGap;
  }
}

function collectAll(roots: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  const stack = [...roots];
  while (stack.length) {
    const n = stack.pop()!;
    result.push(n);
    stack.push(...n.children);
  }
  return result;
}

// ---- Connector path ---------------------------------------------------------

function elbowPath(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, _bw: number, _bh: number,
  dir: OrgLayoutDirection,
): string {
  // Connect bottom-center of parent to top-center of child (TB layout)
  const px = ax + aw / 2;
  const py = ay + ah;
  const cx = bx + aw / 2;
  const cy = by;
  if (dir === 'LR') {
    // Right-center → left-center
    const mx = (ax + aw + bx) / 2;
    return `M ${ax + aw} ${ay + ah / 2} L ${mx} ${ay + ah / 2} L ${mx} ${by + ah / 2} L ${bx} ${by + ah / 2}`;
  }
  const midY = (py + cy) / 2;
  return `M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`;
}

// ---- Main render ------------------------------------------------------------

export function renderOrgChart(
  renderer: BaseRenderer,
  _allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const orgCfg = (config as ChartConfig & { orgChart?: OrgChartConfig })?.orgChart;
  if (!orgCfg) return;

  const { chartArea } = state;
  const nw    = orgCfg.nodeWidth   ?? 140;
  const nh    = orgCfg.nodeHeight  ?? 52;
  const hGap  = orgCfg.hGap       ?? 24;
  const vGap  = orgCfg.vGap       ?? 48;
  const rx    = orgCfg.cornerRadius ?? 6;
  const dir   = orgCfg.direction  ?? 'TB';
  const _lsyle = orgCfg.lineStyle  ?? 'elbow';
  const showEL = orgCfg.showEdgeLabels !== false;

  const roots = buildTree(orgCfg.nodes, orgCfg.edges);
  setDepths(roots, 0);

  // Compute layout for each root tree (multiple root support)
  let rootOffsetX = chartArea.x;
  const treeRoots: LayoutNode[] = [];
  for (const root of roots) {
    computeSubtreeWidth(root, nw, hGap);
    assignPositions(root, rootOffsetX, chartArea.y + vGap, nw, nh, hGap, vGap, dir);
    rootOffsetX += root.subtreeWidth + hGap * 2;
    treeRoots.push(root);
  }

  const allNodes = collectAll(treeRoots);

  // ── Scale-to-fit: compute bounding box and scale down if tree overflows ───
  let minNodeX = Infinity, maxNodeX = -Infinity;
  let minNodeY = Infinity, maxNodeY = -Infinity;
  for (const ln of allNodes) {
    if (ln.x < minNodeX) minNodeX = ln.x;
    if (ln.x + nw > maxNodeX) maxNodeX = ln.x + nw;
    if (ln.y < minNodeY) minNodeY = ln.y;
    if (ln.y + nh > maxNodeY) maxNodeY = ln.y + nh;
  }
  const treeW = maxNodeX - minNodeX;
  const treeH = maxNodeY - minNodeY;
  const availW = chartArea.width;
  const availH = chartArea.height;
  const scaleX = treeW > availW ? availW / treeW : 1;
  const scaleY = treeH > availH ? availH / treeH : 1;
  const scaleFit = Math.min(scaleX, scaleY, 1);
  if (scaleFit < 1) {
    // Offset to center the scaled tree within chartArea
    const offsetX = chartArea.x + (availW - treeW * scaleFit) / 2 - minNodeX * scaleFit;
    const offsetY = chartArea.y + (availH - treeH * scaleFit) / 2 - minNodeY * scaleFit;
    for (const ln of allNodes) {
      ln.x = ln.x * scaleFit + offsetX;
      ln.y = ln.y * scaleFit + offsetY;
    }
  }
  const effNw = nw * scaleFit;
  const effNh = nh * scaleFit;


  // ── Draw connectors ─────────────────────────────────────────────────────
  renderer.beginGroup('org-edges', 'uc-org-edges');
  for (const ln of allNodes) {
    for (const child of ln.children) {
      const edges = orgCfg.edges.filter(e => e.from === ln.data.id && e.to === child.data.id);
      const edgeColor = edges[0]?.color ?? (theme.textColor as string) ?? '#999';
      const path = elbowPath(ln.x, ln.y, effNw, effNh, child.x, child.y, effNw, effNh, dir);
      renderer.drawPath(path, {
        fill: 'none',
        stroke: edgeColor,
        strokeWidth: 1.5,
      });
      // Edge label
      if (showEL && edges[0]?.label) {
        const lx = (ln.x + effNw / 2 + child.x + effNw / 2) / 2;
        const ly = (ln.y + effNh + child.y) / 2;
        renderer.drawText(lx, ly, edges[0].label, {
          fontSize: Math.max(7, 9 * scaleFit),
          fontFamily: theme.fontFamily ?? 'sans-serif',
          fill: (theme.textColor as string) ?? '#666',
          textAnchor: 'middle',
          dominantBaseline: 'middle',
        });
      }
    }
  }
  renderer.endGroup();

  // ── Draw nodes ──────────────────────────────────────────────────────────
  renderer.beginGroup('org-nodes', 'uc-org-nodes');
  for (let i = 0; i < allNodes.length; i++) {
    const ln = allNodes[i];
    const nd = ln.data;
    const fill = (nd.color as string | undefined) ?? getSeriesColor(theme, i);
    const textFill = (nd.textColor as string | undefined) ?? '#fff';

    // Node box
    renderer.drawRect(ln.x, ln.y, effNw, effNh, { fill, rx, ry: rx }, rx, rx);

    // Title
    const titleY = nd.description
      ? ln.y + effNh * 0.38
      : ln.y + effNh / 2;
    renderer.drawText(ln.x + effNw / 2, titleY, nd.title ?? nd.id, {
      fontSize: Math.max(9, 13 * scaleFit),
      fontWeight: 'bold',
      fontFamily: theme.fontFamily ?? 'sans-serif',
      fill: textFill,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });

    // Description / subtitle
    if (nd.description) {
      renderer.drawText(ln.x + effNw / 2, ln.y + effNh * 0.68, nd.description, {
        fontSize: Math.max(7, 10 * scaleFit),
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: textFill,
        opacity: 0.8,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }

    // Collapsed indicator (▸) when node has hidden children
    if (nd.collapsed) {
      renderer.drawText(ln.x + effNw - 10 * scaleFit, ln.y + effNh / 2, '▸', {
        fontSize: Math.max(7, 10 * scaleFit),
        fill: textFill,
        opacity: 0.7,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
  }
  renderer.endGroup();
}
