// ============================================================================
// TimelineChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderTimelineChart } from '../../src/charts/TimelineChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return {
    convert: (v: number) => v / 1000,
    bandwidth: 60,
    ticks: (n = 5) => Array.from({ length: n }, (_, i) => i * 100000),
  };
}

function makeMockRenderer() {
  let rects = 0, paths = 0, lines = 0, texts = 0, groups = 0;
  return {
    get rects() { return rects; },
    get paths() { return paths; },
    get lines() { return lines; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    drawPath: () => { paths++; },
    drawLine: () => { lines++; },
    drawText: () => { texts++; },
    beginGroup: () => { groups++; },
    endGroup: () => {},
    defineClipRect: () => {},
  };
}

function makeState(): ChartState {
  const scales = new Map();
  scales.set('x0', makeMockScale());
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 400 },
    width: 800, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
    hoveredPoint: null, selectedPoints: [],
  } as unknown as ChartState;
}

const t0 = 0;
const t1 = 100000;
const t2 = 200000;
const t3 = 300000;

function makeSeries(id: string, name: string, events: Array<{ x: number; x2?: number; label?: string }>, extra: Record<string, unknown> = {}) {
  return {
    id, name, type: 'timeline',
    data: events.map(e => ({ x: e.x, x2: e.x2, y: 0, label: e.label })),
    processedData: events.map(e => ({ x: e.x, x2: e.x2, xNum: e.x, yNum: 0, label: e.label })),
    ...extra,
  } as any;
}

describe('renderTimelineChart', () => {
  it('is a function', () => {
    expect(typeof renderTimelineChart).toBe('function');
  });

  it('returns without drawing when no x scale', () => {
    const r = makeMockRenderer();
    renderTimelineChart(r as unknown as BaseRenderer, [makeSeries('s1', 'Lane 1', [{ x: t0, x2: t1 }])], { ...makeState(), scales: new Map() } as unknown as ChartState, {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('returns without drawing on empty visible series', () => {
    const r = makeMockRenderer();
    renderTimelineChart(r as unknown as BaseRenderer, [makeSeries('s1', 'Hidden', [{ x: t0, x2: t1 }], { visible: false })], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws lane backgrounds (one per lane)', () => {
    const r = makeMockRenderer();
    renderTimelineChart(r as unknown as BaseRenderer, [
      makeSeries('s1', 'Lane A', [{ x: t0, x2: t1 }]),
      makeSeries('s2', 'Lane B', [{ x: t1, x2: t2 }]),
    ], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    // 2 lane backgrounds + event rects
    expect(r.rects).toBeGreaterThanOrEqual(2);
  });

  it('draws event bars for data points with x2', () => {
    const r = makeMockRenderer();
    renderTimelineChart(r as unknown as BaseRenderer, [
      makeSeries('s1', 'Lane A', [{ x: t0, x2: t1, label: 'Event 1' }, { x: t2, x2: t3, label: 'Event 2' }]),
    ], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    // 1 lane background + 2 event bars
    expect(r.rects).toBeGreaterThanOrEqual(3);
  });

  it('draws lane labels', () => {
    const r = makeMockRenderer();
    renderTimelineChart(r as unknown as BaseRenderer, [
      makeSeries('s1', 'Engineering', [{ x: t0, x2: t1 }]),
      makeSeries('s2', 'Design', [{ x: t0, x2: t1 }]),
    ], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.texts).toBeGreaterThanOrEqual(2);
  });

  it('uses beginGroup', () => {
    const r = makeMockRenderer();
    renderTimelineChart(r as unknown as BaseRenderer, [makeSeries('s1', 'Lane', [{ x: t0, x2: t1 }])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
