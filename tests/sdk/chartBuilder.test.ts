// tests/sdk/chartBuilder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartBuilder, chart, charts, BoundChartBuilder } from '../../src/sdk/ChartBuilder';

// ── Mock Engine ────────────────────────────────────────────────────────────────

const mockEngineInstance = {
  update: vi.fn(),
  destroy: vi.fn(),
  setData: vi.fn(),
  addSeries: vi.fn(),
  removeSeries: vi.fn(),
  setTheme: vi.fn(),
  addPoint: vi.fn(),
  resize: vi.fn(),
  export: vi.fn(),
  on: vi.fn(() => () => {}),
};

vi.mock('../../src/core/Engine', () => ({
  Engine: vi.fn(() => mockEngineInstance),
}));

// DOM stub for renderTo
if (typeof document === 'undefined') {
  (globalThis as Record<string, unknown>).document = {
    querySelector: vi.fn(() => ({
      nodeType: 1,
      style: {},
      getBoundingClientRect: () => ({ width: 800, height: 400 }),
    })),
  };
} else {
  vi.spyOn(document, 'querySelector').mockReturnValue({
    nodeType: 1,
    style: {},
    getBoundingClientRect: () => ({ width: 800, height: 400 }),
  } as unknown as Element);
}

describe('ChartBuilder — fluent SDK', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chart() returns a ChartBuilder', () => {
    expect(chart()).toBeInstanceOf(ChartBuilder);
  });

  it('chains type() and returns this', () => {
    const b = chart();
    expect(b.type('bar')).toBe(b);
  });

  it('addSeries populates series list', () => {
    const cfg = chart()
      .type('line')
      .addSeries('Revenue', [10, 20, 30])
      .build();

    expect(cfg.series).toHaveLength(1);
    expect(cfg.series[0]!.name).toBe('Revenue');
    expect(cfg.series[0]!.type).toBe('line');
    expect(cfg.series[0]!.data).toHaveLength(3);
  });

  it('addSeries normalises number arrays to {x,y} pairs', () => {
    const cfg = chart().addSeries('A', [5, 10, 15]).build();
    expect(cfg.series[0]!.data[0]).toEqual({ x: 0, y: 5 });
    expect(cfg.series[0]!.data[2]).toEqual({ x: 2, y: 15 });
  });

  it('addSeries normalises [x,y] tuple arrays', () => {
    const cfg = chart().addSeries('B', [[1, 2], [3, 4]] as [number, number][]).build();
    expect(cfg.series[0]!.data[0]).toEqual({ x: 1, y: 2 });
  });

  it('title() sets config.title', () => {
    const cfg = chart().title('My Chart').build();
    expect(cfg.title?.text).toBe('My Chart');
  });

  it('subtitle() sets config.subtitle', () => {
    const cfg = chart().subtitle('Sub').build();
    expect(cfg.subtitle?.text).toBe('Sub');
  });

  it('size() sets width and height', () => {
    const cfg = chart().size(800, 400).build();
    expect(cfg.width).toBe(800);
    expect(cfg.height).toBe(400);
  });

  it('width() and height() work independently', () => {
    const cfg = chart().width(1200).height(600).build();
    expect(cfg.width).toBe(1200);
    expect(cfg.height).toBe(600);
  });

  it('theme() sets theme', () => {
    const cfg = chart().theme('dark').build();
    expect(cfg.theme).toBe('dark');
  });

  it('palette() merges palette into theme config', () => {
    const colors = ['#f00', '#0f0', '#00f'];
    const cfg = chart().palette(colors).build();
    expect((cfg.theme as any).palette).toEqual(colors);
  });

  it('legend(true) enables legend', () => {
    const cfg = chart().legend(true).build();
    expect(cfg.legend?.enabled).toBe(true);
  });

  it('legend(false) disables legend', () => {
    const cfg = chart().legend(false).build();
    expect(cfg.legend?.enabled).toBe(false);
  });

  it('legend({}) merges config', () => {
    const cfg = chart().legend({ align: 'right' }).build();
    expect(cfg.legend?.align).toBe('right');
    expect(cfg.legend?.enabled).toBe(true);
  });

  it('tooltip(false) disables tooltip', () => {
    const cfg = chart().tooltip(false).build();
    expect(cfg.tooltip?.enabled).toBe(false);
  });

  it('animation(false) disables animation', () => {
    const cfg = chart().noAnimation().build();
    expect(cfg.animation?.enabled).toBe(false);
  });

  it('xAxis() adds x-axis', () => {
    const cfg = chart().xAxis({ type: 'time' }).build();
    const x = cfg.axes?.find(a => a.id === 'x0');
    expect(x).toBeDefined();
    expect(x!.type).toBe('time');
  });

  it('yAxis() adds y-axis with left position', () => {
    const cfg = chart().yAxis({ title: { text: 'Revenue' } }).build();
    const y = cfg.axes?.find(a => a.id === 'y0');
    expect(y?.position).toBe('left');
    expect(y?.title?.text).toBe('Revenue');
  });

  it('y2Axis() adds right-side y-axis', () => {
    const cfg = chart().y2Axis({ title: { text: 'Volume' } }).build();
    const y = cfg.axes?.find(a => a.id === 'y1');
    expect(y?.position).toBe('right');
  });

  it('exportable() sets export config', () => {
    const cfg = chart().exportable().build();
    expect(cfg.export?.enabled).toBe(true);
    expect(cfg.export?.formats).toContain('png');
  });

  it('zoom() sets zoom interaction', () => {
    const cfg = chart().zoom('x').build();
    expect(cfg.interaction?.zoom?.enabled).toBe(true);
    expect(cfg.interaction?.zoom?.axis).toBe('x');
  });

  it('accessible() sets accessibility', () => {
    const cfg = chart().accessible().build();
    expect(cfg.accessibility?.enabled).toBe(true);
  });

  it('debug() sets debug flag', () => {
    const cfg = chart().debug().build();
    expect(cfg.debug).toBe(true);
  });

  it('series() sets multiple series at once', () => {
    const cfg = chart()
      .type('bar')
      .series([
        { id: 's1', name: 'A', type: 'bar', data: [] },
        { id: 's2', name: 'B', type: 'line', data: [] },
      ])
      .build();
    expect(cfg.series).toHaveLength(2);
  });

  it('into() returns BoundChartBuilder', () => {
    const b = chart().into('#app');
    expect(b).toBeInstanceOf(BoundChartBuilder);
  });

  it('charts.stock() preset sets candlestick type', () => {
    const cfg = charts.stock().build();
    expect(cfg.series).toHaveLength(0); // no series added yet
    const x = cfg.axes?.find(a => a.type === 'time');
    expect(x).toBeDefined();
  });

  it('charts.sparkline() preset disables legend and animation', () => {
    const cfg = charts.sparkline().build();
    expect(cfg.legend?.enabled).toBe(false);
    expect(cfg.animation?.enabled).toBe(false);
  });

  it('charts.pie() preset sets pie type default', () => {
    const b = charts.pie();
    const cfg = b.addSeries('A', [30, 70]).build();
    expect(cfg.series[0]!.type).toBe('pie');
  });

  it('autoResponsive() adds responsive rules', () => {
    const cfg = chart().autoResponsive().build();
    expect(cfg.responsive).toBeDefined();
    expect(cfg.responsive!.length).toBeGreaterThanOrEqual(2);
    expect(cfg.responsive![0]!.condition.maxWidth).toBe(480);
  });

  it('locale() sets locale and format options', () => {
    const cfg = chart().locale('de-DE', { maximumFractionDigits: 2 }).build();
    expect(cfg.locale).toBe('de-DE');
    expect(cfg.numberFormat?.maximumFractionDigits).toBe(2);
  });

  it('full chain builds valid config', () => {
    const cfg = chart()
      .type('line')
      .addSeries('Revenue', [100, 200, 150])
      .title('Revenue Trend')
      .subtitle('FY2024')
      .theme('dark')
      .xAxis({ type: 'time' })
      .yAxis({ title: { text: 'USD' } })
      .legend({ align: 'right' })
      .tooltip({ shared: true })
      .animation({ duration: 400 })
      .zoom('x')
      .exportable()
      .accessible()
      .autoResponsive()
      .debug()
      .build();

    expect(cfg.series[0]!.name).toBe('Revenue');
    expect(cfg.title?.text).toBe('Revenue Trend');
    expect(cfg.theme).toBe('dark');
    expect(cfg.debug).toBe(true);
    expect(cfg.export?.enabled).toBe(true);
    expect(cfg.accessibility?.enabled).toBe(true);
    expect(cfg.responsive!.length).toBeGreaterThan(0);
  });
});
