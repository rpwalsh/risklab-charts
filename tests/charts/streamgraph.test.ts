// ============================================================================
// StreamgraphChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderStreamgraph } from '../../src/charts/StreamgraphChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, texts = 0, groups = 0;
  return {
    get paths() { return paths; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawRect: () => {}, drawCircle: () => {}, drawArc: () => {},
    drawPath: () => { paths++; },
    drawText: () => { texts++; },
    drawPolygon: () => {},
    beginGroup: (_id: string) => { groups++; },
    endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales: {}, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

const xSlots = [1, 2, 3, 4, 5];

function makeSeries(values: number[]) {
  return xSlots.map((x, i) => ({ xNum: x, x, yNum: values[i]! }));
}

const allSeries = [
  { id: 's1', name: 'A', type: 'streamgraph', data: makeSeries([10, 20, 15, 25, 18]), processedData: makeSeries([10, 20, 15, 25, 18]) },
  { id: 's2', name: 'B', type: 'streamgraph', data: makeSeries([5, 10, 8, 12, 6]),   processedData: makeSeries([5, 10, 8, 12, 6]) },
  { id: 's3', name: 'C', type: 'streamgraph', data: makeSeries([8, 6, 12, 9, 11]),   processedData: makeSeries([8, 6, 12, 9, 11]) },
] as any;

describe('renderStreamgraph', () => {
  it('is a function', () => {
    expect(typeof renderStreamgraph).toBe('function');
  });

  it('does nothing with empty series', () => {
    const r = makeMockRenderer();
    renderStreamgraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBe(0);
  });

  it('draws one path per series (silhouette baseline)', () => {
    const r = makeMockRenderer();
    renderStreamgraph(r as unknown as BaseRenderer, allSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBe(allSeries.length);
  });

  it('draws paths with wiggle baseline', () => {
    const r = makeMockRenderer();
    renderStreamgraph(r as unknown as BaseRenderer, allSeries, makeState(), defaultTheme as ThemeConfig, {
      streamgraph: { baseline: 'wiggle' },
    } as any);
    expect(r.paths).toBe(allSeries.length);
  });

  it('draws paths with zero baseline', () => {
    const r = makeMockRenderer();
    renderStreamgraph(r as unknown as BaseRenderer, allSeries, makeState(), defaultTheme as ThemeConfig, {
      streamgraph: { baseline: 'zero' },
    } as any);
    expect(r.paths).toBe(allSeries.length);
  });

  it('respects smooth=false', () => {
    const r = makeMockRenderer();
    renderStreamgraph(r as unknown as BaseRenderer, allSeries, makeState(), defaultTheme as ThemeConfig, {
      streamgraph: { smooth: false },
    } as any);
    expect(r.paths).toBeGreaterThan(0);
  });

  it('uses beginGroup/endGroup', () => {
    const r = makeMockRenderer();
    renderStreamgraph(r as unknown as BaseRenderer, allSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });

  it('handles single x-point gracefully (no paths)', () => {
    const singleX = [{ id: 's1', data: [{ xNum: 1, yNum: 5 }], processedData: [{ xNum: 1, yNum: 5 }] }] as any;
    const r = makeMockRenderer();
    expect(() => renderStreamgraph(r as unknown as BaseRenderer, singleX, makeState(), defaultTheme as ThemeConfig)).not.toThrow();
    expect(r.paths).toBe(0); // n < 2
  });
});
