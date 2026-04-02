// ============================================================================
// HistogramChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderHistogramChart } from '../../src/charts/HistogramChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale(domain: [number, number] = [0, 100], range: [number, number] = [0, 600]) {
  return {
    convert: (v: number) => range[0] + ((v - domain[0]) / (domain[1] - domain[0] || 1)) * (range[1] - range[0]),
    bandwidth: 20,
    ticks: (n = 5) => Array.from({ length: n }, (_, i) => domain[0] + (i / (n - 1)) * (domain[1] - domain[0])),
  };
}

function makeMockRenderer() {
  let rects = 0, texts = 0;
  return {
    get rects() { return rects; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    drawText: () => { texts++; },
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  const scales = new Map();
  scales.set('x0', makeMockScale([0, 100], [0, 600]));
  scales.set('y0', makeMockScale([0, 10], [400, 0])); // inverted Y (pixel top = 0)
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
    hoveredPoint: null,
    selectedPoints: [],
  } as unknown as ChartState;
}

function makeSeries(values: number[], extra: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'Hist', type: 'histogram',
    data: values.map(v => ({ y: v })),
    processedData: values.map(v => ({ yNum: v })),
    color: '#4f46e5',
    histogram: {},
    ...extra,
  } as any;
}

const normalValues = [10, 15, 20, 22, 25, 28, 30, 31, 35, 40, 42, 45, 50, 55, 60, 62, 65, 70, 75, 80];

describe('renderHistogramChart', () => {
  it('is a function', () => {
    expect(typeof renderHistogramChart).toBe('function');
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    renderHistogramChart(r as unknown as BaseRenderer, [makeSeries(normalValues)], { ...makeState(), scales: new Map() } as unknown as ChartState, {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('returns without drawing on empty series data', () => {
    const r = makeMockRenderer();
    renderHistogramChart(r as unknown as BaseRenderer, [makeSeries([])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws bars (rects) for a normal dataset', () => {
    const r = makeMockRenderer();
    renderHistogramChart(r as unknown as BaseRenderer, [makeSeries(normalValues)], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBeGreaterThan(0);
  });

  it('respects explicit binCount', () => {
    const r1 = makeMockRenderer();
    const r2 = makeMockRenderer();
    renderHistogramChart(r1 as unknown as BaseRenderer, [makeSeries(normalValues, { histogram: { binCount: 5 } })], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    renderHistogramChart(r2 as unknown as BaseRenderer, [makeSeries(normalValues, { histogram: { binCount: 10 } })], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r2.rects).toBeGreaterThan(r1.rects);
  });

  it('handles multiple series independently', () => {
    const r = makeMockRenderer();
    renderHistogramChart(r as unknown as BaseRenderer, [makeSeries(normalValues), makeSeries(normalValues.map(v => v + 5))], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBeGreaterThan(0);
  });

  it('skips invisible series', () => {
    const r = makeMockRenderer();
    renderHistogramChart(r as unknown as BaseRenderer, [makeSeries(normalValues, { visible: false })], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });
});
