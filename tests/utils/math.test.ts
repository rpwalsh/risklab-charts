import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  mapRange,
  distance,
  angle,
  toRadians,
  toDegrees,
  roundTo,
  sum,
  mean,
  median,
  variance,
  standardDeviation,
  min,
  max,
  percentile,
  quartiles,
  pointOnCircle,
  pointInRect,
} from '../../src/utils/math';

const r = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

// ── clamp ─────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
  it('clamps to min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps to max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('works with negative ranges', () => expect(clamp(-3, -10, -1)).toBe(-3));
});

// ── lerp ──────────────────────────────────────────────────────────────────────

describe('lerp', () => {
  it('t=0 returns start', () => expect(lerp(0, 10, 0)).toBe(0));
  it('t=1 returns end', () => expect(lerp(0, 10, 1)).toBe(10));
  it('t=0.5 returns midpoint', () => expect(lerp(0, 10, 0.5)).toBe(5));
  it('works with negative values', () => expect(lerp(-10, 10, 0.5)).toBe(0));
  it('works with same start/end', () => expect(lerp(5, 5, 0.3)).toBe(5));
});

// ── mapRange ──────────────────────────────────────────────────────────────────

describe('mapRange', () => {
  it('maps 0-10 to 0-100', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
  });
  it('maps at input min → output min', () => {
    expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
  });
  it('maps at input max → output max', () => {
    expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
  });
  it('handles negative output range', () => {
    expect(mapRange(0.5, 0, 1, -1, 1)).toBe(0);
  });
  it('handles inverted input range', () => {
    expect(mapRange(0, 10, 0, 0, 100)).toBe(100);
  });
});

// ── distance ──────────────────────────────────────────────────────────────────

describe('distance', () => {
  it('3-4-5 triangle', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });
  it('same point → distance 0', () => {
    expect(distance(7, 7, 7, 7)).toBe(0);
  });
  it('horizontal distance', () => {
    expect(distance(0, 0, 5, 0)).toBe(5);
  });
  it('vertical distance', () => {
    expect(distance(0, 0, 0, 5)).toBe(5);
  });
  it('negative coordinates', () => {
    expect(distance(-3, 0, 0, 4)).toBe(5);
  });
});

// ── angle ─────────────────────────────────────────────────────────────────────

describe('angle', () => {
  it('right = 0°', () => expect(r(angle(0, 0, 1, 0))).toBe(0));
  it('up = -90° (angle already returns degrees)', () => {
    // angle() returns degrees directly — no toDegrees() wrapper needed
    const a = angle(0, 0, 0, -1);
    expect(Math.abs(a)).toBeCloseTo(90, 0);
  });
  it('45° diagonal', () => {
    expect(r(angle(0, 0, 1, 1), 1)).toBe(45);
  });
});

// ── toRadians / toDegrees ─────────────────────────────────────────────────────

describe('toRadians / toDegrees', () => {
  it('180° → π', () => expect(r(toRadians(180))).toBe(r(Math.PI)));
  it('360° → 2π', () => expect(r(toRadians(360))).toBe(r(2 * Math.PI)));
  it('0° → 0', () => expect(toRadians(0)).toBe(0));
  it('π → 180°', () => expect(r(toDegrees(Math.PI))).toBe(180));
  it('round-trip', () => {
    expect(r(toDegrees(toRadians(45)))).toBe(45);
  });
});

// ── roundTo ───────────────────────────────────────────────────────────────────

describe('roundTo', () => {
  it('rounds to 0 decimals', () => expect(roundTo(3.7, 0)).toBe(4));
  it('rounds to 2 decimals', () => expect(roundTo(3.14159, 2)).toBe(3.14));
  it('rounds to 4 decimals', () => expect(roundTo(1.23456789, 4)).toBe(1.2346));
  it('handles negative numbers', () => expect(roundTo(-2.555, 2)).toBe(-2.56));
  it('zero remains zero', () => expect(roundTo(0, 3)).toBe(0));
});

// ── sum / mean / median ───────────────────────────────────────────────────────

describe('sum', () => {
  it('sums integers', () => expect(sum([1, 2, 3, 4, 5])).toBe(15));
  it('empty array → 0', () => expect(sum([])).toBe(0));
  it('single value', () => expect(sum([42])).toBe(42));
  it('negative values', () => expect(sum([-1, -2, -3])).toBe(-6));
});

describe('mean', () => {
  it('returns arithmetic mean', () => expect(mean([1, 2, 3, 4, 5])).toBe(3));
  it('handles decimals', () => expect(r(mean([1.5, 2.5]))).toBe(2));
  it('single value', () => expect(mean([7])).toBe(7));
  it('empty array → NaN or 0', () => {
    const result = mean([]);
    expect(result === 0 || isNaN(result)).toBe(true);
  });
});

describe('median', () => {
  it('odd count — middle value', () => expect(median([3, 1, 2])).toBe(2));
  it('even count — average of two middles', () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it('single value', () => expect(median([9])).toBe(9));
  it('same values', () => expect(median([5, 5, 5])).toBe(5));
  it('does not mutate input', () => {
    const arr = [5, 1, 3];
    median(arr);
    expect(arr).toEqual([5, 1, 3]);
  });
});

// ── variance / standardDeviation ─────────────────────────────────────────────

describe('variance', () => {
  it('all same values → 0', () => expect(variance([5, 5, 5])).toBe(0));
  it('known variance [2, 4, 4, 4, 5, 5, 7, 9] = 4', () => {
    // Population variance
    expect(r(variance([2, 4, 4, 4, 5, 5, 7, 9]))).toBe(4);
  });
  it('returns non-negative', () => {
    expect(variance([1, 2, 3, 4, 5])).toBeGreaterThanOrEqual(0);
  });
});

describe('standardDeviation', () => {
  it('σ = √variance', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(r(standardDeviation(data))).toBe(2);
  });
  it('all same values → 0', () => {
    expect(standardDeviation([7, 7, 7, 7])).toBe(0);
  });
});

// ── min / max ─────────────────────────────────────────────────────────────────

describe('min', () => {
  it('finds minimum', () => expect(min([3, 1, 4, 1, 5, 9])).toBe(1));
  it('negative values', () => expect(min([-5, -1, -10])).toBe(-10));
  it('single value', () => expect(min([42])).toBe(42));
});

describe('max', () => {
  it('finds maximum', () => expect(max([3, 1, 4, 1, 5, 9])).toBe(9));
  it('negative values', () => expect(max([-5, -1, -10])).toBe(-1));
  it('single value', () => expect(max([42])).toBe(42));
});

// ── percentile ────────────────────────────────────────────────────────────────

describe('percentile', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('50th percentile is median', () => {
    expect(percentile(data, 50)).toBe(median(data));
  });

  it('0th percentile is min', () => {
    expect(percentile(data, 0)).toBe(1);
  });

  it('100th percentile is max', () => {
    expect(percentile(data, 100)).toBe(10);
  });

  it('25th percentile for uniform distribution', () => {
    const p25 = percentile(data, 25);
    expect(p25).toBeGreaterThan(1);
    expect(p25).toBeLessThan(5);
  });
});

// ── quartiles ─────────────────────────────────────────────────────────────────

describe('quartiles', () => {
  it('returns Q1, Q2, Q3', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { q1, q2, q3 } = quartiles(data);
    expect(q1).toBeLessThan(q2);
    expect(q2).toBeLessThan(q3);
  });

  it('Q2 is median', () => {
    const data = [2, 4, 6, 8, 10];
    expect(quartiles(data).q2).toBe(median(data));
  });
});

// ── pointOnCircle ─────────────────────────────────────────────────────────────

describe('pointOnCircle', () => {
  // pointOnCircle uses clock convention: 0° = 12-o'clock (top), 90° = 3-o'clock (right)
  it('90° gives rightmost point', () => {
    const { x, y } = pointOnCircle(0, 0, 10, 90);
    expect(r(x)).toBe(10);
    expect(r(y, 4)).toBe(0);
  });

  it('180° gives bottom-center point', () => {
    // 180° → toRadians(180-90)=π/2 → cos(π/2)≈0, sin(π/2)=1 → {x:0, y:10}
    const { x, y } = pointOnCircle(0, 0, 10, 180);
    expect(r(x, 4)).toBe(0);
    expect(r(y, 4)).toBe(10);
  });

  it('radius determines distance from center', () => {
    const { x, y } = pointOnCircle(5, 5, 3, 45);
    const d = distance(5, 5, x, y);
    expect(r(d)).toBe(3);
  });
});

// ── pointInRect ───────────────────────────────────────────────────────────────

describe('pointInRect', () => {
  // pointInRect(px, py, rx, ry, rw, rh) — 6 separate args

  it('center point is inside', () => {
    expect(pointInRect(5, 5, 0, 0, 10, 10)).toBe(true);
  });

  it('outside point is not inside', () => {
    expect(pointInRect(15, 5, 0, 0, 10, 10)).toBe(false);
    expect(pointInRect(5, 15, 0, 0, 10, 10)).toBe(false);
    expect(pointInRect(-1, 5, 0, 0, 10, 10)).toBe(false);
  });

  it('boundary points are inside (inclusive)', () => {
    expect(pointInRect(0, 0, 0, 0, 10, 10)).toBe(true);
    expect(pointInRect(10, 10, 0, 0, 10, 10)).toBe(true);
  });
});
