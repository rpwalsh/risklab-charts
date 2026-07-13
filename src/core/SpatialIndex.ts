export interface SpatialHit<T> {
  x: number;
  y: number;
  distance: number;
  value: T;
}

interface IndexedPoint<T> {
  x: number;
  y: number;
  value: T;
}

/** Uniform spatial bucket index optimized for repeated pointer proximity queries. */
export class SpatialIndex<T> {
  private readonly buckets = new Map<string, IndexedPoint<T>[]>();
  private count = 0;

  constructor(readonly cellSize = 32) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('cellSize must be positive');
  }

  get size(): number { return this.count; }

  clear(): void {
    this.buckets.clear();
    this.count = 0;
  }

  insert(x: number, y: number, value: T): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const key = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    const bucket = this.buckets.get(key) ?? [];
    bucket.push({ x, y, value });
    this.buckets.set(key, bucket);
    this.count += 1;
  }

  withinRadius(x: number, y: number, radius: number): SpatialHit<T>[] {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return [];
    const minColumn = Math.floor((x - radius) / this.cellSize);
    const maxColumn = Math.floor((x + radius) / this.cellSize);
    const minRow = Math.floor((y - radius) / this.cellSize);
    const maxRow = Math.floor((y + radius) / this.cellSize);
    const radiusSquared = radius * radius;
    const hits: SpatialHit<T>[] = [];
    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        for (const point of this.buckets.get(this.key(column, row)) ?? []) {
          const dx = point.x - x;
          const dy = point.y - y;
          const squared = dx * dx + dy * dy;
          if (squared <= radiusSquared) hits.push({ ...point, distance: Math.sqrt(squared) });
        }
      }
    }
    return hits.sort((left, right) => left.distance - right.distance);
  }

  nearest(x: number, y: number, radius: number): SpatialHit<T> | undefined {
    return this.withinRadius(x, y, radius)[0];
  }

  private key(column: number, row: number): string {
    return `${column}:${row}`;
  }
}

/** Binary nearest lookup for data ordered by its horizontal coordinate. */
export function nearestSortedIndex<T>(
  data: readonly T[],
  target: number,
  valueOf: (item: T) => number,
): number {
  if (data.length === 0 || !Number.isFinite(target)) return -1;
  if (data.length === 1) return Number.isFinite(valueOf(data[0]!)) ? 0 : -1;
  const first = valueOf(data[0]!);
  const last = valueOf(data[data.length - 1]!);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return -1;
  const direction = first <= last ? 1 : -1;
  let low = 0;
  let high = data.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const value = valueOf(data[middle]!);
    if (!Number.isFinite(value)) return -1;
    const comparison = (value - target) * direction;
    if (comparison < 0) low = middle + 1;
    else if (comparison > 0) high = middle - 1;
    else return middle;
  }
  const candidates = [Math.max(0, high), Math.min(data.length - 1, low)];
  return Math.abs(valueOf(data[candidates[0]]!) - target) <= Math.abs(valueOf(data[candidates[1]]!) - target)
    ? candidates[0]!
    : candidates[1]!;
}
