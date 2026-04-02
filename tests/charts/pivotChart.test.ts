// tests/charts/pivotChart.test.ts
import { describe, it, expect } from 'vitest';
import {
  crossTabulate,
  pivotToChartConfig,
  pivotToMultiView,
  type PivotConfig,
} from '../../src/charts/PivotChart';

// ── Sample data ────────────────────────────────────────────────────────────────

const salesRows = [
  { product: 'Widget', quarter: 'Q1', revenue: 100 },
  { product: 'Widget', quarter: 'Q2', revenue: 200 },
  { product: 'Widget', quarter: 'Q3', revenue: 150 },
  { product: 'Widget', quarter: 'Q4', revenue: 180 },
  { product: 'Gadget', quarter: 'Q1', revenue: 80  },
  { product: 'Gadget', quarter: 'Q2', revenue: 120 },
  { product: 'Gadget', quarter: 'Q3', revenue: 90  },
  { product: 'Gadget', quarter: 'Q4', revenue: 110 },
  { product: 'Gizmo',  quarter: 'Q1', revenue: 60  },
  { product: 'Gizmo',  quarter: 'Q2', revenue: 80  },
  { product: 'Gizmo',  quarter: 'Q3', revenue: 70  },
  { product: 'Gizmo',  quarter: 'Q4', revenue: 90  },
];

const baseCfg: PivotConfig = {
  dataSource: { rows: salesRows },
  rowField: 'product',
  columnField: 'quarter',
  valueField: 'revenue',
  aggregation: 'sum',
};

describe('crossTabulate', () => {
  it('produces correct row and column keys', () => {
    const result = crossTabulate(baseCfg);
    expect(result.rowKeys).toHaveLength(3);
    expect(result.colKeys).toHaveLength(4);
    expect(result.rowKeys).toContain('Widget');
    expect(result.colKeys).toContain('Q1');
  });

  it('sums values correctly', () => {
    const result = crossTabulate(baseCfg);
    const cell = result.cells.get('Widget\x00Q2');
    expect(cell?.value).toBe(200);
  });

  it('computes row totals', () => {
    const result = crossTabulate(baseCfg);
    expect(result.rowTotals.get('Widget')).toBe(630); // 100+200+150+180
    expect(result.rowTotals.get('Gadget')).toBe(400);
  });

  it('computes column totals', () => {
    const result = crossTabulate(baseCfg);
    expect(result.colTotals.get('Q1')).toBe(240); // 100+80+60
  });

  it('computes grand total', () => {
    const result = crossTabulate(baseCfg);
    expect(result.grandTotal).toBe(1330); // sum all
  });

  it('avg aggregation', () => {
    const rows = [
      { a: 'x', b: 'y', v: 10 },
      { a: 'x', b: 'y', v: 20 },
    ];
    const result = crossTabulate({
      dataSource: { rows },
      rowField: 'a', columnField: 'b', valueField: 'v',
      aggregation: 'avg',
    });
    expect(result.cells.get('x\x00y')?.value).toBe(15);
  });

  it('count aggregation', () => {
    const rows = [
      { a: 'x', b: 'y', v: 10 },
      { a: 'x', b: 'y', v: 20 },
      { a: 'x', b: 'y', v: 30 },
    ];
    const result = crossTabulate({
      dataSource: { rows },
      rowField: 'a', columnField: 'b', valueField: 'v',
      aggregation: 'count',
    });
    expect(result.cells.get('x\x00y')?.value).toBe(3);
  });

  it('min aggregation', () => {
    const rows = [
      { a: 'x', b: 'y', v: 10 },
      { a: 'x', b: 'y', v: 5 },
      { a: 'x', b: 'y', v: 20 },
    ];
    const result = crossTabulate({
      dataSource: { rows },
      rowField: 'a', columnField: 'b', valueField: 'v',
      aggregation: 'min',
    });
    expect(result.cells.get('x\x00y')?.value).toBe(5);
  });

  it('max aggregation', () => {
    const rows = [
      { a: 'x', b: 'y', v: 10 },
      { a: 'x', b: 'y', v: 5 },
      { a: 'x', b: 'y', v: 20 },
    ];
    const result = crossTabulate({
      dataSource: { rows },
      rowField: 'a', columnField: 'b', valueField: 'v',
      aggregation: 'max',
    });
    expect(result.cells.get('x\x00y')?.value).toBe(20);
  });

  it('median aggregation', () => {
    const rows = [
      { a: 'x', b: 'y', v: 10 },
      { a: 'x', b: 'y', v: 20 },
      { a: 'x', b: 'y', v: 30 },
    ];
    const result = crossTabulate({
      dataSource: { rows },
      rowField: 'a', columnField: 'b', valueField: 'v',
      aggregation: 'median',
    });
    expect(result.cells.get('x\x00y')?.value).toBe(20);
  });

  it('sortRows asc sorts by row label', () => {
    const result = crossTabulate({ ...baseCfg, sortRows: 'asc' });
    const first = result.rowKeys[0]!;
    expect(first <= result.rowKeys[1]!).toBe(true);
  });

  it('sortRows desc by value sorts rows by total descending', () => {
    const result = crossTabulate({
      ...baseCfg,
      sortRows: { field: 'value', direction: 'desc' },
    });
    // Widget (630) should come before Gadget (400) before Gizmo (300)
    expect(result.rowKeys[0]).toBe('Widget');
  });

  it('maxRows limits row count', () => {
    const result = crossTabulate({ ...baseCfg, maxRows: 2 });
    expect(result.rowKeys).toHaveLength(2);
  });
});

describe('pivotToChartConfig', () => {
  it('returns a valid ChartConfig with series', () => {
    const cfg = pivotToChartConfig(baseCfg);
    expect(cfg.series).toBeDefined();
    expect(cfg.series.length).toBe(3); // Widget, Gadget, Gizmo
  });

  it('each series has data for each column key', () => {
    const cfg = pivotToChartConfig(baseCfg);
    const widgetSeries = cfg.series.find(s => s.name === 'Widget');
    expect(widgetSeries?.data).toHaveLength(4); // Q1-Q4
  });

  it('data points have numeric y values', () => {
    const cfg = pivotToChartConfig(baseCfg);
    for (const s of cfg.series) {
      for (const pt of s.data) {
        expect(typeof pt.y).toBe('number');
      }
    }
  });

  it('showTotals adds Total column and Totals series', () => {
    const cfg = pivotToChartConfig({ ...baseCfg, showTotals: true });
    const totalSeries = cfg.series.find(s => s.name === 'Total');
    expect(totalSeries).toBeDefined();
    // Each series should have 5 data points (Q1-Q4 + Total)
    expect(cfg.series[0]!.data).toHaveLength(5);
  });

  it('showTotals: series only', () => {
    const cfg = pivotToChartConfig({ ...baseCfg, showTotals: { series: true, column: false } });
    const total = cfg.series.find(s => s.name === 'Total');
    expect(total).toBeDefined();
    expect(cfg.series[0]!.data).toHaveLength(4); // no Total column
  });

  it('chartType propagates to all series', () => {
    const cfg = pivotToChartConfig({ ...baseCfg, chartType: 'line' });
    for (const s of cfg.series) {
      expect(s.type).toBe('line');
    }
  });

  it('chartOptions.title overrides default title', () => {
    const cfg = pivotToChartConfig({
      ...baseCfg,
      chartOptions: { title: { text: 'Custom Title' } },
    });
    expect(cfg.title?.text).toBe('Custom Title');
  });

  it('has x and y axes', () => {
    const cfg = pivotToChartConfig(baseCfg);
    expect(cfg.axes).toBeDefined();
    const x = cfg.axes!.find(a => a.id === 'x0');
    const y = cfg.axes!.find(a => a.id === 'y0');
    expect(x).toBeDefined();
    expect(y).toBeDefined();
  });
});

describe('pivotToMultiView', () => {
  it('returns bar, line, heatmap, pie views', () => {
    const views = pivotToMultiView(baseCfg);
    expect(views.bar).toBeDefined();
    expect(views.line).toBeDefined();
    expect(views.heatmap).toBeDefined();
    expect(views.pie).toBeDefined();
  });

  it('each view uses correct chart type', () => {
    const views = pivotToMultiView(baseCfg);
    expect(views.bar.series[0]!.type).toBe('bar');
    expect(views.line.series[0]!.type).toBe('line');
    expect(views.heatmap.series[0]!.type).toBe('heatmap');
    expect(views.pie.series[0]!.type).toBe('pie');
  });

  it('all views have the same number of series', () => {
    const views = pivotToMultiView(baseCfg);
    const barCount = views.bar.series.length;
    expect(views.line.series.length).toBe(barCount);
    expect(views.heatmap.series.length).toBe(barCount);
  });
});
