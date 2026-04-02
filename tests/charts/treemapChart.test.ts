// ============================================================================
// TreemapChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderTreemapSeries } from '../../src/charts/TreemapChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, texts = 0;
  return {
    get rects() { return rects; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
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

function makeSeries(pts: { label: string; y: number }[]) {
  return {
    id: 's1', name: 'Treemap', type: 'treemap',
    data: pts.map(p => ({ x: p.label, y: p.y, label: p.label })),
    processedData: pts.map(p => ({ x: p.label, y: p.y, yNum: p.y, label: p.label })),
  } as any;
}

describe('renderTreemapSeries', () => {
  it('is a function', () => {
    expect(typeof renderTreemapSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderTreemapSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('returns without drawing when total is 0', () => {
    const r = makeMockRenderer();
    renderTreemapSeries(r as unknown as BaseRenderer, makeSeries([{ label: 'A', y: 0 }, { label: 'B', y: 0 }]), makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws one rect per data point', () => {
    const r = makeMockRenderer();
    renderTreemapSeries(r as unknown as BaseRenderer, makeSeries([{ label: 'A', y: 40 }, { label: 'B', y: 30 }, { label: 'C', y: 20 }, { label: 'D', y: 10 }]), makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(4);
  });

  it('draws labels inside cells that are large enough', () => {
    const r = makeMockRenderer();
    // With only 1 item it takes the full 600×400 area — definitely > 50×30 threshold
    renderTreemapSeries(r as unknown as BaseRenderer, makeSeries([{ label: 'Big', y: 100 }]), makeState(), defaultTheme as ThemeConfig);
    // 1 rect + 2 texts (label + value)
    expect(r.rects).toBe(1);
    expect(r.texts).toBe(2);
  });

  it('handles single-item treemap without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderTreemapSeries(r as unknown as BaseRenderer, makeSeries([{ label: 'Only', y: 42 }]), makeState(), defaultTheme as ThemeConfig)).not.toThrow();
  });
});
