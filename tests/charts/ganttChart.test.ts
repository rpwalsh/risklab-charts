// ============================================================================
// GanttChart — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderGanttChart } from '../../src/charts/GanttChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockScale() {
  return {
    convert: (v: number) => v / 10000000,
    bandwidth: 60,
    ticks: (n = 5) => Array.from({ length: n }, (_, i) => i * 1000000),
  };
}

function makeMockRenderer() {
  let rects = 0, paths = 0, lines = 0, texts = 0, groups = 0;
  return {
    get rects() { return rects; },
    get paths() { return paths; },
    get lines() { return lines; },
    get texts() { return texts; },
    get groups() { return groups; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawRect: () => { rects++; },
    drawPath: () => { paths++; },
    drawLine: () => { lines++; },
    drawText: () => { texts++; },
    beginGroup: () => { groups++; },
    endGroup: () => {},
    defineClipRect: () => {},
  };
}

function makeState(): ChartState {
  const scales = new Map();
  scales.set('x0', makeMockScale());
  scales.set('y0', { convert: (v: number) => v * 30, bandwidth: 30, ticks: () => [] });
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 400 },
    width: 800, height: 400, pixelRatio: 1,
    series: [], scales, axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
    hoveredPoint: null, selectedPoints: [],
  } as unknown as ChartState;
}

// Dates as timestamps for simplicity
const t0 = new Date('2024-01-01').getTime();
const t1 = new Date('2024-02-01').getTime();
const t2 = new Date('2024-03-01').getTime();
const t3 = new Date('2024-04-01').getTime();

function makeSeries(tasks: Array<{ label?: string; start: number; end: number }>, extra: Record<string, unknown> = {}) {
  return {
    id: 's1', name: 'Tasks', type: 'gantt',
    data: tasks.map((t, i) => ({ x: t.label ?? `Task ${i}`, start: t.start, end: t.end, label: t.label ?? `Task ${i}` })),
    processedData: tasks.map(t => ({ xNum: t.start, yNum: 0 })),
    ...extra,
  } as any;
}

describe('renderGanttChart', () => {
  it('is a function', () => {
    expect(typeof renderGanttChart).toBe('function');
  });

  it('returns without drawing when series is empty', () => {
    const r = makeMockRenderer();
    renderGanttChart(r as unknown as BaseRenderer, [], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.rects).toBe(0);
  });

  it('draws rects for task bars', () => {
    const r = makeMockRenderer();
    renderGanttChart(r as unknown as BaseRenderer, [makeSeries([{ start: t0, end: t1 }, { start: t1, end: t2 }])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    // Each non-milestone task draws track + main bar = 2 rects; so ≥ 2 rects per task
    expect(r.rects).toBeGreaterThanOrEqual(2);
  });

  it('draws labels for bars', () => {
    const r = makeMockRenderer();
    renderGanttChart(r as unknown as BaseRenderer, [makeSeries([{ label: 'Design', start: t0, end: t2 }, { label: 'Build', start: t1, end: t3 }])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.texts).toBeGreaterThanOrEqual(2);
  });

  it('draws milestone as path (diamond), not rect', () => {
    const r = makeMockRenderer();
    const series = {
      id: 's1', name: 'Milestones', type: 'gantt',
      data: [{ x: 'Launch', start: t1, end: t1, milestone: true, label: 'Launch' }],
      processedData: [{ xNum: t1, yNum: 0 }],
    } as any;
    renderGanttChart(r as unknown as BaseRenderer, [series], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.paths).toBeGreaterThanOrEqual(1);
  });

  it('draws progress overlay when progress is set', () => {
    const r = makeMockRenderer();
    const series = {
      id: 's1', name: 'Tasks', type: 'gantt',
      data: [{ x: 'Task1', start: t0, end: t2, progress: 0.5, label: 'Task1' }],
      processedData: [{ xNum: t0, yNum: 0 }],
    } as any;
    renderGanttChart(r as unknown as BaseRenderer, [series], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    // track + progress + dimmed tail = 3 rects (main bar omitted when progress set to avoid tail double-compositing)
    expect(r.rects).toBeGreaterThanOrEqual(3);
  });

  it('uses beginGroup', () => {
    const r = makeMockRenderer();
    renderGanttChart(r as unknown as BaseRenderer, [makeSeries([{ start: t0, end: t1 }])], makeState(), {} as ChartConfig, defaultTheme as ThemeConfig);
    expect(r.groups).toBeGreaterThanOrEqual(1);
  });
});
