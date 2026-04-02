// ============================================================================
// PackedBubbleChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderPackedBubble, type PackedBubbleConfig } from '../../src/charts/PackedBubbleChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';
import type { ProcessedSeries } from '../../src/core/DataPipeline';

function makeMockRenderer() {
  let circles = 0, texts = 0, groups = 0;
  return {
    get circles() { return circles; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {},
    destroy: () => {},
    setSize: () => {},
    drawRect: () => {},
    drawCircle: () => { circles++; },
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
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600,
    height: 400,
    pixelRatio: 1,
    series: [],
    scales: {},
    axes: [],
    theme: defaultTheme as ThemeConfig,
    plugins: {},
  } as unknown as ChartState;
}

function makeSeries(values: Array<{ label: string; y: number }>): ProcessedSeries[] {
  return [{
    id: 'pb',
    type: 'packedBubble',
    data: values.map(({ label, y }) => ({ x: 0, y, label })),
    color: '#4e8bdf',
  }] as unknown as ProcessedSeries[];
}

describe('renderPackedBubble', () => {
  it('is a function', () => {
    expect(typeof renderPackedBubble).toBe('function');
  });

  it('does nothing with empty series', () => {
    const r = makeMockRenderer();
    renderPackedBubble(r as unknown as BaseRenderer, [], makeState(), defaultTheme as ThemeConfig);
    expect(r.circles).toBe(0);
  });

  it('draws one circle per data point', () => {
    const r = makeMockRenderer();
    const series = makeSeries([
      { label: 'A', y: 100 },
      { label: 'B', y: 200 },
      { label: 'C', y: 50 },
    ]);
    renderPackedBubble(r as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig);
    expect(r.circles).toBe(3);
  });

  it('draws labels for bubbles large enough', () => {
    const r = makeMockRenderer();
    const series = makeSeries([
      { label: 'Alpha', y: 1000 },
      { label: 'Beta', y: 900 },
    ]);
    renderPackedBubble(r as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig, undefined, {
      maxRadius: 80,
      showLabels: true,
    });
    // Both bubbles are large → labels drawn
    expect(r.texts).toBeGreaterThan(0);
  });

  it('skips labels when showLabels is false', () => {
    const r = makeMockRenderer();
    const series = makeSeries([{ label: 'X', y: 500 }]);
    renderPackedBubble(r as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig, undefined, {
      showLabels: false,
    });
    expect(r.texts).toBe(0);
  });

  it('draws parent ring when parentNode.enabled is true', () => {
    const r = makeMockRenderer();
    const series = makeSeries([{ label: 'A', y: 100 }, { label: 'B', y: 80 }]);
    renderPackedBubble(r as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig, undefined, {
      parentNode: { enabled: true },
      iterations: 10,
    });
    // 1 extra group circle per series
    expect(r.circles).toBeGreaterThanOrEqual(3); // 2 data + 1 ring
  });

  it('handles single-point series', () => {
    const r = makeMockRenderer();
    const series = makeSeries([{ label: 'Solo', y: 500 }]);
    expect(() => renderPackedBubble(
      r as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig,
    )).not.toThrow();
    expect(r.circles).toBe(1);
  });

  it('uses smaller iterations for faster convergence in tests', () => {
    // Smoke test with low iterations
    const r = makeMockRenderer();
    const series = makeSeries(
      Array.from({ length: 20 }, (_, i) => ({ label: `N${i}`, y: (i + 1) * 10 })),
    );
    expect(() => renderPackedBubble(
      r as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig, undefined, {
        iterations: 5,
      },
    )).not.toThrow();
    expect(r.circles).toBe(20);
  });
});
