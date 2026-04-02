// ============================================================================
// BulletChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderBulletChart } from '../../../src/charts/advanced/BulletChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, lines = 0, texts = 0;
  return {
    get rects() { return rects; }, get lines() { return lines; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawRect:   (_x: any, _y: any, _w: any, _h: any, _s: any, _r?: any) => { rects++; },
    drawLine:   () => { lines++; },
    drawText:   () => { texts++; },
    drawPath: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 20, y: 20, width: 500, height: 200 },
    width: 540, height: 240, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(points: Array<{ y: number; target?: number }>) {
  return {
    id: 's1', name: 'KPI', type: 'bullet',
    data: points.map((p, i) => ({
      x: `Item ${i}`, y: p.y,
      label: `KPI ${i}`,
      meta: { target: p.target ?? p.y * 0.9, ranges: [p.y * 0.5, p.y * 0.75, p.y * 1.1] },
    })),
    processedData: [],
  } as any;
}

describe('renderBulletChart', () => {
  it('is a function', () => {
    expect(typeof renderBulletChart).toBe('function');
  });

  it('draws at least 1 rect per data point (actual bar)', () => {
    const r = makeMockRenderer();
    renderBulletChart(r as unknown as BaseRenderer, makeSeries([{ y: 80, target: 100 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // 3 range rects + 1 actual bar = 4 rects per item
    expect(r.rects).toBeGreaterThanOrEqual(1);
  });

  it('draws a target marker line per item', () => {
    const r = makeMockRenderer();
    renderBulletChart(r as unknown as BaseRenderer, makeSeries([{ y: 80, target: 100 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.lines).toBeGreaterThanOrEqual(1);
  });

  it('draws 2 texts per item (label + value)', () => {
    const r = makeMockRenderer();
    renderBulletChart(r as unknown as BaseRenderer, makeSeries([{ y: 80 }]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.texts).toBeGreaterThanOrEqual(2);
  });

  it('handles multiple data points', () => {
    const r = makeMockRenderer();
    renderBulletChart(
      r as unknown as BaseRenderer,
      makeSeries([{ y: 80 }, { y: 60 }, { y: 90 }]),
      makeState(), defaultTheme as ThemeConfig, '#4f46e5',
    );
    expect(r.rects).toBeGreaterThanOrEqual(3);
  });

  it('returns without drawing when series data is empty', () => {
    const r = makeMockRenderer();
    renderBulletChart(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.rects).toBe(0);
  });
});
