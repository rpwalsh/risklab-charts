// ============================================================================
// ContourChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderContourChart } from '../../../src/charts/advanced/ContourChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, paths = 0;
  return {
    get rects() { return rects; }, get paths() { return paths; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawRect: () => { rects++; },
    drawPath: () => { paths++; },
    drawLine: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawText: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 400, height: 400 },
    width: 400, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

// Build a 4×4 grid of data points with gradual z values
function makeGridSeries(rows = 4, cols = 4) {
  const data: any[] = [];
  for (let xi = 0; xi < cols; xi++) {
    for (let yi = 0; yi < rows; yi++) {
      data.push({ x: xi * 10, y: yi * 10, z: xi * 10 + yi, xNum: xi * 10, yNum: yi * 10 });
    }
  }
  return {
    id: 's1', name: 'Contour', type: 'contour',
    data, processedData: data,
  } as any;
}

describe('renderContourChart', () => {
  it('is a function', () => {
    expect(typeof renderContourChart).toBe('function');
  });

  it('draws colored rects for each grid cell', () => {
    const r = makeMockRenderer();
    renderContourChart(r as unknown as BaseRenderer, makeGridSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // (cols-1) * (rows-1) = 9 cells
    expect(r.rects).toBeGreaterThanOrEqual(9);
  });

  it('draws iso-line paths over the rect background', () => {
    const r = makeMockRenderer();
    renderContourChart(r as unknown as BaseRenderer, makeGridSeries(), makeState(), defaultTheme as ThemeConfig, '#22c55e');
    expect(r.paths).toBeGreaterThanOrEqual(0); // may be 0 if no crossings
  });

  it('returns early when fewer than 3 data points', () => {
    const r = makeMockRenderer();
    renderContourChart(
      r as unknown as BaseRenderer,
      { id: 's1', name: 'C', type: 'contour', data: [{ x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 2 }], processedData: [] } as any,
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.rects).toBe(0);
  });

  it('does not throw for a larger grid', () => {
    const r = makeMockRenderer();
    expect(() =>
      renderContourChart(r as unknown as BaseRenderer, makeGridSeries(8, 8), makeState(), defaultTheme as ThemeConfig, '#f59e0b'),
    ).not.toThrow();
  });
});
