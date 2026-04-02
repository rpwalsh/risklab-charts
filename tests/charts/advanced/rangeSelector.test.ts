// ============================================================================
// RangeSelector — Unit Tests
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  renderRangeSelector,
  rangeToMs,
  computeRangeForButton,
  DEFAULT_RANGE_BUTTONS,
} from '../../../src/charts/advanced/RangeSelector';
import type { BaseRenderer } from '../../../src/renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../../../src/core/types';
import { defaultTheme } from '../../../src/themes/defaultTheme';

function makeMockRenderer() {
  let rects = 0, texts = 0;
  return {
    get rects() { return rects; }, get texts() { return texts; },
    clear: () => {}, destroy: () => {}, setSize: () => {},
    drawRect: () => { rects++; },
    drawText: () => { texts++; },
    drawPath: () => {}, drawLine: () => {}, drawCircle: () => {}, drawArc: () => {}, drawPolygon: () => {},
    beginGroup: () => {}, endGroup: () => {},
  };
}

function makeState(): ChartState {
  return {
    chartArea: { x: 40, y: 60, width: 720, height: 400 },
    width: 800, height: 500, pixelRatio: 1,
    series: [], scales: new Map(), axes: [],
    theme: defaultTheme as ThemeConfig, plugins: {},
  } as unknown as ChartState;
}

function makeConfig() {
  return { container: document.createElement('div') } as unknown as ChartConfig;
}

describe('renderRangeSelector', () => {
  it('is a function', () => {
    expect(typeof renderRangeSelector).toBe('function');
  });

  it('skips rendering when enabled=false', () => {
    const r = makeMockRenderer();
    renderRangeSelector(r as unknown as BaseRenderer, makeState(), makeConfig(), defaultTheme as ThemeConfig, { enabled: false });
    expect(r.rects).toBe(0);
  });

  it('draws one rect and one text per button with default buttons', () => {
    const r = makeMockRenderer();
    renderRangeSelector(r as unknown as BaseRenderer, makeState(), makeConfig(), defaultTheme as ThemeConfig, {});
    expect(r.rects).toBe(DEFAULT_RANGE_BUTTONS.length);
    expect(r.texts).toBe(DEFAULT_RANGE_BUTTONS.length);
  });

  it('highlights the active button (selectedIdx)', () => {
    // Just verify it doesn't throw and draws the same number of rects
    const r = makeMockRenderer();
    renderRangeSelector(r as unknown as BaseRenderer, makeState(), makeConfig(), defaultTheme as ThemeConfig, {}, 2);
    expect(r.rects).toBe(DEFAULT_RANGE_BUTTONS.length);
  });

  it('renders at bottom when verticalAlign=bottom', () => {
    const r = makeMockRenderer();
    expect(() =>
      renderRangeSelector(r as unknown as BaseRenderer, makeState(), makeConfig(), defaultTheme as ThemeConfig, { verticalAlign: 'bottom' }),
    ).not.toThrow();
  });

  it('renders custom buttons when provided', () => {
    const r = makeMockRenderer();
    renderRangeSelector(
      r as unknown as BaseRenderer,
      makeState(), makeConfig(), defaultTheme as ThemeConfig,
      { buttons: [{ label: '7D', count: 7, unit: 'day' }, { label: 'All', unit: 'all' }] },
    );
    expect(r.rects).toBe(2);
  });
});

describe('rangeToMs', () => {
  const now = Date.now();

  it('converts day unit', () => {
    expect(rangeToMs(1, 'day', now)).toBe(86_400_000);
  });

  it('converts week unit', () => {
    expect(rangeToMs(1, 'week', now)).toBe(7 * 86_400_000);
  });

  it('returns Infinity for all unit', () => {
    expect(rangeToMs(0, 'all', now)).toBe(Infinity);
  });

  it('returns 0 for unknown unit', () => {
    expect(rangeToMs(1, undefined, now)).toBe(0);
  });
});

describe('computeRangeForButton', () => {
  const dataPoints = [{ x: 1_700_000_000_000 }, { x: 1_700_086_400_000 }, { x: 1_700_172_800_000 }];

  it('returns {from, to} with to = max data', () => {
    const { to } = computeRangeForButton({ label: '1D', count: 1, unit: 'day' }, dataPoints);
    expect(to).toBe(1_700_172_800_000);
  });

  it('returns from=min for unit=all', () => {
    const { from } = computeRangeForButton({ label: 'All', unit: 'all' }, dataPoints);
    expect(from).toBe(1_700_000_000_000);
  });

  it('handles empty data array', () => {
    const result = computeRangeForButton({ label: '1D', count: 1, unit: 'day' }, []);
    expect(result.from).toBe(0);
  });
});
