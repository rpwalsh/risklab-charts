// ============================================================================
// OHLCChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderOHLCChart } from '../../src/charts/OHLCChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 4, bandwidth: 10 };
}

function makeMockRenderer() {
  let lines = 0, groups = 0;
  return {
    get lines() { return lines; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawText: () => {}, drawRect: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawLine: () => { lines++; },
    beginGroup: () => { groups++; },
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

function makeSeries(pts: Array<{ x: number; open: number; high: number; low: number; close: number }>, extra: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'OHLC', type: 'ohlc',
    data: pts.map(p => ({ x: p.x, open: p.open, high: p.high, low: p.low, close: p.close })),
    processedData: pts.map(p => ({ x: p.x, xNum: p.x, yNum: p.close, open: p.open, high: p.high, low: p.low, close: p.close })),
    ...extra,
  } as any;
}

const bar1 = { x: 1, open: 10, high: 20, low: 8, close: 18 };  // bullish
const bar2 = { x: 2, open: 18, high: 22, low: 7, close: 9 };   // bearish

describe('renderOHLCChart', () => {
  it('is a function', () => {
    expect(typeof renderOHLCChart).toBe('function');
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    renderOHLCChart(r as unknown as BaseRenderer, [makeSeries([bar1])], { ...makeState(), scales: new Map() } as unknown as ChartState, {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.lines).toBe(0);
  });

  it('draws 3 lines per bar (HL + open tick + close tick)', () => {
    const r = makeMockRenderer();
    renderOHLCChart(r as unknown as BaseRenderer, [makeSeries([bar1, bar2])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.lines).toBe(6); // 3 per bar × 2 bars
  });

  it('handles empty series without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderOHLCChart(r as unknown as BaseRenderer, [makeSeries([])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig)).not.toThrow();
    expect(r.lines).toBe(0);
  });

  it('skips invisible series', () => {
    const r = makeMockRenderer();
    renderOHLCChart(r as unknown as BaseRenderer, [makeSeries([bar1], { visible: false })], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.lines).toBe(0);
  });

  it('handles multiple series', () => {
    const r = makeMockRenderer();
    renderOHLCChart(r as unknown as BaseRenderer, [makeSeries([bar1]), makeSeries([bar2])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.lines).toBe(6); // 3 per bar × 2 series with 1 bar each
  });

  it('uses beginGroup', () => {
    const r = makeMockRenderer();
    renderOHLCChart(r as unknown as BaseRenderer, [makeSeries([bar1])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
