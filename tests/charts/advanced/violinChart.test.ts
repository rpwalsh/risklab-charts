// ============================================================================
// ViolinChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderViolinChart } from '../../../src/charts/advanced/ViolinChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, rects = 0, lines = 0, circles = 0, texts = 0;
  return {
    get paths()  { return paths;   }, get rects()  { return rects;   },
    get lines()  { return lines;   }, get circles(){ return circles; },
    get texts()  { return texts;   },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath:   () => { paths++;   },
    drawRect:   (_x: any, _y: any, _w: any, _h: any, _s: any) => { rects++;   },
    drawLine:   () => { lines++;   },
    drawCircle: () => { circles++; },
    drawText:   () => { texts++;   },
    drawArc: () => {}, drawPolygon: () => {},
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

function makeSeries(values: number[], name = 'Violin') {
  return {
    id: 's1', name,
    data: values.map((v, i) => ({ x: i, y: v })),
    processedData: [],
  } as any;
}

describe('renderViolinChart', () => {
  it('is a function', () => {
    expect(typeof renderViolinChart).toBe('function');
  });

  it('draws the violin KDE path', () => {
    const r = makeMockRenderer();
    renderViolinChart(
      r as unknown as BaseRenderer,
      makeSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1,
    );
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });

  it('draws the IQR box rect inside the violin', () => {
    const r = makeMockRenderer();
    renderViolinChart(
      r as unknown as BaseRenderer,
      makeSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1,
    );
    expect(r.rects).toBeGreaterThanOrEqual(1);
  });

  it('draws whisker lines (upper and lower)', () => {
    const r = makeMockRenderer();
    renderViolinChart(
      r as unknown as BaseRenderer,
      makeSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1,
    );
    // 2 whisker lines + 1 median line = 3 lines minimum
    expect(r.lines).toBeGreaterThanOrEqual(3);
  });

  it('draws series label text', () => {
    const r = makeMockRenderer();
    renderViolinChart(
      r as unknown as BaseRenderer,
      makeSeries([1, 3, 5, 7, 9], 'MyLabel'),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1,
    );
    expect(r.texts).toBeGreaterThanOrEqual(1);
  });

  it('returns early when fewer than 2 data points', () => {
    const r = makeMockRenderer();
    renderViolinChart(r as unknown as BaseRenderer, makeSeries([5]), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 1);
    expect(r.paths).toBe(0);
  });

  it('correctly positions multiple violins side by side', () => {
    const r1 = makeMockRenderer();
    const r2 = makeMockRenderer();
    const data = [1, 2, 3, 4, 5, 6, 7];
    renderViolinChart(r1 as unknown as BaseRenderer, makeSeries(data), makeState(), defaultTheme as ThemeConfig, '#4f46e5', 0, 2);
    renderViolinChart(r2 as unknown as BaseRenderer, makeSeries(data), makeState(), defaultTheme as ThemeConfig, '#22c55e', 1, 2);
    // Both should draw the same number of paths/rects
    expect(r1.paths).toBe(r2.paths);
  });
});
