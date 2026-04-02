import { describe, it, expect } from 'vitest';
import {
  linearRegression,
  polynomialRegression,
  logarithmicRegression,
  exponentialRegression,
  powerRegression,
  loessRegression,
  sma,
  ema,
  wma,
  rsi,
  macd,
} from '../../src/plugins/StatisticsPlugin';

// ── Helpers ───────────────────────────────────────────────────────────────────

const r = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

// ── Linear Regression ─────────────────────────────────────────────────────────
// linearRegression(xs, ys) → (x: number) => number

describe('linearRegression', () => {
  it('returns a predict function', () => {
    const predict = linearRegression([1, 2, 3], [3, 5, 7]);
    expect(typeof predict).toBe('function');
  });

  it('fits a perfect line (y = 2x + 1)', () => {
    const predict = linearRegression([1, 2, 3, 4, 5], [3, 5, 7, 9, 11]);
    expect(r(predict(3))).toBe(7);
    expect(r(predict(6))).toBe(13);
    expect(r(predict(0))).toBe(1);
  });

  it('handles horizontal line (slope = 0)', () => {
    const predict = linearRegression([1, 2, 3, 4], [5, 5, 5, 5]);
    expect(r(predict(100))).toBe(5);
    expect(r(predict(0))).toBe(5);
  });

  it('handles negative slope', () => {
    const predict = linearRegression([0, 1, 2, 3], [10, 7, 4, 1]);
    expect(r(predict(0))).toBe(10);
    expect(r(predict(3))).toBe(1);
  });

  it('extrapolates beyond training range', () => {
    const predict = linearRegression([0, 1, 2], [0, 2, 4]); // y = 2x
    expect(r(predict(10))).toBe(20);
    expect(r(predict(-5))).toBe(-10);
  });

  it('single data point returns constant function', () => {
    const predict = linearRegression([5], [7]);
    expect(typeof predict(42)).toBe('number');
  });
});

// ── Polynomial Regression ─────────────────────────────────────────────────────

describe('polynomialRegression', () => {
  it('returns a predict function', () => {
    const predict = polynomialRegression([1, 2, 3], [1, 4, 9], 2);
    expect(typeof predict).toBe('function');
  });

  it('degree 1 behaves like linear regression', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [3, 5, 7, 9, 11]; // y = 2x + 1
    const predict = polynomialRegression(xs, ys, 1);
    expect(r(predict(0))).toBe(1);
    expect(r(predict(3))).toBe(7);
    expect(r(predict(6))).toBe(13);
  });

  it('fits a quadratic (y = x²)', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [1, 4, 9, 16, 25]; // y = x²
    const predict = polynomialRegression(xs, ys, 2);
    expect(r(predict(1))).toBe(1);
    expect(r(predict(4))).toBe(16);
    expect(r(predict(6), 0)).toBe(36);
  });

  it('higher degree can fit cubic curves', () => {
    const xs = [1, 2, 3, 4, 5, 6];
    const ys = xs.map(x => x ** 3); // y = x³
    const predict = polynomialRegression(xs, ys, 3);
    expect(r(predict(2), 0)).toBe(8);
    expect(r(predict(5), 0)).toBe(125);
  });
});

// ── Logarithmic Regression ────────────────────────────────────────────────────

describe('logarithmicRegression', () => {
  it('returns a predict function', () => {
    const predict = logarithmicRegression([1, 2, 4], [0, 1, 2]);
    expect(typeof predict).toBe('function');
  });

  it('fits y ≈ log₂(x)', () => {
    const xs = [1, 2, 4, 8, 16];
    const ys = [0, 1, 2, 3, 4]; // y = log₂(x) = ln(x)/ln(2)
    const predict = logarithmicRegression(xs, ys);
    expect(r(predict(1), 1)).toBe(0);
    expect(r(predict(4), 1)).toBe(2);
    expect(r(predict(16), 0)).toBe(4);
  });

  it('returns finite values for positive x', () => {
    const predict = logarithmicRegression([1, 2, 3], [0, 0.5, 0.8]);
    expect(isFinite(predict(10))).toBe(true);
    expect(isFinite(predict(100))).toBe(true);
  });

  it('is monotonically increasing for positive slope', () => {
    const predict = logarithmicRegression([1, 4, 16, 64], [0, 1, 2, 3]);
    expect(predict(100)).toBeGreaterThan(predict(10));
  });
});

// ── Exponential Regression ────────────────────────────────────────────────────

describe('exponentialRegression', () => {
  it('returns a predict function', () => {
    const predict = exponentialRegression([0, 1, 2, 3], [1, 2, 4, 8]);
    expect(typeof predict).toBe('function');
  });

  it('fits y = 2^x', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [1, 2, 4, 8, 16];
    const predict = exponentialRegression(xs, ys);
    expect(r(predict(0), 0)).toBe(1);
    expect(r(predict(2), 0)).toBe(4);
    expect(r(predict(4), 0)).toBe(16);
  });

  it('always returns positive values', () => {
    const predict = exponentialRegression([0, 1, 2], [1, 3, 9]);
    expect(predict(10)).toBeGreaterThan(0);
    expect(predict(-10)).toBeGreaterThan(0);
  });

  it('is monotonically increasing for growth data', () => {
    const predict = exponentialRegression([0, 1, 2, 3], [1, 2, 4, 8]);
    expect(predict(5)).toBeGreaterThan(predict(3));
  });
});

// ── Power Regression ──────────────────────────────────────────────────────────

describe('powerRegression', () => {
  it('returns a predict function', () => {
    const predict = powerRegression([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]);
    expect(typeof predict).toBe('function');
  });

  it('fits y = x²', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [1, 4, 9, 16, 25]; // y = x²
    const predict = powerRegression(xs, ys);
    expect(r(predict(1), 0)).toBe(1);
    expect(r(predict(3), 0)).toBe(9);
    expect(r(predict(6), 0)).toBe(36);
  });

  it('fits square root data (y = x^0.5)', () => {
    const xs = [1, 4, 9, 16, 25];
    const ys = [1, 2, 3, 4, 5]; // y = √x
    const predict = powerRegression(xs, ys);
    expect(r(predict(100), 0)).toBe(10);
  });

  it('returns positive values for positive x', () => {
    const predict = powerRegression([1, 2, 3], [1, 8, 27]);
    expect(predict(4)).toBeGreaterThan(0);
  });
});

// ── LOESS Regression ──────────────────────────────────────────────────────────

describe('loessRegression', () => {
  it('returns a predict function', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = [2, 4, 3, 5, 6, 5, 7, 8, 7, 9];
    const predict = loessRegression(xs, ys, 0.5);
    expect(typeof predict).toBe('function');
  });

  it('returns finite values at all input points', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = [2, 4, 3, 5, 6, 5, 7, 8, 7, 9];
    const predict = loessRegression(xs, ys, 0.5);
    for (const x of xs) {
      expect(isFinite(predict(x))).toBe(true);
    }
  });

  it('smooths out a spike', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = [1, 1, 1, 1, 100, 1, 1, 1, 1, 1]; // spike at 5
    const predict = loessRegression(xs, ys, 0.5);
    // Smoothed value at x=5 should be less than 50 (pulled toward neighbors)
    expect(predict(5)).toBeLessThan(50);
  });

  it('bandwidth=1 gives maximally smoothed result', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [1, 10, 1, 10, 1];
    const predict = loessRegression(xs, ys, 1.0);
    // With full bandwidth, spike is heavily damped
    expect(predict(2)).toBeLessThan(8);
  });
});

// ── SMA ───────────────────────────────────────────────────────────────────────

describe('sma', () => {
  it('computes a 3-period SMA', () => {
    const values = [1, 2, 3, 4, 5];
    const result = sma(values, 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(2); // (1+2+3)/3
    expect(result[3]).toBe(3); // (2+3+4)/3
    expect(result[4]).toBe(4); // (3+4+5)/3
  });

  it('returns all nulls for period > data length', () => {
    const result = sma([1, 2], 5);
    expect(result.every(v => v === null)).toBe(true);
  });

  it('period 1 equals original values', () => {
    const values = [3, 7, 2, 8];
    const result = sma(values, 1);
    expect(result).toEqual(values);
  });

  it('handles period equal to data length', () => {
    const values = [2, 4, 6];
    const result = sma(values, 3);
    expect(result[2]).toBe(4); // mean of all
  });

  it('returns same length as input', () => {
    const result = sma([1, 2, 3, 4, 5, 6, 7], 3);
    expect(result).toHaveLength(7);
  });
});

// ── EMA ───────────────────────────────────────────────────────────────────────

describe('ema', () => {
  it('first non-null value appears at period-1 index', () => {
    const values = [10, 20, 30, 40, 50];
    const result = ema(values, 3); // period=3 → first non-null at index 2
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).not.toBeNull();
  });

  it('first EMA value equals SMA of first period elements', () => {
    const values = [10, 20, 30, 40, 50];
    const result = ema(values, 3);
    // First EMA = mean(10,20,30) = 20
    expect(result[2]).toBe(20);
  });

  it('returns same length as input', () => {
    const values = [1, 2, 3, 4, 5];
    expect(ema(values, 3)).toHaveLength(5);
  });

  it('period=1 uses k=1 so each value equals input', () => {
    const values = [3, 7, 2, 8];
    const result = ema(values, 1);
    result.forEach((v, i) => {
      expect(v).not.toBeNull();
      expect(v).toBe(values[i]);
    });
  });

  it('tracks rising data upward', () => {
    const rising = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = ema(rising, 3);
    const nonNull = result.filter((v): v is number => v !== null);
    for (let i = 1; i < nonNull.length; i++) {
      expect(nonNull[i]).toBeGreaterThan(nonNull[i - 1]!);
    }
  });
});

// ── WMA ───────────────────────────────────────────────────────────────────────

describe('wma', () => {
  it('computes weighted moving average correctly', () => {
    const values = [1, 2, 3]; // period 3: weights [1,2,3]
    const result = wma(values, 3);
    // WMA = (1*1 + 2*2 + 3*3) / (1+2+3) = 14/6 ≈ 2.333
    expect(r(result[2]!, 3)).toBe(r(14 / 6, 3));
  });

  it('returns nulls for first (period-1) positions', () => {
    const result = wma([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
  });

  it('period 1 equals original values', () => {
    const values = [5, 3, 8];
    expect(wma(values, 1)).toEqual(values);
  });

  it('returns same length as input', () => {
    expect(wma([1, 2, 3, 4, 5], 3)).toHaveLength(5);
  });

  it('recent values are weighted higher than SMA', () => {
    // Final value is large: WMA should exceed SMA
    const values = [1, 1, 1, 1, 10];
    const smaResult = sma(values, 5);
    const wmaResult = wma(values, 5);
    const lastSma = smaResult[4]!;
    const lastWma = wmaResult[4]!;
    expect(lastWma).toBeGreaterThan(lastSma);
  });
});

// ── RSI ───────────────────────────────────────────────────────────────────────

describe('rsi', () => {
  it('returns array of same length as input', () => {
    const values = Array.from({ length: 20 }, (_, i) => i);
    const result = rsi(values, 14);
    expect(result).toHaveLength(20);
  });

  it('first (period) positions are null', () => {
    const values = Array.from({ length: 20 }, (_, i) => i);
    const result = rsi(values, 14);
    for (let i = 0; i < 14; i++) expect(result[i]).toBeNull();
    expect(result[14]).not.toBeNull();
  });

  it('all-upward prices → RSI > 70 (overbought)', () => {
    const rising = Array.from({ length: 30 }, (_, i) => i * 2);
    const result = rsi(rising, 14);
    const last = result[result.length - 1]!;
    expect(last).toBeGreaterThan(70);
  });

  it('all-downward prices → RSI < 30 (oversold)', () => {
    const falling = Array.from({ length: 30 }, (_, i) => 60 - i * 2);
    const result = rsi(falling, 14);
    const last = result[result.length - 1]!;
    expect(last).toBeLessThan(30);
  });

  it('RSI bounded between 0 and 100', () => {
    const values = [100, 50, 80, 20, 90, 10, 60, 30, 70, 40, 55, 45, 65, 35, 75, 25, 85, 15, 95, 5];
    const result = rsi(values, 14);
    const nonNull = result.filter((v): v is number => v !== null);
    expect(nonNull.every(v => v >= 0 && v <= 100)).toBe(true);
  });

  it('returns all nulls when data too short', () => {
    const result = rsi([1, 2, 3], 14);
    expect(result.every(v => v === null)).toBe(true);
  });
});

// ── MACD ──────────────────────────────────────────────────────────────────────

describe('macd', () => {
  it('returns macdLine, signalLine, and histogram', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = macd(prices, 12, 26, 9);
    expect(result).toHaveProperty('macdLine');
    expect(result).toHaveProperty('signalLine');
    expect(result).toHaveProperty('histogram');
  });

  it('histogram = macdLine - signalLine where both non-null', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const { macdLine, signalLine, histogram } = macd(prices, 12, 26, 9);
    for (let i = 0; i < histogram.length; i++) {
      const m = macdLine[i];
      const s = signalLine[i];
      const h = histogram[i];
      if (m !== null && s !== null && h !== null) {
        expect(r(h, 6)).toBe(r(m - s, 6));
      }
    }
  });

  it('returns arrays of same length as input', () => {
    const prices = Array.from({ length: 50 }, (_, i) => i);
    const { macdLine, signalLine, histogram } = macd(prices, 12, 26, 9);
    expect(macdLine).toHaveLength(50);
    expect(signalLine).toHaveLength(50);
    expect(histogram).toHaveLength(50);
  });

  it('first values are null (slow EMA not computed yet)', () => {
    const prices = Array.from({ length: 50 }, (_, i) => i);
    const { macdLine } = macd(prices, 12, 26, 9);
    expect(macdLine[0]).toBeNull();
  });

  it('rising prices give positive MACD (fast EMA > slow EMA)', () => {
    const prices = Array.from({ length: 60 }, (_, i) => i * 2);
    const { macdLine } = macd(prices, 12, 26, 9);
    const nonNull = macdLine.filter((v): v is number => v !== null);
    expect(nonNull[nonNull.length - 1]).toBeGreaterThan(0);
  });
});
