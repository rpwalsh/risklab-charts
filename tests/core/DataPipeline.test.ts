// ============================================================================
// DataPipeline — Unit Tests
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { DataPipeline, toNumber } from '../../src/core/DataPipeline';
import type { SeriesConfig, ChartConfig, DataPoint } from '../../src/core/types';

function makeSeries(overrides: Partial<SeriesConfig> = {}): SeriesConfig {
  return {
    id: 's1',
    name: 'Test',
    type: 'line',
    data: [
      { x: 3, y: 30 },
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ],
    ...overrides,
  } as SeriesConfig;
}

const baseConfig: ChartConfig = {
  container: '#test',
  series: [],
};

describe('DataPipeline', () => {
  // ─── toNumber helper ────────────────────────────────────────────────
  describe('toNumber', () => {
    it('should convert numbers', () => {
      expect(toNumber(42)).toBe(42);
    });

    it('should convert numeric strings', () => {
      expect(toNumber('123')).toBe(123);
    });

    it('should convert Date to timestamp', () => {
      const d = new Date('2024-01-01T00:00:00Z');
      expect(toNumber(d)).toBe(d.getTime());
    });

    it('should preserve null/undefined as invalid data', () => {
      expect(toNumber(null as any)).toBeNaN();
      expect(toNumber(undefined as any)).toBeNaN();
    });

    it('should preserve non-numeric strings as invalid data', () => {
      expect(toNumber('hello')).toBeNaN();
    });
  });

  // ─── Built-in transforms ───────────────────────────────────────────
  describe('built-in transforms', () => {
    it('should filter out invisible series', () => {
      const pipeline = new DataPipeline();
      const series = [
        makeSeries({ id: 's1', visible: true }),
        makeSeries({ id: 's2', visible: false }),
        makeSeries({ id: 's3' }), // default = visible
      ];

      const result = pipeline.process(series, baseConfig);
      const ids = result.map((s) => s.id);
      expect(ids).toContain('s1');
      expect(ids).not.toContain('s2');
      expect(ids).toContain('s3');
    });

    it('should sort data for line series', () => {
      const pipeline = new DataPipeline();
      const series = [makeSeries({ type: 'line' })];

      const result = pipeline.process(series, baseConfig);
      const xValues = result[0]!.data.map((d: any) => d.xNum ?? d.x);
      expect(xValues[0]).toBeLessThanOrEqual(xValues[1]!);
      expect(xValues[1]).toBeLessThanOrEqual(xValues[2]!);
    });

    it('should NOT sort data for bar series', () => {
      const pipeline = new DataPipeline();
      const series = [makeSeries({ type: 'bar' })];

      const result = pipeline.process(series, baseConfig);
      const xValues = result[0]!.data.map((d: any) => d.xNum ?? d.x);
      // Should remain in original order: 3, 1, 2
      expect(xValues[0]).toBe(3);
      expect(xValues[1]).toBe(1);
      expect(xValues[2]).toBe(2);
    });

    it('should convert data to numeric values', () => {
      const pipeline = new DataPipeline();
      const series = [makeSeries()];
      const result = pipeline.process(series, baseConfig);

      for (const d of result[0]!.data) {
        expect((d as any).xNum).toBeTypeOf('number');
        expect((d as any).yNum).toBeTypeOf('number');
      }
    });

    it('sorts continuous data before applying decimation', () => {
      const pipeline = new DataPipeline();
      const data = Array.from({ length: 40 }, (_, index) => ({
        x: 39 - index,
        y: Math.sin(index / 3),
      }));
      const result = pipeline.process([
        makeSeries({ data, decimation: { enabled: true, threshold: 10, algorithm: 'lttb' } }),
      ], baseConfig);
      const points = result[0]!.processedData;
      expect(points).toHaveLength(10);
      for (let index = 1; index < points.length; index += 1) {
        expect(points[index]!.xNum).toBeGreaterThanOrEqual(points[index - 1]!.xNum);
      }
    });

    it('keeps invalid values as explicit gaps', () => {
      const pipeline = new DataPipeline();
      const result = pipeline.process([
        makeSeries({ data: [{ x: 1, y: 2 }, { x: 2, y: 'not-observed' }] }),
      ], baseConfig);
      expect(result[0]!.processedData[1]!.yNum).toBeNaN();
    });
  });

  // ─── Stacking ───────────────────────────────────────────────────────
  describe('stacking', () => {
    it('should compute stack baselines for grouped series', () => {
      const pipeline = new DataPipeline();
      const series: SeriesConfig[] = [
        {
          id: 's1', name: 'A', type: 'stackedArea',
          stackGroup: 'g1',
          data: [{ x: 1, y: 10 }, { x: 2, y: 20 }],
        } as any,
        {
          id: 's2', name: 'B', type: 'stackedArea',
          stackGroup: 'g1',
          data: [{ x: 1, y: 5 }, { x: 2, y: 10 }],
        } as any,
      ];

      const result = pipeline.process(series, baseConfig);
      // The second stacked series should have y0 = first series y
      const s2Points = result.find((s) => s.id === 's2')?.data as any[];
      if (s2Points) {
        // Point at x=1: should stack on top of 10
        const p1 = s2Points.find((d: any) => toNumber(d.x) === 1);
        expect(p1?.y0).toBe(10);
        expect(p1?.y1).toBe(15);
      }
    });

    it('stacks positive and negative values independently from zero', () => {
      const pipeline = new DataPipeline();
      const result = pipeline.process([
        makeSeries({ id: 'a', type: 'stackedArea', stackGroup: 'g', data: [{ x: 1, y: 10 }] }),
        makeSeries({ id: 'b', type: 'stackedArea', stackGroup: 'g', data: [{ x: 1, y: -4 }] }),
        makeSeries({ id: 'c', type: 'stackedArea', stackGroup: 'g', data: [{ x: 1, y: -3 }] }),
      ], baseConfig);
      const b = result[1]!.processedData[0]!;
      const c = result[2]!.processedData[0]!;
      expect([b.y0, b.y1]).toEqual([0, -4]);
      expect([c.y0, c.y1]).toEqual([-4, -7]);
    });

    it('does not mutate caller-owned series or point arrays', () => {
      const pipeline = new DataPipeline();
      const input = [makeSeries({ stackGroup: 'g' })];
      const data = input[0]!.data;
      pipeline.process(input, baseConfig);
      expect(input[0]!.data).toBe(data);
      expect(input[0]!.data[0]).not.toHaveProperty('xNum');
    });
  });

  // ─── Custom transforms ─────────────────────────────────────────────
  describe('custom transforms', () => {
    it('should allow registering custom transforms', () => {
      const pipeline = new DataPipeline();
      const customFn = vi.fn((series: SeriesConfig[]) => {
        // tag all series
        return series.map((s) => ({ ...s, name: `custom-${s.name}` }));
      });

      pipeline.register('my-transform', customFn, 5);
      const series = [makeSeries()];
      const result = pipeline.process(series, baseConfig);

      expect(customFn).toHaveBeenCalled();
      expect(result[0]!.name).toBe('custom-Test');
    });

    it('should replace existing transform with same id', () => {
      const pipeline = new DataPipeline();
      const fn1 = vi.fn((s: SeriesConfig[]) => s);
      const fn2 = vi.fn((s: SeriesConfig[]) => s);

      pipeline.register('my-t', fn1, 5);
      pipeline.register('my-t', fn2, 5);
      pipeline.process([makeSeries()], baseConfig);

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
    });

    it('should remove transform by id', () => {
      const pipeline = new DataPipeline();
      const fn = vi.fn((s: SeriesConfig[]) => s);
      pipeline.register('my-t', fn, 5);
      pipeline.unregister('my-t');
      pipeline.process([makeSeries()], baseConfig);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // ─── Timeline slicing ──────────────────────────────────────────────
  describe('sliceForTimeline', () => {
    it('should filter data points up to frameTime', () => {
      const pipeline = new DataPipeline();
      const series: SeriesConfig[] = [
        makeSeries({
          data: [
            { x: 1, y: 10 },
            { x: 5, y: 50 },
            { x: 10, y: 100 },
            { x: 20, y: 200 },
          ],
        }),
      ];

      const sliced = pipeline.sliceForTimeline(series, 'x', 10);
      expect(sliced[0]!.data).toHaveLength(3); // x: 1, 5, 10
    });
  });
});
