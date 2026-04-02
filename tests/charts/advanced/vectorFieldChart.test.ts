// ============================================================================
// VectorFieldChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderVectorFieldChart } from '../../../src/charts/advanced/VectorFieldChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let lines = 0, paths = 0;
  return {
    get lines() { return lines; }, get paths() { return paths; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => { lines++; },
    drawPath: () => { paths++; },
    drawRect: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawText: () => {},
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

function makeVector(x: number, y: number, angle: number, magnitude: number) {
  return { x, y, meta: { angle, magnitude } };
}

function makeSeries(vectors: ReturnType<typeof makeVector>[]) {
  return {
    id: 's1', name: 'VF', type: 'vectorfield',
    data: vectors,
    processedData: [],
  } as any;
}

describe('renderVectorFieldChart', () => {
  it('is a function', () => {
    expect(typeof renderVectorFieldChart).toBe('function');
  });

  it('draws one shaft line and one arrowhead path per vector', () => {
    const r = makeMockRenderer();
    const n = 4;
    const vecs = Array.from({ length: n }, (_, i) => makeVector(i * 10, i * 10, Math.PI / 4, 1));
    renderVectorFieldChart(r as unknown as BaseRenderer, makeSeries(vecs), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.lines).toBe(n);
    expect(r.paths).toBe(n); // arrowheads
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderVectorFieldChart(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.lines).toBe(0);
  });

  it('handles zero magnitude vectors (draws very short/zero length arrows)', () => {
    const r = makeMockRenderer();
    renderVectorFieldChart(
      r as unknown as BaseRenderer,
      makeSeries([makeVector(0, 0, 0, 0), makeVector(10, 10, 0, 0)]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.lines).toBe(2);
  });

  it('handles varied angles without throwing', () => {
    const r = makeMockRenderer();
    const angles = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2, Math.PI, -Math.PI / 2];
    const vecs = angles.map((a, i) => makeVector(i * 20, i * 20, a, 0.5));
    expect(() =>
      renderVectorFieldChart(r as unknown as BaseRenderer, makeSeries(vecs), makeState(), defaultTheme as ThemeConfig, '#4f46e5'),
    ).not.toThrow();
  });
});
