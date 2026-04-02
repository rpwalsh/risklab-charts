// ============================================================================
// ChordDiagram — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderChordDiagram } from '../../../src/charts/advanced/ChordDiagram';
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

function makeSeries(flows: Array<{ from: string; to: string; y: number }>) {
  return {
    id: 's1', name: 'Chord', type: 'chord',
    data: flows.map(f => ({ x: f.from, y: f.y, meta: { from: f.from, to: f.to } })),
    processedData: [],
  } as any;
}

describe('renderChordDiagram', () => {
  it('is a function', () => {
    expect(typeof renderChordDiagram).toBe('function');
  });

  it('draws outer arcs for each unique group', () => {
    const r = makeMockRenderer();
    renderChordDiagram(
      r as unknown as BaseRenderer,
      makeSeries([
        { from: 'A', to: 'B', y: 10 },
        { from: 'B', to: 'C', y: 5 },
      ]),
      makeState(), defaultTheme as ThemeConfig,
    );
    expect(r.paths).toBeGreaterThan(0);
  });

  it('draws chord paths for each flow', () => {
    const r = makeMockRenderer();
    renderChordDiagram(
      r as unknown as BaseRenderer,
      makeSeries([{ from: 'X', to: 'Y', y: 20 }]),
      makeState(), defaultTheme as ThemeConfig,
    );
    // 2 group arcs + 1 chord = 3 paths minimum
    expect(r.paths).toBeGreaterThanOrEqual(3);
  });

  it('draws a label text for each group', () => {
    const r = makeMockRenderer();
    renderChordDiagram(
      r as unknown as BaseRenderer,
      makeSeries([{ from: 'Alpha', to: 'Beta', y: 30 }]),
      makeState(), defaultTheme as ThemeConfig,
    );
    // One label per unique group: 2 labels
    expect(r.texts).toBeGreaterThanOrEqual(2);
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderChordDiagram(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBe(0);
  });

  it('handles self-loop (from === to) without throwing', () => {
    const r = makeMockRenderer();
    expect(() =>
      renderChordDiagram(
        r as unknown as BaseRenderer,
        makeSeries([{ from: 'A', to: 'A', y: 5 }]),
        makeState(), defaultTheme as ThemeConfig,
      ),
    ).not.toThrow();
  });
});
