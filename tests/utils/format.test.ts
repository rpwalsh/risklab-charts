import { describe, it, expect } from 'vitest';
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatDate,
  formatDuration,
  truncate,
} from '../../src/utils/format';

// ── formatCompact ─────────────────────────────────────────────────────────────

describe('formatCompact', () => {
  it('below 1000 shows full number', () => {
    expect(formatCompact(999)).toBe('999.0');
    expect(formatCompact(0)).toBe('0.0');
    expect(formatCompact(1)).toBe('1.0');
  });

  it('thousands → k', () => {
    expect(formatCompact(1000)).toBe('1.0k');
    expect(formatCompact(1500)).toBe('1.5k');
    expect(formatCompact(999_999)).toBe('1000.0k');
  });

  it('millions → M', () => {
    expect(formatCompact(1_000_000)).toBe('1.0M');
    expect(formatCompact(2_500_000)).toBe('2.5M');
  });

  it('billions → B', () => {
    expect(formatCompact(1_000_000_000)).toBe('1.0B');
    expect(formatCompact(1_500_000_000)).toBe('1.5B');
  });

  it('trillions → T', () => {
    expect(formatCompact(1_000_000_000_000)).toBe('1.0T');
  });

  it('negative values', () => {
    expect(formatCompact(-1500)).toBe('-1.5k');
    expect(formatCompact(-1_000_000)).toBe('-1.0M');
  });

  it('custom decimal places', () => {
    expect(formatCompact(1234, 2)).toBe('1.23k');
    expect(formatCompact(1000, 0)).toBe('1k');
  });
});

// ── formatNumber ──────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('adds thousand separators', () => {
    expect(formatNumber(1234567)).toContain(',');
  });

  it('respects decimal options', () => {
    const result = formatNumber(3.14159, { maximumFractionDigits: 2 });
    expect(result).toBe('3.14');
  });

  it('currency formatting', () => {
    const result = formatNumber(999.99, { style: 'currency', currency: 'USD' });
    expect(result).toContain('$');
    expect(result).toContain('999');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles negative values', () => {
    expect(formatNumber(-42)).toContain('-');
  });
});

// ── formatPercent ─────────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('0.5 → 50.0%', () => expect(formatPercent(0.5)).toBe('50.0%'));
  it('1.0 → 100.0%', () => expect(formatPercent(1.0)).toBe('100.0%'));
  it('0 → 0.0%', () => expect(formatPercent(0)).toBe('0.0%'));
  it('fractional → proper decimals', () => expect(formatPercent(0.1234, 2)).toBe('12.34%'));
  it('over 100%', () => expect(formatPercent(1.5)).toBe('150.0%'));
  it('0 decimals', () => expect(formatPercent(0.256, 0)).toBe('26%'));
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  const date = new Date('2024-06-15T12:00:00Z');
  const ts = date.getTime();

  it('accepts Date objects', () => {
    const result = formatDate(date);
    expect(result).toContain('2024');
    expect(result).toContain('Jun');
  });

  it('accepts timestamp numbers', () => {
    const result = formatDate(ts);
    expect(result).toContain('2024');
  });

  it('returns a non-empty string', () => {
    expect(formatDate(date).length).toBeGreaterThan(0);
  });

  it('custom date options applied', () => {
    const result = formatDate(date, { year: 'numeric' });
    expect(result).toBe('2024');
  });
});

// ── formatDuration ────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('milliseconds < 1000', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('seconds < 60s', () => {
    expect(formatDuration(1000)).toContain('s');
    expect(formatDuration(30_000)).toContain('30');
  });

  it('minutes < 1h', () => {
    const result = formatDuration(90_000); // 1m 30s
    expect(result).toContain('m');
    expect(result).toContain('s');
  });

  it('hours', () => {
    const result = formatDuration(3_661_000); // 1h 1m 1s
    expect(result).toContain('h');
    expect(result).toContain('m');
  });

  it('exactly 1 hour', () => {
    const result = formatDuration(3_600_000);
    expect(result).toContain('h');
  });
});

// ── truncate ──────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns string unchanged if within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates with ellipsis', () => {
    const result = truncate('hello world', 8);
    expect(result.length).toBe(8);
    expect(result.endsWith('…')).toBe(true);
  });

  it('truncates exactly at limit', () => {
    const result = truncate('abcdefgh', 5);
    expect(result).toBe('abcd…');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('maxLength 1 returns just ellipsis', () => {
    expect(truncate('hello', 1)).toBe('…');
  });
});
