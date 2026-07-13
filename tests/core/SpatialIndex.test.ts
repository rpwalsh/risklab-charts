import { describe, expect, it } from 'vitest';
import { nearestSortedIndex, SpatialIndex } from '../../src/core/SpatialIndex';

describe('SpatialIndex', () => {
  it('returns nearby points in distance order across bucket boundaries', () => {
    const index = new SpatialIndex<string>(10);
    index.insert(9, 9, 'near');
    index.insert(12, 12, 'second');
    index.insert(80, 80, 'far');
    expect(index.withinRadius(10, 10, 5).map((hit) => hit.value)).toEqual(['near', 'second']);
    expect(index.nearest(10, 10, 5)?.value).toBe('near');
  });

  it('ignores invalid points and resets without reallocating the index', () => {
    const index = new SpatialIndex<number>();
    index.insert(Number.NaN, 1, 1);
    index.insert(2, 3, 2);
    expect(index.size).toBe(1);
    index.clear();
    expect(index.size).toBe(0);
  });
});

describe('nearestSortedIndex', () => {
  it('finds the nearest ascending or descending value', () => {
    const ascending = [0, 10, 20, 30];
    const descending = [...ascending].reverse();
    expect(nearestSortedIndex(ascending, 18, (value) => value)).toBe(2);
    expect(nearestSortedIndex(descending, 18, (value) => value)).toBe(1);
  });

  it('handles empty and invalid boundaries', () => {
    expect(nearestSortedIndex([], 5, Number)).toBe(-1);
    expect(nearestSortedIndex([Number.NaN, 2], 1, Number)).toBe(-1);
  });
});
