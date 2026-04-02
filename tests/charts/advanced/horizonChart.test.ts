// ============================================================================
// HorizonChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderHorizonChart } from '../../../src/charts/advanced/HorizonChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, lines = 0, texts = 0;
  return {
    get paths() { return paths; }, get lines() { return lines; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => { paths++; },
    drawLine: () => { lines++; },
    drawText: () => { texts++; },
    drawRect: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 300 },
    width: 800, height: 300, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(values: number[], name = 'Series 1') {
  return {
    id: 's1', name,
    data: values.map((v, i) => ({ x: i, y: v })),
    processedData: [],
  } as any;
}

describe('renderHorizonChart', () => {
  it('is a function', () => {
    expect(typeof renderHorizonChart).toBe('function');
  });

  it('draws horizon band paths (at least 1 band per series)', () => {
    const r = makeMockRenderer();
    renderHorizonChart(r as unknown as BaseRenderer, makeSeries([1, 2, 3, 4, 5]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1);
    // Up to 6 band paths (3 positive + 3 negative) + separator line ≥ 1 path
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });

  it('draws a separator line between rows', () => {
    const r = makeMockRenderer();
    renderHorizonChart(r as unknown as BaseRenderer, makeSeries([1, 2, 3, 4, 5]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 2);
    expect(r.lines).toBeGreaterThanOrEqual(1);
  });

  it('draws series name as a label text', () => {
    const r = makeMockRenderer();
    renderHorizonChart(r as unknown as BaseRenderer, makeSeries([1, 2, 3], 'Revenue'), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1);
    expect(r.texts).toBeGreaterThanOrEqual(1);
  });

  it('returns early when fewer than 2 data points', () => {
    const r = makeMockRenderer();
    renderHorizonChart(r as unknown as BaseRenderer, makeSeries([5]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1);
    expect(r.paths).toBe(0);
  });

  it('handles negative values (negative band paths)', () => {
    const r = makeMockRenderer();
    renderHorizonChart(r as unknown as BaseRenderer, makeSeries([-3, -2, -1, 0, 1, 2, 3]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1);
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });
});
