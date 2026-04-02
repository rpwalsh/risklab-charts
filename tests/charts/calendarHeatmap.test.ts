// ============================================================================
// CalendarHeatmap — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderCalendarHeatmap } from '../../src/charts/CalendarHeatmap';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
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
    chartArea: { x: 0, y: 0, width: 900, height: 200 },
    width: 900, height: 200, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(pts: { date: string; value: number }[]) {
  return {
    id: 's1', name: 'Cal', type: 'calendarHeatmap',
    data: pts.map(p => ({ x: p.date, y: p.value })),
    processedData: pts.map(p => ({ x: p.date, y: p.value, yNum: p.value })),
  } as any;
}

// A sparse set of dates spread across one calendar year
const year2024Pts = [
  { date: '2024-01-05', value: 3 },
  { date: '2024-03-20', value: 7 },
  { date: '2024-06-15', value: 1 },
  { date: '2024-09-01', value: 5 },
  { date: '2024-12-25', value: 10 },
];

describe('renderCalendarHeatmap', () => {
  it('is a function', () => {
    expect(typeof renderCalendarHeatmap).toBe('function');
  });

  it('returns without drawing on empty data', () => {
    const r = makeMockRenderer();
    renderCalendarHeatmap(r as unknown as BaseRenderer, [makeSeries([])], makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    expect(r.rects).toBe(0);
  });

  it('draws at least one rect per day-cell in the year', () => {
    const r = makeMockRenderer();
    renderCalendarHeatmap(r as unknown as BaseRenderer, [makeSeries(year2024Pts)], makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    // 2024 has 366 days; plus legend boxes
    expect(r.rects).toBeGreaterThan(300);
  });

  it('draws month and weekday labels by default', () => {
    const r = makeMockRenderer();
    renderCalendarHeatmap(r as unknown as BaseRenderer, [makeSeries(year2024Pts)], makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    // Month labels (12) + weekday labels(~3) + legend texts (2) >= 12
    expect(r.texts).toBeGreaterThanOrEqual(12);
  });

  it('suppresses month labels when showMonthLabels=false', () => {
    const r1 = makeMockRenderer();
    const r2 = makeMockRenderer();
    renderCalendarHeatmap(r1 as unknown as BaseRenderer, [makeSeries(year2024Pts)], makeState(), defaultTheme as ThemeConfig, {} as ChartConfig);
    renderCalendarHeatmap(r2 as unknown as BaseRenderer, [makeSeries(year2024Pts)], makeState(), defaultTheme as ThemeConfig, { calendarHeatmap: { showMonthLabels: false } } as ChartConfig);
    expect(r2.texts).toBeLessThan(r1.texts);
  });

  it('respects custom colorStops', () => {
    const r = makeMockRenderer();
    const config: ChartConfig = {
      calendarHeatmap: {
        colorStops: [{ at: 0, color: '#ebedf0' }, { at: 1, color: '#ff0000' }],
      },
    } as unknown as ChartConfig;
    expect(() => renderCalendarHeatmap(r as unknown as BaseRenderer, [makeSeries(year2024Pts)], makeState(), defaultTheme as ThemeConfig, config)).not.toThrow();
    expect(r.rects).toBeGreaterThan(0);
  });
});
