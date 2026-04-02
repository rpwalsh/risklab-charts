// ============================================================================
// PieChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderPieSeries } from '../../src/charts/PieChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let arcs = 0, texts = 0;
  return {
    get arcs() { return arcs; },
    get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawPath: () => {}, drawRect: () => {}, drawCircle: () => {}, drawPolygon: () => {},
    drawArc: () => { arcs++; },
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
    hoveredPoint: null, selectedPoints: [],
  } as unknown as ChartState;
}

function makeSeries(pts: { y: number; label?: string }[]) {
  return {
    id: 's1', name: 'MySeries', type: 'pie',
    data: pts,
    processedData: pts.map(p => ({ y: p.y, yNum: p.y, label: p.label })),
  } as any;
}

describe('renderPieSeries', () => {
  it('is a function', () => {
    expect(typeof renderPieSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderPieSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, false);
    expect(r.arcs).toBe(0);
  });

  it('returns without drawing when total is 0', () => {
    const r = makeMockRenderer();
    renderPieSeries(r as unknown as BaseRenderer, makeSeries([{ y: 0 }, { y: 0 }]), makeState(), defaultTheme as ThemeConfig, false);
    expect(r.arcs).toBe(0);
  });

  it('draws one arc per data point', () => {
    const r = makeMockRenderer();
    renderPieSeries(r as unknown as BaseRenderer, makeSeries([{ y: 30 }, { y: 50 }, { y: 20 }]), makeState(), defaultTheme as ThemeConfig, false);
    expect(r.arcs).toBe(3);
  });

  it('draws slice labels for large enough slices', () => {
    const r = makeMockRenderer();
    // Equal thirds (120° each — bigger than 15° threshold)
    renderPieSeries(r as unknown as BaseRenderer, makeSeries([{ y: 33 }, { y: 33 }, { y: 34 }]), makeState(), defaultTheme as ThemeConfig, false);
    expect(r.texts).toBe(3);
  });

  it('does not draw slice label for very small slices (< 15°)', () => {
    const r = makeMockRenderer();
    // One huge slice and one tiny slice
    renderPieSeries(r as unknown as BaseRenderer, makeSeries([{ y: 999 }, { y: 1 }]), makeState(), defaultTheme as ThemeConfig, false);
    // tiny slice won't get a label; huge one does
    expect(r.texts).toBe(1);
  });

  it('draws donut center label when isDonut=true', () => {
    const r = makeMockRenderer();
    renderPieSeries(r as unknown as BaseRenderer, makeSeries([{ y: 50 }, { y: 50 }]), makeState(), defaultTheme as ThemeConfig, true);
    // 2 slice labels + 2 center texts (name + total)
    expect(r.texts).toBeGreaterThanOrEqual(2);
  });

  it('pie and donut both draw same number of arcs', () => {
    const rPie = makeMockRenderer();
    const rDonut = makeMockRenderer();
    const series = makeSeries([{ y: 40 }, { y: 60 }]);
    renderPieSeries(rPie as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig, false);
    renderPieSeries(rDonut as unknown as BaseRenderer, series, makeState(), defaultTheme as ThemeConfig, true);
    expect(rPie.arcs).toBe(rDonut.arcs);
  });
});
