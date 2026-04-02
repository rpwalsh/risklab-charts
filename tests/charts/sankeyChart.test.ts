// ============================================================================
// SankeyChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderSankeySeries } from '../../src/charts/SankeyChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, paths = 0, texts = 0;
  return {
    get rects() { return rects; },
    get paths() { return paths; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    drawPath: () => { paths++; },
    drawText: () => { texts++; },
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

const sankeyConfig: ChartConfig = {
  sankey: {
    nodes: [
      { id: 'A', name: 'Source A' },
      { id: 'B', name: 'Source B' },
      { id: 'C', name: 'Target C' },
    ],
    links: [
      { source: 'A', target: 'C', value: 30 },
      { source: 'B', target: 'C', value: 20 },
    ],
  },
} as unknown as ChartConfig;

const emptySeries = { id: 's1', name: 'Sankey', type: 'sankey', data: [], processedData: [] } as any;

describe('renderSankeySeries', () => {
  it('is a function', () => {
    expect(typeof renderSankeySeries).toBe('function');
  });

  it('returns without drawing when no sankey config', () => {
    const r = makeMockRenderer();
    renderSankeySeries(r as unknown as BaseRenderer, emptySeries, makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    expect(r.rects).toBe(0);
  });

  it('draws one rect per node', () => {
    const r = makeMockRenderer();
    renderSankeySeries(r as unknown as BaseRenderer, emptySeries, makeState(), defaultTheme as ThemeConfig, sankeyConfig);
    expect(r.rects).toBe(3);
  });

  it('draws one path per link', () => {
    const r = makeMockRenderer();
    renderSankeySeries(r as unknown as BaseRenderer, emptySeries, makeState(), defaultTheme as ThemeConfig, sankeyConfig);
    expect(r.paths).toBe(2);
  });

  it('draws one text label per node', () => {
    const r = makeMockRenderer();
    renderSankeySeries(r as unknown as BaseRenderer, emptySeries, makeState(), defaultTheme as ThemeConfig, sankeyConfig);
    expect(r.texts).toBe(3);
  });

  it('handles a single node with no links without throwing', () => {
    const r = makeMockRenderer();
    const singleNodeConfig = {
      sankey: { nodes: [{ id: 'X', name: 'Only' }], links: [] },
    } as unknown as ChartConfig;
    expect(() => renderSankeySeries(r as unknown as BaseRenderer, emptySeries, makeState(), defaultTheme as ThemeConfig, singleNodeConfig)).not.toThrow();
  });
});
