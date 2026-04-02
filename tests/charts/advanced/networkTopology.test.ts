// ============================================================================
// NetworkTopology — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderNetworkTopology } from '../../../src/charts/advanced/NetworkTopology';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, lines = 0, texts = 0;
  return {
    get circles() { return circles; }, get lines() { return lines; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => { circles++; },
    drawLine:   () => { lines++;   },
    drawText:   () => { texts++;   },
    drawPath: () => {}, drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 500 },
    width: 600, height: 500, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeNode(id: string, edges: string[] = []) {
  return {
    x: id, y: 10, z: 10, label: id,
    meta: {
      id,
      edges: edges.map(t => ({ target: t, weight: 1 })),
    },
  };
}

function makeSeries(nodes: ReturnType<typeof makeNode>[]) {
  return {
    id: 's1', name: 'Network', type: 'network',
    data: nodes,
    processedData: [],
  } as any;
}

describe('renderNetworkTopology', () => {
  it('is a function', () => {
    expect(typeof renderNetworkTopology).toBe('function');
  });

  it('draws one circle per node', () => {
    const r = makeMockRenderer();
    renderNetworkTopology(
      r as unknown as BaseRenderer,
      makeSeries([makeNode('A'), makeNode('B'), makeNode('C')]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.circles).toBe(3);
  });

  it('draws one label text per node', () => {
    const r = makeMockRenderer();
    renderNetworkTopology(
      r as unknown as BaseRenderer,
      makeSeries([makeNode('X'), makeNode('Y')]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.texts).toBe(2);
  });

  it('draws edge lines between connected nodes', () => {
    const r = makeMockRenderer();
    renderNetworkTopology(
      r as unknown as BaseRenderer,
      makeSeries([makeNode('A', ['B']), makeNode('B')]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.lines).toBeGreaterThanOrEqual(1);
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderNetworkTopology(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBe(0);
  });

  it('handles parent-link style edges (meta.from)', () => {
    const r = makeMockRenderer();
    const childNode = { x: 'child', y: 10, z: 8, label: 'child', meta: { id: 'child', from: 'root' } };
    const rootNode = { x: 'root', y: 10, z: 12, label: 'root', meta: { id: 'root' } };
    renderNetworkTopology(
      r as unknown as BaseRenderer,
      { id: 's1', name: 'Net', type: 'network', data: [rootNode, childNode], processedData: [] } as any,
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.lines).toBeGreaterThanOrEqual(1);
  });
});
