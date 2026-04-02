// ============================================================================
// LollipopChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderLollipopChart } from '../../src/charts/LollipopChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 6, bandwidth: 60 };
}

function makeMockRenderer() {
  let lines = 0, circles = 0, groups = 0;
  return {
    get lines() { return lines; },
    get circles() { return circles; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawText: () => {}, drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawLine: () => { lines++; },
    drawCircle: () => { circles++; },
    beginGroup: (_id: string) => { groups++; },
    endGroup: () => {},
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
    id: 's1', name: 'Lollipop', type: 'lollipop',
    data: pts.map(p => ({ x: p.x, y: p.y })),
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: p.x, yNum: p.y })),
    ...extra,
  } as any;
}

describe('renderLollipopChart', () => {
  it('is a function', () => {
    expect(typeof renderLollipopChart).toBe('function');
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    renderLollipopChart(r as unknown as BaseRenderer, [makeSeries([{ x: 1, y: 5 }])], { ...makeState(), scales: new Map() } as unknown as ChartState, {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.circles).toBe(0);
  });

  it('draws one stem line and one circle per data point', () => {
    const r = makeMockRenderer();
    renderLollipopChart(r as unknown as BaseRenderer, [makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.lines).toBe(3); // one stem per point
    expect(r.circles).toBe(3); // one dot per point
  });

  it('uses beginGroup', () => {
    const r = makeMockRenderer();
    renderLollipopChart(r as unknown as BaseRenderer, [makeSeries([{ x: 0, y: 5 }])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });

  it('draws horizontal lollipops when horizontal=true', () => {
    const r = makeMockRenderer();
    renderLollipopChart(r as unknown as BaseRenderer, [makeSeries([{ x: 0, y: 10 }, { x: 1, y: 20 }])], makeState(), { lollipop: { horizontal: true } } as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.lines).toBe(2);
    expect(r.circles).toBe(2);
  });

  it('skips invisible series', () => {
    const r = makeMockRenderer();
    renderLollipopChart(r as unknown as BaseRenderer, [makeSeries([{ x: 0, y: 10 }], { visible: false })], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.circles).toBe(0);
  });

  it('handles empty series array without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderLollipopChart(r as unknown as BaseRenderer, [], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig)).not.toThrow();
  });
});
