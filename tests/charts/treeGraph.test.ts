// ============================================================================
// TreeGraph — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderTreeGraph } from '../../src/charts/TreeGraph';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, rects = 0, texts = 0, groups = 0;
  return {
    get paths() { return paths; },
    get rects() { return rects; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawPath: () => { paths++; },
    drawRect: () => { rects++; },
    drawText: () => { texts++; },
    beginGroup: (_id: string) => { groups++; },
    endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 600 },
    width: 800, height: 600, pixelRatio: 1,
    series: [], scales: {}, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

const treeNodes = [
  { id: 'root',  name: 'CEO' },
  { id: 'a',     name: 'CTO',  parent: 'root' },
  { id: 'b',     name: 'CFO',  parent: 'root' },
  { id: 'c',     name: 'Dev1', parent: 'a' },
  { id: 'd',     name: 'Dev2', parent: 'a' },
];

describe('renderTreeGraph', () => {
  it('is a function', () => {
    expect(typeof renderTreeGraph).toBe('function');
  });

  it('does nothing without treeGraph config', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws one rect per node', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      treeGraph: { nodes: treeNodes },
    } as any);
    expect(r.rects).toBe(treeNodes.length);
  });

  it('draws one text per node', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      treeGraph: { nodes: treeNodes },
    } as any);
    expect(r.texts).toBe(treeNodes.length);
  });

  it('draws paths for links (4 links for 5 nodes)', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      treeGraph: { nodes: treeNodes },
    } as any);
    expect(r.paths).toBe(4); // 5 nodes - 1 root = 4 edges
  });

  it('supports LR direction', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      treeGraph: { nodes: treeNodes, direction: 'LR' },
    } as any);
    expect(r.rects).toBe(treeNodes.length);
  });

  it('supports TB direction', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      treeGraph: { nodes: treeNodes, direction: 'TB' },
    } as any);
    expect(r.rects).toBe(treeNodes.length);
  });

  it('supports step link style', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      treeGraph: { nodes: treeNodes, linkShape: 'step' },
    } as any);
    expect(r.paths).toBe(4);
  });

  it('uses beginGroup/endGroup', () => {
    const r = makeMockRenderer();
    renderTreeGraph(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      treeGraph: { nodes: treeNodes },
    } as any);
    expect(r.groups).toBeGreaterThanOrEqual(2); // links group + nodes group
  });
});
