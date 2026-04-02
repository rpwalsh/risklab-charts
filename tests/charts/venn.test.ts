// ============================================================================
// VennDiagram — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderVennDiagram, type VennConfig } from '../../src/charts/VennDiagram';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, texts = 0, groups = 0;
  return {
    get circles() { return circles; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawRect: () => {}, drawLine: () => {}, drawPath: () => {},
    drawPolygon: () => {}, drawArc: () => {},
    drawCircle: () => { circles++; },
    drawText: () => { texts++; },
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

const TWO_SET: VennConfig = {
  sets: [
    { id: 'A', name: 'Set A', value: 100 },
    { id: 'B', name: 'Set B', value: 80 },
  ],
  intersections: [{ sets: ['A', 'B'], value: 30, label: 'A∩B' }],
};

const THREE_SET: VennConfig = {
  sets: [
    { id: 'X', value: 50 },
    { id: 'Y', value: 60 },
    { id: 'Z', value: 40 },
  ],
  intersections: [
    { sets: ['X', 'Y'], value: 15 },
    { sets: ['Y', 'Z'], value: 10 },
    { sets: ['X', 'Z'], value: 8 },
  ],
};

describe('renderVennDiagram', () => {
  it('is a function', () => {
    expect(typeof renderVennDiagram).toBe('function');
  });

  it('does nothing when no venn config provided', () => {
    const r = makeMockRenderer();
    renderVennDiagram(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {});
    expect(r.circles).toBe(0);
  });

  it('draws one circle per set', () => {
    const r = makeMockRenderer();
    renderVennDiagram(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      venn: TWO_SET,
    } as any);
    expect(r.circles).toBe(2);
  });

  it('draws labels for each set when showLabels is true', () => {
    const r = makeMockRenderer();
    renderVennDiagram(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      venn: { ...TWO_SET, showLabels: true, showIntersectionLabels: false },
    } as any);
    expect(r.texts).toBe(2); // 'Set A' and 'Set B'
  });

  it('draws intersection label when provided', () => {
    const r = makeMockRenderer();
    renderVennDiagram(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      venn: { ...TWO_SET, showLabels: false, showIntersectionLabels: true },
    } as any);
    expect(r.texts).toBe(1); // 'A∩B'
  });

  it('draws no labels when both label options disabled', () => {
    const r = makeMockRenderer();
    renderVennDiagram(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      venn: { ...TWO_SET, showLabels: false, showIntersectionLabels: false },
    } as any);
    expect(r.texts).toBe(0);
  });

  it('handles 3-set venn without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderVennDiagram(
      r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
        venn: THREE_SET,
      } as any,
    )).not.toThrow();
    expect(r.circles).toBe(3);
  });

  it('handles single set gracefully', () => {
    const r = makeMockRenderer();
    renderVennDiagram(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      venn: { sets: [{ id: 'A', value: 100 }] },
    } as any);
    expect(r.circles).toBe(1);
  });

  it('uses beginGroup/endGroup pairs', () => {
    const r = makeMockRenderer();
    renderVennDiagram(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig, {
      venn: TWO_SET,
    } as any);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
