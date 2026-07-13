// ============================================================================
// RiskLab Charts — Item Chart (Parliament / Waffle Chart)
// Rows of uniform icons/shapes representing proportional quantities.
// Used for: parliament seat counts, survey responses, pictorial data.
// Equivalent to commercial charting premium "item" series — free in RiskLab Charts.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

// ---- Public config ----------------------------------------------------------

export type ItemShape = 'circle' | 'square' | 'triangle' | 'diamond';
export type ItemLayout = 'rectangular' | 'arc';

export interface ItemSeriesConfig {
  name: string;
  value: number;
  color?: string;
}

export interface ItemChartConfig {
  /** The series (segments) to show. */
  series: ItemSeriesConfig[];
  /** Total number of items (default: sum of all values). */
  total?: number;
  /** Shape of each item (default 'circle'). */
  shape?: ItemShape;
  /** Rows for rectangular layout (default: auto). */
  rows?: number;
  /** Columns for rectangular layout (default: auto). */
  cols?: number;
  /** Item size in px (default: auto-fits chart area). */
  itemSize?: number;
  /** Gap between items (default 2). */
  gap?: number;
  /** Layout mode (default 'rectangular'). */
  layout?: ItemLayout;
  /** For arc layout, inner radius fraction (default 0.4). */
  arcInnerFraction?: number;
  /** Show count labels in legend (default true). */
  showCounts?: boolean;
}

// ---- Geometry helpers -------------------------------------------------------

function drawItemShape(
  renderer: BaseRenderer,
  shape: ItemShape,
  x: number,
  y: number,
  size: number,
  fill: string,
): void {
  const half = size / 2;
  switch (shape) {
    case 'circle':
      renderer.drawCircle(x + half, y + half, half, { fill });
      break;
    case 'square':
      renderer.drawRect(x, y, size, size, { fill }, 1, 1);
      break;
    case 'diamond': {
      const cx = x + half, cy = y + half;
      renderer.drawPolygon([
        [cx, cy - half],
        [cx + half, cy],
        [cx, cy + half],
        [cx - half, cy],
      ], { fill });
      break;
    }
    case 'triangle': {
      const cx = x + half;
      renderer.drawPolygon([
        [cx, y],
        [x + size, y + size],
        [x, y + size],
      ], { fill });
      break;
    }
  }
}

// ---- Main render ------------------------------------------------------------

export function renderItemChart(
  renderer: BaseRenderer,
  _allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const iCfg = (config as ChartConfig & { itemChart?: ItemChartConfig })?.itemChart;
  if (!iCfg || !iCfg.series.length) return;

  const { chartArea: _chartArea } = state;
  const shape = iCfg.shape ?? 'circle';
  const gap   = iCfg.gap   ?? 2;
  const layout = iCfg.layout ?? 'rectangular';

  // Build color-mapped series
  const series = iCfg.series.map((s, i) => ({
    ...s,
    color: (s.color as string | undefined) ?? getSeriesColor(theme, i),
  }));

  const total = iCfg.total ?? series.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return;

  if (layout === 'arc') {
    renderArcItems(renderer, series, total, state, theme, iCfg, shape, gap);
  } else {
    renderRectItems(renderer, series, total, state, theme, iCfg, shape, gap);
  }

  // Draw inline legend below the grid/arc (opt-in via showCounts)
  if (iCfg.showCounts === true) {
    const { chartArea } = state;
    renderer.beginGroup('items-legend', 'uc-items-legend');
    const legendY = chartArea.y + chartArea.height - 16;
    let lx = chartArea.x + 8;
    const swatchSize = 10;
    for (const s of series) {
      renderer.drawRect(lx, legendY, swatchSize, swatchSize, { fill: s.color }, 2, 2);
      const label = `${s.name} (${s.value})`;
      renderer.drawText(lx + swatchSize + 4, legendY + swatchSize - 1, label, {
        fontSize: 10,
        fill: (theme.textColor as string) ?? '#333',
        fontFamily: theme.fontFamily ?? 'sans-serif',
        textAnchor: 'start',
      });
      lx += swatchSize + 8 + label.length * 6;
    }
    renderer.endGroup();
  }
}

function renderRectItems(
  renderer: BaseRenderer,
  series: Array<ItemSeriesConfig & { color: string }>,
  total: number,
  state: ChartState,
  theme: ThemeConfig,
  iCfg: ItemChartConfig,
  shape: ItemShape,
  gap: number,
): void {
  const { chartArea } = state;

  // Auto-size items
  const autoSize = Math.floor(Math.sqrt((chartArea.width * chartArea.height) / total)) - gap;
  const itemSize = iCfg.itemSize ?? Math.max(6, Math.min(autoSize, 40));
  const step = itemSize + gap;

  const cols = iCfg.cols ?? Math.floor(chartArea.width / step);
  const rows = iCfg.rows ?? Math.ceil(total / cols);

  // Build flat item list
  const items: string[] = [];
  for (const s of series) {
    for (let i = 0; i < s.value; i++) items.push(s.color);
  }

  // Center grid
  const gridW = cols * step - gap;
  const gridH = rows * step - gap;
  const ox = chartArea.x + (chartArea.width - gridW) / 2;
  const oy = chartArea.y + (chartArea.height - gridH) / 2;

  renderer.beginGroup('items-grid', 'uc-items-grid');
  for (let i = 0; i < Math.min(items.length, total); i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawItemShape(renderer, shape,
      ox + col * step,
      oy + row * step,
      itemSize,
      items[i],
    );
  }
  renderer.endGroup();
}

function renderArcItems(
  renderer: BaseRenderer,
  series: Array<ItemSeriesConfig & { color: string }>,
  total: number,
  state: ChartState,
  _theme: ThemeConfig,
  iCfg: ItemChartConfig,
  shape: ItemShape,
  gap: number,
): void {
  const { chartArea } = state;
  const cx = chartArea.x + chartArea.width / 2;
  const cy = chartArea.y + chartArea.height * 0.6; // centre arc in lower 60% of area
  const outerR = Math.min(chartArea.width, chartArea.height) / 2 - 20;
  const innerFraction = iCfg.arcInnerFraction ?? 0.4;
  const innerR = outerR * innerFraction;

  // Build flat item list
  const items: Array<{ color: string }> = [];
  for (const s of series) {
    for (let i = 0; i < s.value; i++) items.push({ color: s.color });
  }

  const n = Math.min(items.length, total);

  // Estimate item size from arc circumference
  const arcCircumference = Math.PI * (outerR + innerR);
  const autoSize = Math.floor(arcCircumference / n) - gap;
  const itemSize = iCfg.itemSize ?? Math.max(4, Math.min(autoSize, 30));

  // Distribute items across the semicircle arc
  const startAngle = -Math.PI;
  const endAngle   = 0;
  const rings = Math.round((outerR - innerR) / (itemSize + gap));
  const arcSpan = endAngle - startAngle;

  renderer.beginGroup('items-arc', 'uc-items-arc');

  let itemIdx = 0;
  for (let ring = 0; ring < rings && itemIdx < n; ring++) {
    const r = innerR + ring * (itemSize + gap) + itemSize / 2;
    const circ = Math.abs(arcSpan) * r;
    const ringCount = Math.max(1, Math.floor(circ / (itemSize + gap)));
    const angleStep = arcSpan / ringCount;

    for (let j = 0; j < ringCount && itemIdx < n; j++) {
      const angle = startAngle + j * angleStep + angleStep / 2;
      const px = cx + r * Math.cos(angle) - itemSize / 2;
      const py = cy + r * Math.sin(angle) - itemSize / 2;
      drawItemShape(renderer, shape, px, py, itemSize, items[itemIdx].color);
      itemIdx++;
    }
  }

  renderer.endGroup();
}
