// ============================================================================
// ErrorBand — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderErrorBand } from '../../../src/charts/advanced/ErrorBand';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, circles = 0;
  return {
    get paths()  { return paths;   },
    get circles(){ return circles; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath:   () => { paths++;   },
    drawCircle: () => { circles++; },
    drawLine: () => {}, drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawText: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeScale(factor = 1) {
  return { convert: (v: any) => Number(v) * factor, bandwidth: undefined, ticks: () => [] };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 400, height: 300 },
    width: 400, height: 300, pixelRatio: 1,
    series: [], scales: new Map([['x0', makeScale()], ['y0', makeScale()]]), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(n = 4) {
  return {
    id: 's1', name: 'ErrorBand', type: 'errorband',
    xAxisId: 'x0', yAxisId: 'y0',
    data: Array.from({ length: n }, (_, i) => ({
      x: i, y: i * 10,
      meta: { upper: i * 10 + 5, lower: i * 10 - 5 },
    })),
    processedData: [],
  } as any;
}

describe('renderErrorBand', () => {
  it('is a function', () => {
    expect(typeof renderErrorBand).toBe('function');
  });

  it('draws band fill + center line + 2 boundary lines = 4 paths', () => {
    const r = makeMockRenderer();
    renderErrorBand(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBe(4);
  });

  it('draws one marker circle per data point', () => {
    const r = makeMockRenderer();
    renderErrorBand(r as unknown as BaseRenderer, makeSeries(6), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBe(6);
  });

  it('returns early when fewer than 2 data points', () => {
    const r = makeMockRenderer();
    const s = { ...makeSeries(1), data: [{ x: 0, y: 5 }] };
    renderErrorBand(r as unknown as BaseRenderer, s as any, makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBe(0);
  });

  it('returns early when scales are missing', () => {
    const r = makeMockRenderer();
    const state = makeState();
    (state.scales as Map<string, any>).clear();
    renderErrorBand(r as unknown as BaseRenderer, makeSeries(), state, defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBe(0);
  });

  it('falls back to high/low fields when meta.upper/lower absent', () => {
    const r = makeMockRenderer();
    const s = {
      id: 's1', name: 'EB', type: 'errorband',
      xAxisId: 'x0', yAxisId: 'y0',
      data: [
        { x: 0, y: 10, high: 12, low: 8 },
        { x: 1, y: 20, high: 22, low: 18 },
      ],
      processedData: [],
    } as any;
    renderErrorBand(r as unknown as BaseRenderer, s, makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBe(4);
  });
});
