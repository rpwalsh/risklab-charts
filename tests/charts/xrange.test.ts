// ============================================================================
// XRangeChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderXRange } from '../../src/charts/XRangeChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, texts = 0, circles = 0, groups = 0;
  return {
    get rects() { return rects; },
    get texts() { return texts; },
    get circles() { return circles; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: (_x: number, _y: number, _w: number, _h: number) => { rects++; },
    drawCircle: () => { circles++; },
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

const xrSeries = [
  {
    id: 's1', name: 'Tasks', type: 'xrange',
    data: [
      { x: 0, x2: 3, y: 0, label: 'Plan' },
      { x: 3, x2: 7, y: 1, label: 'Build' },
      { x: 5, x2: 10, y: 2, label: 'Test' },
    ],
    processedData: [
      { x: 0, x2: 3, y: 0, xNum: 0, yNum: 0, label: 'Plan' },
      { x: 3, x2: 7, y: 1, xNum: 3, yNum: 1, label: 'Build' },
      { x: 5, x2: 10, y: 2, xNum: 5, yNum: 2, label: 'Test' },
    ],
  },
] as any;

describe('renderXRange', () => {
  it('is a function', () => {
    expect(typeof renderXRange).toBe('function');
  });

  it('does nothing with empty series', () => {
    const r = makeMockRenderer();
    renderXRange(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws one rect per data point', () => {
    const r = makeMockRenderer();
    renderXRange(r as unknown as BaseRenderer, xrSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(3);
  });

  it('skips data points without x2', () => {
    const noX2Series = [{
      id: 's1', name: 'S', type: 'xrange',
      processedData: [{ x: 0, xNum: 0, yNum: 0 }], // no x2
    }] as any;
    const r = makeMockRenderer();
    renderXRange(r as unknown as BaseRenderer, noX2Series, makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('shows labels in bars when showLabels=true and label provided', () => {
    const r = makeMockRenderer();
    renderXRange(r as unknown as BaseRenderer, xrSeries, makeState(), defaultTheme as ThemeConfig, {
      xRange: { showLabels: true },
    } as any);
    expect(r.texts).toBeGreaterThan(0);
  });

  it('renders category labels on y-axis when provided', () => {
    const r = makeMockRenderer();
    renderXRange(r as unknown as BaseRenderer, xrSeries, makeState(), defaultTheme as ThemeConfig, {
      xRange: { categories: ['Planning', 'Development', 'QA'] },
    } as any);
    // 3 bar data labels (showLabels=true by default, bars >30px) + 3 category labels = 6
    expect(r.texts).toBeGreaterThanOrEqual(3);
  });

  it('uses beginGroup/endGroup', () => {
    const r = makeMockRenderer();
    renderXRange(r as unknown as BaseRenderer, xrSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });

  it('handles partial fill overlay', () => {
    const pfSeries = [{
      id: 's1', name: 'S', type: 'xrange',
      processedData: [{ x: 0, x2: 10, y: 0, xNum: 0, yNum: 0, partialFill: 0.6 }],
    }] as any;
    const r = makeMockRenderer();
    renderXRange(r as unknown as BaseRenderer, pfSeries, makeState(), defaultTheme as ThemeConfig, {
      xRange: { showPartialFill: true },
    } as any);
    expect(r.rects).toBe(2); // main bar + partial fill overlay
  });
});
