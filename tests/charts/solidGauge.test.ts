// ============================================================================
// SolidGaugeChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderSolidGauge } from '../../src/charts/SolidGaugeChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, texts = 0, groups = 0;
  return {
    get paths() { return paths; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawRect: () => {}, drawCircle: () => {}, drawArc: () => {},
    drawPolygon: () => {},
    drawPath: () => { paths++; },
    drawText: () => { texts++; },
    beginGroup: (_id: string) => { groups++; },
    endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 400, height: 400 },
    width: 400, height: 400, pixelRatio: 1,
    series: [], scales: {}, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

const sgSeries = [
  { id: 's1', name: 'Speed', type: 'solidGauge',
    data: [{ y: 72 }], processedData: [{ yNum: 72 }] },
] as any;

describe('renderSolidGauge', () => {
  it('is a function', () => {
    expect(typeof renderSolidGauge).toBe('function');
  });

  it('draws track + filled arc (2 paths) per series', () => {
    const r = makeMockRenderer();
    renderSolidGauge(r as unknown as BaseRenderer, sgSeries, makeState(), defaultTheme as ThemeConfig);
    // 1 track + 1 fill = 2 paths for one series
    expect(r.paths).toBe(2);
  });

  it('draws value label by default', () => {
    const r = makeMockRenderer();
    renderSolidGauge(r as unknown as BaseRenderer, sgSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.texts).toBeGreaterThan(0);
  });

  it('uses beginGroup/endGroup', () => {
    const r = makeMockRenderer();
    renderSolidGauge(r as unknown as BaseRenderer, sgSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });

  it('draws 4 paths for two series (2 per series)', () => {
    const twoSeries = [
      { id: 's1', name: 'A', processedData: [{ yNum: 60 }] },
      { id: 's2', name: 'B', processedData: [{ yNum: 80 }] },
    ] as any;
    const r = makeMockRenderer();
    renderSolidGauge(r as unknown as BaseRenderer, twoSeries, makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBe(4);
  });

  it('clamps values to [min, max]', () => {
    const outSeries = [{ id: 's1', processedData: [{ yNum: 200 }] }] as any;
    const r = makeMockRenderer();
    expect(() => renderSolidGauge(
      r as unknown as BaseRenderer, outSeries, makeState(), defaultTheme as ThemeConfig,
      { solidGauge: { min: 0, max: 100 } } as any,
    )).not.toThrow();
  });

  it('hides value label when showValue=false (name label still shows)', () => {
    const r = makeMockRenderer();
    renderSolidGauge(r as unknown as BaseRenderer, sgSeries, makeState(), defaultTheme as ThemeConfig, {
      solidGauge: { showValue: false },
    } as any);
    // Series name "Speed" still draws 1 text label (showName=true by default)
    expect(r.texts).toBe(1);
  });

  it('respects custom arc angles', () => {
    const r = makeMockRenderer();
    expect(() => renderSolidGauge(
      r as unknown as BaseRenderer, sgSeries, makeState(), defaultTheme as ThemeConfig,
      { solidGauge: { startAngleDeg: -90, endAngleDeg: 90 } } as any,
    )).not.toThrow();
    expect(r.paths).toBe(2);
  });

  it('uses full-circle defaults for progressRing', () => {
    const r = makeMockRenderer();
    const ringSeries = [{ id: 'p1', name: 'Completion', type: 'progressRing', processedData: [{ yNum: 64 }] }] as any;
    renderSolidGauge(r as unknown as BaseRenderer, ringSeries, makeState(), defaultTheme as ThemeConfig, {} as any);
    expect(r.paths).toBe(2);
    expect(r.texts).toBe(1);
  });

  it('uses multi-band defaults for radialBar', () => {
    const r = makeMockRenderer();
    const radialSeries = [
      { id: 'r1', name: 'North', type: 'radialBar', processedData: [{ yNum: 48 }] },
      { id: 'r2', name: 'South', type: 'radialBar', processedData: [{ yNum: 71 }] },
    ] as any;
    renderSolidGauge(r as unknown as BaseRenderer, radialSeries, makeState(), defaultTheme as ThemeConfig, {} as any);
    expect(r.paths).toBe(4);
    expect(r.texts).toBe(2);
  });
});
