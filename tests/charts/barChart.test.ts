// ============================================================================
// BarChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderBarSeries } from '../../src/charts/BarChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return {
    convert: (v: number) => v * 6,
    bandwidth: 60,
    ticks: (n = 5) => Array.from({ length: n }, (_, i) => i * 20),
  };
}

function makeMockRenderer() {
  let rects = 0;
  return {
    get rects() { return rects; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawText: () => {}, drawPath: () => {},
    drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  const scales = new Map<string, ReturnType<typeof makeMockScale>>();
  scales.set('x0', makeMockScale());
  scales.set('y0', makeMockScale());
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
    hoveredPoint: null, selectedPoints: [],
  } as unknown as ChartState;
}

function makeSeries(pts: { x: number; y: number }[], type = 'column') {
  return {
    id: 's1', name: 'Bars', type,
    data: pts,
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: p.x, yNum: p.y })),
  } as any;
}

describe('renderBarSeries', () => {
  it('is a function', () => {
    expect(typeof renderBarSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderBarSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#ec4899', 0, 1);
    expect(r.rects).toBe(0);
  });

  it('draws one rect per data point (column)', () => {
    const r = makeMockRenderer();
    renderBarSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }]), makeState(), defaultTheme as ThemeConfig, '#ec4899', 0, 1);
    expect(r.rects).toBe(3);
  });

  it('draws one rect per data point (horizontal bar)', () => {
    const r = makeMockRenderer();
    renderBarSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }], 'bar'), makeState(), defaultTheme as ThemeConfig, '#ec4899', 0, 1);
    expect(r.rects).toBe(2);
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    const noScaleState = { ...makeState(), scales: new Map() } as unknown as ChartState;
    renderBarSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }]), noScaleState, defaultTheme as ThemeConfig, '#ec4899', 0, 1);
    expect(r.rects).toBe(0);
  });

  it('handles grouped columns (multiple series)', () => {
    const r = makeMockRenderer();
    const pts = [{ x: 0, y: 10 }, { x: 1, y: 20 }];
    renderBarSeries(r as unknown as BaseRenderer, makeSeries(pts), makeState(), defaultTheme as ThemeConfig, '#ec4899', 1, 3);
    expect(r.rects).toBe(2);
  });

  it('handles stacked columns (stackedColumn type)', () => {
    const r = makeMockRenderer();
    renderBarSeries(
      r as unknown as BaseRenderer,
      makeSeries([{ x: 0, y: 10 }, { x: 1, y: 5 }], 'stackedColumn'),
      makeState(), defaultTheme as ThemeConfig, '#ec4899', 0, 1,
    );
    expect(r.rects).toBe(2);
  });
});
