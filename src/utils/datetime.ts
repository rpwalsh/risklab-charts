// ============================================================================
// RiskLab Charts — DateTime Utilities
// Smart, context-aware date/time formatting for chart axes and tooltips.
//
// Works with: ms timestamps, ISO strings, Date objects, "time" axis type.
// No external dependencies.
// ============================================================================

// ── Types ─────────────────────────────────────────────────────────────────────

export type DateLike = number | string | Date;

export interface TickIntervalDescriptor {
  ms: number;
  unit: TimeUnit;
  count: number;
  label: string;
}

export type TimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

// ── Constants ─────────────────────────────────────────────────────────────────

export const MS: Record<TimeUnit, number> = {
  millisecond: 1,
  second:      1_000,
  minute:      60_000,
  hour:        3_600_000,
  day:         86_400_000,
  week:        604_800_000,
  month:       2_628_000_000,
  year:        31_536_000_000,
} as const;

/** Ordered tick intervals from finest to coarsest. */
const TICK_INTERVALS: TickIntervalDescriptor[] = [
  { ms: MS.millisecond * 1,    unit: 'millisecond', count: 1,    label: '1ms'  },
  { ms: MS.millisecond * 5,    unit: 'millisecond', count: 5,    label: '5ms'  },
  { ms: MS.millisecond * 10,   unit: 'millisecond', count: 10,   label: '10ms' },
  { ms: MS.millisecond * 50,   unit: 'millisecond', count: 50,   label: '50ms' },
  { ms: MS.millisecond * 100,  unit: 'millisecond', count: 100,  label: '100ms'},
  { ms: MS.millisecond * 500,  unit: 'millisecond', count: 500,  label: '500ms'},
  { ms: MS.second * 1,         unit: 'second',      count: 1,    label: '1s'   },
  { ms: MS.second * 5,         unit: 'second',      count: 5,    label: '5s'   },
  { ms: MS.second * 15,        unit: 'second',      count: 15,   label: '15s'  },
  { ms: MS.second * 30,        unit: 'second',      count: 30,   label: '30s'  },
  { ms: MS.minute * 1,         unit: 'minute',      count: 1,    label: '1min' },
  { ms: MS.minute * 5,         unit: 'minute',      count: 5,    label: '5min' },
  { ms: MS.minute * 15,        unit: 'minute',      count: 15,   label: '15min'},
  { ms: MS.minute * 30,        unit: 'minute',      count: 30,   label: '30min'},
  { ms: MS.hour * 1,           unit: 'hour',        count: 1,    label: '1h'   },
  { ms: MS.hour * 3,           unit: 'hour',        count: 3,    label: '3h'   },
  { ms: MS.hour * 6,           unit: 'hour',        count: 6,    label: '6h'   },
  { ms: MS.hour * 12,          unit: 'hour',        count: 12,   label: '12h'  },
  { ms: MS.day * 1,            unit: 'day',         count: 1,    label: '1d'   },
  { ms: MS.day * 2,            unit: 'day',         count: 2,    label: '2d'   },
  { ms: MS.day * 3,            unit: 'day',         count: 3,    label: '3d'   },
  { ms: MS.week * 1,           unit: 'week',        count: 1,    label: '1w'   },
  { ms: MS.week * 2,           unit: 'week',        count: 2,    label: '2w'   },
  { ms: MS.month * 1,          unit: 'month',       count: 1,    label: '1m'   },
  { ms: MS.month * 2,          unit: 'month',       count: 2,    label: '2m'   },
  { ms: MS.month * 3,          unit: 'month',       count: 3,    label: '3m'   },
  { ms: MS.month * 6,          unit: 'month',       count: 6,    label: '6m'   },
  { ms: MS.year * 1,           unit: 'year',        count: 1,    label: '1y'   },
  { ms: MS.year * 2,           unit: 'year',        count: 2,    label: '2y'   },
  { ms: MS.year * 5,           unit: 'year',        count: 5,    label: '5y'   },
  { ms: MS.year * 10,          unit: 'year',        count: 10,   label: '10y'  },
];

// ── Parse ─────────────────────────────────────────────────────────────────────

/**
 * Parse any date-like value to a Unix ms timestamp.
 * Handles: Date objects, ms numbers, ISO string, YYYY-MM-DD, etc.
 */
export function parseDate(value: DateLike): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.valueOf();
  if (typeof value === 'string') {
    // Try ISO / RFC formats first (browsers handle these natively)
    const d = new Date(value);
    if (!isNaN(d.valueOf())) return d.valueOf();
    // Try YYYY/MM/DD
    const slash = value.replace(/-/g, '/');
    const d2 = new Date(slash);
    if (!isNaN(d2.valueOf())) return d2.valueOf();
  }
  return NaN;
}

/**
 * Attempt to detect if an array of x-values looks like time data.
 * Returns `true` if >50% of values parse as valid dates.
 */
export function detectTimeAxis(values: unknown[]): boolean {
  if (!values.length) return false;
  let valid = 0;
  for (const v of values) {
    if (v instanceof Date) { valid++; continue; }
    if (typeof v === 'number' && v > 86_400_000 && v < 3e12) { valid++; continue; } // plausible ms
    if (typeof v === 'string' && !isNaN(new Date(v).valueOf())) { valid++; continue; }
  }
  return valid / values.length > 0.5;
}

// ── Tick generation ───────────────────────────────────────────────────────────

/**
 * Choose the best tick interval for a time axis given the visible span.
 * @param spanMs    Total visible time range in milliseconds
 * @param target    Desired number of ticks (default 8)
 */
export function getTickInterval(spanMs: number, target = 8): TickIntervalDescriptor {
  const ideal = spanMs / target;
  let best = TICK_INTERVALS[0]!;
  for (const interval of TICK_INTERVALS) {
    if (interval.ms <= ideal) {
      best = interval;
    } else {
      break;
    }
  }
  return best;
}

/**
 * Snap a timestamp to the nearest boundary of a given interval.
 * e.g. snap a 09:47 ts with 'hour' interval → 09:00.
 */
export function alignToInterval(ts: number, interval: TickIntervalDescriptor): number {
  const { unit, count } = interval;
  const d = new Date(ts);

  switch (unit) {
    case 'millisecond': return Math.floor(ts / (count)) * count;
    case 'second': { d.setMilliseconds(0); return Math.floor(d.valueOf() / (MS.second * count)) * (MS.second * count); }
    case 'minute': { d.setSeconds(0, 0); return Math.floor(d.valueOf() / (MS.minute * count)) * (MS.minute * count); }
    case 'hour': { d.setMinutes(0, 0, 0); return Math.floor(d.valueOf() / (MS.hour * count)) * (MS.hour * count); }
    case 'day': { d.setHours(0, 0, 0, 0); return d.valueOf(); }
    case 'week': {
      d.setHours(0, 0, 0, 0);
      const dow = d.getDay(); // 0=Sun
      d.setDate(d.getDate() - dow);
      return d.valueOf();
    }
    case 'month': {
      d.setDate(1); d.setHours(0, 0, 0, 0);
      return d.valueOf();
    }
    case 'year': {
      const year = Math.floor(d.getFullYear() / count) * count;
      return new Date(year, 0, 1).valueOf();
    }
    default: return ts;
  }
}

/**
 * Generate evenly-spaced tick timestamps for a time axis.
 * @returns Array of ms timestamps
 */
export function generateTimeTicks(
  minTs: number,
  maxTs: number,
  targetTicks = 8,
): number[] {
  const spanMs = maxTs - minTs;
  const interval = getTickInterval(spanMs, targetTicks);
  const ticks: number[] = [];
  let ts = alignToInterval(minTs, interval);

  while (ts <= maxTs) {
    if (ts >= minTs) ticks.push(ts);
    ts = nextInterval(ts, interval.unit, interval.count);
  }

  return ticks;
}

function nextInterval(ts: number, unit: TimeUnit, count: number): number {
  const d = new Date(ts);
  switch (unit) {
    case 'millisecond': return ts + count;
    case 'second': return ts + MS.second * count;
    case 'minute': return ts + MS.minute * count;
    case 'hour': return ts + MS.hour * count;
    case 'day': d.setDate(d.getDate() + count); return d.valueOf();
    case 'week': d.setDate(d.getDate() + 7 * count); return d.valueOf();
    case 'month': d.setMonth(d.getMonth() + count); return d.valueOf();
    case 'year': d.setFullYear(d.getFullYear() + count); return d.valueOf();
    default: return ts + MS[unit] * count;
  }
}

// ── Context-aware formatting ──────────────────────────────────────────────────

/**
 * Format a timestamp for display on an axis or in a tooltip.
 * Automatically chooses the appropriate format based on the visible span.
 *
 * @param ts      Timestamp in ms
 * @param spanMs  Total visible span in ms (determines label granularity)
 * @param locale  BCP 47 locale string (default: browser locale)
 */
export function formatAxisDate(ts: number, spanMs: number, locale = 'en-US'): string {
  const d = new Date(ts);

  if (spanMs < MS.minute * 10) {
    // Sub-minute span → show ss.mmm
    return `${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
  }
  if (spanMs < MS.hour * 2) {
    // Minutes → HH:MM:SS
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }
  if (spanMs < MS.day * 1) {
    // Same day → HH:MM am/pm
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  if (spanMs < MS.day * 5) {
    // Few days → "Mon 14" / "Mon Jan 14"
    return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (spanMs < MS.month * 3) {
    // Weeks → "Jan 14"
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  if (spanMs < MS.year * 2) {
    // Months → "Jan 2024"
    return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  }
  // Multi-year → just year
  return String(d.getFullYear());
}

/**
 * Detailed tooltip format — always human-readable.
 */
export function formatTooltipDate(ts: number, locale = 'en-US'): string {
  return new Date(ts).toLocaleString(locale, {
    weekday: 'short',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Relative time ─────────────────────────────────────────────────────────────

/**
 * Return a human-readable relative time string.
 *
 * @example
 * relativeTo(Date.now() - 30_000) → "30 seconds ago"
 * relativeTo(Date.now() + 3_600_000) → "in 1 hour"
 */
export function relativeTo(ts: DateLike, now: DateLike = Date.now()): string {
  const deltaMs = parseDate(ts) - parseDate(now);
  const abs = Math.abs(deltaMs);
  const past = deltaMs < 0;
  const prefix = past ? '' : 'in ';
  const suffix = past ? ' ago' : '';

  let count: number;
  let unit: string;

  if (abs < MS.second * 10) return 'just now';
  if (abs < MS.minute)      { count = Math.round(abs / MS.second); unit = 'second'; }
  else if (abs < MS.hour)   { count = Math.round(abs / MS.minute); unit = 'minute'; }
  else if (abs < MS.day)    { count = Math.round(abs / MS.hour);   unit = 'hour';   }
  else if (abs < MS.week)   { count = Math.round(abs / MS.day);    unit = 'day';    }
  else if (abs < MS.month)  { count = Math.round(abs / MS.week);   unit = 'week';   }
  else if (abs < MS.year)   { count = Math.round(abs / MS.month);  unit = 'month';  }
  else                      { count = Math.round(abs / MS.year);   unit = 'year';   }

  const plural = count !== 1 ? 's' : '';
  return `${prefix}${count} ${unit}${plural}${suffix}`;
}

// ── Duration ──────────────────────────────────────────────────────────────────

/**
 * Format a duration in ms as a human-readable string.
 *
 * @example
 * formatDuration(3_661_000) → "1h 1m 1s"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / MS.hour);
  const m = Math.floor((ms % MS.hour) / MS.minute);
  const s = Math.floor((ms % MS.minute) / MS.second);
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ── Timezone ──────────────────────────────────────────────────────────────────

/**
 * Get the UTC offset in milliseconds for a given IANA timezone string.
 * Falls back to the local timezone offset if the zone is invalid.
 *
 * @example tzOffsetMs('America/New_York') → -18000000 (UTC-5)
 */
export function tzOffsetMs(timezone: string): number {
  try {
    const now = Date.now();
    const local = new Date(now).toLocaleString('en-US', { timeZone: timezone });
    const utc = new Date(now).toLocaleString('en-US', { timeZone: 'UTC' });
    return new Date(local).valueOf() - new Date(utc).valueOf();
  } catch {
    return -new Date().getTimezoneOffset() * MS.minute;
  }
}

/**
 * Convert a UTC timestamp to a different timezone.
 * Returns a new timestamp adjusted so wall-clock reads correctly in that zone.
 */
export function toTimezone(ts: number, timezone: string): number {
  return ts + tzOffsetMs(timezone);
}

// ── Date math helpers ─────────────────────────────────────────────────────────

/** Add `count` of `unit` to a timestamp. */
export function addTime(ts: DateLike, count: number, unit: TimeUnit): number {
  return nextInterval(parseDate(ts), unit, count);
}

/** Clamp a timestamp to a min/max range. */
export function clampDate(ts: DateLike, min: DateLike, max: DateLike): number {
  const t = parseDate(ts);
  return Math.min(Math.max(t, parseDate(min)), parseDate(max));
}

/** Start of the day in local time. */
export function startOfDay(ts: DateLike): number {
  const d = new Date(parseDate(ts));
  d.setHours(0, 0, 0, 0);
  return d.valueOf();
}

/** Start of the month. */
export function startOfMonth(ts: DateLike): number {
  const d = new Date(parseDate(ts));
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.valueOf();
}

/** Start of the year. */
export function startOfYear(ts: DateLike): number {
  return new Date(new Date(parseDate(ts)).getFullYear(), 0, 1).valueOf();
}

/** Day-of-week (0=Sun, 6=Sat). */
export function dayOfWeek(ts: DateLike): number {
  return new Date(parseDate(ts)).getDay();
}

/** ISO week number (1–53). */
export function isoWeek(ts: DateLike): number {
  const d = new Date(parseDate(ts));
  // Advance d to the Thursday of its ISO week (ISO weeks are identified by
  // their Thursday; getDay()=0 means Sunday which is treated as day 7).
  const dow = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dow);
  // Count whole weeks from Jan 1 of the Thursday's calendar year
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / MS.day + 1) / 7);
}

/** Check if two timestamps fall on the same day. */
export function sameDay(a: DateLike, b: DateLike): boolean {
  const da = new Date(parseDate(a));
  const db = new Date(parseDate(b));
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

// ── Private helpers ───────────────────────────────────────────────────────────

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function pad3(n: number): string { return String(n).padStart(3, '0'); }
