// ============================================================================
// BellCurveChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderBellCurve } from '../../src/charts/BellCurveChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, lines = 0, texts = 0, rects = 0, groups = 0;
  return {
    get paths() { return paths; },
    get lines() { return lines; },
    get texts() { return texts; },
    get rects() { return rects; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawPath: () => { paths++; },
    drawLine: () => { lines++; },
    drawText: () => { texts++; },
    drawRect: () => { rects++; },
    beginGroup: (_id: string) => { groups++; },
    endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales: {}, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

// Series with raw data (stats will be computed)
function makeSeries(values: number[]) {
  return {
    id: 's1', name: 'Data', type: 'bellcurve',
    processedData: values.map(v => ({ yNum: v })),
    data: values.map(v => ({ y: v })),
  };
}

const normalData = [45, 52, 55, 58, 60, 62, 63, 65, 67, 70, 73, 78];

describe('renderBellCurve', () => {
  it('is a function', () => {
    expect(typeof renderBellCurve).toBe('function');
  });

  it('does nothing with empty series', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBe(0);
  });

  it('draws fill + curve path (2 paths) by default', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [makeSeries(normalData)] as any, makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBe(2); // fill + curve
  });

  it('draws only curve when fill=false', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [makeSeries(normalData)] as any, makeState(), defaultTheme as ThemeConfig, {
      bellCurve: { fill: false },
    } as any);
    expect(r.paths).toBe(1); // only curve
  });

  it('uses explicit mean and stdDev', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [makeSeries([])] as any, makeState(), defaultTheme as ThemeConfig, {
      bellCurve: { mean: 50, stdDev: 10 },
    } as any);
    expect(r.paths).toBeGreaterThan(0);
  });

  it('draws annotation lines (μ and ±σ) when showAnnotations=true', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [makeSeries(normalData)] as any, makeState(), defaultTheme as ThemeConfig, {
      bellCurve: { showAnnotations: true },
    } as any);
    // μ line + 2 σ lines + 2 ×2σ lines = 5 lines
    expect(r.lines).toBe(5);
    // μ text label
    expect(r.texts).toBeGreaterThan(0);
  });

  it('draws sigma band when fillSigmaBand=true', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [makeSeries(normalData)] as any, makeState(), defaultTheme as ThemeConfig, {
      bellCurve: { fillSigmaBand: true },
    } as any);
    // fill + sigmaband + curve = 3 paths
    expect(r.paths).toBe(3);
  });

  it('renders histogram when showHistogram=true', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [makeSeries(normalData)] as any, makeState(), defaultTheme as ThemeConfig, {
      bellCurve: { showHistogram: true },
    } as any);
    expect(r.rects).toBeGreaterThan(0); // histogram bars
  });

  it('handles two series independently', () => {
    const r = makeMockRenderer();
    renderBellCurve(r as unknown as BaseRenderer, [
      makeSeries(normalData) as any,
      makeSeries(normalData.map(v => v + 20)) as any,
    ], makeState(), defaultTheme as ThemeConfig);
    // 2 series × 2 paths each
    expect(r.paths).toBe(4);
  });
});
