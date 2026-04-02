// ============================================================================
// ColumnRangeChart + DumbbellChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderColumnRange, renderDumbbellChart } from '../../src/charts/ColumnRangeChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, circles = 0, lines = 0, texts = 0, groups = 0;
  return {
    get rects() { return rects; },
    get circles() { return circles; },
    get lines() { return lines; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    drawCircle: () => { circles++; },
    drawLine: () => { lines++; },
    drawText: () => { texts++; },
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

const rangeSeries = [
  {
    id: 's1', name: 'Range', type: 'columnrange',
    processedData: [
      { x: 1, xNum: 1, yNum: 10, low: 10, high: 60 },
      { x: 2, xNum: 2, yNum: 20, low: 20, high: 75 },
      { x: 3, xNum: 3, yNum: 5,  low: 5,  high: 50 },
    ],
  },
] as any;

describe('renderColumnRange', () => {
  it('is a function', () => {
    expect(typeof renderColumnRange).toBe('function');
  });

  it('does nothing with empty series', () => {
    const r = makeMockRenderer();
    renderColumnRange(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws one rect per data point', () => {
    const r = makeMockRenderer();
    renderColumnRange(r as unknown as BaseRenderer, rangeSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(3);
  });

  it('uses beginGroup', () => {
    const r = makeMockRenderer();
    renderColumnRange(r as unknown as BaseRenderer, rangeSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });

  it('shows labels when showLabels=true', () => {
    const r = makeMockRenderer();
    renderColumnRange(r as unknown as BaseRenderer, rangeSeries, makeState(), defaultTheme as ThemeConfig, {
      columnRange: { showLabels: true },
    } as any);
    expect(r.texts).toBeGreaterThan(0);
  });
});

describe('renderDumbbellChart', () => {
  it('is a function', () => {
    expect(typeof renderDumbbellChart).toBe('function');
  });

  it('does nothing with empty series', () => {
    const r = makeMockRenderer();
    renderDumbbellChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.circles).toBe(0);
  });

  it('draws 2 circles and 1 line per data point', () => {
    const r = makeMockRenderer();
    renderDumbbellChart(r as unknown as BaseRenderer, rangeSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.circles).toBe(6);  // 3 pts × 2 endpoints
    expect(r.lines).toBe(3);    // 3 connector lines
  });

  it('uses beginGroup', () => {
    const r = makeMockRenderer();
    renderDumbbellChart(r as unknown as BaseRenderer, rangeSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
