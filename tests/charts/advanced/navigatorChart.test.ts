// ============================================================================
// NavigatorChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  renderNavigatorChart,
  getNavigatorBounds,
  hitTestNavigator,
  startNavigatorDrag,
  updateNavigatorDrag,
  stopNavigatorDrag,
} from '../../../src/charts/advanced/NavigatorChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, paths = 0, lines = 0;
  return {
    get rects() { return rects; }, get paths() { return paths; }, get lines() { return lines; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawRect: () => { rects++; },
    drawPath: () => { paths++; },
    drawLine: () => { lines++; },
    drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawText: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 40, y: 40, width: 720, height: 400 },
    width: 800, height: 500, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeConfig() {
  return { container: document.createElement('div') } as unknown as ChartConfig;
}

function makeSeries() {
  return [{
    id: 's1', name: 'Main', visible: true,
    data: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }],
    processedData: [
      { x: 0, y: 10, xNum: 0, yNum: 10 },
      { x: 1, y: 20, xNum: 1, yNum: 20 },
      { x: 2, y: 15, xNum: 2, yNum: 15 },
    ],
  }] as any[];
}

describe('renderNavigatorChart', () => {
  it('is a function', () => {
    expect(typeof renderNavigatorChart).toBe('function');
  });

  it('skips rendering when enabled=false', () => {
    const r = makeMockRenderer();
    renderNavigatorChart(r as unknown as BaseRenderer, makeSeries(), makeState(), makeConfig(), defaultTheme as ThemeConfig, { enabled: false });
    expect(r.rects).toBe(0);
  });

  it('draws the background rect + handle rects', () => {
    const r = makeMockRenderer();
    renderNavigatorChart(r as unknown as BaseRenderer, makeSeries(), makeState(), makeConfig(), defaultTheme as ThemeConfig, { enabled: true });
    expect(r.rects).toBeGreaterThanOrEqual(1);
  });

  it('draws mini series paths when showSeries=true', () => {
    const r = makeMockRenderer();
    renderNavigatorChart(r as unknown as BaseRenderer, makeSeries(), makeState(), makeConfig(), defaultTheme as ThemeConfig, { enabled: true, showSeries: true });
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });
});

describe('getNavigatorBounds', () => {
  it('returns expected bounds from state', () => {
    const bounds = getNavigatorBounds(makeState(), { height: 60, margin: 20 });
    expect(bounds.navH).toBe(60);
    expect(bounds.navX).toBe(40);
    expect(bounds.navW).toBe(720);
    expect(bounds.navY).toBe(40 + 400 + 20); // chartArea.y + chartArea.height + margin
  });
});

describe('Navigator drag helpers', () => {
  it('hitTestNavigator returns null when outside bounds', () => {
    const result = hitTestNavigator(0, 0, makeState(), makeConfig(), { height: 60 });
    expect(result).toBeNull();
  });

  it('startNavigatorDrag + updateNavigatorDrag + stopNavigatorDrag work without error', () => {
    const cfg = makeConfig();
    const state = makeState();
    expect(() => {
      startNavigatorDrag(500, 'right', cfg, state, { height: 60 });
      updateNavigatorDrag(600, cfg, state, { height: 60 });
      stopNavigatorDrag(cfg, state);
    }).not.toThrow();
  });
});
