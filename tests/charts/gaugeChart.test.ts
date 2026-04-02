// ============================================================================
// GaugeChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderGaugeSeries } from '../../src/charts/GaugeChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let arcs = 0, circles = 0, polygons = 0, texts = 0;
  return {
    get arcs() { return arcs; },
    get circles() { return circles; },
    get polygons() { return polygons; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawRect: () => {},
    drawArc: () => { arcs++; },
    drawCircle: () => { circles++; },
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

function makeSeries(value: number) {
  return {
    id: 's1', name: 'Gauge', type: 'gauge',
    data: [{ y: value }],
    processedData: [{ y: value, yNum: value }],
  } as any;
}

const gaugeConfig: ChartConfig = { gauge: { min: 0, max: 100 } } as ChartConfig;

describe('renderGaugeSeries', () => {
  it('is a function', () => {
    expect(typeof renderGaugeSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderGaugeSeries(r as unknown as BaseRenderer, { ...makeSeries(0), data: [], processedData: [] }, makeState(), defaultTheme as ThemeConfig, gaugeConfig);
    expect(r.arcs).toBe(0);
  });

  it('draws background arc + value arc (at least 2 arcs)', () => {
    const r = makeMockRenderer();
    renderGaugeSeries(r as unknown as BaseRenderer, makeSeries(50), makeState(), defaultTheme as ThemeConfig, gaugeConfig);
    expect(r.arcs).toBeGreaterThanOrEqual(2);
  });

  it('draws the needle polygon and center circle', () => {
    const r = makeMockRenderer();
    renderGaugeSeries(r as unknown as BaseRenderer, makeSeries(50), makeState(), defaultTheme as ThemeConfig, gaugeConfig);
    expect(r.polygons).toBe(1);
    expect(r.circles).toBe(1);
  });

  it('draws value text by default', () => {
    const r = makeMockRenderer();
    renderGaugeSeries(r as unknown as BaseRenderer, makeSeries(75), makeState(), defaultTheme as ThemeConfig, gaugeConfig);
    // value text + min label + max label
    expect(r.texts).toBeGreaterThanOrEqual(3);
  });

  it('hides value text when showValue=false', () => {
    const r = makeMockRenderer();
    const cfg = { gauge: { min: 0, max: 100, showValue: false } } as ChartConfig;
    renderGaugeSeries(r as unknown as BaseRenderer, makeSeries(75), makeState(), defaultTheme as ThemeConfig, cfg);
    // only min + max labels (no value)
    expect(r.texts).toBe(2);
  });

  it('draws colored bands when provided', () => {
    const r = makeMockRenderer();
    const cfg: ChartConfig = {
      gauge: {
        min: 0, max: 100,
        bands: [
          { from: 0, to: 33, color: '#10B981' },
          { from: 33, to: 66, color: '#F59E0B' },
          { from: 66, to: 100, color: '#EF4444' },
        ],
      },
    } as unknown as ChartConfig;
    renderGaugeSeries(r as unknown as BaseRenderer, makeSeries(50), makeState(), defaultTheme as ThemeConfig, cfg);
    // background + 3 bands + value arc = at least 5 arcs
    expect(r.arcs).toBeGreaterThanOrEqual(5);
  });

  it('clamps value to [min, max] without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderGaugeSeries(r as unknown as BaseRenderer, makeSeries(200), makeState(), defaultTheme as ThemeConfig, gaugeConfig)).not.toThrow();
  });
});
