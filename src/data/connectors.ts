// ============================================================================
// RiskLab Charts — Data Connectors
// Load, stream, and transform data from any source into chart-ready format.
//
// Sources supported:
//   • CSV  — parse from string / File / URL
//   • JSON — fetch from URL with field mapping
//   • REST — periodic polling from any REST endpoint
//   • WebSocket — real-time streaming
//   • SSE (Server-Sent Events) — server-push streaming
//
// All connectors return:
//   connect() → DataFeed (subscribe to data, pause, resume, destroy)
//   loadOnce() → Promise<SeriesConfig[]>
// ============================================================================

import type { SeriesConfig, DataPoint } from '../core/types';

// ── Shared types ──────────────────────────────────────────────────────────────

export type FieldMapper<T = Record<string, unknown>> = {
  /** Map source field → x value */
  x: keyof T | ((row: T) => DataPoint['x']);
  /** Map source field → y value */
  y: keyof T | ((row: T) => DataPoint['y']);
  /** Map source field → series grouping key (optional) */
  series?: keyof T | ((row: T) => string);
  /** Additional field mappings merged onto each DataPoint */
  extra?: Partial<Record<keyof DataPoint, keyof T | ((row: T) => unknown)>>;
};

export interface DataFeed {
  /** Subscribe to incoming data. Returns unsubscribe fn. */
  on(event: 'data', handler: (series: SeriesConfig[]) => void): () => void;
  on(event: 'error', handler: (err: Error) => void): () => void;
  on(event: 'connect', handler: () => void): () => void;
  on(event: 'disconnect', handler: () => void): () => void;
  /** Pause receiving data */
  pause(): void;
  /** Resume after pause */
  resume(): void;
  /** Permanently close the connection */
  destroy(): void;
  readonly connected: boolean;
}

// ── CSV Connector ─────────────────────────────────────────────────────────────

export interface CsvConnectorOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Which column becomes x. Default: first column. */
  xField?: keyof T | string;
  /** Which column(s) become y-series. Default: all non-x numeric columns. */
  yFields?: Array<keyof T | string>;
  /** Custom field delimiter. Default: auto-detect (comma or tab). */
  delimiter?: string;
  /** Row has header row. Default: true. */
  hasHeader?: boolean;
  /** Transform a raw row before mapping. */
  transform?: (row: T) => T | null;
  /** Skip rows where any y value is NaN. Default: true. */
  skipInvalid?: boolean;
  /** Series type. Default: 'line'. */
  seriesType?: SeriesConfig['type'];
}

/**
 * Parse a CSV string into SeriesConfig[].
 *
 * @example
 * const series = parseCSV(rawText, { xField: 'date', yFields: ['revenue', 'costs'] });
 */
export function parseCSV<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  options: CsvConnectorOptions<T> = {},
): SeriesConfig[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];

  // Auto-detect delimiter
  const delimiter = options.delimiter ?? (lines[0]!.includes('\t') ? '\t' : ',');

  // Parse header
  const hasHeader = options.hasHeader ?? true;
  const headers: string[] = hasHeader
    ? parseCsvRow(lines[0]!, delimiter)
    : lines[0]!.split(delimiter).map((_, i) => `col${i}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Parse rows
  const rawRows: T[] = dataLines
    .map(line => {
      const values = parseCsvRow(line, delimiter);
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return obj as T;
    })
    .map(row => options.transform ? options.transform(row) : row)
    .filter((r): r is T => r !== null && r !== undefined);

  const xField = (options.xField as string) ?? headers[0] ?? 'x';
  const yFields = (options.yFields as string[] | undefined)
    ?? headers.filter(h => h !== xField && rawRows.some(r => !isNaN(Number(r[h]))));

  const type = options.seriesType ?? 'line';
  const seriesMap = new Map<string, DataPoint[]>();

  for (const field of yFields) {
    seriesMap.set(field, []);
  }

  for (const row of rawRows) {
    const xVal = coerceX(row[xField]);
    for (const field of yFields) {
      const yVal = Number(row[field]);
      if (options.skipInvalid !== false && isNaN(yVal)) continue;
      seriesMap.get(field)!.push({ x: xVal, y: yVal });
    }
  }

  return [...seriesMap.entries()].map(([field, data], i) => ({
    id: `csv_${field}_${i}`,
    name: field,
    type,
    data,
  }));
}

/**
 * Fetch a CSV from a URL and parse it.
 */
export async function fetchCSV<T extends Record<string, unknown>>(
  url: string,
  options: CsvConnectorOptions<T> & { fetchInit?: RequestInit } = {},
): Promise<SeriesConfig[]> {
  const res = await fetch(url, options.fetchInit);
  if (!res.ok) throw new Error(`[CSV] HTTP ${res.status}: ${url}`);
  const text = await res.text();
  return parseCSV<T>(text, options);
}

/**
 * Read a CSV from a browser File object.
 */
export function readCSVFile<T extends Record<string, unknown>>(
  file: File,
  options: CsvConnectorOptions<T> = {},
): Promise<SeriesConfig[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(parseCSV<T>(e.target!.result as string, options));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('[CSV] FileReader error'));
    reader.readAsText(file);
  });
}

// ── JSON Connector ────────────────────────────────────────────────────────────

export interface JsonConnectorOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /** JSON path to the array of records: e.g. 'data.rows'. Default: root. */
  dataPath?: string;
  /** Field mapping */
  map: FieldMapper<T>;
  /** Series type. Default: 'line'. */
  seriesType?: SeriesConfig['type'];
  /** Name override for single-series case */
  name?: string;
  /** Request options */
  fetchInit?: RequestInit;
}

/**
 * Fetch JSON from a URL and map it to SeriesConfig[].
 *
 * @example
 * const series = await fetchJSON('https://api.example.com/stocks', {
 *   dataPath: 'candles',
 *   map: { x: 'timestamp', y: 'close', series: 'ticker' },
 * });
 */
export async function fetchJSON<T extends Record<string, unknown>>(
  url: string,
  options: JsonConnectorOptions<T>,
): Promise<SeriesConfig[]> {
  const res = await fetch(url, options.fetchInit);
  if (!res.ok) throw new Error(`[JSON] HTTP ${res.status}: ${url}`);
  const json: unknown = await res.json();
  return mapJSON<T>(json, options);
}

/**
 * Map an already-fetched JSON value to SeriesConfig[].
 */
export function mapJSON<T extends Record<string, unknown>>(
  json: unknown,
  options: JsonConnectorOptions<T>,
): SeriesConfig[] {
  let rows: T[] = [];

  if (options.dataPath) {
    const parts = options.dataPath.split('.');
    let node: unknown = json;
    for (const p of parts) node =
      (node as Record<string, unknown>)?.[p];
    rows = Array.isArray(node) ? (node as T[]) : [];
  } else {
    rows = Array.isArray(json) ? (json as T[]) : [];
  }

  const { map, seriesType = 'line' } = options;
  const seriesMap = new Map<string, DataPoint[]>();

  for (const row of rows) {
    const xVal = typeof map.x === 'function' ? map.x(row) : coerceX(row[map.x as string]);
    const yVal = Number(typeof map.y === 'function' ? map.y(row) : row[map.y as string]);
    const seriesKey = map.series
      ? String(typeof map.series === 'function' ? map.series(row) : row[map.series as string])
      : (options.name ?? 'default');

    if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, []);
    const pt: DataPoint = { x: xVal, y: yVal };
    if (map.extra) {
      for (const [k, v] of Object.entries(map.extra)) {
        (pt as unknown as Record<string, unknown>)[k] = typeof v === 'function' ? v(row) : row[v as string];
      }
    }
    seriesMap.get(seriesKey)!.push(pt);
  }

  return [...seriesMap.entries()].map(([name, data], i) => ({
    id: `json_${name}_${i}`,
    name,
    type: seriesType,
    data,
  }));
}

// ── REST Polling Connector ────────────────────────────────────────────────────

export interface RestConnectorOptions<T extends Record<string, unknown> = Record<string, unknown>> extends JsonConnectorOptions<T> {
  /** Poll interval in ms. Default: 5000. */
  intervalMs?: number;
  /** Max number of points to keep per series (ring buffer). Default: 0 = unlimited. */
  maxPoints?: number;
  /** Append new points to existing data (true) or replace (false). Default: true. */
  append?: boolean;
}

/**
 * Create a polling REST data connector.
 *
 * @example
 * const feed = createRestConnector('https://api.example.com/live', {
 *   map: { x: 'time', y: 'price' },
 *   intervalMs: 2000,
 *   maxPoints: 500,
 *   append: true,
 * });
 * feed.on('data', (series) => chart.setData(series));
 */
export function createRestConnector<T extends Record<string, unknown>>(
  url: string,
  options: RestConnectorOptions<T>,
): DataFeed {
  const handlers: Record<string, Set<(...args: unknown[]) => unknown>> = {
    data: new Set(), error: new Set(), connect: new Set(), disconnect: new Set(),
  };
  const intervalMs = options.intervalMs ?? 5000;
  const maxPoints = options.maxPoints ?? 0;
  const append = options.append ?? true;
  const accumulated = new Map<string, DataPoint[]>();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;
  let connected = false;
  let destroyed = false;

  function emit(event: string, ...args: unknown[]) {
    handlers[event]?.forEach(fn => fn(...args));
  }

  async function poll() {
    if (paused || destroyed) return;
    try {
      const series = await fetchJSON<T>(url, options);
      if (!connected) { connected = true; emit('connect'); }

      let finalSeries: SeriesConfig[];

      if (append) {
        for (const s of series) {
          const acc = accumulated.get(s.id) ?? [];
          acc.push(...s.data);
          if (maxPoints > 0 && acc.length > maxPoints) acc.splice(0, acc.length - maxPoints);
          accumulated.set(s.id, acc);
        }
        finalSeries = series.map(s => ({ ...s, data: accumulated.get(s.id) ?? s.data }));
      } else {
        finalSeries = series;
      }

      emit('data', finalSeries);
    } catch (err) {
      emit('error', err instanceof Error ? err : new Error(String(err)));
    }

    if (!destroyed) {
      timer = setTimeout(poll, intervalMs);
    }
  }

  // Start immediately
  poll();

  return {
    get connected() { return connected; },
    on(event: string, handler: (...args: unknown[]) => unknown) {
      handlers[event]?.add(handler);
      return () => handlers[event]?.delete(handler);
    },
    pause() { paused = true; },
    resume() {
      if (!paused) return;
      paused = false;
      if (!timer) poll();
    },
    destroy() {
      destroyed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      connected = false;
      emit('disconnect');
    },
  } as DataFeed;
}

// ── WebSocket Connector ───────────────────────────────────────────────────────

export interface WebSocketConnectorOptions {
  /**
   * Map a raw message to DataPoint(s) for the given series.
   * Return null to ignore the message.
   */
  messageParser: (event: MessageEvent) => Array<{ seriesId: string; point: DataPoint }> | null;
  /** Series definitions (id + name + type). Provide upfront so chart can be initialized. */
  initialSeries?: SeriesConfig[];
  /** Max points per series. Default: 1000. */
  maxPoints?: number;
  /** Auto-reconnect on disconnect. Default: true. */
  autoReconnect?: boolean;
  /** Reconnect delay ms. Default: 3000. */
  reconnectDelayMs?: number;
  /** WebSocket protocols */
  protocols?: string | string[];
}

/**
 * Create a WebSocket data connector.
 *
 * @example
 * const feed = createWebSocketConnector('wss://stream.example.com', {
 *   messageParser: (e) => {
 *     const d = JSON.parse(e.data);
 *     return [{ seriesId: 'btc', point: { x: d.ts, y: d.price } }];
 *   },
 *   maxPoints: 500,
 * });
 *
 * feed.on('data', series => chart.setData(series));
 */
export function createWebSocketConnector(
  url: string,
  options: WebSocketConnectorOptions,
): DataFeed & { send: (data: string | ArrayBuffer | ArrayBufferView | Blob) => void } {
  const handlers: Record<string, Set<(...args: unknown[]) => unknown>> = {
    data: new Set(), error: new Set(), connect: new Set(), disconnect: new Set(),
  };
  const maxPoints = options.maxPoints ?? 1000;
  const seriesData = new Map<string, DataPoint[]>();

  // Pre-fill from initialSeries
  for (const s of options.initialSeries ?? []) {
    seriesData.set(s.id, [...s.data]);
  }

  let ws: WebSocket | null = null;
  let connected = false;
  let destroyed = false;

  function emit(event: string, ...args: unknown[]) {
    handlers[event]?.forEach(fn => fn(...args));
  }

  function buildSeriesArray(): SeriesConfig[] {
    return (options.initialSeries ?? [...seriesData.keys()].map(id => ({
      id, name: id, type: 'line' as const, data: [],
    }))).map(s => ({ ...s, data: seriesData.get(s.id) ?? [] }));
  }

  function connect() {
    if (destroyed) return;
    try {
      ws = new WebSocket(url, options.protocols);

      ws.onopen = () => {
        connected = true;
        emit('connect');
      };

      ws.onmessage = (event) => {
        try {
          const updates = options.messageParser(event);
          if (!updates?.length) return;

          for (const { seriesId, point } of updates) {
            const arr = seriesData.get(seriesId) ?? [];
            arr.push(point);
            if (maxPoints > 0 && arr.length > maxPoints) arr.splice(0, arr.length - maxPoints);
            seriesData.set(seriesId, arr);
          }

          emit('data', buildSeriesArray());
        } catch (err) {
          emit('error', err instanceof Error ? err : new Error(String(err)));
        }
      };

      ws.onerror = (event) => {
        emit('error', new Error(`[WebSocket] error event: ${url}`));
        void event;
      };

      ws.onclose = () => {
        connected = false;
        emit('disconnect');
        if (!destroyed && (options.autoReconnect ?? true)) {
          setTimeout(connect, options.reconnectDelayMs ?? 3000);
        }
      };
    } catch (err) {
      emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  connect();

  return {
    get connected() { return connected; },
    on(event: string, handler: (...args: unknown[]) => unknown) {
      handlers[event]?.add(handler);
      return () => handlers[event]?.delete(handler);
    },
    pause() { /* WebSocket doesn't pause — messages are buffered internally */ },
    resume() {},
    send(data) { if (ws?.readyState === WebSocket.OPEN) ws.send(data as string | Blob | BufferSource); },
    destroy() {
      destroyed = true;
      ws?.close();
      ws = null;
      connected = false;
      emit('disconnect');
    },
  } as DataFeed & { send: (data: string | ArrayBuffer | ArrayBufferView | Blob) => void };
}

// ── Server-Sent Events Connector ──────────────────────────────────────────────

export interface SseConnectorOptions {
  /** Parse an SSE MessageEvent into DataPoints */
  messageParser: (event: MessageEvent) => Array<{ seriesId: string; point: DataPoint }> | null;
  /** Pre-existing series */
  initialSeries?: SeriesConfig[];
  /** Max points per series */
  maxPoints?: number;
  /** SSE event names to listen on. Default: ['message'] */
  eventNames?: string[];
  /** Auto reconnect delay (browser does this natively, but just in case) */
  reconnectDelayMs?: number;
  /** Additional EventSource init options (withCredentials etc.) */
  eventSourceInit?: EventSourceInit;
}

/**
 * Create a Server-Sent Events connector.
 * SSE is simpler than WebSocket and works over plain HTTP/2.
 *
 * @example
 * const feed = createSseConnector('/api/live-data', {
 *   messageParser: (e) => {
 *     const d = JSON.parse(e.data);
 *     return [{ seriesId: 's1', point: { x: d.ts, y: d.value } }];
 *   },
 * });
 */
export function createSseConnector(
  url: string,
  options: SseConnectorOptions,
): DataFeed {
  const handlers: Record<string, Set<(...args: unknown[]) => unknown>> = {
    data: new Set(), error: new Set(), connect: new Set(), disconnect: new Set(),
  };
  const maxPoints = options.maxPoints ?? 1000;
  const seriesData = new Map<string, DataPoint[]>();
  for (const s of options.initialSeries ?? []) seriesData.set(s.id, [...s.data]);

  let es: EventSource | null = null;
  let connected = false;
  let destroyed = false;
  let paused = false;

  function emit(event: string, ...args: unknown[]) {
    handlers[event]?.forEach(fn => fn(...args));
  }

  function buildSeries(): SeriesConfig[] {
    return (options.initialSeries ?? [...seriesData.keys()].map(id => ({
      id, name: id, type: 'line' as const, data: [],
    }))).map(s => ({ ...s, data: seriesData.get(s.id) ?? [] }));
  }

  function handleMessage(event: MessageEvent) {
    if (paused || destroyed) return;
    try {
      const updates = options.messageParser(event);
      if (!updates?.length) return;
      for (const { seriesId, point } of updates) {
        const arr = seriesData.get(seriesId) ?? [];
        arr.push(point);
        if (maxPoints > 0 && arr.length > maxPoints) arr.splice(0, arr.length - maxPoints);
        seriesData.set(seriesId, arr);
      }
      emit('data', buildSeries());
    } catch (err) {
      emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  function connect() {
    if (typeof EventSource === 'undefined') {
      emit('error', new Error('[SSE] EventSource not supported in this environment'));
      return;
    }
    es = new EventSource(url, options.eventSourceInit);

    es.onopen = () => { connected = true; emit('connect'); };
    es.onerror = () => {
      connected = false;
      emit('error', new Error(`[SSE] connection error: ${url}`));
    };

    for (const name of options.eventNames ?? ['message']) {
      es.addEventListener(name, handleMessage as EventListenerOrEventListenerObject);
    }
  }

  connect();

  return {
    get connected() { return connected; },
    on(event: string, handler: (...args: unknown[]) => unknown) {
      handlers[event]?.add(handler);
      return () => handlers[event]?.delete(handler);
    },
    pause() { paused = true; },
    resume() { paused = false; },
    destroy() {
      destroyed = true;
      es?.close();
      es = null;
      connected = false;
      emit('disconnect');
    },
  } as DataFeed;
}

// ── Helper: coerce x value ────────────────────────────────────────────────────

function coerceX(value: unknown): DataPoint['x'] {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Try date parse
    const d = new Date(value);
    if (!isNaN(d.valueOf()) && value.length > 4) return d;
    const n = Number(value);
    if (!isNaN(n)) return n;
    return value;
  }
  return String(value ?? '');
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
