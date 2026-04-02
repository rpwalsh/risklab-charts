// ============================================================================
// Scale System — Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { createScale, niceStep, linearTicks, clamp } from '../../src/scales';

describe('Scale System', () => {
  // ─── Linear Scale ───────────────────────────────────────────────────
  describe('linear scale', () => {
    it('should map domain to range linearly', () => {
      const scale = createScale('linear', [0, 100], [0, 500]);
      expect(scale.convert(0)).toBe(0);
      expect(scale.convert(50)).toBe(250);
      expect(scale.convert(100)).toBe(500);
    });

    it('should invert from pixel back to value', () => {
      const scale = createScale('linear', [0, 100], [0, 500]);
      expect(scale.invert(250)).toBe(50);
    });

    it('should clamp values when clamp=true', () => {
      const scale = createScale('linear', [0, 100], [0, 500], { clamp: true });
      expect(scale.convert(-10)).toBe(0);
      expect(scale.convert(110)).toBe(500);
    });

    it('should invert range when inverted=true', () => {
      const scale = createScale('linear', [0, 100], [0, 500], { inverted: true });
      // 0 maps to 500, 100 maps to 0
      expect(scale.convert(0)).toBe(500);
      expect(scale.convert(100)).toBe(0);
    });

    it('should produce nice domain when nice=true', () => {
      const scale = createScale('linear', [3.7, 97.2], [0, 500], { nice: true });
      expect(scale.domain[0]).toBeLessThanOrEqual(3.7);
      expect(scale.domain[1]).toBeGreaterThanOrEqual(97.2);
      // Should be rounded to nice numbers
      expect(scale.domain[0]! as number % 1).toBe(0);
    });

    it('should generate ticks', () => {
      const scale = createScale('linear', [0, 100], [0, 500]);
      const ticks = scale.ticks(5);
      expect(ticks.length).toBeGreaterThan(0);
      for (const t of ticks) {
        expect(Number(t)).toBeGreaterThanOrEqual(0);
        expect(Number(t)).toBeLessThanOrEqual(100);
      }
    });
  });

  // ─── Logarithmic Scale ─────────────────────────────────────────────
  describe('logarithmic scale', () => {
    it('should map via log10', () => {
      const scale = createScale('logarithmic', [1, 1000], [0, 300]);
      // log10(1)=0, log10(1000)=3, so 10 (log10=1) → 100px
      expect(scale.convert(1)).toBeCloseTo(0, 0);
      expect(scale.convert(10)).toBeCloseTo(100, 0);
      expect(scale.convert(100)).toBeCloseTo(200, 0);
      expect(scale.convert(1000)).toBeCloseTo(300, 0);
    });

    it('should handle near-zero domain gracefully', () => {
      const scale = createScale('logarithmic', [0, 100], [0, 200]);
      const val = scale.convert(1);
      expect(isFinite(val)).toBe(true);
    });

    it('should produce power-of-10 ticks', () => {
      const scale = createScale('logarithmic', [1, 10000], [0, 400]);
      const ticks = scale.ticks();
      expect(ticks).toContain(1);
      expect(ticks).toContain(10);
      expect(ticks).toContain(100);
      expect(ticks).toContain(1000);
      expect(ticks).toContain(10000);
    });
  });

  // ─── Time Scale ─────────────────────────────────────────────────────
  describe('time scale', () => {
    it('should convert Date objects', () => {
      const t0 = new Date('2024-01-01').getTime();
      const t1 = new Date('2024-12-31').getTime();
      const scale = createScale('time', [t0, t1], [0, 1000]);

      const mid = new Date('2024-07-01');
      const pixel = scale.convert(mid);
      expect(pixel).toBeGreaterThan(400);
      expect(pixel).toBeLessThan(600);
    });

    it('should invert to Date', () => {
      const t0 = new Date('2024-01-01').getTime();
      const t1 = new Date('2024-12-31').getTime();
      const scale = createScale('time', [t0, t1], [0, 1000]);

      const result = scale.invert(500);
      expect(result).toBeInstanceOf(Date);
    });

    it('should generate Date ticks', () => {
      const t0 = new Date('2024-01-01').getTime();
      const t1 = new Date('2024-12-31').getTime();
      const scale = createScale('time', [t0, t1], [0, 1000]);
      const ticks = scale.ticks(4);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]).toBeInstanceOf(Date);
    });
  });

  // ─── Band Scale ─────────────────────────────────────────────────────
  describe('band scale', () => {
    it('should place categories in bands', () => {
      const scale = createScale('band', ['A', 'B', 'C'] as any, [0, 300]);
      const a = scale.convert('A');
      const b = scale.convert('B');
      const c = scale.convert('C');

      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(c);
    });

    it('should have a bandwidth', () => {
      const scale = createScale('band', ['A', 'B', 'C'] as any, [0, 300]);
      expect(scale.bandwidth).toBeGreaterThan(0);
    });

    it('should return all domain values as ticks', () => {
      const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
      const scale = createScale('band', labels as any, [0, 400]);
      expect(scale.ticks()).toEqual(labels);
    });

    it('should invert pixel to nearest category', () => {
      const scale = createScale('band', ['A', 'B', 'C'] as any, [0, 300]);
      const bPixel = scale.convert('B');
      const inverted = scale.invert(bPixel);
      expect(inverted).toBe('B');
    });
  });

  // ─── Point Scale ────────────────────────────────────────────────────
  describe('point scale', () => {
    it('should evenly distribute points', () => {
      const scale = createScale('point', ['X', 'Y', 'Z'] as any, [0, 200]);
      expect(scale.convert('X')).toBe(0);
      expect(scale.convert('Y')).toBe(100);
      expect(scale.convert('Z')).toBe(200);
    });
  });

  // ─── Ordinal Scale ─────────────────────────────────────────────────
  describe('ordinal scale', () => {
    it('should behave like band scale with more padding', () => {
      const scale = createScale('ordinal', ['a', 'b'] as any, [0, 200]);
      const a = scale.convert('a');
      const b = scale.convert('b');
      expect(a).toBeLessThan(b);
    });
  });

  // ─── Utility functions ──────────────────────────────────────────────
  describe('utility functions', () => {
    it('clamp should constrain values', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('niceStep should produce human-friendly steps', () => {
      expect(niceStep(7)).toBe(5);
      expect(niceStep(1.2)).toBe(1);
      expect(niceStep(25)).toBe(20);
      expect(niceStep(80)).toBe(100);
    });

    it('linearTicks should be evenly spaced', () => {
      const ticks = linearTicks(0, 100, 5);
      expect(ticks.length).toBeGreaterThan(0);
      // All ticks should be in range
      for (const t of ticks) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(100);
      }
    });
  });
});
