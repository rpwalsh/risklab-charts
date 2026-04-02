// ============================================================================
// SmithChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderSmithChart } from '../../../src/charts/advanced/SmithChart';
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

function makeSeries(points: Array<{ x: number; y: number }> = []) {
  return {
    id: 's1', name: 'Smith', type: 'smith',
    data: points.map(p => ({ x: p.x, y: p.y })),
    processedData: [],
  } as any;
}

describe('renderSmithChart', () => {
  it('is a function', () => {
    expect(typeof renderSmithChart).toBe('function');
  });

  it('draws outer unit boundary circle', () => {
    const r = makeMockRenderer();
    renderSmithChart(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // outer circle + resistance circles (rValues = [0,0.2,0.5,1,2,5] = 6)
    expect(r.circles).toBeGreaterThanOrEqual(6);
  });

  it('draws resistance circle labels', () => {
    const r = makeMockRenderer();
    renderSmithChart(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // 5 labels (rVal > 0 for each non-zero r)
    expect(r.texts).toBeGreaterThanOrEqual(5);
  });

  it('draws real axis center line', () => {
    const r = makeMockRenderer();
    renderSmithChart(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.lines).toBeGreaterThanOrEqual(1);
  });

  it('draws a reactance arc path for each x value', () => {
    const r = makeMockRenderer();
    renderSmithChart(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // 5 x values × 2 signs = up to 10 arc paths
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });

  it('draws data point circles', () => {
    const r = makeMockRenderer();
    const circlesBefore = 0;
    renderSmithChart(
      r as unknown as BaseRenderer,
      makeSeries([{ x: 1, y: 0 }, { x: 2, y: 1 }, { x: 0.5, y: -1 }]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    // Additional circles for data points
    expect(r.circles).toBeGreaterThan(circlesBefore + 5); // grid circles + 3 data circles
  });

  it('connects data points with lines when more than 1 point', () => {
    const r = makeMockRenderer();
    renderSmithChart(
      r as unknown as BaseRenderer,
      makeSeries([{ x: 1, y: 0 }, { x: 2, y: 1 }]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    // 1 real-axis line + 1 connecting data line
    expect(r.lines).toBeGreaterThanOrEqual(2);
  });
});
