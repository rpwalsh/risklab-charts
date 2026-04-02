// ============================================================================
// MarimekkoChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderMarimekko, type MarimekkoConfig } from '../../src/charts/MarimekkoChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, texts = 0, groups = 0;
  return {
    get rects() { return rects; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {},
    destroy: () => {},
    setSize: () => {},
    drawRect: () => { rects++; },
    drawCircle: () => {},
    drawLine: () => {},
    drawPath: () => {},
    drawText: () => { texts++; },
    drawPolygon: () => {},
    drawArc: () => {},
    beginGroup: () => { groups++; },
    endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 500 },
    width: 800,
    height: 500,
    pixelRatio: 1,
    series: [],
    scales: {},
    axes: [],
    theme: defaultTheme as ThemeConfig,
    plugins: {},
  } as unknown as ChartState;
}

const BASE_CONFIG: MarimekkoConfig = {
  data: [
    { category: 'Electronics', width: 40, values: { Premium: 60, Mid: 30, Budget: 10 } },
    { category: 'Apparel',     width: 30, values: { Premium: 20, Mid: 50, Budget: 30 } },
    { category: 'Food',        width: 30, values: { Premium: 10, Mid: 40, Budget: 50 } },
  ],
  segments: ['Premium', 'Mid', 'Budget'],
};

describe('renderMarimekko', () => {
  it('is a function', () => {
    expect(typeof renderMarimekko).toBe('function');
  });

  it('does nothing when no marimekko config provided', () => {
    const r = makeMockRenderer();
    renderMarimekko(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {});
    expect(r.rects).toBe(0);
  });

  it('draws one rect per segment per column', () => {
    const r = makeMockRenderer();
    renderMarimekko(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      marimekko: BASE_CONFIG,
    } as any);
    // 3 columns × 3 segments = 9 rects
    expect(r.rects).toBe(9);
  });

  it('draws category labels when showCategoryLabels is true', () => {
    const r = makeMockRenderer();
    renderMarimekko(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      marimekko: { ...BASE_CONFIG, showCategoryLabels: true, showValueLabels: false, showWidthLabels: false },
    } as any);
    // Each column gets 1 cat label
    expect(r.texts).toBe(3);
  });

  it('draws width % labels when showWidthLabels is true', () => {
    const r = makeMockRenderer();
    renderMarimekko(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      marimekko: { ...BASE_CONFIG, showCategoryLabels: false, showValueLabels: false, showWidthLabels: true },
    } as any);
    expect(r.texts).toBe(3); // 1 per column
  });

  it('suppresses all labels when all label options disabled', () => {
    const r = makeMockRenderer();
    renderMarimekko(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      marimekko: {
        ...BASE_CONFIG,
        showCategoryLabels: false,
        showValueLabels: false,
        showWidthLabels: false,
      },
    } as any);
    expect(r.texts).toBe(0);
  });

  it('handles empty data gracefully', () => {
    const r = makeMockRenderer();
    expect(() => renderMarimekko(
      r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
        marimekko: { data: [], segments: [] },
      } as any,
    )).not.toThrow();
    expect(r.rects).toBe(0);
  });

  it('handles zero-valued segments (skips them)', () => {
    const r = makeMockRenderer();
    renderMarimekko(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      marimekko: {
        data: [
          { category: 'Tech', width: 100, values: { A: 80, B: 0, C: 20 } },
        ],
        showCategoryLabels: false,
        showValueLabels: false,
        showWidthLabels: false,
      },
    } as any);
    // B has value=0, skipped → only 2 rects
    expect(r.rects).toBe(2);
  });

  it('uses beginGroup/endGroup pair', () => {
    const r = makeMockRenderer();
    renderMarimekko(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      marimekko: BASE_CONFIG,
    } as any);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
