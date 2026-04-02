// ============================================================================
// LineChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderLineSeries } from '../../src/charts/LineChart';
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
  let paths = 0, circles = 0;
  return {
    get paths() { return paths; },
    get circles() { return circles; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawText: () => {}, drawRect: () => {}, drawArc: () => {},
    drawPolygon: () => {}, drawPath: () => { paths++; },
    drawCircle: () => { circles++; },
    beginGroup: () => {}, endGroup: () => {},
    buildLinePath: (_pts: unknown) => 'M0,0L100,100',
    defineLinearGradient: () => {},
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

function makeSeries(pts: { x: number; y: number }[]) {
  return {
    id: 's1', name: 'Line', type: 'line',
    data: pts,
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: p.x, yNum: p.y })),
  } as any;
}

describe('renderLineSeries', () => {
  it('is a function', () => {
    expect(typeof renderLineSeries).toBe('function');
  });

  it('returns without drawing when no x/y scales', () => {
    const r = makeMockRenderer();
    const noScaleState = { ...makeState(), scales: new Map() } as unknown as ChartState;
    renderLineSeries(r as unknown as BaseRenderer, makeSeries([{ x: 1, y: 2 }]), noScaleState, defaultTheme as ThemeConfig, '#6366f1');
    expect(r.paths).toBe(0);
  });

  it('returns without drawing on empty processedData', () => {
    const r = makeMockRenderer();
    renderLineSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.paths).toBe(0);
  });

  it('draws one path for the line', () => {
    const r = makeMockRenderer();
    renderLineSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.paths).toBe(1);
  });

  it('draws a circle marker per data point by default', () => {
    const r = makeMockRenderer();
    renderLineSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }]), makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.circles).toBe(3);
  });

  it('draws no markers when marker.enabled is false', () => {
    const r = makeMockRenderer();
    const s = { ...makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }]), marker: { enabled: false } };
    renderLineSeries(r as unknown as BaseRenderer, s, makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.circles).toBe(0);
  });

  it('handles a single data point without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderLineSeries(r as unknown as BaseRenderer, makeSeries([{ x: 5, y: 5 }]), makeState(), defaultTheme as ThemeConfig, '#6366f1')).not.toThrow();
  });
});
