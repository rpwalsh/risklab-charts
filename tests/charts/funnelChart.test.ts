// ============================================================================
// FunnelChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderFunnelSeries } from '../../src/charts/FunnelChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let polygons = 0, texts = 0;
  return {
    get polygons() { return polygons; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawRect: () => {}, drawCircle: () => {}, drawArc: () => {},
    drawPolygon: () => { polygons++; },
    drawText: () => { texts++; },
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(pts: { y: number; label?: string }[], extra: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'Funnel', type: 'funnel',
    data: pts.map((p, i) => ({ x: p.label ?? i, y: p.y, label: p.label })),
    processedData: pts.map((p, i) => ({ x: p.label ?? i, y: p.y, yNum: p.y, label: p.label })),
    ...extra,
  } as any;
}

describe('renderFunnelSeries', () => {
  it('is a function', () => {
    expect(typeof renderFunnelSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderFunnelSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig);
    expect(r.polygons).toBe(0);
  });

  it('draws one trapezoid (polygon) per data point (vertical)', () => {
    const r = makeMockRenderer();
    renderFunnelSeries(r as unknown as BaseRenderer, makeSeries([{ y: 100 }, { y: 60 }, { y: 30 }]), makeState(), defaultTheme as ThemeConfig);
    expect(r.polygons).toBe(3);
  });

  it('draws two text labels per stage (name + percent)', () => {
    const r = makeMockRenderer();
    renderFunnelSeries(r as unknown as BaseRenderer, makeSeries([{ y: 100 }, { y: 60 }]), makeState(), defaultTheme as ThemeConfig);
    expect(r.texts).toBe(4); // 2 stages × 2 texts each
  });

  it('draws one trapezoid per stage for horizontal orientation', () => {
    const r = makeMockRenderer();
    renderFunnelSeries(r as unknown as BaseRenderer, makeSeries([{ y: 100 }, { y: 60 }, { y: 30 }], { funnel: { orientation: 'horizontal' } }), makeState(), defaultTheme as ThemeConfig);
    expect(r.polygons).toBe(3);
  });

  it('handles single-stage funnel without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderFunnelSeries(r as unknown as BaseRenderer, makeSeries([{ y: 100 }]), makeState(), defaultTheme as ThemeConfig)).not.toThrow();
  });
});
