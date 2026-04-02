// ============================================================================
// BubbleChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderBubbleSeries } from '../../src/charts/BubbleChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 6, bandwidth: 60 };
}

function makeMockRenderer() {
  let circles = 0, texts = 0;
  return {
    get circles() { return circles; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawCircle: () => { circles++; },
    drawText: () => { texts++; },
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  const scales = new Map();
  scales.set('x0', makeMockScale());
  scales.set('y0', makeMockScale());
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(pts: { x: number; y: number; z?: number; label?: string }[]) {
  return {
    id: 's1', name: 'Bubble', type: 'bubble',
    data: pts,
    processedData: pts.map(p => ({ x: p.x, y: p.y, z: p.z, xNum: p.x, yNum: p.y, label: p.label })),
  } as any;
}

describe('renderBubbleSeries', () => {
  it('is a function', () => {
    expect(typeof renderBubbleSeries).toBe('function');
  });

  it('returns early when no scales', () => {
    const r = makeMockRenderer();
    const noScale = { ...makeState(), scales: new Map() } as unknown as ChartState;
    renderBubbleSeries(r as unknown as BaseRenderer, makeSeries([{ x: 1, y: 1, z: 5 }]), noScale, defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBe(0);
  });

  it('returns early on empty data', () => {
    const r = makeMockRenderer();
    renderBubbleSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBe(0);
  });

  it('draws one circle per data point', () => {
    const r = makeMockRenderer();
    renderBubbleSeries(r as unknown as BaseRenderer, makeSeries([{ x: 0, y: 0, z: 10 }, { x: 1, y: 1, z: 20 }, { x: 2, y: 2, z: 5 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.circles).toBe(3);
  });

  it('draws label inside large enough bubbles', () => {
    const r = makeMockRenderer();
    // Two points with very different z so the large one gets radius=40 (> threshold 15)
    renderBubbleSeries(r as unknown as BaseRenderer, makeSeries([{ x: 1, y: 1, z: 1 }, { x: 5, y: 5, z: 1000, label: 'BigBubble' }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.texts).toBe(1);
  });

  it('does not draw label when bubble has no label', () => {
    const r = makeMockRenderer();
    renderBubbleSeries(r as unknown as BaseRenderer, makeSeries([{ x: 5, y: 5, z: 1000 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.texts).toBe(0);
  });

  it('handles single-value z (all same size) without throwing', () => {
    const r = makeMockRenderer();
    expect(() => renderBubbleSeries(r as unknown as BaseRenderer, makeSeries([{ x: 1, y: 1, z: 5 }, { x: 2, y: 2, z: 5 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5')).not.toThrow();
  });
});
