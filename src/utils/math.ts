// ============================================================================
// RiskLab Charts — Math Utilities
// Statistical helpers, interpolation, and geometric calculations
// ============================================================================

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map a value from one range to another */
export function mapRange(
  value: number,
  inMin: number, inMax: number,
  outMin: number, outMax: number,
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Distance between two points */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** Angle in degrees between two points */
export function angle(x1: number, y1: number, x2: number, y2: number): number {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

/** Degrees to radians */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Radians to degrees */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Round to N decimal places */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function mean(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function variance(values: number[]): number {
  const m = mean(values);
  return mean(values.map((v) => (v - m) ** 2));
}

export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

export function min(values: number[]): number {
  if (values.length === 0) return Infinity;
  let m = values[0]!;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! < m) m = values[i]!;
  }
  return m;
}

export function max(values: number[]): number {
  if (values.length === 0) return -Infinity;
  let m = values[0]!;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! > m) m = values[i]!;
  }
  return m;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  return lerp(sorted[lower]!, sorted[upper]!, index - lower);
}

export function quartiles(values: number[]): { q1: number; q2: number; q3: number } {
  return {
    q1: percentile(values, 25),
    q2: percentile(values, 50),
    q3: percentile(values, 75),
  };
}

// ---------------------------------------------------------------------------
// Geometry Helpers
// ---------------------------------------------------------------------------

/** Point on circle at angle (degrees) */
export function pointOnCircle(
  cx: number, cy: number, radius: number, angleDeg: number,
): { x: number; y: number } {
  const rad = toRadians(angleDeg - 90);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/** Check if a point is inside a rectangle */
export function pointInRect(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
