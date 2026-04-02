// ============================================================================
// CandlestickChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderCandlestickSeries } from '../../src/charts/CandlestickChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return { convert: (v: number) => v * 4, bandwidth: 10 };
}

function makeMockRenderer() {
  let lines = 0, rects = 0;
  return {
    get lines() { return lines; },
    get rects() { return rects; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawPath: () => {}, drawText: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawLine: () => { lines++; },
    drawRect: () => { rects++; },
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

function makeOHLCPoint(x: number, open: number, high: number, low: number, close: number) {
  return { x, xNum: x, yNum: close, open, high, low, close };
}

function makeSeries(pts: ReturnType<typeof makeOHLCPoint>[]) {
  return {
    id: 's1', name: 'OHLC', type: 'candlestick',
    data: pts, processedData: pts,
  } as any;
}

const bullishCandle = makeOHLCPoint(1, 10, 20, 8, 18); // close > open
const bearishCandle = makeOHLCPoint(2, 18, 22, 7, 9); // close < open

describe('renderCandlestickSeries', () => {
  it('is a function', () => {
    expect(typeof renderCandlestickSeries).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderCandlestickSeries(r as unknown as BaseRenderer, makeSeries([]), makeState(), defaultTheme as ThemeConfig, false);
    expect(r.rects).toBe(0);
  });

  it('returns without drawing when no scales', () => {
    const r = makeMockRenderer();
    renderCandlestickSeries(r as unknown as BaseRenderer, makeSeries([bullishCandle]), { ...makeState(), scales: new Map() } as unknown as ChartState, defaultTheme as ThemeConfig, false);
    expect(r.rects).toBe(0);
  });

  it('draws one line (wick) + one rect (body) per candlestick', () => {
    const r = makeMockRenderer();
    renderCandlestickSeries(r as unknown as BaseRenderer, makeSeries([bullishCandle, bearishCandle]), makeState(), defaultTheme as ThemeConfig, false);
    expect(r.lines).toBe(2); // one wick per candle
    expect(r.rects).toBe(2); // one body per candle
  });

  it('draws 3 lines per bar in OHLC mode (no rects)', () => {
    const r = makeMockRenderer();
    renderCandlestickSeries(r as unknown as BaseRenderer, makeSeries([bullishCandle, bearishCandle]), makeState(), defaultTheme as ThemeConfig, true);
    // 3 lines × 2 bars = 6 lines
    expect(r.lines).toBe(6);
    expect(r.rects).toBe(0);
  });

  it('handles three candles correctly', () => {
    const r = makeMockRenderer();
    const thirdCandle = makeOHLCPoint(3, 9, 15, 6, 12);
    renderCandlestickSeries(r as unknown as BaseRenderer, makeSeries([bullishCandle, bearishCandle, thirdCandle]), makeState(), defaultTheme as ThemeConfig, false);
    expect(r.rects).toBe(3);
  });
});
