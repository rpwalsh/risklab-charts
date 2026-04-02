// ============================================================================
// TilemapChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderTilemap } from '../../src/charts/TilemapChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, rects = 0, circles = 0, texts = 0, groups = 0;
  return {
    get paths() { return paths; },
    get rects() { return rects; },
    get circles() { return circles; },
    get texts() { return texts; },
    get groups() { return groups; },
    get tiles() { return paths + rects + circles; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawPath: () => { paths++; },
    drawRect: () => { rects++; },
    drawCircle: () => { circles++; },
    drawText: () => { texts++; },
    beginGroup: (_id: string) => { groups++; },
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

const baseData = Array.from({ length: 9 }, (_, i) => ({
  x: i % 3, y: Math.floor(i / 3), value: (i + 1) * 10,
}));

describe('renderTilemap', () => {
  it('is a function', () => {
    expect(typeof renderTilemap).toBe('function');
  });

  it('does nothing without tilemap config', () => {
    const r = makeMockRenderer();
    renderTilemap(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.tiles).toBe(0);
  });

  it('draws one hex path per data point', () => {
    const r = makeMockRenderer();
    renderTilemap(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      tilemap: { data: baseData, shape: 'hexagon' },
    } as any);
    expect(r.paths).toBe(9);
  });

  it('draws one circle per data point for circle shape', () => {
    const r = makeMockRenderer();
    renderTilemap(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      tilemap: { data: baseData, shape: 'circle' },
    } as any);
    expect(r.circles).toBe(9);
  });

  it('draws one rect per data point for square shape', () => {
    const r = makeMockRenderer();
    renderTilemap(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      tilemap: { data: baseData, shape: 'square' },
    } as any);
    expect(r.rects).toBe(9);
  });

  it('draws one diamond path per data point', () => {
    const r = makeMockRenderer();
    renderTilemap(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      tilemap: { data: baseData, shape: 'diamond' },
    } as any);
    expect(r.paths).toBe(9);
  });

  it('shows labels when showLabels=true and tile size large enough', () => {
    const r = makeMockRenderer();
    renderTilemap(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      tilemap: { data: baseData, shape: 'square', tileSize: 60, showLabels: true },
    } as any);
    expect(r.texts).toBeGreaterThan(0);
  });

  it('uses beginGroup/endGroup', () => {
    const r = makeMockRenderer();
    renderTilemap(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      tilemap: { data: baseData },
    } as any);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
