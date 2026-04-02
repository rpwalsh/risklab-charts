// ============================================================================
// OrgChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderOrgChart, type OrgChartConfig } from '../../src/charts/OrgChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, paths = 0, texts = 0, groups = 0;
  return {
    get rects() { return rects; },
    get paths() { return paths; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {},
    destroy: () => {},
    setSize: () => {},
    drawRect: () => { rects++; },
    drawCircle: () => {},
    drawLine: () => {},
    drawPath: () => { paths++; },
    drawText: () => { texts++; },
    drawPolygon: () => {},
    drawArc: () => {},
    beginGroup: () => { groups++; },
    endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 600 },
    width: 800,
    height: 600,
    pixelRatio: 1,
    series: [],
    scales: {},
    axes: [],
    theme: defaultTheme as ThemeConfig,
    plugins: {},
  } as unknown as ChartState;
}

const FLAT_ORG: OrgChartConfig = {
  nodes: [
    { id: 'ceo', title: 'Alice', description: 'CEO' },
    { id: 'cto', title: 'Bob', description: 'CTO' },
    { id: 'cfo', title: 'Carol', description: 'CFO' },
  ],
  edges: [
    { from: 'ceo', to: 'cto' },
    { from: 'ceo', to: 'cfo' },
  ],
};

const DEEP_ORG: OrgChartConfig = {
  nodes: [
    { id: 'a', title: 'Alice' },
    { id: 'b', title: 'Bob' },
    { id: 'c', title: 'Carol' },
    { id: 'd', title: 'Dave' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'b', to: 'd' },
  ],
};

describe('renderOrgChart', () => {
  it('is a function', () => {
    expect(typeof renderOrgChart).toBe('function');
  });

  it('does nothing when no orgChart config provided', () => {
    const r = makeMockRenderer();
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {});
    expect(r.rects).toBe(0);
  });

  it('draws one rect per node', () => {
    const r = makeMockRenderer();
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: FLAT_ORG,
    } as any);
    expect(r.rects).toBe(3);
  });

  it('draws connectors (paths) between nodes', () => {
    const r = makeMockRenderer();
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: FLAT_ORG,
    } as any);
    // 2 edges = 2 connector paths
    expect(r.paths).toBe(2);
  });

  it('draws title text for each node', () => {
    const r = makeMockRenderer();
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: FLAT_ORG,
    } as any);
    // 3 titles + 3 descriptions = 6 text draws
    expect(r.texts).toBeGreaterThanOrEqual(3);
  });

  it('draws description subtitle when provided', () => {
    const r = makeMockRenderer();
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: FLAT_ORG,
    } as any);
    // CEO/CTO/CFO have descriptions → 6 total text calls
    expect(r.texts).toBe(6); // 3 titles + 3 descriptions
  });

  it('handles multi-level hierarchies', () => {
    const r = makeMockRenderer();
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: DEEP_ORG,
    } as any);
    expect(r.rects).toBe(4);
    expect(r.paths).toBe(3);
  });

  it('respects collapsed nodes (hides children link)', () => {
    const r = makeMockRenderer();
    const cfg: OrgChartConfig = {
      nodes: [
        { id: 'a', title: 'Alice' },
        { id: 'b', title: 'Bob', collapsed: true },
        { id: 'c', title: 'Carol' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    };
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: cfg,
    } as any);
    // 'b' is collapsed — the b→c edge is suppressed so there is only 1 connector path (a→b)
    expect(r.paths).toBe(1);
    // All 3 nodes are still in the node list (c becomes a disconnected root)
    expect(r.rects).toBe(3);
  });

  it('renders without errors for single-node org', () => {
    const r = makeMockRenderer();
    expect(() => renderOrgChart(
      r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
        orgChart: { nodes: [{ id: 'solo', title: 'Solo' }], edges: [] },
      } as any,
    )).not.toThrow();
    expect(r.rects).toBe(1);
  });

  it('uses beginGroup/endGroup pairs', () => {
    const r = makeMockRenderer();
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: FLAT_ORG,
    } as any);
    expect(r.groups).toBeGreaterThanOrEqual(2);
  });

  it('renders LR direction without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderOrgChart(
      r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
        orgChart: { ...FLAT_ORG, direction: 'LR' },
      } as any,
    )).not.toThrow();
  });

  it('renders edge labels when showEdgeLabels is true', () => {
    const r = makeMockRenderer();
    const cfg: OrgChartConfig = {
      ...FLAT_ORG,
      edges: [
        { from: 'ceo', to: 'cto', label: 'Reports to' },
        { from: 'ceo', to: 'cfo', label: 'Manages' },
      ],
      showEdgeLabels: true,
    };
    renderOrgChart(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      orgChart: cfg,
    } as any);
    // 2 edge labels added to texts
    const expectedTexts = 3 /* titles */ + 3 /* descriptions */ + 2 /* labels */;
    expect(r.texts).toBe(expectedTexts);
  });
});
