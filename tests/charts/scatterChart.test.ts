// ============================================================================
// ScatterChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderScatterSeries } from '../../src/charts/ScatterChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 6, bandwidth: 60 };
}

function makeMockRenderer() {
  let circles = 0, rects = 0, polygons = 0, lines = 0;
  return {
    get circles() { return circles; },
    get rects() { return rects; },
    get polygons() { return polygons; },
    get lines() { return lines; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawText: () => {}, drawArc: () => {},
    drawCircle: () => { circles++; },
    drawRect: () => { rects++; },
    drawPolygon: () => { polygons++; },
    drawLine: () => { lines++; },
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
    hoveredPoint: null, selectedPoints: [],
  } as unknown as ChartState;
}

function makeSeries(pts: { x: number; y: number }[], extra: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'Scatter', type: 'scatter',
    data: pts,
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: p.x, yNum: p.y })),
    ...extra,
  } as any;
}

describe('renderScatterSeries', () => {
  it('is a function', () => {
    expect(typeof renderScatterSeries).toBe('function');
  });

  it('returns early when no scales', () => {
    const r = makeMockRenderer();
    const noScale = { ...makeState(), scales: new Map() } as unknown as ChartState;
    renderScatterSeries(r as unknown as BaseRenderer, makeSeries([{ x: 1, y: 2 }]), noScale, defaultTheme as ThemeConfig, '#6366f1');
    expect(r.circles).toBe(0);
  });

  it('draws one circle per point by default (circle symbol)', () => {
    const r = makeMockRenderer();
    renderScatterSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.circles).toBe(3);
  });

  it('draws a rect per point for square symbol', () => {
    const r = makeMockRenderer();
    renderScatterSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 0 }, { x: 1, y: 1 }], { marker: { symbol: 'square' } }), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.rects).toBe(2);
    expect(r.circles).toBe(0);
  });

  it('draws a polygon per point for diamond symbol', () => {
    const r = makeMockRenderer();
    renderScatterSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 0 }, { x: 1, y: 1 }], { marker: { symbol: 'diamond' } }), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.polygons).toBe(2);
  });

  it('draws a polygon per point for triangle symbol', () => {
    const r = makeMockRenderer();
    renderScatterSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 0 }, { x: 1, y: 1 }], { marker: { symbol: 'triangle' } }), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.polygons).toBe(2);
  });

  it('draws 2 lines per point for cross symbol', () => {
    const r = makeMockRenderer();
    renderScatterSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 0 }, { x: 1, y: 1 }], { marker: { symbol: 'cross' } }), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.lines).toBe(4); // 2 lines × 2 points
  });

  it('handles empty data without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderScatterSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#6366f1')).not.toThrow();
  });
});
