// ============================================================================
// ItemChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderItemChart, type ItemChartConfig } from '../../src/charts/ItemChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, rects = 0, polys = 0, groups = 0;
  return {
    get circles() { return circles; },
    get rects() { return rects; },
    get polys() { return polys; },
    get groups() { return groups; },
    get items() { return circles + rects + polys; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawText: () => {}, drawArc: () => {},
    drawCircle: () => { circles++; },
    drawRect: () => { rects++; },
    drawPolygon: () => { polys++; },
    beginGroup: () => { groups++; },
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

const BASE_CONFIG: ItemChartConfig = {
  series: [
    { name: 'Party A', value: 35, color: '#2196f3' },
    { name: 'Party B', value: 28, color: '#f44336' },
    { name: 'Party C', value: 12, color: '#4caf50' },
  ],
};

describe('renderItemChart', () => {
  it('is a function', () => {
    expect(typeof renderItemChart).toBe('function');
  });

  it('does nothing when no itemChart config provided', () => {
    const r = makeMockRenderer();
    renderItemChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {});
    expect(r.items).toBe(0);
  });

  it('draws total number of items equal to sum of series values', () => {
    const r = makeMockRenderer();
    renderItemChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      itemChart: BASE_CONFIG,
    } as any);
    // 35 + 28 + 12 = 75 total items drawn as circles
    expect(r.items).toBe(75);
  });

  it('draws square items when shape is square', () => {
    const r = makeMockRenderer();
    renderItemChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      itemChart: { ...BASE_CONFIG, shape: 'square' },
    } as any);
    expect(r.rects).toBe(75);
    expect(r.circles).toBe(0);
  });

  it('draws polygon items when shape is diamond', () => {
    const r = makeMockRenderer();
    renderItemChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      itemChart: { ...BASE_CONFIG, shape: 'diamond' },
    } as any);
    expect(r.polys).toBe(75);
  });

  it('renders arc layout without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderItemChart(
      r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
        itemChart: { ...BASE_CONFIG, layout: 'arc' },
      } as any,
    )).not.toThrow();
    expect(r.items).toBeGreaterThan(0);
  });

  it('handles empty series gracefully', () => {
    const r = makeMockRenderer();
    renderItemChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      itemChart: { series: [] },
    } as any);
    expect(r.items).toBe(0);
  });

  it('respects custom total (clips item count)', () => {
    const r = makeMockRenderer();
    renderItemChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      itemChart: { ...BASE_CONFIG, total: 50 },
    } as any);
    // total=50 caps rendering, but sum(values)=75 so 50 items drawn
    expect(r.items).toBe(50);
  });

  it('uses beginGroup/endGroup', () => {
    const r = makeMockRenderer();
    renderItemChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      itemChart: BASE_CONFIG,
    } as any);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
