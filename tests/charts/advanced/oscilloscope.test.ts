// ============================================================================
// Oscilloscope — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderOscilloscope } from '../../../src/charts/advanced/Oscilloscope';
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
    drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 600, height: 400 },
    width: 600, height: 400, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeWave(samples: number, name = 'CH1') {
  return {
    id: 's1', name,
    data: Array.from({ length: samples }, (_, i) => ({ x: i, y: Math.sin(i / 10) })),
    processedData: [],
  } as any;
}

describe('renderOscilloscope', () => {
  it('is a function', () => {
    expect(typeof renderOscilloscope).toBe('function');
  });

  it('draws the CRT background rect', () => {
    const r = makeMockRenderer();
    renderOscilloscope(r as unknown as BaseRenderer, makeWave(20), makeState(), defaultTheme as ThemeConfig, '#00ff41', 0);
    expect(r.rects).toBeGreaterThanOrEqual(1);
  });

  it('draws grid lines (divX+1 vertical + divY+1 horizontal)', () => {
    const r = makeMockRenderer();
    renderOscilloscope(r as unknown as BaseRenderer, makeWave(20), makeState(), defaultTheme as ThemeConfig, '#00ff41', 0);
    // 11 vertical + 9 horizontal + center tick lines
    expect(r.lines).toBeGreaterThan(10);
  });

  it('draws 3 paths for the waveform (glow×2 + main trace)', () => {
    const r = makeMockRenderer();
    renderOscilloscope(r as unknown as BaseRenderer, makeWave(20), makeState(), defaultTheme as ThemeConfig, '#00ff41', 0);
    // 3 waveform paths + possible trigger marker path
    expect(r.paths).toBeGreaterThanOrEqual(3);
  });

  it('draws channel label text', () => {
    const r = makeMockRenderer();
    renderOscilloscope(r as unknown as BaseRenderer, makeWave(20), makeState(), defaultTheme as ThemeConfig, '#00ff41', 0);
    expect(r.texts).toBeGreaterThanOrEqual(1);
  });

  it('draws only grid and background when data is empty (no waveform paths)', () => {
    const r = makeMockRenderer();
    const empty = { id: 's1', name: 'CH1', data: [], processedData: [] } as any;
    renderOscilloscope(r as unknown as BaseRenderer, empty, makeState(), defaultTheme as ThemeConfig, '#00ff41', 0);
    // CRT rect + grid lines should still be drawn; no waveform paths
    expect(r.rects).toBeGreaterThanOrEqual(1);
    expect(r.paths).toBe(0); // no waveform paths
  });
});
