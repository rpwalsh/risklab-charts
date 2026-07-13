// ============================================================================
// RiskLab Charts — Treemap Chart Renderer
// Renders hierarchical data as nested rectangles using squarified layout
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

/**
 * Renders hierarchical data as a treemap of nested, proportionally sized rectangles.
 *
 * Uses a squarified layout algorithm to partition the chart area into rectangles
 * whose sizes reflect each data point's value. Labels and value annotations are
 * rendered inside cells that exceed a minimum size threshold.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 */
export function renderTreemapSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
): void {
  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const { chartArea } = state;
  // Leave a small gap at the bottom so the legend doesn't butt up against rectangles
  const treePad = 8;
  const treeArea = {
    x: chartArea.x,
    y: chartArea.y,
    width: chartArea.width,
    height: chartArea.height - treePad,
  };
  const total = data.reduce((sum, d) => sum + Math.abs(d.yNum ?? 0), 0);
  if (total === 0) return;

  // Squarified treemap layout
  const rects = squarify(
    data.map((d, i) => ({
      value: Math.abs(d.yNum ?? 0),
      index: i,
      data: d,
    })),
    treeArea.x,
    treeArea.y,
    treeArea.width,
    treeArea.height,
    total,
  );

  for (const rect of rects) {
    const d = rect.data;
    const color = (d.color as string) ?? getSeriesColor(theme, rect.index);
    const padding = 2;

    renderer.drawRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      {
        fill: color,
        stroke: theme.backgroundColor as string,
        strokeWidth: 2,
      },
      4,
    );

    // Label (if cell is large enough)
    if (rect.width > 50 && rect.height > 30) {
      const label = d.label ?? String(d.x ?? '');
      renderer.drawText(rect.x + rect.width / 2, rect.y + rect.height / 2 - 6, label, {
        fill: '#fff',
        fontSize: Math.min(12, rect.width / label.length * 1.2),
        fontFamily: theme.fontFamily,
        fontWeight: '600',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
      renderer.drawText(rect.x + rect.width / 2, rect.y + rect.height / 2 + 10, String(Math.round(d.yNum ?? 0)), {
        fill: '#fff',
        fontSize: 10,
        fontFamily: theme.fontFamily,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        opacity: 0.8,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Squarified treemap algorithm
// ---------------------------------------------------------------------------

interface TreemapItem {
  value: number;
  index: number;
  data: ProcessedDataPoint;
}

interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  data: ProcessedDataPoint;
}

function squarify(
  items: TreemapItem[],
  x: number,
  y: number,
  width: number,
  height: number,
  total: number,
): TreemapRect[] {
  if (items.length === 0 || width <= 0 || height <= 0) return [];
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: TreemapRect[] = [];
  squarifyLayout(sorted, x, y, width, height, total, rects);
  return rects;
}

/**
 * Squarified treemap layout (Bruls, Huizing, van Wijk 2000).
 * Builds rows that minimise the worst aspect-ratio, then recurses on the
 * remaining rectangle — producing cells closer to square than slice-and-dice.
 */
function squarifyLayout(
  items: TreemapItem[],
  x: number, y: number, w: number, h: number,
  total: number,
  rects: TreemapRect[],
): void {
  if (!items.length) return;

  // Lay out all items in a single rect when space is nearly exhausted
  if (items.length === 1 || w <= 0 || h <= 0) {
    let cursor = w >= h ? y : x;
    for (const item of items) {
      const frac = total > 0 ? item.value / total : 1 / items.length;
      if (w >= h) {
        rects.push({ x, y: cursor, width: w, height: frac * h, index: item.index, data: item.data });
        cursor += frac * h;
      } else {
        rects.push({ x: cursor, y, width: frac * w, height: h, index: item.index, data: item.data });
        cursor += frac * w;
      }
    }
    return;
  }

  // Find optimal row size: add items as long as worst aspect ratio improves
  let row: TreemapItem[] = [];
  let rowSum = 0;
  let prevWorst = Infinity;
  let cutAt = 0;

  for (let i = 0; i < items.length; i++) {
    const candidate = items[i];
    const newRow = [...row, candidate];
    const newSum = rowSum + candidate.value;
    const worst = worstAspect(newRow, newSum, w, h, total);
    if (i > 0 && worst > prevWorst) break;
    row = newRow;
    rowSum = newSum;
    prevWorst = worst;
    cutAt = i + 1;
  }

  // Layout the committed row along the shorter container side
  const isWide = w >= h;
  const stripLen = total > 0 ? (rowSum / total) * (isWide ? w : h) : 0;

  let cursor = isWide ? y : x;
  for (const item of row) {
    const frac = rowSum > 0 ? item.value / rowSum : 1 / row.length;
    if (isWide) {
      rects.push({ x, y: cursor, width: stripLen, height: frac * h, index: item.index, data: item.data });
      cursor += frac * h;
    } else {
      rects.push({ x: cursor, y, width: frac * w, height: stripLen, index: item.index, data: item.data });
      cursor += frac * w;
    }
  }

  // Recurse for remaining items in the remaining rectangle
  const rest = items.slice(cutAt);
  if (!rest.length) return;
  const newTotal = total - rowSum;
  if (isWide) {
    squarifyLayout(rest, x + stripLen, y, w - stripLen, h, newTotal, rects);
  } else {
    squarifyLayout(rest, x, y + stripLen, w, h - stripLen, newTotal, rects);
  }
}

/** Returns the worst (largest) aspect ratio of all items in a proposed row. */
function worstAspect(
  row: TreemapItem[], rowSum: number,
  w: number, h: number, total: number,
): number {
  const isWide = w >= h;
  // Strip width along the longer axis
  const stripLen = total > 0 ? (rowSum / total) * (isWide ? w : h) : 0;
  if (stripLen < 0.001) return Infinity;
  const side = isWide ? h : w; // shorter axis — item spans along this

  let worst = 0;
  for (const item of row) {
    const itemSpan = rowSum > 0 ? (item.value / rowSum) * side : 0;
    if (itemSpan < 0.001) return Infinity;
    const ar = Math.max(stripLen / itemSpan, itemSpan / stripLen);
    if (ar > worst) worst = ar;
  }
  return worst;
}
