// ============================================================================
// MapChart — Unit Tests
// ============================================================================
// Tests exercise the SVG choropleth fallback path (no real DOM container),
// which is the code path exercised in a jsdom test environment.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { renderMapChart } from '../../src/charts/MapChart';
import type { BaseRenderer } from '../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../src/core/types';
import { defaultTheme } from '../../src/themes/defaultTheme';

function makeMockRenderer() {
  let paths = 0, texts = 0, rects = 0;
  return {
    get paths() { return paths; },
    get texts() { return texts; },
    get rects() { return rects; },
    // No svg/el property — forces choropleth fallback
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawLine: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    drawPath: () => { paths++; },
    drawText: () => { texts++; },
    drawRect: () => { rects++; },
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 0, y: 0, width: 800, height: 500 },
    width: 800, height: 500, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

// Minimal inline GeoJSON with 2 country polygons
const usCoords: [number, number][][] = [[[-100, 40], [-90, 40], [-90, 30], [-100, 30], [-100, 40]]];
const caCoords: [number, number][][] = [[[-100, 60], [-90, 60], [-90, 50], [-100, 50], [-100, 60]]];
const minimalGeoJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      id: 'US',
      properties: { name: 'United States' },
      geometry: { type: 'Polygon' as const, coordinates: usCoords },
    },
    {
      type: 'Feature' as const,
      id: 'CA',
      properties: { name: 'Canada' },
      geometry: { type: 'Polygon' as const, coordinates: caCoords },
    },
  ],
};

function makeSeries(pts: Array<{ x: string; y: number }> = []) {
  return {
    id: 's1', name: 'Map', type: 'map',
    data: pts.map(p => ({ x: p.x, y: p.y })),
    processedData: pts.map(p => ({ x: p.x, y: p.y, xNum: 0, yNum: p.y })),
  } as any;
}

describe('renderMapChart', () => {
  it('is a function', () => {
    expect(typeof renderMapChart).toBe('function');
  });

  it('draws one path per GeoJSON feature', () => {
    const r = makeMockRenderer();
    renderMapChart(r as unknown as BaseRenderer, [makeSeries()], makeState(), defaultTheme as ThemeConfig, { series: [], map: { geoJSON: minimalGeoJSON } });
    expect(r.paths).toBe(2);
  });

  it('renders with built-in world GeoJSON when none provided (draws paths)', () => {
    const r = makeMockRenderer();
    renderMapChart(r as unknown as BaseRenderer, [makeSeries()], makeState(), defaultTheme as ThemeConfig, { series: [] });
    expect(r.paths).toBeGreaterThan(0);
  });

  it('draws data labels when dataLabels=true and data has matching feature', () => {
    const r = makeMockRenderer();
    renderMapChart(
      r as unknown as BaseRenderer,
      [makeSeries([{ x: 'United States', y: 100 }])],
      makeState(),
      defaultTheme as ThemeConfig,
      { series: [], map: { geoJSON: minimalGeoJSON, dataLabels: true } },
    );
    expect(r.texts).toBeGreaterThan(0);
  });

  it('renders without throwing when series is empty', () => {
    const r = makeMockRenderer();
    expect(() => renderMapChart(r as unknown as BaseRenderer, [makeSeries()], makeState(), defaultTheme as ThemeConfig, { series: [], map: { geoJSON: minimalGeoJSON } })).not.toThrow();
  });

  it('shows "No GeoJSON provided" text when geoJSON has no features', () => {
    const r = makeMockRenderer();
    const emptyGeoJSON = { type: 'FeatureCollection' as const, features: [] };
    renderMapChart(r as unknown as BaseRenderer, [makeSeries()], makeState(), defaultTheme as ThemeConfig, { series: [], map: { geoJSON: emptyGeoJSON as typeof minimalGeoJSON } });
    expect(r.texts).toBeGreaterThanOrEqual(1);
  });
});
