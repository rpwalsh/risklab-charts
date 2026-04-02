// ============================================================================
// ParetoChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderParetoChart } from '../../src/charts/ParetoChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale(min = 0, max = 100) {
  return {
    convert: (v: number) => (v / (max - min)) * 400,
    bandwidth: 60,
    ticks: (n = 5) => Array.from({ length: n }, (_, i) => i * 20),
  };
}

function makeMockRenderer() {
  let rects = 0, paths = 0, circles = 0, lines = 0, texts = 0, groups = 0;
  return {
    get rects() { return rects; },
    get paths() { return paths; },
    get circles() { return circles; },
    get lines() { return lines; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    drawPath: () => { paths++; },
    drawCircle: () => { circles++; },
    drawLine: () => { lines++; },
    drawText: () => { texts++; },
    beginGroup: () => { groups++; },
    endGroup: () => {},
  };
}

function makeState(): ChartState {
  const scales = new Map();
  scales.set('x0', makeMockScale(0, 4));
  scales.set('y0', makeMockScale(0, 100));
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
    hoveredPoint: null, selectedPoints: [],
  } as unknown as ChartState;
}

function makeSeries(pts: { x: string; y: number }[]) {
  return {
    id: 's1', name: 'Pareto', type: 'pareto',
    data: pts.map(p => ({ x: p.x, y: p.y })),
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: 0, yNum: p.y })),
  } as any;
}

const data = [
  { x: 'A', y: 40 }, { x: 'B', y: 25 },
  { x: 'C', y: 20 }, { x: 'D', y: 10 }, { x: 'E', y: 5 },
];

describe('renderParetoChart', () => {
  it('is a function', () => {
    expect(typeof renderParetoChart).toBe('function');
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    renderParetoChart(r as unknown as BaseRenderer, [makeSeries(data)], { ...makeState(), scales: new Map() } as unknown as ChartState, {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('returns without drawing when series data is empty', () => {
    const r = makeMockRenderer();
    renderParetoChart(r as unknown as BaseRenderer, [makeSeries([])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws one bar per data point', () => {
    const r = makeMockRenderer();
    renderParetoChart(r as unknown as BaseRenderer, [makeSeries(data)], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(5);
  });

  it('draws a cumulative line path', () => {
    const r = makeMockRenderer();
    renderParetoChart(r as unknown as BaseRenderer, [makeSeries(data)], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });

  it('draws a dot on each cumulative % point', () => {
    const r = makeMockRenderer();
    renderParetoChart(r as unknown as BaseRenderer, [makeSeries(data)], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.circles).toBe(5);
  });

  it('draws the 80% reference line', () => {
    const r = makeMockRenderer();
    renderParetoChart(r as unknown as BaseRenderer, [makeSeries(data)], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.lines).toBeGreaterThanOrEqual(1); // 80% dashed reference line
  });

  it('uses beginGroup', () => {
    const r = makeMockRenderer();
    renderParetoChart(r as unknown as BaseRenderer, [makeSeries(data)], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
