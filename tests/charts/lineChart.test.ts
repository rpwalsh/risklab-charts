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
  const pathValues: string[] = [];
  const linePointSets: Array<Array<{ x: number; y: number }>> = [];
  const smoothFlags: boolean[] = [];
  return {
    get paths() { return paths; },
    get circles() { return circles; },
    get pathValues() { return pathValues; },
    get linePointSets() { return linePointSets; },
    get smoothFlags() { return smoothFlags; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawText: () => {}, drawRect: () => {}, drawArc: () => {},
    drawPolygon: () => {}, drawPath: (d: string) => { paths++; pathValues.push(d); },
    drawCircle: () => { circles++; },
    beginGroup: () => {}, endGroup: () => {},
    buildLinePath: (pts: Array<{ x: number; y: number }>, smooth = false) => {
      linePointSets.push(pts);
      smoothFlags.push(smooth);
      return pts.map((pt, index) => `${index === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join('');
    },
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

  it('renders stepLine with horizontal-then-vertical segments', () => {
    const r = makeMockRenderer();
    const stepSeries = { ...makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }]), type: 'stepLine' };
    renderLineSeries(r as unknown as BaseRenderer, stepSeries as any, makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.pathValues[0]).toBe('M0,60L6,60L6,120');
    expect(r.linePointSets).toHaveLength(0);
  });

  it('keeps connectedScatter in author-provided point order', () => {
    const r = makeMockRenderer();
    const scatterSeries = {
      ...makeSeries([{ x: 2, y: 15 }, { x: 0, y: 10 }, { x: 1, y: 20 }]),
      type: 'connectedScatter',
      processedData: [
        { x: 0, y: 10, xNum: 0, yNum: 10 },
        { x: 1, y: 20, xNum: 1, yNum: 20 },
        { x: 2, y: 15, xNum: 2, yNum: 15 },
      ],
    };
    renderLineSeries(r as unknown as BaseRenderer, scatterSeries as any, makeState(), defaultTheme as ThemeConfig, '#6366f1');
    expect(r.linePointSets[0]?.map((point) => point.x)).toEqual([12, 0, 6]);
    expect(r.smoothFlags[0]).toBe(false);
  });
});
