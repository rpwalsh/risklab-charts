// ============================================================================
// DependencyWheelChart — Unit Tests
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import {
  renderDependencyWheel,
  type DependencyWheelConfig,
  type DependencyWheelNode,
  type DependencyWheelLink,
} from '../../src/charts/DependencyWheelChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

// Minimal mock renderer that records draw calls
function makeMockRenderer(): BaseRenderer & { calls: string[] } {
  const calls: string[] = [];
  const rec = (name: string) => (..._args: unknown[]) => { calls.push(name); };
  return {
    calls,
    clear: rec('clear'),
    destroy: rec('destroy'),
    setSize: rec('setSize'),
    drawRect: rec('drawRect'),
    drawCircle: rec('drawCircle'),
    drawLine: rec('drawLine'),
    drawPath: rec('drawPath'),
    drawText: rec('drawText'),
    drawPolygon: rec('drawPolygon'),
    drawArc: rec('drawArc'),
    beginGroup: rec('beginGroup'),
    endGroup: rec('endGroup'),
    // Cast needed — abstract class
  } as unknown as BaseRenderer & { calls: string[] };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 10, y: 10, width: 400, height: 400 },
    width: 420,
    height: 420,
    pixelRatio: 1,
    series: [],
    scales: {},
    axes: [],
    theme: defaultTheme as ThemeConfig,
    plugins: {},
  } as unknown as ChartState;
}

const NODES: DependencyWheelNode[] = [
  { id: 'A', name: 'Alpha' },
  { id: 'B', name: 'Beta' },
  { id: 'C', name: 'Gamma' },
];

const LINKS: DependencyWheelLink[] = [
  { from: 'A', to: 'B', weight: 10 },
  { from: 'B', to: 'C', weight: 5 },
  { from: 'A', to: 'C', weight: 3 },
];

const CFG: DependencyWheelConfig = {
  nodes: NODES,
  links: LINKS,
};

describe('renderDependencyWheel', () => {
  it('is a function', () => {
    expect(typeof renderDependencyWheel).toBe('function');
  });

  it('does nothing when no dependencyWheel config provided', () => {
    const r = makeMockRenderer();
    renderDependencyWheel(r, [], makeState(), defaultTheme as ThemeConfig, {});
    expect(r.calls).toHaveLength(0);
  });

  it('draws arcs (drawPath) for nodes', () => {
    const r = makeMockRenderer();
    renderDependencyWheel(r, [], makeState(), defaultTheme as ThemeConfig, {
      dependencyWheel: CFG,
    } as any);
    const pathCalls = r.calls.filter(c => c === 'drawPath');
    // 3 chords + 3 node arcs = 6 drawPath calls minimum
    expect(pathCalls.length).toBeGreaterThanOrEqual(6);
  });

  it('draws labels when showLabels is true', () => {
    const r = makeMockRenderer();
    renderDependencyWheel(r, [], makeState(), defaultTheme as ThemeConfig, {
      dependencyWheel: { ...CFG, showLabels: true },
    } as any);
    const textCalls = r.calls.filter(c => c === 'drawText');
    expect(textCalls.length).toBe(NODES.length);
  });

  it('skips labels when showLabels is false', () => {
    const r = makeMockRenderer();
    renderDependencyWheel(r, [], makeState(), defaultTheme as ThemeConfig, {
      dependencyWheel: { ...CFG, showLabels: false },
    } as any);
    const textCalls = r.calls.filter(c => c === 'drawText');
    expect(textCalls).toHaveLength(0);
  });

  it('uses beginGroup/endGroup pairs', () => {
    const r = makeMockRenderer();
    renderDependencyWheel(r, [], makeState(), defaultTheme as ThemeConfig, {
      dependencyWheel: CFG,
    } as any);
    const begins = r.calls.filter(c => c === 'beginGroup');
    const ends = r.calls.filter(c => c === 'endGroup');
    expect(begins.length).toBe(ends.length);
    expect(begins.length).toBeGreaterThanOrEqual(2);
  });

  it('infers node ids from links when nodes not provided', () => {
    const r = makeMockRenderer();
    // No nodes array — should still work
    renderDependencyWheel(r, [], makeState(), defaultTheme as ThemeConfig, {
      dependencyWheel: { links: LINKS },
    } as any);
    const pathCalls = r.calls.filter(c => c === 'drawPath');
    expect(pathCalls.length).toBeGreaterThan(0);
  });

  it('handles zero-weight links gracefully', () => {
    const r = makeMockRenderer();
    const linksWithZero: DependencyWheelLink[] = [
      { from: 'A', to: 'B', weight: 0 },
      { from: 'B', to: 'C', weight: 5 },
    ];
    expect(() => renderDependencyWheel(
      r, [], makeState(), defaultTheme as ThemeConfig,
      { dependencyWheel: { links: linksWithZero } } as any,
    )).not.toThrow();
  });
});
