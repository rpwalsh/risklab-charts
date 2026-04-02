// ============================================================================
// RiskLab Charts — Legend Component
// Renders series legend with toggle, search, drag, grouping, pagination
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig, LegendConfig, SeriesConfig } from '../core/types';
import type { EventBus } from '../core/EventBus';
import { getSeriesColor } from '../themes/ThemeEngine';

const ITEM_HEIGHT = 22;
const ITEM_PADDING = 8;
const SYMBOL_SIZE = 12;
const SYMBOL_MARGIN = 6;

// Chart types where each data-point is a distinct visual entity (slice, bubble, etc.).
// For these types the legend should expand data points into individual items
// instead of showing a single series-level entry.
const DATA_POINT_CHART_TYPES = new Set([
  'pie', 'donut', 'funnel', 'treemap',
]);

// Waterfall uses a fixed Increase / Decrease / Total legend
const WATERFALL_LEGEND: Array<{ name: string; color: string }> = [
  { name: 'Increase', color: '#10B981' },
  { name: 'Decrease', color: '#EF4444' },
  { name: 'Total',    color: '#4F46E5' },
];

// Sunburst: expand top-level children as legend items
function buildSunburstLegend(s: SeriesConfig, theme: ThemeConfig): SeriesConfig[] {
  const data = s.data;
  if (!data.length) return [s];
  // Find root(s): points with no parent or parent not in data
  const ids = new Set(data.map(d => String(d.x ?? d.label ?? '')));
  const topLevel = data.filter(d => {
    const parent = d.meta?.parent ? String(d.meta.parent) : null;
    return parent && ids.has(parent);
  }).filter(d => {
    // Keep only direct children of root(s)
    const parent = String(d.meta!.parent);
    const parentPt = data.find(p => String(p.x ?? p.label ?? '') === parent);
    if (!parentPt) return false;
    const pParent = parentPt.meta?.parent ? String(parentPt.meta.parent) : null;
    return !pParent || !ids.has(pParent);
  });
  const items = topLevel.length > 0 ? topLevel : data;
  return items.map((dp, j) => {
    const label = String(dp.x ?? dp.label ?? `Segment ${j + 1}`);
    const hue = hashHueLegend(label);
    return {
      ...s,
      id: `${s.id}::${j}`,
      name: `${label} (${dp.y})`,
      color: (dp.color as string | undefined) ?? `hsl(${hue}, 65%, 50%)`,
    };
  });
}

function hashHueLegend(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

/**
 * Build the effective legend items list.  For most chart types each
 * `SeriesConfig` maps to a single legend item.  For data-point-based types
 * (pie, donut, funnel, treemap) a single series is expanded so that every
 * data point gets its own legend entry with the correct label and color.
 */
function buildLegendSeries(
  series: SeriesConfig[],
  theme: ThemeConfig,
): SeriesConfig[] {
  const result: SeriesConfig[] = [];
  for (const s of series) {
    if (DATA_POINT_CHART_TYPES.has(s.type)) {
      // Expand each data point into a virtual series entry
      for (let j = 0; j < s.data.length; j++) {
        const dp = s.data[j]!;
        result.push({
          ...s,
          id: `${s.id}::${j}`,
          name: String(dp.x ?? dp.label ?? `Item ${j + 1}`),
          color: (dp.color as string | undefined) ?? getSeriesColor(theme, j),
          // keep data/type from parent so toggling still works
        });
      }
    } else if (s.type === 'waterfall') {
      // Waterfall: show Increase / Decrease / Total colour key
      for (const entry of WATERFALL_LEGEND) {
        result.push({
          ...s,
          id: `${s.id}::${entry.name}`,
          name: entry.name,
          color: entry.color,
        });
      }
    } else if (s.type === 'sunburst' || s.type === 'sunburstChart') {
      result.push(...buildSunburstLegend(s, theme));
    } else {
      result.push(s);
    }
  }
  return result;
}

export function renderLegend(
  renderer: BaseRenderer,
  config: ChartConfig,
  state: ChartState,
  theme: ThemeConfig,
  bus: EventBus,
): void {
  const legend: LegendConfig = { enabled: true, ...config.legend };
  if (!legend.enabled) return;

  const series = buildLegendSeries(config.series, theme);
  if (series.length === 0) return;

  const layout = legend.layout ?? 'horizontal';
  const align = legend.align ?? 'center';
  const vAlign = legend.verticalAlign ?? 'bottom';

  renderer.beginGroup('legend', 'uc-legend');

  if (layout === 'horizontal') {
    renderHorizontalLegend(renderer, series, state, theme, legend, align, vAlign, bus);
  } else {
    renderVerticalLegend(renderer, series, state, theme, legend, align, vAlign, bus);
  }

  renderer.endGroup();
}

function renderHorizontalLegend(
  renderer: BaseRenderer,
  series: ChartConfig['series'],
  state: ChartState,
  theme: ThemeConfig,
  legend: LegendConfig,
  align: string,
  vAlign: string,
  bus: EventBus,
): void {
  // Calculate items with estimated widths
  const items = series.map((s, i) => {
    const label = legend.itemFormatter ? legend.itemFormatter(s, i) : s.name;
    const color = (s.color as string) ?? getSeriesColor(theme, i);
    const estimatedWidth = label.length * 7 + SYMBOL_SIZE + SYMBOL_MARGIN + ITEM_PADDING * 2;
    return { label, color, width: estimatedWidth, visible: s.visible !== false, id: s.id };
  });

  const { chartArea } = state;
  const maxWidth = chartArea.width;

  // ── Row Wrapping ──────────────────────────────────────────────────────
  // If items overflow a single row, break into multiple rows
  const rows: typeof items[] = [];
  let currentRow: typeof items = [];
  let currentRowWidth = 0;

  for (const item of items) {
    if (currentRow.length > 0 && currentRowWidth + item.width > maxWidth) {
      rows.push(currentRow);
      currentRow = [item];
      currentRowWidth = item.width;
    } else {
      currentRow.push(item);
      currentRowWidth += item.width;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // ── Pagination ────────────────────────────────────────────────────────
  // If maxHeight is set and rows exceed it, only render the rows that fit
  const rowHeight = ITEM_HEIGHT + 4;
  const maxRows = legend.maxHeight
    ? Math.max(1, Math.floor(legend.maxHeight / rowHeight))
    : rows.length;
  const visibleRows = rows.slice(0, maxRows);
  const totalRenderedHeight = visibleRows.length * rowHeight;

  // ── Determine Y ───────────────────────────────────────────────────────
  // Position legend outside the chart area + axis labels + axis titles
  // to avoid any overlap with chart content
  let baseY: number;
  if (vAlign === 'top') {
    baseY = Math.max(8, state.chartArea.y - totalRenderedHeight - 8);
  } else if (vAlign === 'middle') {
    baseY = state.chartArea.y + state.chartArea.height / 2 - totalRenderedHeight / 2;
  } else {
    // Bottom: place below the chart area + axis footprint (labels + title)
    // The axisBottomFootprint tells us exactly how tall the axis block is,
    // so the legend renders immediately below it with a comfortable gap.
    const axisFootprint = state.axisBottomFootprint ?? 0;
    const gap = 6;
    baseY = state.chartArea.y + state.chartArea.height + axisFootprint + gap;
    // Clamp so legend doesn't go below canvas
    if (baseY + totalRenderedHeight > state.height - 4) {
      baseY = state.height - totalRenderedHeight - 4;
    }
  }

  // ── Floating: overlay on chart instead of outside it ──────────────────
  if (legend.floating) {
    if (vAlign === 'top') {
      baseY = state.chartArea.y + 8;
    } else if (vAlign === 'bottom') {
      baseY = state.chartArea.y + state.chartArea.height - totalRenderedHeight - 8;
    }
  }

  for (let rowIdx = 0; rowIdx < visibleRows.length; rowIdx++) {
    const row = visibleRows[rowIdx]!;
    const rowWidth = row.reduce((sum, item) => sum + item.width, 0);
    const y = baseY + rowIdx * rowHeight;

    // Determine starting X for this row
    let startX: number;
    if (align === 'left') {
      startX = state.chartArea.x;
    } else if (align === 'right') {
      startX = state.chartArea.x + state.chartArea.width - rowWidth;
    } else {
      startX = state.chartArea.x + (state.chartArea.width - rowWidth) / 2;
    }

    // Background (only for first row if floating)
    if (rowIdx === 0 && legend.backgroundColor) {
      const fullWidth = Math.max(...visibleRows.map(r => r.reduce((s, it) => s + it.width, 0)));
      const bgX = align === 'left' ? state.chartArea.x : align === 'right'
        ? state.chartArea.x + state.chartArea.width - fullWidth : state.chartArea.x + (state.chartArea.width - fullWidth) / 2;
      renderer.drawRect(
        bgX - 8, baseY - ITEM_HEIGHT / 2 - 4,
        fullWidth + 16, totalRenderedHeight + 8,
        {
          fill: legend.backgroundColor as string,
          stroke: (legend.borderColor as string) ?? 'transparent',
          strokeWidth: legend.borderWidth ?? 0,
          opacity: legend.floating ? 0.9 : 1,
        },
        legend.borderRadius ?? 4,
      );
    }

    let x = startX;
    for (const item of row) {
      const opacity = item.visible ? 1 : 0.35;
      const itemId = `legend-item-${item.id}`;

      // Symbol
      renderer.drawRect(x, y - SYMBOL_SIZE / 2, SYMBOL_SIZE, SYMBOL_SIZE, {
        fill: item.color,
        opacity,
        id: `${itemId}-symbol`,
        cursor: legend.toggleOnClick !== false ? 'pointer' : 'default',
      }, (legend.symbolRadius ?? 2));

      // Label
      renderer.drawText(x + SYMBOL_SIZE + SYMBOL_MARGIN, y, item.label, {
        fill: item.visible
          ? (theme.legend.textColor as string)
          : (theme.legend.inactiveColor as string),
        fontSize: legend.itemStyle?.fontSize ?? theme.fontSize,
        fontFamily: theme.fontFamily,
        textAnchor: 'start',
        dominantBaseline: 'middle',
        cursor: legend.toggleOnClick !== false ? 'pointer' : 'default',
        opacity,
        id: `${itemId}-label`,
      });

      // ── Toggle Interactivity ──────────────────────────────────────────
      if (legend.toggleOnClick !== false) {
        const seriesId = item.id;
        // Attach click events to both symbol and label
        try {
          renderer.attachEvent(`${itemId}-symbol`, 'click', () => {
            bus.emit('legendClick', { seriesId });
          });
          renderer.attachEvent(`${itemId}-label`, 'click', () => {
            bus.emit('legendClick', { seriesId });
          });
        } catch {
          // Canvas renderer may not support element-level events
        }
      }

      x += item.width;
    }
  }

  // ── Pagination indicator (if rows were truncated) ─────────────────────
  if (rows.length > maxRows) {
    const truncY = baseY + visibleRows.length * rowHeight;
    const hiddenCount = rows.slice(maxRows).reduce((s, r) => s + r.length, 0);
    renderer.drawText(
      chartArea.x + chartArea.width / 2,
      truncY,
      `+ ${hiddenCount} more series`,
      {
        fill: theme.legend.inactiveColor as string,
        fontSize: (legend.itemStyle?.fontSize ?? theme.fontSize) - 1,
        fontFamily: theme.fontFamily,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fontWeight: '500',
      },
    );
  }
}

function renderVerticalLegend(
  renderer: BaseRenderer,
  series: ChartConfig['series'],
  state: ChartState,
  theme: ThemeConfig,
  legend: LegendConfig,
  align: string,
  _vAlign: string,
  bus: EventBus,
): void {
  const { chartArea } = state;

  let x: number;
  if (align === 'right') {
    x = chartArea.x + chartArea.width + 20;
  } else if (align === 'left') {
    x = chartArea.x - 120;
  } else {
    x = chartArea.x + chartArea.width + 20;
  }

  let y = chartArea.y + 10;

  // Title
  if (legend.title) {
    renderer.drawText(x, y, legend.title, {
      fill: theme.legend.textColor as string,
      fontSize: (legend.itemStyle?.fontSize ?? theme.fontSize) + 1,
      fontFamily: theme.fontFamily,
      fontWeight: 'bold',
    });
    y += ITEM_HEIGHT + 4;
  }

  // ── Determine max items based on maxHeight ────────────────────────────
  const startY = y;
  const maxY = legend.maxHeight ? startY + legend.maxHeight : Infinity;

  // Groups
  const groups = legend.groups;
  let itemCount = 0;
  let truncatedCount = 0;

  if (groups && groups.length > 0) {
    for (const group of groups) {
      if (y + ITEM_HEIGHT > maxY) {
        // Count remaining items for truncation message
        for (const g of groups) {
          for (const sid of g.seriesIds) {
            if (series.find(sr => sr.id === sid)) truncatedCount++;
          }
        }
        truncatedCount -= itemCount;
        break;
      }
      renderer.drawText(x, y, group.title, {
        fill: theme.legend.textColor as string,
        fontSize: 10,
        fontFamily: theme.fontFamily,
        fontWeight: '600',
        opacity: 0.6,
      });
      y += ITEM_HEIGHT;

      for (const sid of group.seriesIds) {
        if (y + ITEM_HEIGHT > maxY) break;
        const s = series.find((sr) => sr.id === sid);
        const idx = series.findIndex((sr) => sr.id === sid);
        if (s) {
          renderLegendItem(renderer, s, idx, x + 8, y, theme, legend, bus);
          y += ITEM_HEIGHT;
          itemCount++;
        }
      }
      y += 4;
    }
  } else {
    const ordered = legend.reversed ? [...series].reverse() : series;
    for (let i = 0; i < ordered.length; i++) {
      if (y + ITEM_HEIGHT > maxY) {
        truncatedCount = ordered.length - i;
        break;
      }
      const s = ordered[i]!;
      const idx = legend.reversed ? ordered.length - 1 - i : i;
      renderLegendItem(renderer, s, idx, x, y, theme, legend, bus);
      y += ITEM_HEIGHT;
    }
  }

  // ── Truncation indicator ──────────────────────────────────────────────
  if (truncatedCount > 0) {
    renderer.drawText(x, y + 4, `+ ${truncatedCount} more`, {
      fill: theme.legend.inactiveColor as string,
      fontSize: (legend.itemStyle?.fontSize ?? theme.fontSize) - 1,
      fontFamily: theme.fontFamily,
      fontWeight: '500',
    });
  }
}

function renderLegendItem(
  renderer: BaseRenderer,
  series: ChartConfig['series'][number],
  index: number,
  x: number,
  y: number,
  theme: ThemeConfig,
  legend: LegendConfig,
  bus: EventBus,
): void {
  const color = (series.color as string) ?? getSeriesColor(theme, index);
  const visible = series.visible !== false;
  const opacity = visible ? 1 : 0.35;
  const label = legend.itemFormatter
    ? legend.itemFormatter(series, index)
    : series.name;
  const itemId = `legend-item-${series.id}`;

  renderer.drawRect(x, y - SYMBOL_SIZE / 2, SYMBOL_SIZE, SYMBOL_SIZE, {
    fill: color,
    opacity,
    id: `${itemId}-symbol`,
    cursor: legend.toggleOnClick !== false ? 'pointer' : 'default',
  }, (legend.symbolRadius ?? 2));

  renderer.drawText(x + SYMBOL_SIZE + SYMBOL_MARGIN, y, label, {
    fill: visible
      ? (theme.legend.textColor as string)
      : (theme.legend.inactiveColor as string),
    fontSize: legend.itemStyle?.fontSize ?? theme.fontSize,
    fontFamily: theme.fontFamily,
    dominantBaseline: 'middle',
    cursor: legend.toggleOnClick !== false ? 'pointer' : 'default',
    opacity,
    id: `${itemId}-label`,
  });

  // ── Toggle Interactivity ────────────────────────────────────────────
  if (legend.toggleOnClick !== false) {
    try {
      renderer.attachEvent(`${itemId}-symbol`, 'click', () => {
        bus.emit('legendClick', { seriesId: series.id });
      });
      renderer.attachEvent(`${itemId}-label`, 'click', () => {
        bus.emit('legendClick', { seriesId: series.id });
      });
    } catch {
      // Canvas renderer may not support element-level events
    }
  }
}
