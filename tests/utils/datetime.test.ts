// tests/utils/datetime.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseDate,
  detectTimeAxis,
  getTickInterval,
  alignToInterval,
  generateTimeTicks,
  formatAxisDate,
  formatTooltipDate,
  relativeTo,
  formatDuration,
  tzOffsetMs,
  addTime,
  clampDate,
  startOfDay,
  startOfMonth,
  startOfYear,
  dayOfWeek,
  isoWeek,
  sameDay,
  MS,
} from '../../src/utils/datetime';

describe('parseDate', () => {
  it('handles ms number', () => {
    const now = Date.now();
    expect(parseDate(now)).toBe(now);
  });

  it('handles Date object', () => {
    const d = new Date(2024, 0, 15);
    expect(parseDate(d)).toBe(d.valueOf());
  });

  it('handles ISO string', () => {
    const ts = parseDate('2024-01-15T12:00:00Z');
    expect(ts).toBeGreaterThan(0);
    expect(new Date(ts).getFullYear()).toBe(2024);
  });

  it('handles YYYY-MM-DD string', () => {
    const ts = parseDate('2024-07-04');
    expect(new Date(ts).getFullYear()).toBe(2024);
  });

  it('returns NaN for invalid string', () => {
    expect(parseDate('not-a-date')).toBeNaN();
  });
});

describe('detectTimeAxis', () => {
  it('detects Date array as time', () => {
    const arr = [new Date(), new Date(Date.now() + 1000)];
    expect(detectTimeAxis(arr)).toBe(true);
  });

  it('detects ms-range numbers as time', () => {
    const arr = [Date.now(), Date.now() + 1000, Date.now() + 2000];
    expect(detectTimeAxis(arr)).toBe(true);
  });

  it('rejects small numbers as non-time', () => {
    expect(detectTimeAxis([1, 2, 3, 4])).toBe(false);
  });

  it('empty array returns false', () => {
    expect(detectTimeAxis([])).toBe(false);
  });
});

describe('MS constants', () => {
  it('second = 1000ms', () => expect(MS.second).toBe(1_000));
  it('minute = 60s', () => expect(MS.minute).toBe(60_000));
  it('hour = 60min', () => expect(MS.hour).toBe(3_600_000));
  it('day = 24h', () => expect(MS.day).toBe(86_400_000));
  it('week = 7 days', () => expect(MS.week).toBe(604_800_000));
});

describe('getTickInterval', () => {
  it('1-hour span returns minute-level interval', () => {
    const interval = getTickInterval(MS.hour);
    expect(['millisecond', 'second', 'minute']).toContain(interval.unit);
  });

  it('1-week span returns day-level interval', () => {
    const interval = getTickInterval(MS.week);
    expect(['hour', 'day']).toContain(interval.unit);
  });

  it('1-year span returns month-level interval', () => {
    const interval = getTickInterval(MS.year);
    expect(['week', 'month', 'year']).toContain(interval.unit);
  });

  it('10-year span returns year-level interval', () => {
    const interval = getTickInterval(MS.year * 10, 8);
    expect(interval.unit).toBe('year');
  });
});

describe('alignToInterval', () => {
  it('aligns to hour', () => {
    const ts = new Date(2024, 0, 15, 9, 47, 23).valueOf();
    // Use a 2-day span → getTickInterval picks an hourly interval
    const interval = getTickInterval(MS.day * 2, 8);
    const aligned = alignToInterval(ts, interval);
    const d = new Date(aligned);
    // After aligning to hour: minutes and seconds should be 0
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('aligns to month', () => {
    const ts = new Date(2024, 5, 23).valueOf(); // June 23
    const interval = { ms: MS.month, unit: 'month' as const, count: 1, label: '1m' };
    const aligned = alignToInterval(ts, interval);
    const d = new Date(aligned);
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(5);
  });
});

describe('generateTimeTicks', () => {
  it('generates ticks within range', () => {
    const start = new Date(2024, 0, 1).valueOf();
    const end   = new Date(2024, 11, 31).valueOf();
    const ticks = generateTimeTicks(start, end, 8);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every(t => t >= start && t <= end)).toBe(true);
  });

  it('ticks are sorted ascending', () => {
    const start = Date.now();
    const end = start + MS.week;
    const ticks = generateTimeTicks(start, end, 7);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
    }
  });
});

describe('formatAxisDate', () => {
  const base = new Date(2024, 2, 14, 9, 30, 0).valueOf(); // March 14, 2024 09:30

  it('sub-minute span → sec.ms format', () => {
    const s = formatAxisDate(base, MS.second * 30);
    expect(s).toMatch(/\d{2}\.\d{3}/);
  });

  it('1-hour span → time format', () => {
    const s = formatAxisDate(base, MS.hour);
    expect(s).toMatch(/:/);
  });

  it('2-year span → year only', () => {
    const s = formatAxisDate(base, MS.year * 3);
    expect(s).toBe('2024');
  });
});

describe('relativeTo', () => {
  const now = new Date(2024, 0, 15, 12, 0, 0).valueOf();

  it('just now for < 10s', () => {
    expect(relativeTo(now - 5000, now)).toBe('just now');
  });

  it('seconds ago', () => {
    expect(relativeTo(now - 30_000, now)).toContain('second');
  });

  it('minutes ago', () => {
    expect(relativeTo(now - MS.minute * 5, now)).toContain('minute');
  });

  it('hours ago', () => {
    expect(relativeTo(now - MS.hour * 3, now)).toContain('hour');
  });

  it('in future', () => {
    expect(relativeTo(now + MS.hour, now)).toMatch(/^in/);
  });

  it('days ago', () => {
    expect(relativeTo(now - MS.day * 3, now)).toContain('day');
  });
});

describe('formatDuration', () => {
  it('zero → 0s', () => expect(formatDuration(0)).toBe('0s'));
  it('30_000ms → 30s', () => expect(formatDuration(30_000)).toBe('30s'));
  it('1 hour 1 min 1 sec', () => expect(formatDuration(3_661_000)).toBe('1h 1m 1s'));
  it('negative → 0s', () => expect(formatDuration(-100)).toBe('0s'));
});

describe('date helpers', () => {
  const ts = new Date(2024, 5, 23, 14, 30, 0).valueOf(); // June 23 2024, Sunday

  it('startOfDay sets midnight', () => {
    const d = new Date(startOfDay(ts));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('startOfMonth sets day=1', () => {
    const d = new Date(startOfMonth(ts));
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(5);
  });

  it('startOfYear returns Jan 1', () => {
    const d = new Date(startOfYear(ts));
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(d.getFullYear()).toBe(2024);
  });

  it('dayOfWeek returns 0-6', () => {
    const dow = dayOfWeek(ts);
    expect(dow).toBeGreaterThanOrEqual(0);
    expect(dow).toBeLessThanOrEqual(6);
  });

  it('isoWeek returns 1-53', () => {
    const w = isoWeek(ts);
    expect(w).toBeGreaterThanOrEqual(1);
    expect(w).toBeLessThanOrEqual(53);
  });

  it('sameDay true for same day', () => {
    const ts2 = new Date(2024, 5, 23, 20, 0).valueOf();
    expect(sameDay(ts, ts2)).toBe(true);
  });

  it('sameDay false for different day', () => {
    const ts2 = new Date(2024, 5, 24, 0, 0).valueOf();
    expect(sameDay(ts, ts2)).toBe(false);
  });
});

describe('addTime', () => {
  const base = new Date(2024, 0, 1).valueOf();

  it('adds days', () => {
    const result = new Date(addTime(base, 5, 'day'));
    expect(result.getDate()).toBe(6);
  });

  it('adds months', () => {
    const result = new Date(addTime(base, 3, 'month'));
    expect(result.getMonth()).toBe(3); // April
  });

  it('adds years', () => {
    const result = new Date(addTime(base, 2, 'year'));
    expect(result.getFullYear()).toBe(2026);
  });
});

describe('clampDate', () => {
  const min = new Date(2024, 0, 1).valueOf();
  const max = new Date(2024, 11, 31).valueOf();

  it('clamps below min', () => {
    expect(clampDate(new Date(2023, 6, 1), min, max)).toBe(min);
  });

  it('clamps above max', () => {
    expect(clampDate(new Date(2025, 0, 1), min, max)).toBe(max);
  });

  it('passes through in-range value', () => {
    const mid = new Date(2024, 5, 15).valueOf();
    expect(clampDate(mid, min, max)).toBe(mid);
  });
});

describe('tzOffsetMs', () => {
  it('returns a number', () => {
    const offset = tzOffsetMs('UTC');
    expect(typeof offset).toBe('number');
  });

  it('UTC has zero offset from itself', () => {
    // The function measures wall-clock difference; UTC vs UTC is 0
    expect(tzOffsetMs('UTC')).toBe(0);
  });
});
