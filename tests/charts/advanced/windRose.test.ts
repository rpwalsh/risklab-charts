// ============================================================================
// WindRose — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderWindRose } from '../../../src/charts/advanced/WindRose';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, lines = 0, paths = 0, texts = 0;
  return {
    get circles() { return circles; }, get lines() { return lines; },
    get paths()   { return paths;   }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => { circles++; },
    drawLine:   () => { lines++;   },
    drawPath:   () => { paths++;   },
    drawText:   () => { texts++;   },
    drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 500, height: 500 },
    width: 500, height: 500, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

// Wind rose with 16 directional compass points
const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function makeSeries(dirs = COMPASS_16, values?: number[]) {
  return {
    id: 's1', name: 'Wind', type: 'windrose',
    data: dirs.map((d, i) => ({ x: d, y: values ? values[i] : Math.random() * 10 + 1 })),
    processedData: [],
  } as any;
}

describe('renderWindRose', () => {
  it('is a function', () => {
    expect(typeof renderWindRose).toBe('function');
  });

  it('draws 5 grid ring circles', () => {
    const r = makeMockRenderer();
    renderWindRose(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBe(5);
  });

  it('draws 16 direction lines (one per compass point)', () => {
    const r = makeMockRenderer();
    renderWindRose(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.lines).toBe(16);
  });

  it('draws petal arc paths for each direction with non-zero value', () => {
    const r = makeMockRenderer();
    renderWindRose(r as unknown as BaseRenderer, makeSeries(COMPASS_16, Array(16).fill(5)), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBeGreaterThan(0);
  });

  it('draws grid ring labels and direction labels', () => {
    const r = makeMockRenderer();
    renderWindRose(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // 5 ring value labels + 8 direction labels (every other compass point)
    expect(r.texts).toBeGreaterThanOrEqual(5);
  });

  it('returns early without drawing petals when data is empty', () => {
    const r = makeMockRenderer();
    renderWindRose(
      r as unknown as BaseRenderer,
      { id: 's1', name: 'W', type: 'windrose', data: [], processedData: [] } as any,
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.paths).toBe(0);
  });

  it('accepts degree-based direction values', () => {
    const r = makeMockRenderer();
    const degDirs = Array.from({ length: 8 }, (_, i) => i * 45); // 0,45,90,...315
    const s = {
      id: 's1', name: 'Wind', type: 'windrose',
      data: degDirs.map((d) => ({ x: d, y: 5 })), processedData: [],
    } as any;
    expect(() =>
      renderWindRose(r as unknown as BaseRenderer, s, makeState(), defaultTheme as ThemeConfig, '#4f46e5'),
    ).not.toThrow();
  });
});
