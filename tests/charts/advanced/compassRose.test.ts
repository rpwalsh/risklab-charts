// ============================================================================
// CompassRose — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderCompassRose } from '../../../src/charts/advanced/CompassRose';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, lines = 0, texts = 0, paths = 0, rects = 0;
  return {
    get circles() { return circles; }, get lines() { return lines; },
    get texts()   { return texts;   }, get paths() { return paths; }, get rects() { return rects; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => { circles++; },
    drawLine:   () => { lines++;   },
    drawText:   () => { texts++;   },
    drawPath:   () => { paths++;   },
    drawRect:   () => { rects++;   },
    drawArc: () => {}, drawPolygon: () => {},
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

function makeSeries(heading = 0, waypoints: number[] = []) {
  return {
    id: 's1', name: 'Heading', type: 'compass',
    data: [
      { x: 0, y: heading },
      ...waypoints.map((w, i) => ({ x: i + 1, y: w, label: `WP${i + 1}` })),
    ],
    processedData: [],
  } as any;
}

describe('renderCompassRose', () => {
  it('is a function', () => {
    expect(typeof renderCompassRose).toBe('function');
  });

  it('draws at least 2 circles (outer + inner bezel)', () => {
    const r = makeMockRenderer();
    renderCompassRose(r as unknown as BaseRenderer, makeSeries(0), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBeGreaterThanOrEqual(2);
  });

  it('draws tick marks as lines', () => {
    const r = makeMockRenderer();
    renderCompassRose(r as unknown as BaseRenderer, makeSeries(0), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.lines).toBeGreaterThan(0);
  });

  it('draws cardinal direction text labels', () => {
    const r = makeMockRenderer();
    renderCompassRose(r as unknown as BaseRenderer, makeSeries(0), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // 8 cardinals + numeric labels
    expect(r.texts).toBeGreaterThanOrEqual(8);
  });

  it('draws heading bug as a triangle path', () => {
    const r = makeMockRenderer();
    renderCompassRose(r as unknown as BaseRenderer, makeSeries(180), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });

  it('draws waypoint markers when waypoints are provided', () => {
    const r = makeMockRenderer();
    const pathsBefore = 0;
    renderCompassRose(r as unknown as BaseRenderer, makeSeries(0, [45, 225]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // heading bug + 2 waypoint markers = ≥3 paths
    expect(r.paths).toBeGreaterThan(pathsBefore + 2);
  });

  it('draws the heading readout rect and text', () => {
    const r = makeMockRenderer();
    renderCompassRose(r as unknown as BaseRenderer, makeSeries(90), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.rects).toBeGreaterThanOrEqual(1);
    expect(r.texts).toBeGreaterThan(0);
  });
});
