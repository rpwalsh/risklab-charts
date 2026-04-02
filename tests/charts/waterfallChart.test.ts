// ============================================================================
// WaterfallChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderWaterfallSeries } from '../../src/charts/WaterfallChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 4, bandwidth: 50 };
}

function makeMockRenderer() {
  let rects = 0, lines = 0, texts = 0;
  return {
    get rects() { return rects; },
    get lines() { return lines; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    drawLine: () => { lines++; },
    drawText: () => { texts++; },
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

function makeSeries(pts: { x: number; y: number; isTotal?: boolean }[]) {
  return {
    id: 's1', name: 'Waterfall', type: 'waterfall',
    data: pts,
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: p.x, yNum: p.y, meta: p.isTotal ? { isTotal: true } : {} })),
  } as any;
}

describe('renderWaterfallSeries', () => {
  it('is a function', () => {
    expect(typeof renderWaterfallSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderWaterfallSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.rects).toBe(0);
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    renderWaterfallSeries(r as unknown as BaseRenderer, makeSeries([{ x: 1, y: 10 }]), { ...makeState(), scales: new Map() } as unknown as ChartState, defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.rects).toBe(0);
  });

  it('draws one rect per data point', () => {
    const r = makeMockRenderer();
    renderWaterfallSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 5 }, { x: 2, y: -3 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.rects).toBe(3);
  });

  it('draws connector lines between non-total bars', () => {
    const r = makeMockRenderer();
    renderWaterfallSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 5 }, { x: 2, y: -3 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.lines).toBe(2); // connector between bar 0→1 and 1→2
  });

  it('draws a value label per bar', () => {
    const r = makeMockRenderer();
    renderWaterfallSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: -5 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.texts).toBe(2);
  });

  it('does not draw connector after total bar', () => {
    const r = makeMockRenderer();
    renderWaterfallSeries(r as unknown as BaseRenderer, makeSeries([
      { x: 0, y: 10 }, { x: 1, y: 5 }, { x: 2, y: 0, isTotal: true },
    ]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // connectors drawn from every non-total bar (0→1 and 1→2); total bar itself emits no connector
    expect(r.lines).toBe(2);
  });
});
