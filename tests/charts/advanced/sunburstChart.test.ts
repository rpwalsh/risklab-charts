// ============================================================================
// SunburstChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderSunburstChart } from '../../../src/charts/advanced/SunburstChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, texts = 0;
  return {
    get paths() { return paths; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => { paths++; },
    drawText: () => { texts++; },
    drawLine: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {}, drawRect: () => {},
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

function makeSeries(nodes: Array<{ id: string; value: number; parent?: string }>) {
  return {
    id: 's1', name: 'Sunburst', type: 'sunburst',
    data: nodes.map(n => ({
      x: n.id, y: n.value, label: n.id,
      meta: n.parent ? { parent: n.parent } : undefined,
    })),
    processedData: [],
  } as any;
}

describe('renderSunburstChart', () => {
  it('is a function', () => {
    expect(typeof renderSunburstChart).toBe('function');
  });

  it('draws one arc path per node (flat list)', () => {
    const r = makeMockRenderer();
    renderSunburstChart(
      r as unknown as BaseRenderer,
      makeSeries([{ id: 'A', value: 30 }, { id: 'B', value: 20 }, { id: 'C', value: 50 }]),
      makeState(), defaultTheme as ThemeConfig,
    );
    expect(r.paths).toBe(3);
  });

  it('draws children arcs for hierarchical data', () => {
    const r = makeMockRenderer();
    renderSunburstChart(
      r as unknown as BaseRenderer,
      makeSeries([
        { id: 'root', value: 100 },
        { id: 'child1', value: 60, parent: 'root' },
        { id: 'child2', value: 40, parent: 'root' },
      ]),
      makeState(), defaultTheme as ThemeConfig,
    );
    // 1 root + 2 children = 3 paths
    expect(r.paths).toBe(3);
  });

  it('draws label texts for large enough arc segments', () => {
    const r = makeMockRenderer();
    renderSunburstChart(
      r as unknown as BaseRenderer,
      // single big node → large arc segment → should draw label
      makeSeries([{ id: 'BigNode', value: 100 }]),
      makeState(), defaultTheme as ThemeConfig,
    );
    expect(r.texts).toBeGreaterThan(0);
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderSunburstChart(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBe(0);
  });

  it('does not throw for deeply nested hierarchy', () => {
    const r = makeMockRenderer();
    const nodes = [
      { id: 'L0', value: 100 },
      { id: 'L1a', value: 60, parent: 'L0' },
      { id: 'L2a', value: 30, parent: 'L1a' },
      { id: 'L2b', value: 30, parent: 'L1a' },
    ];
    expect(() =>
      renderSunburstChart(r as unknown as BaseRenderer, makeSeries(nodes), makeState(), defaultTheme as ThemeConfig),
    ).not.toThrow();
  });
});
