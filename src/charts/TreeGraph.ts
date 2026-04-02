// ============================================================================
// RiskLab Charts — Tree Graph Chart
// Renders an node-link tree with orthogonal or curved connectors.
// Different from Treemap (which fills area with nested rectangles).
// Equivalent to Highcharts premium "treegraph" series — free in RiskLab Charts.
//
// Layout: Reingold-Tilford algorithm for O(n) orthogonal tree layout.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

// ---- Public config ----------------------------------------------------------

export interface TreeGraphNode {
  id: string;
  name?: string;
  parent?: string;  // id of parent node; omit for root
  value?: number;   // drives node size
  color?: string;
  /** Custom data to attach. */
  data?: Record<string, unknown>;
}

export type TreeGraphDirection = 'TB' | 'LR';
export type TreeGraphLinkShape  = 'curved' | 'straight' | 'step';

export interface TreeGraphConfig {
  nodes: TreeGraphNode[];
  /** Layout direction: top-bottom or left-right (default 'LR'). */
  direction?: TreeGraphDirection;
  /** Node box width in px (default 100). */
  nodeWidth?: number;
  /** Node box height in px (default 28). */
  nodeHeight?: number;
  /** Vertical gap between sibling nodes (default 20). */
  siblingGap?: number;
  /** Horizontal gap between depth levels (default 80). */
  levelGap?: number;
  /** Link style (default 'curved'). */
  linkShape?: TreeGraphLinkShape;
  /** Node fill color (default from palette). */
  nodeColor?: string;
  /** Node text color (default '#fff'). */
  nodeTextColor?: string;
  /** Corner radius for node boxes (default 4). */
  cornerRadius?: number;
  /** Show value inside node (default false). */
  showValues?: boolean;
}

// ---- Internal layout --------------------------------------------------------

interface TGNode {
  data: TreeGraphNode;
  children: TGNode[];
  parent: TGNode | null;
  depth: number;
  x: number;
  y: number;
  mod: number;    // RT modifier
  thread: TGNode | null;
  ancestor: TGNode;
  number: number; // index among siblings
  change: number;
  shift: number;
  prelim: number;
}

function buildTree(nodes: TreeGraphNode[]): TGNode[] {
  const byId = new Map<string, TGNode>();
  for (const n of nodes) {
    const tg: TGNode = {
      data: n,
      children: [],
      parent: null,
      depth: 0,
      x: 0, y: 0,
      mod: 0, thread: null,
      ancestor: null as unknown as TGNode,
      number: 0,
      change: 0, shift: 0, prelim: 0,
    };
    tg.ancestor = tg;
    byId.set(n.id, tg);
  }

  const childOf = new Set<string>();
  for (const n of nodes) {
    if (n.parent) {
      const parent = byId.get(n.parent);
      const child  = byId.get(n.id);
      if (parent && child) {
        child.parent = parent;
        parent.children.push(child);
        childOf.add(n.id);
      }
    }
  }

  // Assign child numbers and depths
  function setDepth(node: TGNode, d: number, numIdx: number) {
    node.depth = d;
    node.number = numIdx;
    for (let i = 0; i < node.children.length; i++) {
      setDepth(node.children[i]!, d + 1, i);
    }
  }

  const roots: TGNode[] = [];
  for (const [id, n] of byId) {
    if (!childOf.has(id)) {
      roots.push(n);
      setDepth(n, 0, 0);
    }
  }
  return roots;
}

/** Reingold-Tilford: first walk — compute prelim positions */
function firstWalk(v: TGNode, distance: number): void {
  if (!v.children.length) {
    const w = leftSibling(v);
    v.prelim = w ? w.prelim + distance : 0;
    return;
  }

  let defaultAncestor = v.children[0]!;
  for (const w of v.children) {
    firstWalk(w, distance);
    defaultAncestor = apportion(w, defaultAncestor, distance);
  }

  executeShifts(v);
  const midpoint = (v.children[0]!.prelim + v.children[v.children.length - 1]!.prelim) / 2;
  const w = leftSibling(v);
  v.prelim = w ? w.prelim + distance : 0;
  v.mod   = v.prelim - midpoint;
}

function secondWalk(v: TGNode, m: number, levelStep: number, dir: TreeGraphDirection): void {
  if (dir === 'LR') {
    v.x = v.depth * levelStep;
    v.y = v.prelim + m;
  } else {
    v.y = v.depth * levelStep;
    v.x = v.prelim + m;
  }
  for (const w of v.children) secondWalk(w, m + v.mod, levelStep, dir);
}

function leftSibling(v: TGNode): TGNode | null {
  if (!v.parent) return null;
  const siblings = v.parent.children;
  const idx = siblings.indexOf(v);
  return idx > 0 ? siblings[idx - 1]! : null;
}

function apportion(v: TGNode, defaultAncestor: TGNode, distance: number): TGNode {
  const w = leftSibling(v);
  if (!w) return defaultAncestor;

  let vir = v, vor = v, vil = w;
  let volLeft = v.parent?.children[0] ?? v;
  let sir = v.mod, sor = v.mod, sil = vil.mod, sol = volLeft.mod;

  while (nextRight(vil) && nextLeft(vir)) {
    vil = nextRight(vil)!;
    vir = nextLeft(vir)!;
    volLeft = nextLeft(volLeft)!;
    vor = nextRight(vor)!;
    vor.ancestor = v;

    const shift = (vil.prelim + sil) - (vir.prelim + sir) + distance;
    if (shift > 0) {
      moveSubtree(ancestor(vil, v, defaultAncestor), v, shift);
      sir += shift;
      sor += shift;
    }
    sil += vil.mod;
    sir += vir.mod;
    sol += volLeft.mod;
    sor += vor.mod;
  }

  if (nextRight(vil) && !nextRight(vor)) {
    vor.thread = nextRight(vil);
    vor.mod   += sil - sor;
  } else if (nextLeft(vir) && !nextLeft(volLeft)) {
    volLeft.thread = nextLeft(vir);
    volLeft.mod   += sir - sol;
    defaultAncestor = v;
  }

  return defaultAncestor;
}

function nextLeft(v: TGNode): TGNode | null {
  return v.children.length ? v.children[0]! : v.thread;
}
function nextRight(v: TGNode): TGNode | null {
  return v.children.length ? v.children[v.children.length - 1]! : v.thread;
}

function moveSubtree(wm: TGNode, wp: TGNode, shift: number): void {
  const subtrees = wp.number - wm.number;
  if (subtrees === 0) return;
  wp.change -= shift / subtrees;
  wp.shift  += shift;
  wm.change += shift / subtrees;
  wp.prelim += shift;
  wp.mod    += shift;
}

function executeShifts(v: TGNode): void {
  let shift = 0, change = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i]!;
    w.prelim += shift;
    w.mod    += shift;
    change   += w.change;
    shift    += w.shift + change;
  }
}

function ancestor(vil: TGNode, v: TGNode, defaultAncestor: TGNode): TGNode {
  return (v.parent && vil.ancestor.parent === v.parent) ? vil.ancestor : defaultAncestor;
}

function collectAll(roots: TGNode[]): TGNode[] {
  const result: TGNode[] = [];
  const stack = [...roots];
  while (stack.length) {
    const n = stack.pop()!;
    result.push(n);
    stack.push(...n.children);
  }
  return result;
}

// ---- Link path builders -----------------------------------------------------

function stepPath(
  px: number, py: number, pw: number, ph: number,
  cx: number, cy: number, _cw: number, _ch: number,
  dir: TreeGraphDirection,
): string {
  if (dir === 'LR') {
    const mx = (px + pw + cx) / 2;
    return `M ${px + pw} ${py + ph / 2} H ${mx} V ${cy + _ch / 2} H ${cx}`;
  }
  const my = (py + ph + cy) / 2;
  return `M ${px + pw / 2} ${py + ph} V ${my} H ${cx + _cw / 2} V ${cy}`;
}

function curvePath(
  px: number, py: number, pw: number, ph: number,
  cx: number, cy: number, _cw: number, _ch: number,
  dir: TreeGraphDirection,
): string {
  if (dir === 'LR') {
    const sx = px + pw, sy = py + ph / 2;
    const ex = cx,      ey = cy + _ch / 2;
    const mx = (sx + ex) / 2;
    return `M ${sx} ${sy} C ${mx} ${sy} ${mx} ${ey} ${ex} ${ey}`;
  }
  const sx = px + pw / 2, sy = py + ph;
  const ex = cx + _cw / 2, ey = cy;
  const my = (sy + ey) / 2;
  return `M ${sx} ${sy} C ${sx} ${my} ${ex} ${my} ${ex} ${ey}`;
}

// ---- Main render ------------------------------------------------------------

export function renderTreeGraph(
  renderer: BaseRenderer,
  _allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const tgCfg = (config as ChartConfig & { treeGraph?: TreeGraphConfig })?.treeGraph;
  if (!tgCfg || !tgCfg.nodes.length) return;

  const { chartArea } = state;
  const dir       = tgCfg.direction    ?? 'LR';
  const nw        = tgCfg.nodeWidth    ?? 100;
  const nh        = tgCfg.nodeHeight   ?? 28;
  const sibGap    = tgCfg.siblingGap   ?? 20;
  const lvlGap    = tgCfg.levelGap     ?? 80;
  const linkStyle = tgCfg.linkShape    ?? 'curved';
  const nodeColor = tgCfg.nodeColor    ?? getSeriesColor(theme, 0);
  const textColor = tgCfg.nodeTextColor ?? '#fff';
  const rx        = tgCfg.cornerRadius  ?? 4;
  const showVals  = tgCfg.showValues    ?? false;

  const roots = buildTree(tgCfg.nodes);
  if (!roots.length) return;

  // Layout each root subtree
  let rootOffset = 0;
  for (const root of roots) {
    firstWalk(root, nh + sibGap);
    secondWalk(root, rootOffset - root.prelim, lvlGap + nw, dir);

    // Normalize so min y/x offset maps to 0
    const all = collectAll([root]);
    const minY = Math.min(...all.map(n => n.y));
    const minX = Math.min(...all.map(n => n.x));
    for (const n of all) { n.x -= minX; n.y -= minY; }

    if (dir === 'LR') {
      rootOffset += Math.max(...all.map(n => n.y)) + nh + sibGap;
    } else {
      rootOffset += Math.max(...all.map(n => n.x)) + nw + sibGap;
    }
  }

  // Shift everything to chartArea
  const allNodes = collectAll(roots);
  const maxX = Math.max(...allNodes.map(n => n.x));
  const maxY = Math.max(...allNodes.map(n => n.y));

  // Scale to fit chartArea
  const scaleX = maxX > 0 ? (chartArea.width  - nw) / maxX : 1;
  const scaleY = maxY > 0 ? (chartArea.height - nh) / maxY : 1;
  const scale  = Math.min(scaleX, scaleY, 1);

  for (const n of allNodes) {
    n.x = chartArea.x + n.x * scale;
    n.y = chartArea.y + n.y * scale;
  }

  // Draw links
  renderer.beginGroup('tg-links', 'uc-tg-links');
  for (const node of allNodes) {
    for (const child of node.children) {
      const path = linkStyle === 'curved'
        ? curvePath(node.x, node.y, nw, nh, child.x, child.y, nw, nh, dir)
        : linkStyle === 'step'
          ? stepPath(node.x, node.y, nw, nh, child.x, child.y, nw, nh, dir)
          : `M ${node.x + nw / 2} ${node.y + nh / 2} L ${child.x + nw / 2} ${child.y + nh / 2}`;
      renderer.drawPath(path, {
        fill: 'none',
        stroke: (theme.textColor as string) ?? '#aaa',
        strokeWidth: 1.5,
      });
    }
  }
  renderer.endGroup();

  // Draw node boxes
  renderer.beginGroup('tg-nodes', 'uc-tg-nodes');
  for (let i = 0; i < allNodes.length; i++) {
    const n = allNodes[i]!;
    const fill = (n.data.color as string | undefined)
      ?? (i === 0 ? nodeColor : getSeriesColor(theme, n.depth));

    renderer.drawRect(n.x, n.y, nw, nh, { fill }, rx, rx);

    const label = n.data.name ?? n.data.id;
    const valueStr = showVals && n.data.value !== undefined ? ` (${n.data.value})` : '';
    renderer.drawText(n.x + nw / 2, n.y + nh / 2, label + valueStr, {
      fontSize: 11,
      fontFamily: theme.fontFamily ?? 'sans-serif',
      fill: textColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
  }
  renderer.endGroup();
}
