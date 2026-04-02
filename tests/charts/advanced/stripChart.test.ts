// ============================================================================
// StripChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderStripChart } from '../../../src/charts/advanced/StripChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, paths = 0, texts = 0;
  return {
    get circles() { return circles; }, get paths() { return paths; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => { circles++; },
    drawPath:   () => { paths++;   },
    drawText:   () => { texts++;   },
    drawLine: () => {}, drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeScale(factor = 1) {
  return { convert: (v: any) => Number(v) * factor, bandwidth: 40, ticks: () => [] };
}

function makeState(withScales = false): ChartState {
  const scales = withScales
    ? new Map<string, any>([['x0', makeScale()], ['y0', makeScale(10)]])
    : new Map<string, any>();
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(values: number[]) {
  return {
    id: 's1', name: 'Strip',
    xAxisId: 'x0', yAxisId: 'y0',
    data: values.map((v, i) => ({ x: i, y: v })),
    processedData: [],
  } as any;
}

describe('renderStripChart', () => {
  it('is a function', () => {
    expect(typeof renderStripChart).toBe('function');
  });

  it('draws jittered circles when scales are present (categorical mode)', () => {
    const r = makeMockRenderer();
    renderStripChart(r as unknown as BaseRenderer, makeSeries([1, 2, 3, 4]), makeState(true), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.circles).toBe(4);
  });

  it('draws a line path fallback when no scales (rolling mode)', () => {
    const r = makeMockRenderer();
    renderStripChart(r as unknown as BaseRenderer, makeSeries([1, 2, 3, 4, 5]), makeState(false), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.paths).toBe(1);
  });

  it('draws channel label in categorical mode', () => {
    const r = makeMockRenderer();
    renderStripChart(r as unknown as BaseRenderer, makeSeries([1, 2, 3]), makeState(true), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.texts).toBeGreaterThanOrEqual(1);
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderStripChart(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.circles + r.paths).toBe(0);
  });
});
