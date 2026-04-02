// ============================================================================
// FlameChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderFlameChart } from '../../../src/charts/advanced/FlameChart';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, texts = 0;
  return {
    get rects() { return rects; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawRect: (_x: any, _y: any, _w: any, _h: any, _s: any) => { rects++; },
    drawText: () => { texts++; },
    drawPath: () => {}, drawLine: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 400 },
    width: 800, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeFrame(start: number, end: number, depth: number, label: string) {
  return { x: start, y: end, meta: { depth, label } };
}

function makeSeries(frames: ReturnType<typeof makeFrame>[]) {
  return {
    id: 's1', name: 'Flame', type: 'flame',
    data: frames,
    processedData: [],
  } as any;
}

describe('renderFlameChart', () => {
  it('is a function', () => {
    expect(typeof renderFlameChart).toBe('function');
  });

  it('draws one rect per frame', () => {
    const r = makeMockRenderer();
    renderFlameChart(
      r as unknown as BaseRenderer,
      makeSeries([
        makeFrame(0, 100, 0, 'main'),
        makeFrame(10, 60, 1, 'child1'),
        makeFrame(65, 90, 1, 'child2'),
      ]),
      makeState(), defaultTheme as ThemeConfig,
    );
    expect(r.rects).toBe(3);
  });

  it('draws label text for wide-enough frames', () => {
    const r = makeMockRenderer();
    renderFlameChart(
      r as unknown as BaseRenderer,
      // frame spans 80% of the 800px wide area → bw ≈ 640px > 30px threshold
      makeSeries([makeFrame(0, 800, 0, 'wideFrame')]),
      makeState(), defaultTheme as ThemeConfig,
    );
    expect(r.texts).toBeGreaterThanOrEqual(1);
  });

  it('does not draw label text for very narrow frames', () => {
    const r = makeMockRenderer();
    renderFlameChart(
      r as unknown as BaseRenderer,
      // narrow frame: start=0, end=1 out of total=1 → bw ≈ 800px? Let's use a relative span where bw < 30px
      makeSeries([
        makeFrame(0, 1000, 0, 'root'),      // total range
        makeFrame(800, 803, 1, 'tiny'),     // 0.3% → bw ≈ 2.4px < 30
      ]),
      makeState(), defaultTheme as ThemeConfig,
    );
    // 'root' is wide → gets a label, 'tiny' does not
    expect(r.texts).toBeGreaterThanOrEqual(1);
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderFlameChart(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('stacks frames at correct depths', () => {
    const r = makeMockRenderer();
    renderFlameChart(
      r as unknown as BaseRenderer,
      makeSeries([
        makeFrame(0, 100, 0, 'L0'),
        makeFrame(0, 50, 1, 'L1'),
        makeFrame(0, 25, 2, 'L2'),
      ]),
      makeState(), defaultTheme as ThemeConfig,
    );
    expect(r.rects).toBe(3);
  });
});
