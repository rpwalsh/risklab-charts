import { describe, it, expect } from 'vitest';
import { parseCSV, mapJSON } from '../../src/data/connectors';

// ── parseCSV ──────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  const simpleCsv = `date,revenue,costs\n2024-01,100,80\n2024-02,120,90\n2024-03,140,100`;

  it('parses a CSV with header row', () => {
    const series = parseCSV(simpleCsv, { xField: 'date', yFields: ['revenue', 'costs'] });
    expect(series).toHaveLength(2);
    expect(series[0]!.name).toBe('revenue');
    expect(series[1]!.name).toBe('costs');
  });

  it('parses all numeric non-x columns by default', () => {
    const series = parseCSV(simpleCsv, { xField: 'date' });
    expect(series).toHaveLength(2);
  });

  it('produces correct data points', () => {
    const [revenue] = parseCSV(simpleCsv, { xField: 'date', yFields: ['revenue'] });
    expect(revenue!.data).toHaveLength(3);
    expect(revenue!.data[0]!.y).toBe(100);
    expect(revenue!.data[1]!.y).toBe(120);
    expect(revenue!.data[2]!.y).toBe(140);
  });

  it('handles tab-delimited CSV', () => {
    const tsv = `name\tvalue\nA\t10\nB\t20`;
    const series = parseCSV(tsv, { xField: 'name', yFields: ['value'] });
    expect(series[0]!.data).toHaveLength(2);
    expect(series[0]!.data[0]!.y).toBe(10);
  });

  it('handles quoted fields with commas inside', () => {
    const csv = `label,value\n"foo, bar",42\nbaz,7`;
    const series = parseCSV(csv, { xField: 'label', yFields: ['value'] });
    expect(series[0]!.data[0]!.x).toBe('foo, bar');
    expect(series[0]!.data[0]!.y).toBe(42);
  });

  it('handles escaped double quotes', () => {
    const csv = `label,value\n"say ""hello""",5`;
    const series = parseCSV(csv, { xField: 'label', yFields: ['value'] });
    expect(series[0]!.data[0]!.x).toBe('say "hello"');
  });

  it('skips invalid (NaN) rows by default', () => {
    const csv = `x,y\n1,10\n2,N/A\n3,30`;
    const series = parseCSV(csv, { xField: 'x', yFields: ['y'] });
    expect(series[0]!.data).toHaveLength(2); // N/A row skipped
  });

  it('keeps invalid rows when skipInvalid=false', () => {
    const csv = `x,y\n1,10\n2,N/A\n3,30`;
    const series = parseCSV(csv, { xField: 'x', yFields: ['y'], skipInvalid: false });
    expect(series[0]!.data).toHaveLength(3);
    expect(Number.isNaN(series[0]!.data[1]!.y)).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('\n\n')).toEqual([]);
  });

  it('auto-detects first column as x when xField not provided', () => {
    const csv = `name,score\nAlice,95\nBob,87`;
    const series = parseCSV(csv);
    expect(series[0]!.data[0]!.x).toBe('Alice');
  });

  it('applies transform function to each row', () => {
    const csv = `x,y\n1,10\n2,20\n3,30`;
    const series = parseCSV(csv, {
      xField: 'x',
      yFields: ['y'],
      transform: (row) => ({ ...row, y: String(Number(row.y) * 2) }),
    });
    expect(series[0]!.data[0]!.y).toBe(20);
    expect(series[0]!.data[1]!.y).toBe(40);
  });

  it('transform returning null skips the row', () => {
    const csv = `x,y\n1,10\n2,20\n3,30`;
    const series = parseCSV(csv, {
      xField: 'x',
      yFields: ['y'],
      transform: (row) => Number(row.x) === 2 ? null : row,
    });
    expect(series[0]!.data).toHaveLength(2);
  });

  it('uses seriesType option', () => {
    const csv = `x,y\n1,10`;
    const [s] = parseCSV(csv, { xField: 'x', yFields: ['y'], seriesType: 'bar' });
    expect(s!.type).toBe('bar');
  });

  it('coerces numeric x values to numbers', () => {
    const csv = `x,y\n1,10\n2,20`;
    const [s] = parseCSV(csv, { xField: 'x', yFields: ['y'] });
    expect(typeof s!.data[0]!.x).toBe('number');
  });

  it('coerces date strings to Date objects', () => {
    const csv = `date,value\n2024-01-15,100\n2024-02-15,200`;
    const [s] = parseCSV(csv, { xField: 'date', yFields: ['value'] });
    expect(s!.data[0]!.x).toBeInstanceOf(Date);
  });

  it('assigns unique ids to each series', () => {
    const csv = `x,a,b,c\n1,10,20,30`;
    const series = parseCSV(csv, { xField: 'x', yFields: ['a', 'b', 'c'] });
    const ids = series.map(s => s.id);
    expect(new Set(ids).size).toBe(3);
  });
});

// ── mapJSON ───────────────────────────────────────────────────────────────────

describe('mapJSON', () => {
  const flat = [
    { ts: 1, price: 100, ticker: 'AAPL' },
    { ts: 2, price: 110, ticker: 'AAPL' },
    { ts: 3, price: 90, ticker: 'GOOG' },
    { ts: 4, price: 95, ticker: 'GOOG' },
  ];

  it('maps flat array to a single series', () => {
    const series = mapJSON(flat, { map: { x: 'ts', y: 'price' } });
    expect(series).toHaveLength(1);
    expect(series[0]!.data).toHaveLength(4);
  });

  it('groups by series field', () => {
    const series = mapJSON(flat, {
      map: { x: 'ts', y: 'price', series: 'ticker' },
    });
    expect(series).toHaveLength(2);
    const names = series.map(s => s.name).sort();
    expect(names).toEqual(['AAPL', 'GOOG']);
  });

  it('each series has correct data', () => {
    const series = mapJSON(flat, {
      map: { x: 'ts', y: 'price', series: 'ticker' },
    });
    const aapl = series.find(s => s.name === 'AAPL')!;
    expect(aapl.data).toHaveLength(2);
    expect(aapl.data[0]!.y).toBe(100);
    expect(aapl.data[1]!.y).toBe(110);
  });

  it('supports function-based mapper for x', () => {
    const rows = [{ time: '2024-01-01', val: 5 }];
    const series = mapJSON(rows, {
      map: { x: (row) => new Date(row.time as string).getTime(), y: 'val' },
    });
    expect(typeof series[0]!.data[0]!.x).toBe('number');
  });

  it('supports function-based mapper for y', () => {
    const rows = [{ a: 3, b: 4 }];
    const series = mapJSON(rows, {
      map: { x: 'a', y: (row) => Math.sqrt((row.a as number) ** 2 + (row.b as number) ** 2) },
    });
    expect(series[0]!.data[0]!.y).toBe(5);
  });

  it('traverses dataPath', () => {
    const nested = { response: { data: [{ x: 1, y: 2 }] } };
    const series = mapJSON(nested, {
      dataPath: 'response.data',
      map: { x: 'x', y: 'y' },
    });
    expect(series[0]!.data[0]!.x).toBe(1);
    expect(series[0]!.data[0]!.y).toBe(2);
  });

  it('returns empty result for missing dataPath', () => {
    const series = mapJSON({}, { dataPath: 'does.not.exist', map: { x: 'x', y: 'y' } });
    // When path resolves to non-array, rows=[]. No series keys are created.
    expect(series.length === 0 || series[0]!.data.length === 0).toBe(true);
  });

  it('returns empty result for non-array root without dataPath', () => {
    const series = mapJSON({ x: 1, y: 2 }, { map: { x: 'x', y: 'y' } });
    // Object is not an array → rows=[], seriesMap stays empty → series=[]
    expect(series.length === 0 || series[0]!.data.length === 0).toBe(true);
  });

  it('uses name option for single-series case', () => {
    const series = mapJSON([{ x: 1, y: 2 }], { map: { x: 'x', y: 'y' }, name: 'Revenue' });
    expect(series[0]!.name).toBe('Revenue');
  });

  it('applies seriesType', () => {
    const series = mapJSON([{ x: 1, y: 2 }], { map: { x: 'x', y: 'y' }, seriesType: 'scatter' });
    expect(series[0]!.type).toBe('scatter');
  });
});
