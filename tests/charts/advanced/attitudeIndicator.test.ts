// ============================================================================
// AttitudeIndicator — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderAttitudeIndicator } from '../../../src/charts/advanced/AttitudeIndicator';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, lines = 0, texts = 0, paths = 0;
  return {
    get circles() { return circles; }, get lines() { return lines; },
    get texts()   { return texts;   }, get paths() { return paths; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle:  () => { circles++; },
    drawLine:    () => { lines++;   },
    drawText:    () => { texts++;   },
    drawPath:    () => { paths++;   },
    drawRect: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 400, height: 400 },
    width: 400, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeSeries(pitch = 0, roll = 0) {
  return {
    id: 's1', name: 'Attitude', type: 'attitude',
    data: [{ x: roll, y: pitch, meta: { pitch, roll } }],
    processedData: [{ x: roll, y: pitch, xNum: roll, yNum: pitch }],
  } as any;
}

describe('renderAttitudeIndicator', () => {
  it('is a function', () => {
    expect(typeof renderAttitudeIndicator).toBe('function');
  });

  it('draws at least 2 circles (bezel + mask)', () => {
    const r = makeMockRenderer();
    renderAttitudeIndicator(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig);
    expect(r.circles).toBeGreaterThanOrEqual(2);
  });

  it('draws sky and ground paths', () => {
    const r = makeMockRenderer();
    renderAttitudeIndicator(r as unknown as BaseRenderer, makeSeries(), makeState(), defaultTheme as ThemeConfig);
    expect(r.paths).toBeGreaterThanOrEqual(2);
  });

  it('draws pitch ladder lines', () => {
    const r = makeMockRenderer();
    renderAttitudeIndicator(r as unknown as BaseRenderer, makeSeries(10, 15), makeState(), defaultTheme as ThemeConfig);
    expect(r.lines).toBeGreaterThan(0);
  });

  it('draws roll-arc tick lines', () => {
    const r = makeMockRenderer();
    renderAttitudeIndicator(r as unknown as BaseRenderer, makeSeries(0, 30), makeState(), defaultTheme as ThemeConfig);
    // aircraft wings are 2 lines + roll ticks
    expect(r.lines).toBeGreaterThan(2);
  });

  it('does not throw for extreme pitch/roll values', () => {
    const r = makeMockRenderer();
    expect(() => renderAttitudeIndicator(r as unknown as BaseRenderer, makeSeries(85, -60), makeState(), defaultTheme as ThemeConfig)).not.toThrow();
  });
});
