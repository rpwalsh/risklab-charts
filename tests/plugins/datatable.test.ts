import { describe, it, expect } from 'vitest';
import { extractRows, rowsToCSV } from '../../src/plugins/DataTablePlugin';
import type { FlatRow } from '../../src/plugins/DataTablePlugin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSeries(id: string, name: string, data: Array<{ x: unknown; y: unknown }>) {
  return { id, name, data };
}

// ── extractRows ───────────────────────────────────────────────────────────────

describe('extractRows', () => {
  it('returns rows, headers, and seriesNames', () => {
    const s1 = makeSeries('s1', 'Revenue', [{ x: 'Jan', y: 100 }, { x: 'Feb', y: 120 }]);
    const { rows, headers, seriesNames } = extractRows([s1]);
    expect(Array.isArray(rows)).toBe(true);
    expect(Array.isArray(headers)).toBe(true);
    expect(typeof seriesNames).toBe('object');
  });

  it('headers start with x then series ids', () => {
    const s1 = makeSeries('revenue', 'Revenue', [{ x: 'Q1', y: 100 }]);
    const s2 = makeSeries('cost', 'Cost', [{ x: 'Q1', y: 80 }]);
    const { headers } = extractRows([s1, s2]);
    expect(headers[0]).toBe('x');
    expect(headers).toContain('revenue');
    expect(headers).toContain('cost');
  });

  it('seriesNames maps id to display name', () => {
    const s1 = makeSeries('s1', 'Revenue', [{ x: 1, y: 10 }]);
    const s2 = makeSeries('s2', 'Cost', [{ x: 1, y: 5 }]);
    const { seriesNames } = extractRows([s1, s2]);
    expect(seriesNames['s1']).toBe('Revenue');
    expect(seriesNames['s2']).toBe('Cost');
  });

  it('rows contain x value at row.x', () => {
    const s1 = makeSeries('s1', 'Revenue', [
      { x: 'Jan', y: 100 },
      { x: 'Feb', y: 120 },
    ]);
    const { rows } = extractRows([s1]);
    const xValues = rows.map(r => r.x);
    expect(xValues).toContain('Jan');
    expect(xValues).toContain('Feb');
  });

  it('rows contain y value keyed by series id', () => {
    const s1 = makeSeries('revenue', 'Revenue', [{ x: 'Jan', y: 500 }]);
    const { rows } = extractRows([s1]);
    expect(rows[0]['revenue']).toBe(500);
  });

  it('merges multiple series into same row by x value', () => {
    const s1 = makeSeries('s1', 'A', [
      { x: 'Q1', y: 10 },
      { x: 'Q2', y: 20 },
    ]);
    const s2 = makeSeries('s2', 'B', [
      { x: 'Q1', y: 5 },
      { x: 'Q2', y: 8 },
    ]);
    const { rows } = extractRows([s1, s2]);
    expect(rows).toHaveLength(2);
    const q1 = rows.find(r => r.x === 'Q1')!;
    expect(q1['s1']).toBe(10);
    expect(q1['s2']).toBe(5);
  });

  it('missing series value for a row x-key is undefined', () => {
    const s1 = makeSeries('s1', 'A', [{ x: 'Jan', y: 100 }, { x: 'Feb', y: 200 }]);
    const s2 = makeSeries('s2', 'B', [{ x: 'Jan', y: 50 }]); // Feb missing
    const { rows } = extractRows([s1, s2]);
    const febRow = rows.find(r => r.x === 'Feb')!;
    expect(febRow['s1']).toBe(200);
    expect(febRow['s2']).toBeUndefined();
  });

  it('empty series array gives empty rows', () => {
    const { rows, headers } = extractRows([]);
    expect(rows).toHaveLength(0);
    expect(headers).toEqual(['x']);
  });

  it('handles numeric x values', () => {
    const s1 = makeSeries('s1', 'Data', [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ]);
    const { rows } = extractRows([s1]);
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r['s1'])).toContain(10);
    expect(rows.map(r => r['s1'])).toContain(30);
  });

  it('rows are sorted by x value string localeCompare', () => {
    const s1 = makeSeries('s1', 'A', [
      { x: 'C', y: 3 },
      { x: 'A', y: 1 },
      { x: 'B', y: 2 },
    ]);
    const { rows } = extractRows([s1]);
    expect(rows[0].x).toBe('A');
    expect(rows[1].x).toBe('B');
    expect(rows[2].x).toBe('C');
  });

  it('three-series scenario has correct length', () => {
    const s1 = makeSeries('s1', 'A', [{ x: 1, y: 10 }, { x: 2, y: 20 }]);
    const s2 = makeSeries('s2', 'B', [{ x: 1, y: 15 }, { x: 2, y: 25 }]);
    const s3 = makeSeries('s3', 'C', [{ x: 1, y: 5 }, { x: 2, y: 8 }]);
    const { rows, headers } = extractRows([s1, s2, s3]);
    expect(rows).toHaveLength(2);
    expect(headers).toHaveLength(4); // x + s1 + s2 + s3
  });
});

// ── rowsToCSV ─────────────────────────────────────────────────────────────────

describe('rowsToCSV', () => {
  it('produces a string output', () => {
    const rows: FlatRow[] = [{ x: 'Jan', s1: 100 }];
    const headers = ['x', 's1'];
    const names = { s1: 'Revenue' };
    const csv = rowsToCSV(rows, headers, names);
    expect(typeof csv).toBe('string');
  });

  it('first line is the header row with series names', () => {
    const rows: FlatRow[] = [{ x: 'Jan', s1: 100 }];
    const csv = rowsToCSV(rows, ['x', 's1'], { s1: 'Revenue' });
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('"x"');
    expect(firstLine).toContain('"Revenue"');
  });

  it('uses x as key in header when no seriesName for it', () => {
    const rows: FlatRow[] = [{ x: 'Q1', s1: 10 }];
    const headers = ['x', 's1'];
    const names = { s1: 'Sales' };
    const firstLine = rowsToCSV(rows, headers, names).split('\n')[0];
    expect(firstLine).toContain('"x"');
  });

  it('data rows contain correct values', () => {
    const rows: FlatRow[] = [{ x: 'Jan', revenue: 500, cost: 300 }];
    const headers = ['x', 'revenue', 'cost'];
    const names = { revenue: 'Revenue', cost: 'Cost' };
    const csv = rowsToCSV(rows, headers, names);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('Jan');
    expect(dataLine).toContain('500');
    expect(dataLine).toContain('300');
  });

  it('null/undefined values are replaced with empty string', () => {
    const rows: FlatRow[] = [{ x: 'Jan', s1: null, s2: undefined }];
    const headers = ['x', 's1', 's2'];
    const names = { s1: 'A', s2: 'B' };
    const csv = rowsToCSV(rows, headers, names);
    const dataLine = csv.split('\n')[1];
    // Two commas next to each other (empty cells)
    expect(dataLine).toContain('Jan,,');
  });

  it('values with commas are quoted', () => {
    const rows: FlatRow[] = [{ x: 'A, B', s1: 100 }];
    const csv = rowsToCSV(rows, ['x', 's1'], { s1: 'Val' });
    expect(csv).toContain('"A, B"');
  });

  it('values with double-quotes are escaped', () => {
    const rows: FlatRow[] = [{ x: 'Say "hello"', s1: 1 }];
    const csv = rowsToCSV(rows, ['x', 's1'], { s1: 'Val' });
    expect(csv).toContain('""hello""');
  });

  it('multiple rows produce correct line count', () => {
    const rows: FlatRow[] = [
      { x: 'Jan', s1: 100 },
      { x: 'Feb', s1: 200 },
      { x: 'Mar', s1: 300 },
    ];
    const csv = rowsToCSV(rows, ['x', 's1'], { s1: 'Sales' });
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4); // 1 header + 3 data
  });

  it('empty rows array produces only header', () => {
    const csv = rowsToCSV([], ['x', 's1'], { s1: 'Sales' });
    const lines = csv.split('\n');
    expect(lines[0]).toContain('"x"');
    expect(lines[0]).toContain('"Sales"');
    // Body is empty string after the '\n'
    expect(lines.slice(1).join('')).toBe('');
  });

  it('round-trip: extractRows → rowsToCSV', () => {
    const s1 = makeSeries('rev', 'Revenue', [
      { x: 'Q1', y: 1000 },
      { x: 'Q2', y: 2000 },
    ]);
    const { rows, headers, seriesNames } = extractRows([s1]);
    const csv = rowsToCSV(rows, headers, seriesNames);
    expect(csv).toContain('Revenue');
    expect(csv).toContain('Q1');
    expect(csv).toContain('1000');
    expect(csv).toContain('Q2');
    expect(csv).toContain('2000');
  });
});
