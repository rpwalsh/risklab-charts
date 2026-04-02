// ============================================================================
// Boost Module — Unit Tests
// Tests the synchronous LTTB and MinMax decimation algorithms plus
// the createBoostDecimator pipeline factory.
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  lttbSync,
  minMaxSync,
  createBoostDecimator,
  BoostWorker,
  type BoostOptions,
} from '../../src/boost/index';
import type { DataPoint } from '../../src/core/types';

// ---- Helpers ----------------------------------------------------------------

function makeSeries(n: number, noiseScale = 1): DataPoint[] {
  const data: DataPoint[] = [];
  for (let i = 0; i < n; i++) {
    data.push({
      x: i,
      y: Math.sin(i / 20) * 100 + (Math.random() - 0.5) * noiseScale,
    });
  }
  return data;
}

// ---- lttbSync ---------------------------------------------------------------

describe('lttbSync', () => {
  it('returns the same data when below threshold', () => {
    const data = makeSeries(50);
    const result = lttbSync(data, 200);
    expect(result).toHaveLength(50);
    expect(result).toBe(data); // identity — no copy needed
  });

  it('reduces to exactly the threshold count', () => {
    const data = makeSeries(10_000);
    const result = lttbSync(data, 500);
    expect(result).toHaveLength(500);
  });

  it('always preserves first and last points', () => {
    const data = makeSeries(5_000);
    const result = lttbSync(data, 100);
    expect(result[0]).toEqual(data[0]);
    expect(result[result.length - 1]).toEqual(data[data.length - 1]);
  });

  it('handles exactly 2 points', () => {
    const data = makeSeries(2);
    const result = lttbSync(data, 2);
    expect(result).toHaveLength(2);
  });

  it('returns original data when threshold is 2 or less (early-exit branch)', () => {
    const data = makeSeries(1_000);
    const result = lttbSync(data, 2);
    // Implementation early-exits and returns data unmodified
    expect(result).toBe(data);
  });

  it('handles empty array', () => {
    const result = lttbSync([], 100);
    expect(result).toHaveLength(0);
  });

  it('produces monotonically non-decreasing x values', () => {
    const data = makeSeries(10_000);
    const result = lttbSync(data, 300);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].x as number).toBeGreaterThanOrEqual(result[i - 1].x as number);
    }
  });
});

// ---- minMaxSync -------------------------------------------------------------

describe('minMaxSync', () => {
  it('returns original array when fewer than 2×pixelWidth points', () => {
    const data = makeSeries(100);
    const result = minMaxSync(data, 200);
    expect(result).toBe(data);
  });

  it('reduces large datasets to ~2×pixelWidth points', () => {
    const data = makeSeries(100_000);
    const pixelWidth = 800;
    const result = minMaxSync(data, pixelWidth);
    // result should be ≤ 2 × pixelWidth
    expect(result.length).toBeLessThanOrEqual(pixelWidth * 2 + 2);
  });

  it('handles empty array', () => {
    expect(minMaxSync([], 500)).toHaveLength(0);
  });

  it('preserves peaks (max/min within each bucket)', () => {
    // Construct data where bucket 0 has a spike
    const data: DataPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: i === 5 ? 9999 : 0,
    }));
    const result = minMaxSync(data, 100); // ~10 pts per bucket
    // The spike (9999) must appear somewhere in the result
    expect(result.some(p => p.y === 9999)).toBe(true);
  });
});

// ---- createBoostDecimator ---------------------------------------------------

describe('createBoostDecimator', () => {
  it('returns a function', () => {
    expect(typeof createBoostDecimator()).toBe('function');
  });

  it('defaults to lttb with threshold=1000', () => {
    const dec = createBoostDecimator();
    const data = makeSeries(8_000);  // must exceed autoThreshold default(5000)
    const result = dec(data);
    expect(result.length).toBeLessThanOrEqual(1000);
  });

  it('respects custom threshold', () => {
    const dec = createBoostDecimator({ threshold: 200, autoThreshold: 100 });
    const data = makeSeries(10_000);
    const result = dec(data);
    expect(result).toHaveLength(200);
  });

  it('uses minmax algorithm when specified', () => {
    const dec = createBoostDecimator({ defaultOp: 'minmax', pixelWidth: 400, autoThreshold: 100 });
    const data = makeSeries(50_000);
    const result = dec(data);
    expect(result.length).toBeLessThanOrEqual(400 * 2 + 2);
  });

  it('passes through data below autoThreshold unchanged', () => {
    const dec = createBoostDecimator({ autoThreshold: 2000 });
    const data = makeSeries(100);
    const result = dec(data);
    expect(result).toHaveLength(100);
  });
});

// ---- BoostWorker class ------------------------------------------------------

describe('BoostWorker', () => {
  it('can be instantiated', () => {
    // Worker may or may not be available in test env — should not throw
    expect(() => new BoostWorker()).not.toThrow();
  });

  it('exposes lttb, minmax, sort, auto methods', () => {
    const w = new BoostWorker();
    expect(typeof w.lttb).toBe('function');
    expect(typeof w.minmax).toBe('function');
    expect(typeof w.sort).toBe('function');
    expect(typeof w.auto).toBe('function');
    w.destroy();
  });

  it('lttb falls back to sync when Worker unavailable', async () => {
    const w = new BoostWorker();
    const data = makeSeries(5_000);
    const result = await w.lttb(data, { threshold: 200 });
    expect(result).toHaveLength(200);
    w.destroy();
  });

  it('minmax falls back to sync when Worker unavailable', async () => {
    const w = new BoostWorker();
    const data = makeSeries(10_000);
    const result = await w.minmax(data, { pixelWidth: 400 });
    expect(result.length).toBeLessThanOrEqual(800 + 2);
    w.destroy();
  });

  it('destroy is idempotent', () => {
    const w = new BoostWorker();
    expect(() => { w.destroy(); w.destroy(); }).not.toThrow();
  });
});
