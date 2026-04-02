// ============================================================================
// BoxPlotChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderBoxPlotSeries } from '../../src/charts/BoxPlotChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 4, bandwidth: 60 };
}

function makeMockRenderer() {
  let lines = 0, rects = 0;
  return {
    get lines() { return lines; },
    get rects() { return rects; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawText: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawLine: () => { lines++; },
    drawRect: () => { rects++; },
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  const scales = new Map();
  scales.set('x0', makeMockScale());
  scales.set('y0', makeMockScale());
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeBoxPoint(x: number, low: number, q1: number, median: number, q3: number, high: number) {
  return { x, xNum: x, yNum: median, low, q1, median, q3, high };
}

function makeSeries(pts: ReturnType<typeof makeBoxPoint>[]) {
  return {
    id: 's1', name: 'BoxPlot', type: 'boxplot',
    data: pts, processedData: pts,
  } as any;
}

describe('renderBoxPlotSeries', () => {
  it('is a function', () => {
    expect(typeof renderBoxPlotSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderBoxPlotSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.rects).toBe(0);
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    renderBoxPlotSeries(r as unknown as BaseRenderer, makeSeries([makeBoxPoint(0, 1, 3, 5, 7, 9)]), { ...makeState(), scales: new Map() } as unknown as ChartState, defaultTheme as ThemeConfig, '#6366f1');
    expect(r.rects).toBe(0);
  });

  it('draws one rect (IQR box) per data point', () => {
    const r = makeMockRenderer();
    renderBoxPlotSeries(r as unknown as BaseRenderer, makeSeries([makeBoxPoint(1, 5, 10, 15, 20, 25), makeBoxPoint(2, 8, 12, 18, 22, 28)]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.rects).toBe(2);
  });

  it('draws 5 lines per data point (low whisker, low cap, median, high whisker, high cap)', () => {
    const r = makeMockRenderer();
    renderBoxPlotSeries(r as unknown as BaseRenderer, makeSeries([makeBoxPoint(1, 5, 10, 15, 20, 25)]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.lines).toBe(5);
  });

  it('handles multiple data points', () => {
    const r = makeMockRenderer();
    renderBoxPlotSeries(r as unknown as BaseRenderer, makeSeries([
      makeBoxPoint(1, 5, 10, 15, 20, 25),
      makeBoxPoint(2, 3, 8, 12, 16, 20),
      makeBoxPoint(3, 1, 4, 7, 11, 14),
    ]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.rects).toBe(3);
    expect(r.lines).toBe(15); // 5 lines × 3 boxes
  });
});
