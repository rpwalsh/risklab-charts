// ============================================================================
// AreaChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderAreaSeries } from '../../src/charts/AreaChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 6, bandwidth: 60 };
}

function makeMockRenderer() {
  let paths = 0, circles = 0;
  return {
    get paths() { return paths; },
    get circles() { return circles; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawText: () => {}, drawRect: () => {}, drawArc: () => {},
    drawPolygon: () => {}, drawPath: () => { paths++; },
    drawCircle: () => { circles++; },
    beginGroup: () => {}, endGroup: () => {},
    buildLinePath: () => 'M0,0L100,100',
    buildAreaPath: () => 'M0,400L100,200L100,400Z',
    defineLinearGradient: () => {},
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
    id: 's1', name: 'Area', type: 'area',
    data: pts,
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: p.x, yNum: p.y })),
    ...extra,
  } as any;
}

describe('renderAreaSeries', () => {
  it('is a function', () => {
    expect(typeof renderAreaSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderAreaSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.paths).toBe(0);
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    const noScaleState = { ...makeState(), scales: new Map() } as unknown as ChartState;
    renderAreaSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }]), noScaleState, defaultTheme as ThemeConfig, '#6366f1');
    expect(r.paths).toBe(0);
  });

  it('draws fill area path and line path (2 paths total)', () => {
    const r = makeMockRenderer();
    renderAreaSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.paths).toBe(2);
  });

  it('draws markers when marker.enabled is true', () => {
    const r = makeMockRenderer();
    renderAreaSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }], { marker: { enabled: true } }), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.circles).toBe(2);
  });

  it('draws no markers when marker.enabled is not set', () => {
    const r = makeMockRenderer();
    renderAreaSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.circles).toBe(0);
  });

  it('handles single data point without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderAreaSeries(r as unknown as BaseRenderer, makeSeries([{ x: 5, y: 5 }]), makeState(), defaultTheme as ThemeConfig, '#6366f1')).not.toThrow();
  });
});
