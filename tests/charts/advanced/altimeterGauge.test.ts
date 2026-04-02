// ============================================================================
// AltimeterGauge — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderAltimeterGauge } from '../../../src/charts/advanced/AltimeterGauge';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let circles = 0, lines = 0, texts = 0, paths = 0, rects = 0;
  return {
    get circles() { return circles; },
    get lines()   { return lines;   },
    get texts()   { return texts;   },
    get paths()   { return paths;   },
    get rects()   { return rects;   },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawCircle: () => { circles++; },
    drawLine:   () => { lines++;   },
    drawText:   () => { texts++;   },
    drawPath:   () => { paths++;   },
    drawRect:   () => { rects++;   },
    drawArc: () => {}, drawPolygon: () => {},
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

function makeSeries(altitude = 0) {
  return {
    id: 's1', name: 'Altitude', type: 'altimeter',
    data: [{ x: 0, y: altitude }],
    processedData: [{ x: 0, y: altitude, xNum: 0, yNum: altitude }],
  } as any;
}

describe('renderAltimeterGauge', () => {
  it('is a function', () => {
    expect(typeof renderAltimeterGauge).toBe('function');
  });

  it('draws the bezel circles', () => {
    const r = makeMockRenderer();
    renderAltimeterGauge(r as unknown as BaseRenderer, makeSeries(0), makeState(), defaultTheme as ThemeConfig, '#f59e0b');
    expect(r.circles).toBeGreaterThanOrEqual(2);
  });

  it('draws tick marks as lines', () => {
    const r = makeMockRenderer();
    renderAltimeterGauge(r as unknown as BaseRenderer, makeSeries(0), makeState(), defaultTheme as ThemeConfig, '#f59e0b');
    expect(r.lines).toBeGreaterThan(0);
  });

  it('draws numeric labels for every 100ft mark', () => {
    const r = makeMockRenderer();
    renderAltimeterGauge(r as unknown as BaseRenderer, makeSeries(0), makeState(), defaultTheme as ThemeConfig, '#f59e0b');
    expect(r.texts).toBeGreaterThan(0);
  });

  it('draws needle paths (triangle needle + triangle tip)', () => {
    const r = makeMockRenderer();
    renderAltimeterGauge(r as unknown as BaseRenderer, makeSeries(5000), makeState(), defaultTheme as ThemeConfig, '#f59e0b');
    expect(r.paths).toBeGreaterThan(0);
  });

  it('draws digital readout background rect', () => {
    const r = makeMockRenderer();
    renderAltimeterGauge(r as unknown as BaseRenderer, makeSeries(12345), makeState(), defaultTheme as ThemeConfig, '#f59e0b');
    expect(r.rects).toBeGreaterThanOrEqual(1);
  });

  it('does not throw for extreme altitude values', () => {
    const r = makeMockRenderer();
    expect(() => renderAltimeterGauge(r as unknown as BaseRenderer, makeSeries(99999), makeState(), defaultTheme as ThemeConfig, '#f59e0b')).not.toThrow();
  });
});
