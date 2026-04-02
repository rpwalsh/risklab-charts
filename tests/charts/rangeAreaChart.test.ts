import { describe, expect, it } from 'vitest';

import { renderRangeAreaSeries } from '../../src/charts/RangeAreaChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return {
    convert: (value: number) => value * 8,
    bandwidth: 40,
    ticks: (count = 5) => Array.from({ length: count }, (_, index) => index),
  };
}

function makeMockRenderer() {
  let paths = 0;
  let circles = 0;
  let gradients = 0;
  return {
    get paths() { return paths; },
    get circles() { return circles; },
    get gradients() { return gradients; },
    clear: () => {},
    destroy: () => {},
    setSize: () => {},
    drawLine: () => {},
    drawRect: () => {},
    drawArc: () => {},
    drawPolygon: () => {},
    drawText: () => {},
    drawPath: () => { paths++; },
    drawCircle: () => { circles++; },
    beginGroup: () => {},
    endGroup: () => {},
    defineLinearGradient: () => { gradients++; },
    buildLinePath: () => 'M0,0L8,8',
    buildAreaPath: () => 'M0,0L8,8L8,24L0,24Z',
  };
}

function makeState(): ChartState {
  const scales = new Map<string, ReturnType<typeof makeMockScale>>();
  scales.set('x0', makeMockScale());
  scales.set('y0', makeMockScale());
  return {
    chartArea: { x: 0, y: 0, width: 640, height: 320 },
    width: 640,
    height: 320,
    scales,
    activeSeries: [],
    selectedPoints: [],
    zoomLevel: { x: 1, y: 1 },
    panOffset: { x: 0, y: 0 },
    tooltipVisible: false,
    animating: false,
  } as ChartState;
}

describe('renderRangeAreaSeries', () => {
  it('draws a band fill plus upper and lower range lines', () => {
    const renderer = makeMockRenderer();
    renderRangeAreaSeries(
      renderer as unknown as BaseRenderer,
      {
        id: 's1',
        name: 'Forecast',
        type: 'rangeArea',
        data: [
          { x: 0, low: 4, high: 12 },
          { x: 1, low: 6, high: 14 },
        ],
        processedData: [
          { x: 0, y: 12, low: 4, high: 12, xNum: 0, yNum: 12 },
          { x: 1, y: 14, low: 6, high: 14, xNum: 1, yNum: 14 },
        ],
      } as any,
      makeState(),
      defaultTheme as ThemeConfig,
      '#6366f1',
      {},
    );

    expect(renderer.gradients).toBe(1);
    expect(renderer.paths).toBe(3);
  });

  it('supports top markers when enabled', () => {
    const renderer = makeMockRenderer();
    renderRangeAreaSeries(
      renderer as unknown as BaseRenderer,
      {
        id: 's1',
        name: 'Forecast',
        type: 'rangeArea',
        marker: { enabled: true, size: 4 },
        data: [{ x: 0, low: 3, high: 9 }],
        processedData: [{ x: 0, y: 9, low: 3, high: 9, xNum: 0, yNum: 9 }],
      } as any,
      makeState(),
      defaultTheme as ThemeConfig,
      '#6366f1',
      {},
    );

    expect(renderer.circles).toBe(1);
  });
});
