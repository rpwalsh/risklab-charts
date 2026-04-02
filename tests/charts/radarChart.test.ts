// ============================================================================
// RadarChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderRadarSeries } from '../../src/charts/RadarChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let polygons = 0, circles = 0, texts = 0, lines = 0;
  return {
    get polygons() { return polygons; },
    get circles() { return circles; },
    get texts() { return texts; },
    get lines() { return lines; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawRect: () => {}, drawArc: () => {},
    drawPolygon: () => { polygons++; },
    drawCircle: () => { circles++; },
    drawText: () => { texts++; },
    drawLine: () => { lines++; },
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(values: number[]) {
  return {
    id: 's1', name: 'Radar', type: 'radar',
    data: values.map((v, i) => ({ x: i, y: v, label: `Cat${i}` })),
    processedData: values.map((v, i) => ({ x: i, y: v, xNum: i, yNum: v, label: `Cat${i}` })),
  } as any;
}

describe('renderRadarSeries', () => {
  it('is a function', () => {
    expect(typeof renderRadarSeries).toBe('function');
  });

  it('returns without drawing for fewer than 3 data points', () => {
    const r = makeMockRenderer();
    renderRadarSeries(r as unknown as BaseRenderer, makeSeries([10, 20]), makeState(), defaultTheme as ThemeConfig, '#6366f1', 0);
    expect(r.polygons).toBe(0);
  });

  it('draws grid polygons and data polygon for first series', () => {
    const r = makeMockRenderer();
    // 5 levels of grid + 1 data polygon = 6 polygons
    renderRadarSeries(r as unknown as BaseRenderer, makeSeries([10, 20, 30, 40, 50]), makeState(), defaultTheme as ThemeConfig, '#6366f1', 0);
    expect(r.polygons).toBe(6); // 5 grid levels + 1 data
  });

  it('draws only data polygon for subsequent series (no grid)', () => {
    const r = makeMockRenderer();
    renderRadarSeries(r as unknown as BaseRenderer, makeSeries([10, 20, 30, 40, 50]), makeState(), defaultTheme as ThemeConfig, '#ef4444', 1);
    expect(r.polygons).toBe(1); // only data polygon
  });

  it('draws one axis line per data point (for first series)', () => {
    const r = makeMockRenderer();
    renderRadarSeries(r as unknown as BaseRenderer, makeSeries([10, 20, 30, 40, 50, 60]), makeState(), defaultTheme as ThemeConfig, '#6366f1', 0);
    expect(r.lines).toBe(6);
  });

  it('draws a circle marker per data point', () => {
    const r = makeMockRenderer();
    renderRadarSeries(r as unknown as BaseRenderer, makeSeries([10, 20, 30, 40, 50]), makeState(), defaultTheme as ThemeConfig, '#6366f1', 0);
    expect(r.circles).toBe(5);
  });

  it('draws axis labels for first series', () => {
    const r = makeMockRenderer();
    renderRadarSeries(r as unknown as BaseRenderer, makeSeries([10, 20, 30, 40, 50]), makeState(), defaultTheme as ThemeConfig, '#6366f1', 0);
    expect(r.texts).toBe(5);
  });

  it('draws no labels for subsequent series', () => {
    const r = makeMockRenderer();
    renderRadarSeries(r as unknown as BaseRenderer, makeSeries([10, 20, 30, 40, 50]), makeState(), defaultTheme as ThemeConfig, '#ef4444', 1);
    expect(r.texts).toBe(0);
  });
});
