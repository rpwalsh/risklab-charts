// ============================================================================
// RiskLab Charts — Scale System
// Generates domain → range mapping functions for all scale types
// ============================================================================

import type { ResolvedScale, ScaleType, DataValue } from '../core/types';

export interface ScaleOptions {
  padding?: number;
  inverted?: boolean;
  nice?: boolean;
  clamp?: boolean;
  /** Target tick count used when nice=true to compute rounded domain boundaries. */
  tickCount?: number;
}

/**
 * Factory: create a resolved scale from type, domain, range, and options.
 */
export function createScale(
  type: ScaleType,
  domain: [number, number] | string[],
  range: [number, number],
  options: ScaleOptions = {},
): ResolvedScale {
  switch (type) {
    case 'linear':
      return createLinearScale(domain as [number, number], range, options);
    case 'logarithmic':
      return createLogScale(domain as [number, number], range, options);
    case 'time':
      return createTimeScale(domain as [number, number], range, options);
    case 'band':
      return createBandScale(domain as string[], range, options);
    case 'ordinal':
      return createOrdinalScale(domain as string[], range, options);
    case 'point':
      return createPointScale(domain as string[], range, options);
    default:
      return createLinearScale(domain as [number, number], range, options);
  }
}

// ---------------------------------------------------------------------------
// Linear Scale
// ---------------------------------------------------------------------------

function createLinearScale(
  domain: [number, number],
  range: [number, number],
  options: ScaleOptions,
): ResolvedScale {
  let [d0, d1] = domain;
  let [r0, r1] = range;

  if (options.inverted) [r0, r1] = [r1, r0];
  if (options.nice) {
    [d0, d1] = niceLinearDomain(d0, d1, options.tickCount ?? 10);
  }

  const domainSpan = d1 - d0 || 1;
  const rangeSpan = r1 - r0;

  return {
    type: 'linear',
    domain: [d0, d1],
    range: [r0, r1],
    convert(value: DataValue): number {
      const v = Number(value);
      const t = (v - d0) / domainSpan;
      const result = r0 + t * rangeSpan;
      return options.clamp ? clamp(result, Math.min(r0, r1), Math.max(r0, r1)) : result;
    },
    invert(pixel: number): DataValue {
      const t = (pixel - r0) / rangeSpan;
      return d0 + t * domainSpan;
    },
    ticks(count: number = 10): DataValue[] {
      return linearTicks(d0, d1, count);
    },
  };
}

// ---------------------------------------------------------------------------
// Logarithmic Scale
// ---------------------------------------------------------------------------

function createLogScale(
  domain: [number, number],
  range: [number, number],
  options: ScaleOptions,
): ResolvedScale {
  let [d0, d1] = domain;
  let [r0, r1] = range;

  if (options.inverted) [r0, r1] = [r1, r0];

  // Ensure positive domain for log scale
  d0 = Math.max(d0, 1e-10);
  d1 = Math.max(d1, d0 + 1e-10);

  const logD0 = Math.log10(d0);
  const logD1 = Math.log10(d1);
  const logSpan = logD1 - logD0 || 1;
  const rangeSpan = r1 - r0;

  return {
    type: 'logarithmic',
    domain: [d0, d1],
    range: [r0, r1],
    convert(value: DataValue): number {
      const v = Math.max(Number(value), 1e-10);
      const t = (Math.log10(v) - logD0) / logSpan;
      return r0 + t * rangeSpan;
    },
    invert(pixel: number): DataValue {
      const t = (pixel - r0) / rangeSpan;
      return Math.pow(10, logD0 + t * logSpan);
    },
    ticks(): DataValue[] {
      const ticks: number[] = [];
      const start = Math.floor(logD0);
      const end = Math.ceil(logD1);
      for (let i = start; i <= end; i++) {
        ticks.push(Math.pow(10, i));
      }
      return ticks;
    },
  };
}

// ---------------------------------------------------------------------------
// Time Scale (linear over timestamps)
// ---------------------------------------------------------------------------

function createTimeScale(
  domain: [number, number],
  range: [number, number],
  options: ScaleOptions,
): ResolvedScale {
  const linear = createLinearScale(domain, range, options);
  return {
    ...linear,
    type: 'time',
    convert(value: DataValue): number {
      let v: number;
      if (value instanceof Date) {
        v = value.getTime();
      } else {
        v = Number(value);
        // Fall back to date-string parsing so that xScale.convert("2023-01-01")
        // works correctly in every chart renderer without requiring each call
        // site to pre-convert to xNum first.
        if (Number.isNaN(v) && typeof value === 'string') {
          v = Date.parse(value);
        }
      }
      return linear.convert(v);
    },
    invert(pixel: number): DataValue {
      return new Date(Number(linear.invert(pixel)));
    },
    ticks(count: number = 8): DataValue[] {
      const [d0, d1] = domain;
      const step = (d1 - d0) / count;
      const ticks: Date[] = [];
      for (let i = 0; i <= count; i++) {
        ticks.push(new Date(d0 + step * i));
      }
      return ticks;
    },
  };
}

// ---------------------------------------------------------------------------
// Band Scale (for bar charts)
// ---------------------------------------------------------------------------

function createBandScale(
  domain: string[],
  range: [number, number],
  options: ScaleOptions,
): ResolvedScale {
  const padding = options.padding ?? 0.1;
  const [r0, r1] = options.inverted ? [range[1], range[0]] : range;
  const n = domain.length || 1;
  const rangeSpan = r1 - r0;

  // Use absolute span for sizing so bandwidth is always positive,
  // even when the range is inverted (e.g. y-axis: [bottom, top]).
  const absSpan = Math.abs(rangeSpan);
  const dir = rangeSpan >= 0 ? 1 : -1; // direction of range
  const totalPadding = padding * absSpan;
  const bandWidth = (absSpan - totalPadding) / n;
  const stepPadding = totalPadding / (n + 1);
  const step = bandWidth + stepPadding;

  const map = new Map<string, number>();
  for (let i = 0; i < domain.length; i++) {
    // Store the center position of each band, walking in range direction
    map.set(domain[i]!, r0 + dir * (stepPadding + i * step + bandWidth / 2));
  }

  return {
    type: 'band',
    domain,
    range: [r0, r1],
    bandwidth: bandWidth,
    convert(value: DataValue): number {
      return map.get(String(value)) ?? r0;
    },
    invert(pixel: number): DataValue {
      const idx = Math.round((pixel - r0 - dir * (stepPadding + bandWidth / 2)) / (dir * step));
      return domain[clamp(idx, 0, domain.length - 1)] ?? '';
    },
    ticks(): DataValue[] {
      return domain;
    },
  };
}

// ---------------------------------------------------------------------------
// Ordinal Scale
// ---------------------------------------------------------------------------

function createOrdinalScale(
  domain: string[],
  range: [number, number],
  options: ScaleOptions,
): ResolvedScale {
  // Same as band but without width (just center points)
  return createBandScale(domain, range, { ...options, padding: options.padding ?? 0.5 });
}

// ---------------------------------------------------------------------------
// Point Scale
// ---------------------------------------------------------------------------

function createPointScale(
  domain: string[],
  range: [number, number],
  options: ScaleOptions,
): ResolvedScale {
  const [r0, r1] = options.inverted ? [range[1], range[0]] : range;
  const n = Math.max(domain.length - 1, 1);
  const step = (r1 - r0) / n;

  const map = new Map<string, number>();
  for (let i = 0; i < domain.length; i++) {
    map.set(domain[i]!, r0 + i * step);
  }

  return {
    type: 'point',
    domain,
    range: [r0, r1],
    convert(value: DataValue): number {
      return map.get(String(value)) ?? r0;
    },
    invert(pixel: number): DataValue {
      const idx = Math.round((pixel - r0) / step);
      return domain[clamp(idx, 0, domain.length - 1)] ?? '';
    },
    ticks(): DataValue[] {
      return domain;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function linearTicks(d0: number, d1: number, count: number): number[] {
  const step = niceStep((d1 - d0) / Math.max(1, count));
  const start = Math.ceil(d0 / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= d1 + step * 0.01; v += step) {
    ticks.push(parseFloat(v.toPrecision(12)));
  }
  return ticks;
}

function niceStep(rawStep: number): number {
  const exp = Math.floor(Math.log10(Math.abs(rawStep) || 1));
  const frac = rawStep / Math.pow(10, exp);
  let nice: number;
  if (frac <= 1.5) nice = 1;
  else if (frac <= 3) nice = 2;
  else if (frac <= 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

function niceLinearDomain(d0: number, d1: number, count: number = 10): [number, number] {
  const step = niceStep((d1 - d0) / count);
  return [Math.floor(d0 / step) * step, Math.ceil(d1 / step) * step];
}

export { clamp, linearTicks, niceStep, niceLinearDomain };
