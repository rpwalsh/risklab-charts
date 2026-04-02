// ============================================================================
// HeatmapChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderHeatmapSeries } from '../../src/charts/HeatmapChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

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
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(pts: { x: string | number; y: string | number; z?: number }[]) {
  return {
    id: 's1', name: 'Heatmap', type: 'heatmap',
    data: pts,
    processedData: pts.map(p => ({ x: p.x, y: p.y, z: p.z, xNum: Number(p.x), yNum: p.z ?? 0 })),
  } as any;
}

const heatData = [
  { x: 'Mon', y: 'AM', z: 10 }, { x: 'Mon', y: 'PM', z: 20 },
  { x: 'Tue', y: 'AM', z: 30 }, { x: 'Tue', y: 'PM', z: 5 },
];

describe('renderHeatmapSeries', () => {
  it('is a function', () => {
    expect(typeof renderHeatmapSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderHeatmapSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    expect(r.rects).toBe(0);
  });

  it('draws one rect per data point', () => {
    const r = makeMockRenderer();
    renderHeatmapSeries(r as unknown as BaseRenderer, makeSeries(heatData), makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    expect(r.rects).toBe(4);
  });

  it('draws value labels when cells are large enough', () => {
    const r = makeMockRenderer();
    // chartArea 600x400, 2 cols × 2 rows → cells 300×200 > 30px×20px threshold
    renderHeatmapSeries(r as unknown as BaseRenderer, makeSeries(heatData), makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    expect(r.texts).toBe(4);
  });

  it('respects custom colorScale config', () => {
    const r = makeMockRenderer();
    const config = { heatmap: { colorScale: { min: '#ffffff', max: '#ff0000' } } } as ChartConfig;
    expect(() => renderHeatmapSeries(r as unknown as BaseRenderer, makeSeries(heatData), makeState(), defaultTheme as ThemeConfig, config)).not.toThrow();
    expect(r.rects).toBe(4);
  });

  it('handles single-cell heatmap', () => {
    const r = makeMockRenderer();
    renderHeatmapSeries(r as unknown as BaseRenderer, makeSeries([{ x: 'A', y: 'B', z: 42 }]), makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    expect(r.rects).toBe(1);
  });
});
