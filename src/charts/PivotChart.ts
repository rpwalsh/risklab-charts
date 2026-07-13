// ============================================================================
// RiskLab Charts — PivotChart
// Takes a flat array of row objects, pivots by row/col/value fields,
// and renders any supported chart type on the cross-tabulated output.
//
// "Pivot charts that use a data source to show data multiple ways."
//
// Usage:
//   import { pivotToChartConfig, renderPivotChart } from '@risklab/charts/charts/PivotChart';
//
//   const engine = new Engine({
//     container: el,
//     ...pivotToChartConfig({
//       dataSource: { rows: salesData },
//       rowField: 'product',
//       columnField: 'quarter',
//       valueField: 'revenue',
//       aggregation: 'sum',
//       chartType: 'bar',
//       showTotals: true,
//       sortRows: 'desc',
//     }),
//   });
// ============================================================================

import type {
  ChartConfig,
  ChartType,
  SeriesConfig,
  DataPoint,
} from '../core/types';

// ── Public API types ──────────────────────────────────────────────────────────

export type PivotAggregation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'stddev';

export interface PivotDataSource {
  rows: Record<string, unknown>[];
}

export interface PivotSortConfig {
  field?: 'label' | 'value';
  direction?: 'asc' | 'desc';
}

export interface PivotConfig {
  /** Flat record data source */
  dataSource: PivotDataSource;
  /** Field whose distinct values become row keys (series/categories) */
  rowField: string;
  /** Field whose distinct values become column keys (x-axis points) */
  columnField: string;
  /** Field to aggregate per cell */
  valueField: string;
  /** How to aggregate multiple values into one cell */
  aggregation?: PivotAggregation;
  /** Which chart type to render the pivot as */
  chartType?: ChartType;
  /** Sort rows by label or total value */
  sortRows?: PivotSortConfig | 'asc' | 'desc';
  /** Sort columns by label or total value */
  sortColumns?: PivotSortConfig | 'asc' | 'desc';
  /** Append a "Totals" series and/or a "Total" column */
  showTotals?: boolean | { series?: boolean; column?: boolean };
  /** Limit rows returned */
  maxRows?: number;
  /** Limit columns returned */
  maxColumns?: number;
  /** Custom label formatter for row field values */
  formatRow?: (value: unknown) => string;
  /** Custom label formatter for column field values */
  formatColumn?: (value: unknown) => string;
  /** Custom aggregator function */
  customAggregator?: (values: number[]) => number;
  /** Extra ChartConfig fields to merge (title, theme, axes, etc.) */
  chartOptions?: Partial<ChartConfig>;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface PivotResultCell {
  rowKey: string;
  colKey: string;
  value: number;
  count: number;
  rawValues: number[];
}

export interface PivotResult {
  rowKeys: string[];
  colKeys: string[];
  cells: Map<string, PivotResultCell>; // key: `${rowKey}__${colKey}`
  rowTotals: Map<string, number>;
  colTotals: Map<string, number>;
  grandTotal: number;
}

// ── Core pivot logic ──────────────────────────────────────────────────────────

/**
 * Cross-tabulate flat rows into a pivot result.
 * This is the pure data step — no rendering.
 */
export function crossTabulate(cfg: PivotConfig): PivotResult {
  const { dataSource, rowField, columnField, valueField } = cfg;
  const aggFn = cfg.customAggregator ?? makeAggregator(cfg.aggregation ?? 'sum');
  const fmtRow = cfg.formatRow ?? String;
  const fmtCol = cfg.formatColumn ?? String;

  // 1. Collect raw values per cell
  const buckets = new Map<string, number[]>();
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  for (const row of dataSource.rows) {
    const rk = fmtRow(row[rowField]);
    const ck = fmtCol(row[columnField]);
    const v = Number(row[valueField]);
    if (isNaN(v)) continue;

    rowSet.add(rk);
    colSet.add(ck);
    const key = `${rk}\x00${ck}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(v);
  }

  // 2. Apply aggregation
  const cells = new Map<string, PivotResultCell>();
  for (const [key, vals] of buckets) {
    const idx = key.indexOf('\x00');
    const rk = key.slice(0, idx);
    const ck = key.slice(idx + 1);
    cells.set(key, {
      rowKey: rk,
      colKey: ck,
      value: aggFn(vals),
      count: vals.length,
      rawValues: vals,
    });
  }

  // 3. Sort row/column keys
  let rowKeys = [...rowSet];
  let colKeys = [...colSet];

  rowKeys = sortKeys(rowKeys, cfg.sortRows, (rk) => {
    let total = 0;
    for (const ck of colKeys) {
      total += cells.get(`${rk}\x00${ck}`)?.value ?? 0;
    }
    return total;
  });

  colKeys = sortKeys(colKeys, cfg.sortColumns, (ck) => {
    let total = 0;
    for (const rk of rowKeys) {
      total += cells.get(`${rk}\x00${ck}`)?.value ?? 0;
    }
    return total;
  });

  if (cfg.maxRows != null) rowKeys = rowKeys.slice(0, cfg.maxRows);
  if (cfg.maxColumns != null) colKeys = colKeys.slice(0, cfg.maxColumns);

  // 4. Compute totals
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let grandTotal = 0;

  for (const rk of rowKeys) {
    let t = 0;
    for (const ck of colKeys) t += cells.get(`${rk}\x00${ck}`)?.value ?? 0;
    rowTotals.set(rk, t);
    grandTotal += t;
  }
  for (const ck of colKeys) {
    let t = 0;
    for (const rk of rowKeys) t += cells.get(`${rk}\x00${ck}`)?.value ?? 0;
    colTotals.set(ck, t);
  }

  return { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal };
}

// ── Pivot → ChartConfig ───────────────────────────────────────────────────────

/**
 * Convert a PivotConfig into a full ChartConfig that can be fed to the Engine.
 *
 * Each `rowKey` becomes one `SeriesConfig`. Each `colKey` becomes one x-axis category.
 */
export function pivotToChartConfig(cfg: PivotConfig): ChartConfig {
  const result = crossTabulate(cfg);
  const chartType = cfg.chartType ?? 'bar';
  const { rowKeys, colKeys, cells, rowTotals, colTotals } = result;

  const showTotalSeries =
    cfg.showTotals === true ||
    (typeof cfg.showTotals === 'object' && cfg.showTotals.series);
  const showTotalColumn =
    cfg.showTotals === true ||
    (typeof cfg.showTotals === 'object' && cfg.showTotals.column);

  const allColKeys = showTotalColumn ? [...colKeys, 'Total'] : colKeys;

  // Build series: one per row key
  const series: SeriesConfig[] = rowKeys.map((rk, ri) => {
    const data: DataPoint[] = allColKeys.map((ck, ci) => {
      const v = ck === 'Total'
        ? rowTotals.get(rk) ?? 0
        : cells.get(`${rk}\x00${ck}`)?.value ?? 0;
      return { x: ci, y: v, label: ck };
    });

    return {
      id: `pivot_row_${ri}`,
      name: rk,
      type: chartType,
      data,
    };
  });

  // Totals series
  if (showTotalSeries) {
    const data: DataPoint[] = allColKeys.map((ck, ci) => ({
      x: ci,
      y: ck === 'Total' ? result.grandTotal : colTotals.get(ck) ?? 0,
      label: ck,
    }));
    series.push({
      id: 'pivot_totals',
      name: 'Total',
      type: chartType,
      data,
    });
  }

  // Build x-axis categories
  const xCategories = allColKeys;

  const baseConfig: ChartConfig = {
    series,
    axes: [
      {
        id: 'x0',
        type: 'band',
        position: 'bottom',
        title: { text: cfg.columnField },
        // categories stored as extra metadata for renderers that support it
        ...(xCategories.length ? { labels: { formatter: (v: number) => xCategories[v] ?? String(v) } } : {}),
      } as import('../core/types').AxisConfig,
      {
        id: 'y0',
        type: 'linear',
        position: 'left',
        title: { text: cfg.valueField },
      },
    ],
    title: {
      text: `${cfg.valueField} by ${cfg.rowField} × ${cfg.columnField}`,
    },
    legend: { enabled: true },
    tooltip: { enabled: true, shared: true },
  };

  // Merge user overrides
  if (cfg.chartOptions) {
    const { series: _s, ...rest } = cfg.chartOptions;
    Object.assign(baseConfig, rest);
  }

  return baseConfig;
}

// ── Multi-view helper ─────────────────────────────────────────────────────────

/**
 * Generate several ChartConfigs showing the same pivot data from different angles.
 * Useful for dashboard "widget packs".
 */
export function pivotToMultiView(cfg: Omit<PivotConfig, 'chartType'>): {
  bar: ChartConfig;
  line: ChartConfig;
  heatmap: ChartConfig;
  pie: ChartConfig;
} {
  const make = (chartType: ChartType): ChartConfig =>
    pivotToChartConfig({ ...cfg, chartType });

  return {
    bar: make('bar'),
    line: make('line'),
    heatmap: make('heatmap'),
    pie: make('pie'),
  };
}

// ── Aggregators ───────────────────────────────────────────────────────────────

function makeAggregator(type: PivotAggregation): (values: number[]) => number {
  switch (type) {
    case 'sum':    return values => values.reduce((a, b) => a + b, 0);
    case 'avg':    return values => values.reduce((a, b) => a + b, 0) / (values.length || 1);
    case 'count':  return values => values.length;
    case 'min':    return values => Math.min(...values);
    case 'max':    return values => Math.max(...values);
    case 'median': return values => {
      const s = [...values].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid]! : ((s[mid - 1]! + s[mid]!) / 2);
    };
    case 'stddev': return values => {
      if (values.length < 2) return 0;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / values.length;
      return Math.sqrt(variance);
    };
    default: return values => values.reduce((a, b) => a + b, 0);
  }
}

function sortKeys(
  keys: string[],
  sort: PivotSortConfig | 'asc' | 'desc' | undefined,
  totalFn: (key: string) => number,
): string[] {
  if (!sort) return keys;
  const cfg: PivotSortConfig = typeof sort === 'string'
    ? { field: 'label', direction: sort }
    : sort;

  return [...keys].sort((a, b) => {
    const va = cfg.field === 'value' ? totalFn(a) : a;
    const vb = cfg.field === 'value' ? totalFn(b) : b;
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb));
    return cfg.direction === 'desc' ? -cmp : cmp;
  });
}
