// ============================================================================
// SparklineChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderSparklineChart } from '../../../src/charts/advanced/SparklineChart';
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

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 150, height: 40 },
    width: 150, height: 40, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(values: number[]) {
  return {
    id: 's1', name: 'Spark', type: 'sparkline',
    data: values.map((v, i) => ({ x: i, y: v })),
    processedData: [],
  } as any;
}

describe('renderSparklineChart', () => {
  it('is a function', () => {
    expect(typeof renderSparklineChart).toBe('function');
  });

  it('draws area path + line path = 2 paths', () => {
    const r = makeMockRenderer();
    renderSparklineChart(r as unknown as BaseRenderer, makeSeries([1, 2, 3, 4, 5]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBe(2);
  });

  it('draws 3 circles (last point + min + max)', () => {
    const r = makeMockRenderer();
    renderSparklineChart(r as unknown as BaseRenderer, makeSeries([3, 1, 5, 2, 4]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBe(3);
  });

  it('returns early when fewer than 2 data points', () => {
    const r = makeMockRenderer();
    renderSparklineChart(r as unknown as BaseRenderer, makeSeries([5]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBe(0);
  });

  it('handles flat data (all same values)', () => {
    const r = makeMockRenderer();
    expect(() =>
      renderSparklineChart(r as unknown as BaseRenderer, makeSeries([7, 7, 7, 7]), makeState(), defaultTheme as ThemeConfig, '#4f46e5'),
    ).not.toThrow();
    expect(r.paths).toBe(2);
  });

  it('handles negative values without throwing', () => {
    const r = makeMockRenderer();
    expect(() =>
      renderSparklineChart(r as unknown as BaseRenderer, makeSeries([-5, -3, -8, -1]), makeState(), defaultTheme as ThemeConfig, '#ef4444'),
    ).not.toThrow();
  });
});
