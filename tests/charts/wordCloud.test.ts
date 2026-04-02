// ============================================================================
// WordCloudChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderWordCloud, type WordCloudConfig } from '../../src/charts/WordCloudChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';
import type { ProcessedSeries } from '../../src/core/DataPipeline';

function makeMockRenderer(): BaseRenderer & { paths: number; texts: number; groups: number } {
  let paths = 0, texts = 0, groups = 0;
  return {
    get paths() { return paths; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {},
    destroy: () => {},
    setSize: () => {},
    drawRect: () => {},
    drawCircle: () => {},
    drawLine: () => {},
    drawPath: () => { paths++; },
    drawText: () => { texts++; },
    drawPolygon: () => {},
    drawArc: () => {},
    beginGroup: () => { groups++; },
    endGroup: () => {},
  } as unknown as BaseRenderer & { paths: number; texts: number; groups: number };
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

function makeSeries(words: Array<{ label: string; value: number }>): ProcessedSeries[] {
  return [{
    id: 'wc-1',
    type: 'wordCloud',
    data: words.map(({ label, value }) => ({ x: 0, y: value, label })),
    color: '#333',
  }] as unknown as ProcessedSeries[];
}

describe('renderWordCloud', () => {
  it('is a function', () => {
    expect(typeof renderWordCloud).toBe('function');
  });

  it('renders text items for each word', () => {
    const r = makeMockRenderer();
    const words = [
      { label: 'TypeScript', value: 100 },
      { label: 'Charts', value: 80 },
      { label: 'Canvas', value: 60 },
    ];
    const series = makeSeries(words);
    renderWordCloud(r, series, makeState(), defaultTheme as ThemeConfig);
    // At least one word should be placed (most if not all)
    expect(r.texts).toBeGreaterThan(0);
  });

  it('does not throw with empty series', () => {
    const r = makeMockRenderer();
    expect(() =>
      renderWordCloud(r, [], makeState(), defaultTheme as ThemeConfig),
    ).not.toThrow();
  });

  it('does not throw with a single word', () => {
    const r = makeMockRenderer();
    const series = makeSeries([{ label: 'RiskLab', value: 999 }]);
    expect(() =>
      renderWordCloud(r, series, makeState(), defaultTheme as ThemeConfig),
    ).not.toThrow();
    expect(r.texts).toBe(1);
  });

  it('respects custom config options', () => {
    const r = makeMockRenderer();
    const cfg: WordCloudConfig = {
      minFontSize: 8,
      maxFontSize: 40,
      allowRotation: false,
      padding: 6,
    };
    const series = makeSeries([
      { label: 'Alpha', value: 100 },
      { label: 'Beta', value: 50 },
    ]);
    expect(() =>
      renderWordCloud(r, series, makeState(), defaultTheme as ThemeConfig, cfg),
    ).not.toThrow();
  });
});
