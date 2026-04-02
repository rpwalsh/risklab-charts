// ============================================================================
// StockChart — Unit Tests
// ============================================================================
// createStockChart is a factory function that wires up an Engine with OHLC /
// candlestick series, technical indicators, a navigator and range selector.
// These are smoke-tests to verify: the export exists, the factory returns an
// Engine-shaped object, and it accepts the various config scenarios without
// throwing.
// ============================================================================
import { describe, it, expect, vi, afterEach } from 'vitest';

// Stub the Engine to avoid spinning up a full renderer in jsdom
vi.mock('../../src/core/Engine', () => ({
  Engine: vi.fn().mockImplementation((cfg) => ({
    _cfg: cfg,
    destroy: vi.fn(),
    render: vi.fn(),
    update: vi.fn(),
    zoomToRange: vi.fn(),
  })),
}));

import { createStockChart } from '../../src/charts/StockChart';
import { Engine } from '../../src/core/Engine';

const MockEngine = Engine as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  MockEngine.mockClear();
});

const OHLC_DATA = [
  { x: 1_700_000_000_000, open: 150, high: 155, low: 148, close: 153, y: 153 },
  { x: 1_700_086_400_000, open: 153, high: 158, low: 151, close: 156, y: 156 },
];

describe('createStockChart', () => {
  it('is a function export', () => {
    expect(typeof createStockChart).toBe('function');
  });

  it('returns an Engine instance for minimal config', () => {
    const container = document.createElement('div');
    const chart = createStockChart({
      container,
      series: [{ id: 's1', name: 'AAPL', type: 'candlestick', data: OHLC_DATA }],
    });
    expect(chart).toBeDefined();
    expect(MockEngine).toHaveBeenCalledOnce();
  });

  it('passes series through to the engine config', () => {
    const container = document.createElement('div');
    createStockChart({
      container,
      series: [{ id: 's1', name: 'AAPL', type: 'candlestick', data: OHLC_DATA }],
    });
    const cfg = MockEngine.mock.calls[0][0] as any;
    expect(cfg.series[0].type).toBe('candlestick');
  });

  it('sets seriesType=ohlc correctly', () => {
    const container = document.createElement('div');
    createStockChart({
      container,
      seriesType: 'ohlc',
      series: [{ id: 's1', name: 'AAPL', type: 'ohlc', data: OHLC_DATA }],
    });
    const cfg = MockEngine.mock.calls[0][0] as any;
    expect(cfg.series[0].type).toBe('ohlc');
  });

  it('includes volume axis when a volume series is present', () => {
    const container = document.createElement('div');
    createStockChart({
      container,
      series: [
        { id: 's1', name: 'AAPL', type: 'candlestick', data: OHLC_DATA },
        { id: 'volume', name: 'Volume', type: 'bar', data: OHLC_DATA },
      ],
    });
    const cfg = MockEngine.mock.calls[0][0] as any;
    expect(cfg.axes.some((a: any) => a.id === 'y1')).toBe(true);
  });

  it('populates statistics config when indicators are provided', () => {
    const container = document.createElement('div');
    createStockChart({
      container,
      series: [{ id: 's1', name: 'AAPL', type: 'candlestick', data: OHLC_DATA }],
      indicators: [{ type: 'sma', period: 20 }, { type: 'bollinger', period: 20 }],
    });
    const cfg = MockEngine.mock.calls[0][0] as any;
    expect(cfg.statistics).toBeDefined();
    expect(cfg.statistics.movingAverages.length).toBeGreaterThan(0);
  });

  it('enables navigator by default', () => {
    const container = document.createElement('div');
    createStockChart({ container, series: [{ id: 's1', name: 'A', type: 'candlestick', data: OHLC_DATA }] });
    const cfg = MockEngine.mock.calls[0][0] as any;
    expect(cfg.navigator).toBeDefined();
  });

  it('passes custom title to the engine config', () => {
    const container = document.createElement('div');
    createStockChart({
      container,
      title: 'My Stock Chart',
      series: [{ id: 's1', name: 'A', type: 'candlestick', data: OHLC_DATA }],
    });
    const cfg = MockEngine.mock.calls[0][0] as any;
    expect(cfg.title?.text).toBe('My Stock Chart');
  });
});
