// ============================================================================
// PolarChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderPolarChart } from '../../../src/charts/advanced/PolarChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, lines = 0, paths = 0, texts = 0;
  return {
    get circles() { return circles; }, get lines() { return lines; },
    get paths()   { return paths;   }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => { circles++; },
    drawLine:   () => { lines++;   },
    drawPath:   () => { paths++;   },
    drawText:   () => { texts++;   },
    drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 500, height: 500 },
    width: 500, height: 500, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(values: number[], labels?: string[]) {
  return {
    id: 's1', name: 'Polar', type: 'polar',
    data: values.map((v, i) => ({ x: i, y: v, label: labels?.[i] ?? `Item ${i}` })),
    processedData: [],
  } as any;
}

describe('renderPolarChart', () => {
  it('is a function', () => {
    expect(typeof renderPolarChart).toBe('function');
  });

  it('draws 4 grid ring circles', () => {
    const r = makeMockRenderer();
    renderPolarChart(r as unknown as BaseRenderer, makeSeries([10, 20, 30]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.circles).toBe(4);
  });

  it('draws one spoke line per data point', () => {
    const r = makeMockRenderer();
    const n = 5;
    renderPolarChart(r as unknown as BaseRenderer, makeSeries(Array(n).fill(10)), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.lines).toBe(n);
  });

  it('draws one sector path per data point', () => {
    const r = makeMockRenderer();
    const n = 6;
    renderPolarChart(r as unknown as BaseRenderer, makeSeries(Array(n).fill(10)), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.paths).toBe(n);
  });

  it('draws label texts for each data point', () => {
    const r = makeMockRenderer();
    const n = 4;
    renderPolarChart(r as unknown as BaseRenderer, makeSeries(Array(n).fill(10)), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.texts).toBe(n);
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderPolarChart(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0);
    expect(r.paths).toBe(0);
  });
});
