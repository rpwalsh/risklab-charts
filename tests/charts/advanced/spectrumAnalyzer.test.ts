// ============================================================================
// SpectrumAnalyzer — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderSpectrumAnalyzer } from '../../../src/charts/advanced/SpectrumAnalyzer';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, lines = 0, paths = 0, texts = 0;
  return {
    get rects() { return rects; }, get lines() { return lines; },
    get paths() { return paths; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawRect: () => { rects++; },
    drawLine: () => { lines++;  },
    drawPath: () => { paths++;  },
    drawText: () => { texts++;  },
    defineLinearGradient: () => {},
    drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 40, y: 0, width: 760, height: 400 },
    width: 800, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(values: number[]) {
  return {
    id: 's1', name: 'FFT', type: 'spectrum',
    data: values.map((v, i) => ({ x: i * 100, y: v, label: `${i * 100}Hz` })),
    processedData: [],
  } as any;
}

describe('renderSpectrumAnalyzer', () => {
  it('is a function', () => {
    expect(typeof renderSpectrumAnalyzer).toBe('function');
  });

  it('draws one bar rect per frequency bin', () => {
    const r = makeMockRenderer();
    const n = 8;
    renderSpectrumAnalyzer(r as unknown as BaseRenderer, makeSeries(Array(n).fill(0.5)), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.rects).toBe(n);
  });

  it('draws peak-hold lines (1 per bin)', () => {
    const r = makeMockRenderer();
    const n = 8;
    renderSpectrumAnalyzer(r as unknown as BaseRenderer, makeSeries(Array(n).fill(0.5)), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // grid lines (5 dB lines) + peak hold lines (n)
    expect(r.lines).toBeGreaterThanOrEqual(n);
  });

  it('draws dB grid labels', () => {
    const r = makeMockRenderer();
    renderSpectrumAnalyzer(r as unknown as BaseRenderer, makeSeries([1, 2, 3, 4]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    // 5 dB level labels + frequency labels
    expect(r.texts).toBeGreaterThanOrEqual(5);
  });

  it('draws an envelope path when more than 2 bins', () => {
    const r = makeMockRenderer();
    renderSpectrumAnalyzer(r as unknown as BaseRenderer, makeSeries([1, 2, 3]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });

  it('returns early when data is empty', () => {
    const r = makeMockRenderer();
    renderSpectrumAnalyzer(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, '#4f46e5');
    expect(r.rects).toBe(0);
  });
});
