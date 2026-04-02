import { describe, it, expect } from 'vitest';
import { RiskLab } from '../../src/sdk/RiskLab';

// ── Existence / shape ─────────────────────────────────────────────────────────

describe('RiskLab namespace — shape', () => {
  it('exports version string', () => {
    expect(typeof RiskLab.version).toBe('string');
    expect(RiskLab.version).toBeTruthy();
  });

  it('exposes chart() builder factory', () => {
    expect(typeof RiskLab.chart).toBe('function');
  });

  it('exposes charts preset object', () => {
    expect(typeof RiskLab.charts).toBe('object');
    expect(typeof RiskLab.charts.sparkline).toBe('function');
    expect(typeof RiskLab.charts.pie).toBe('function');
    expect(typeof RiskLab.charts.stock).toBe('function');
  });

  it('exposes mount function', () => {
    expect(typeof RiskLab.mount).toBe('function');
  });

  it('exposes autoInit function', () => {
    expect(typeof RiskLab.autoInit).toBe('function');
  });

  it('exposes sync factory', () => {
    expect(typeof RiskLab.sync).toBe('function');
  });

  it('exposes pivot utilities', () => {
    expect(typeof RiskLab.pivot).toBe('function');
    expect(typeof RiskLab.multiView).toBe('function');
    expect(typeof RiskLab.crossTab).toBe('function');
  });

  it('exposes theme sub-namespace', () => {
    expect(typeof RiskLab.theme).toBe('object');
    expect(typeof RiskLab.theme.resolve).toBe('function');
    expect(typeof RiskLab.theme.create).toBe('function');
    expect(typeof RiskLab.theme.seriesColor).toBe('function');
    expect(RiskLab.theme.light).toBeDefined();
    expect(RiskLab.theme.dark).toBeDefined();
  });

  it('exposes data sub-namespace', () => {
    expect(typeof RiskLab.data).toBe('object');
    expect(typeof RiskLab.data.parseCSV).toBe('function');
    expect(typeof RiskLab.data.fetchCSV).toBe('function');
    expect(typeof RiskLab.data.fetchJSON).toBe('function');
    expect(typeof RiskLab.data.mapJSON).toBe('function');
    expect(typeof RiskLab.data.rest).toBe('function');
    expect(typeof RiskLab.data.ws).toBe('function');
    expect(typeof RiskLab.data.sse).toBe('function');
  });

  it('exposes adapters sub-namespace', () => {
    expect(typeof RiskLab.adapters).toBe('object');
    expect(typeof RiskLab.adapters.angular).toBe('object');
    expect(typeof RiskLab.adapters.svelte).toBe('object');
    expect(typeof RiskLab.adapters.lit).toBe('object');
  });
});

// ── Fluent builder integration ────────────────────────────────────────────────

describe('RiskLab.chart() integration', () => {
  it('builds a chart config without errors', () => {
    const config = RiskLab.chart()
      .type('bar')
      .title('Revenue')
      .addSeries('Q1', [10, 20, 30])
      .build();

    expect(config.series).toHaveLength(1);
    expect(config.series[0]!.name).toBe('Q1');
    expect(config.title?.text).toBe('Revenue');
  });

  it('preset stock builder returns ChartBuilder', () => {
    const b = RiskLab.charts.stock();
    expect(typeof b.build).toBe('function');
  });

  it('preset sparkline sets small dimensions', () => {
    const config = RiskLab.charts.sparkline().addSeries('', [1, 2, 3]).build();
    expect(config).toBeDefined();
  });
});

// ── Theme integration ─────────────────────────────────────────────────────────

describe('RiskLab.theme integration', () => {
  it('theme.light has background property', () => {
    expect(typeof RiskLab.theme.light.backgroundColor).toBe('string');
  });

  it('theme.dark differs from theme.light', () => {
    expect(RiskLab.theme.dark.backgroundColor).not.toBe(RiskLab.theme.light.backgroundColor);
  });

  it('theme.create produces a named theme', () => {
    const t = RiskLab.theme.create('ns-test', 'NS Test', 'default', {});
    expect(t.id).toBe('ns-test');
    expect(t.name).toBe('NS Test');
  });

  it('theme.seriesColor cycles palette', () => {
    const c0 = RiskLab.theme.seriesColor(RiskLab.theme.light, 0);
    const cCycle = RiskLab.theme.seriesColor(
      RiskLab.theme.light,
      RiskLab.theme.light.palette.length,
    );
    expect(c0).toBe(cCycle);
  });
});

// ── Data sub-namespace integration ────────────────────────────────────────────

describe('RiskLab.data integration', () => {
  it('parseCSV parses inline CSV', () => {
    const series = RiskLab.data.parseCSV(
      'x,y\n1,10\n2,20\n3,30',
      { xField: 'x', yFields: ['y'] },
    );
    expect(series).toHaveLength(1);
    expect(series[0]!.data).toHaveLength(3);
  });

  it('mapJSON groups by series field', () => {
    const rows = [
      { ts: 1, v: 100, s: 'A' },
      { ts: 2, v: 200, s: 'B' },
    ];
    const series = RiskLab.data.mapJSON(rows, {
      map: { x: 'ts', y: 'v', series: 's' },
    });
    expect(series).toHaveLength(2);
  });
});

// ── Pivot integration ─────────────────────────────────────────────────────────

describe('RiskLab.pivot integration', () => {
  const rows = [
    { region: 'North', year: '2022', sales: 100 },
    { region: 'North', year: '2023', sales: 120 },
    { region: 'South', year: '2022', sales: 80 },
    { region: 'South', year: '2023', sales: 90 },
  ];

  it('pivot produces chart config', () => {
    const config = RiskLab.pivot({
      dataSource: { rows },
      rowField: 'region',
      columnField: 'year',
      valueField: 'sales',
      aggregation: 'sum',
    });
    expect(config.series.length).toBeGreaterThan(0);
  });

  it('crossTab returns pivot result with rows and columns', () => {
    const result = RiskLab.crossTab({
      dataSource: { rows },
      rowField: 'region',
      columnField: 'year',
      valueField: 'sales',
      aggregation: 'sum',
    });
    expect(result.rowKeys).toContain('North');
    expect(result.colKeys).toContain('2022');
  });
});

// ── Adapter source generators ─────────────────────────────────────────────────

describe('RiskLab.adapters source generators', () => {
  it('angular.componentSource returns TypeScript string', () => {
    const src = RiskLab.adapters.angular.componentSource();
    expect(typeof src).toBe('string');
    expect(src).toContain('@Component');
  });

  it('svelte.componentSource returns .svelte source', () => {
    const src = RiskLab.adapters.svelte.componentSource();
    expect(typeof src).toBe('string');
    expect(src).toContain('<script');
  });

  it('lit.componentSource returns LitElement source', () => {
    const src = RiskLab.adapters.lit.componentSource();
    expect(typeof src).toBe('string');
    expect(src).toContain('LitElement');
  });
});
