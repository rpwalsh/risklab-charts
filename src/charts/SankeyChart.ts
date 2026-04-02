// ============================================================================
// RiskLab Charts — Sankey Diagram Renderer
// Renders flow diagrams with nodes and weighted curved links
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig, SankeyNode, SankeyLink } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

interface LayoutNode extends SankeyNode {
  x: number;
  y: number;
  width: number;
  height: number;
  columnIndex: number;
  inValue: number;
  outValue: number;
  inOffset: number;
  outOffset: number;
}

interface LayoutLink extends SankeyLink {
  sourceNode: LayoutNode;
  targetNode: LayoutNode;
  sourceY: number;
  targetY: number;
  width: number;
}

/**
 * Renders a Sankey flow diagram with positioned nodes and weighted curved links.
 *
 * Computes a topological layout of nodes across columns, sizes each node
 * proportionally to its flow value, and draws curved links between source
 * and target nodes. Node labels are placed outside the node rectangles.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param _series - Pre-processed series data from the DataPipeline (unused)
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 * @param config - Full chart configuration including sankey-specific options
 */
export function renderSankeySeries(
  renderer: BaseRenderer,
  _series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  config: ChartConfig,
): void {
  const { sankey } = config;
  if (!sankey) return;

  const { chartArea } = state;
  const nodeWidth = sankey.nodeWidth ?? 20;
  const nodePadding = sankey.nodePadding ?? 12;
  const curvature = sankey.curvature ?? 0.5;

  // Build layout
  const { layoutNodes, layoutLinks } = computeSankeyLayout(
    sankey.nodes,
    sankey.links,
    chartArea,
    nodeWidth,
    nodePadding,
  );

  // Draw links
  for (const link of layoutLinks) {
    const color = (link.color as string) ?? getSeriesColor(theme, layoutLinks.indexOf(link));
    const path = buildSankeyLinkPath(link, curvature);

    renderer.drawPath(path, {
      fill: color,
      opacity: 0.35,
      stroke: color,
      strokeWidth: 0.5,
    });
  }

  // Draw nodes
  for (let i = 0; i < layoutNodes.length; i++) {
    const node = layoutNodes[i]!;
    const color = (node.color as string) ?? getSeriesColor(theme, i);

    renderer.drawRect(node.x, node.y, node.width, node.height, {
      fill: color,
      stroke: color,
      strokeWidth: 1,
    }, 2);

    // Node label
    const rawLabelX =
      node.columnIndex === 0 ? node.x - 6 : node.x + node.width + 6;
    const anchor = node.columnIndex === 0 ? 'end' : 'start';
    // Clamp label X within chartArea bounds
    const labelX = Math.max(chartArea.x + 4, Math.min(chartArea.x + chartArea.width - 4, rawLabelX));

    renderer.drawText(labelX, node.y + node.height / 2, node.name, {
      fill: theme.textColor as string,
      fontSize: 11,
      fontFamily: theme.fontFamily,
      textAnchor: anchor as 'start' | 'end',
      dominantBaseline: 'middle',
    });
  }
}

function computeSankeyLayout(
  nodes: SankeyNode[],
  links: SankeyLink[],
  chartArea: { x: number; y: number; width: number; height: number },
  nodeWidth: number,
  nodePadding: number,
): { layoutNodes: LayoutNode[]; layoutLinks: LayoutLink[] } {
  // Assign columns
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, {
      ...node,
      x: 0, y: 0, width: nodeWidth, height: 0,
      columnIndex: node.column ?? -1,
      inValue: 0, outValue: 0,
      inOffset: 0, outOffset: 0,
    });
  }

  // Auto-assign columns via topological sort
  const sourceOf = new Map<string, Set<string>>();
  const targetOf = new Map<string, Set<string>>();
  for (const link of links) {
    if (!targetOf.has(link.target)) targetOf.set(link.target, new Set());
    targetOf.get(link.target)!.add(link.source);
    if (!sourceOf.has(link.source)) sourceOf.set(link.source, new Set());
    sourceOf.get(link.source)!.add(link.target);
  }

  for (const [, node] of nodeMap) {
    if (node.columnIndex < 0) {
      node.columnIndex = computeDepth(node.id, targetOf, nodeMap, new Set());
    }
  }

  // Compute node values
  for (const link of links) {
    const sn = nodeMap.get(link.source);
    const tn = nodeMap.get(link.target);
    if (sn) sn.outValue += link.value;
    if (tn) tn.inValue += link.value;
  }

  // Group nodes by column
  const columns = new Map<number, LayoutNode[]>();
  for (const [, node] of nodeMap) {
    if (!columns.has(node.columnIndex)) columns.set(node.columnIndex, []);
    columns.get(node.columnIndex)!.push(node);
  }

  const maxCol = Math.max(...columns.keys(), 0);
  const colWidth = maxCol > 0 ? (chartArea.width - nodeWidth) / maxCol : 0;

  // Initial positioning — place nodes proportionally in each column
  const positionColumn = (colNodes: LayoutNode[], col: number) => {
    const x = chartArea.x + col * colWidth;
    const totalValue = colNodes.reduce((s, n) => s + Math.max(n.inValue, n.outValue, 1), 0);
    const availHeight = chartArea.height - (colNodes.length - 1) * nodePadding;
    let y = chartArea.y;
    for (const node of colNodes) {
      node.x = x;
      node.y = y;
      const value = Math.max(node.inValue, node.outValue, 1);
      node.height = Math.max(4, (value / totalValue) * availHeight);
      y += node.height + nodePadding;
    }
  };

  for (const [col, colNodes] of columns) {
    positionColumn(colNodes, col);
  }

  // Iterative relaxation — reorder nodes in non-source columns by the
  // weighted barycenter of their connected nodes to minimise crossings.
  const sortedCols = Array.from(columns.keys()).sort((a, b) => a - b);
  for (let iter = 0; iter < 6; iter++) {
    // Forward pass (left → right)
    for (let ci = 1; ci < sortedCols.length; ci++) {
      const colNodes = columns.get(sortedCols[ci])!;
      colNodes.sort((a, b) => {
        const aCenter = weightedCenter(a, links, nodeMap, 'in');
        const bCenter = weightedCenter(b, links, nodeMap, 'in');
        return aCenter - bCenter;
      });
      positionColumn(colNodes, sortedCols[ci]);
    }
    // Backward pass (right → left)
    for (let ci = sortedCols.length - 2; ci >= 0; ci--) {
      const colNodes = columns.get(sortedCols[ci])!;
      colNodes.sort((a, b) => {
        const aCenter = weightedCenter(a, links, nodeMap, 'out');
        const bCenter = weightedCenter(b, links, nodeMap, 'out');
        return aCenter - bCenter;
      });
      positionColumn(colNodes, sortedCols[ci]);
    }
  }

  // Build layout links
  const layoutNodes = Array.from(nodeMap.values());

  // Sort links per source node by target Y so bands stack without crossing
  const sortedLinks = [...links].sort((a, b) => {
    const sa = nodeMap.get(a.source)!, sb = nodeMap.get(b.source)!;
    if (sa !== sb) return sa.y - sb.y;
    const ta = nodeMap.get(a.target)!, tb = nodeMap.get(b.target)!;
    return ta.y - tb.y;
  });

  // Reset offsets
  for (const n of layoutNodes) {
    n.inOffset = 0;
    n.outOffset = 0;
  }

  const layoutLinks: LayoutLink[] = sortedLinks.map((link) => {
    const sn = nodeMap.get(link.source)!;
    const tn = nodeMap.get(link.target)!;
    const sourceVal = Math.max(sn.outValue, 1);
    const targetVal = Math.max(tn.inValue, 1);

    const sw = (link.value / sourceVal) * sn.height;
    const tw = (link.value / targetVal) * tn.height;
    const width = Math.max(sw, tw, 1);

    const sourceY = sn.y + sn.outOffset + sw / 2;
    const targetY = tn.y + tn.inOffset + tw / 2;

    sn.outOffset += sw;
    tn.inOffset += tw;

    return {
      ...link,
      sourceNode: sn,
      targetNode: tn,
      sourceY,
      targetY,
      width,
    };
  });

  return { layoutNodes, layoutLinks };
}

/**
 * Compute the weighted Y-center of a node's connections on the specified side.
 * Used during iterative relaxation to order nodes so that links are less tangled.
 */
function weightedCenter(
  node: LayoutNode,
  links: SankeyLink[],
  nodeMap: Map<string, LayoutNode>,
  side: 'in' | 'out',
): number {
  let sumWY = 0;
  let sumW = 0;
  for (const link of links) {
    const isRelevant =
      side === 'in' ? link.target === node.id : link.source === node.id;
    if (!isRelevant) continue;
    const peer = nodeMap.get(side === 'in' ? link.source : link.target);
    if (!peer) continue;
    const cy = peer.y + peer.height / 2;
    sumWY += cy * link.value;
    sumW += link.value;
  }
  return sumW > 0 ? sumWY / sumW : node.y;
}

function computeDepth(
  nodeId: string,
  targetOf: Map<string, Set<string>>,
  _nodeMap: Map<string, LayoutNode>,
  visited: Set<string>,
): number {
  // `visited` tracks the current DFS path, not permanently visited nodes.
  // By deleting nodeId after recursion we allow the same node to be
  // traversed from multiple parent paths, so the LONGEST path is always found.
  // Nodes already on the current path return 0 to break cycles.
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);

  const sources = targetOf.get(nodeId);
  let maxDepth = 0;
  if (sources) {
    for (const source of sources) {
      maxDepth = Math.max(maxDepth, computeDepth(source, targetOf, _nodeMap, visited) + 1);
    }
  }

  visited.delete(nodeId); // allow sibling/alternate paths to revisit this node
  return maxDepth;
}

function buildSankeyLinkPath(link: LayoutLink, curvature: number): string {
  const x0 = link.sourceNode.x + link.sourceNode.width;
  const x1 = link.targetNode.x;
  const xi = (x1 - x0) * curvature;
  const y0 = link.sourceY;
  const y1 = link.targetY;
  const w = link.width / 2;

  return [
    `M${x0},${y0 - w}`,
    `C${x0 + xi},${y0 - w},${x1 - xi},${y1 - w},${x1},${y1 - w}`,
    `L${x1},${y1 + w}`,
    `C${x1 - xi},${y1 + w},${x0 + xi},${y0 + w},${x0},${y0 + w}`,
    'Z',
  ].join('');
}
