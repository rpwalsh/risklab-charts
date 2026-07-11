// ============================================================================
// RiskLab Charts — OpenTopography API integration
//
// Utilities for fetching and parsing elevation data from the OpenTopography
// REST API (https://portal.opentopography.org/apidocs/).
//
// CORS: The OT API does not emit CORS headers for arbitrary browser origins.
//   • In Vite dev: configure server.proxy { '/api/opentopo': ... } so that
//     requests to /api/opentopo/** are forwarded to the OT server.
//   • In production: supply `openTopo.proxy` (a URL-prefix for a CORS proxy
//     such as 'https://corsproxy.io/?') or run a server-side relay.
//   • When `proxy` is omitted the relative path /api/opentopo is used, which
//     works when the site's reverse proxy routes it to the OT API.
//
// Data format returned: Arc ASCII Grid (AAIGrid) — a plain-text raster format
// with a 6-line header followed by space-separated elevation values stored
// north-to-south, west-to-east.  Parsing is done entirely in JS with no deps.
// ============================================================================

import type { OpenTopoConfig } from '../core/types';
export type { OpenTopoConfig } from '../core/types';

// ── Re-export the DEM type unions for IDE autocomplete ──────────────────────

/** Global DEM dataset identifiers accepted by the OpenTopography /globaldem endpoint. */
export type OpenTopoGlobalDemType =
  | 'SRTMGL3'          // SRTM GL3  — 90 m global
  | 'SRTMGL1'          // SRTM GL1  — 30 m global
  | 'SRTMGL1_E'        // SRTM GL1 Ellipsoidal — 30 m global
  | 'AW3D30'           // ALOS World 3D — 30 m global
  | 'AW3D30_E'         // ALOS World 3D Ellipsoidal — 30 m global
  | 'SRTM15Plus'       // Global Bathymetry — 500 m (ocean floor)
  | 'NASADEM'          // NASA DEM — global
  | 'COP30'            // Copernicus DSM — 30 m global
  | 'COP90'            // Copernicus DSM — 90 m global
  | 'EU_DTM'           // EU DTM — 30 m (Europe only)
  | 'GEDI_L3'          // GEDI DTM — 1000 m global
  | 'GEBCOIceTopo'     // GEBCO Ice Topo — 500 m bathymetry
  | 'GEBCOSubIceTopo'  // GEBCO Sub-Ice Topo — 500 m bathymetry
  | 'CA_MRDEM_DSM'     // Canada MRDEM DSM — 30 m
  | 'CA_MRDEM_DTM';    // Canada MRDEM DTM — 30 m

/** USGS 3DEP raster dataset identifiers accepted by the /usgsdem endpoint. */
export type OpenTopoUSGSDemType = 'USGS30m' | 'USGS10m' | 'USGS1m';

// ── Parsed AAIGrid ───────────────────────────────────────────────────────────

/** Structured result of parsing an Arc ASCII Grid (AAIGrid) response. */
export interface AAIGridData {
  /** Number of columns (west → east). */
  ncols: number;
  /** Number of rows (north → south in storage order). */
  nrows: number;
  /** Longitude of the left edge of the leftmost column (WGS 84). */
  xllcorner: number;
  /** Latitude of the bottom edge of the bottom row (WGS 84). */
  yllcorner: number;
  /** Cell size in degrees. */
  cellsize: number;
  /** NODATA sentinel value (cells with this value are excluded from output). */
  nodata: number;
  /**
   * Row-major elevation values in north-to-south, west-to-east order.
   * Index = row * ncols + col  (row 0 = northernmost row).
   */
  values: Float32Array;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildUrl(cfg: OpenTopoConfig): string {
  const params = new URLSearchParams();
  if (cfg.source === 'global') {
    params.set('demtype', cfg.demtype);
  } else {
    params.set('datasetName', cfg.demtype);
  }
  params.set('south',        String(cfg.south));
  params.set('north',        String(cfg.north));
  params.set('west',         String(cfg.west));
  params.set('east',         String(cfg.east));
  params.set('outputFormat', 'AAIGrid');
  params.set('API_Key',      cfg.apiKey);

  const endpoint = cfg.source === 'global' ? 'globaldem' : 'usgsdem';
  const canonical = `https://portal.opentopography.org/API/${endpoint}?${params}`;

  if (cfg.proxy !== undefined) {
    // User-supplied CORS proxy: prefix + URL-encode the canonical URL.
    return cfg.proxy + encodeURIComponent(canonical);
  }
  // Default: use the relative /api/opentopo path (works with the Vite dev proxy
  // or any reverse-proxy that strips the prefix and forwards to the OT server).
  return `/api/opentopo/${endpoint}?${params}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse an Arc ASCII Grid (AAIGrid) text payload into a structured object.
 *
 * The format consists of up to 6 header lines followed by space-separated
 * elevation values (north-to-south, west-to-east).
 *
 * @param text  Raw AAIGrid text (e.g. the `response.text()` from the OT API).
 */
export function parseAAIGrid(text: string): AAIGridData {
  const lines = text.trim().split(/\r?\n/);
  const header: Record<string, number> = {};
  let dataStart = 0;

  // Parse header lines (key  value pairs) until a non-header line is found.
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const m = lines[i].match(/^(\S+)\s+([-\d.eE+]+)\s*$/);
    if (m) {
      header[m[1].toLowerCase()] = parseFloat(m[2]);
      dataStart = i + 1;
    } else {
      break;
    }
  }

  const ncols     = (header['ncols']  | 0) || 1;
  const nrows     = (header['nrows']  | 0) || 1;
  const xllcorner = header['xllcorner'] ?? header['xllcenter'] ?? 0;
  const yllcorner = header['yllcorner'] ?? header['yllcenter'] ?? 0;
  const cellsize  = header['cellsize']  ?? 1;
  const nodata    = header['nodata_value'] ?? header['nodata'] ?? -9999;

  const values = new Float32Array(ncols * nrows);
  let idx = 0;
  for (let r = dataStart; r < lines.length && idx < values.length; r++) {
    const row = lines[r].trim();
    if (!row) continue;
    const tokens = row.split(/\s+/);
    for (const tok of tokens) {
      if (idx >= values.length) break;
      values[idx++] = parseFloat(tok);
    }
  }

  return { ncols, nrows, xllcorner, yllcorner, cellsize, nodata, values };
}

/**
 * Convert a parsed AAIGrid object into the flat `{x, y, z}` point array
 * expected by the `terrain3d` chart series.
 *
 * - `x` = longitude (WGS 84 decimal degrees)
 * - `y` = latitude  (WGS 84 decimal degrees)
 * - `z` = elevation in metres
 *
 * NODATA cells and non-finite values are omitted.
 */
export function aaigridToPoints(
  grid: AAIGridData,
): Array<{ x: number; y: number; z: number }> {
  const { ncols, nrows, xllcorner, yllcorner, cellsize, nodata, values } = grid;
  // Pre-allocate; real count determined during iteration.
  const pts = new Array<{ x: number; y: number; z: number }>(ncols * nrows);
  let count = 0;

  for (let r = 0; r < nrows; r++) {
    // Row 0 is the northernmost row; yllcorner is the south edge of the bottom row.
    const lat = yllcorner + (nrows - 1 - r) * cellsize;
    for (let c = 0; c < ncols; c++) {
      const z = values[r * ncols + c];
      if (z === nodata || !isFinite(z)) continue;
      pts[count++] = { x: xllcorner + c * cellsize, y: lat, z };
    }
  }

  pts.length = count;
  return pts;
}

/**
 * Fetch DEM data from the OpenTopography API, parse the AAIGrid response,
 * and return a point array ready for the `terrain3d` chart series.
 *
 * Also returns the `gridWidth` / `gridHeight` values to pass into
 * `terrain3d.gridWidth` / `terrain3d.gridHeight` for optimal rendering.
 *
 * @example
 * ```ts
 * import { fetchOpenTopoPoints } from '@risklab/charts';
 *
 * const result = await fetchOpenTopoPoints({
 *   source:  'global',
 *   demtype: 'SRTMGL1',        // 30 m global SRTM
 *   south: 36.05, north: 36.20,
 *   west: -112.20, east: -112.00,
 *   apiKey: 'demoapikeyot2022', // demo key — replace with your own
 * });
 *
 * engine.update({
 *   series: [{ type: 'terrain3d', label: 'Grand Canyon', data: result.points }],
 *   terrain3d: {
 *     gridWidth:  result.gridWidth,
 *     gridHeight: result.gridHeight,
 *     colormap: 'hypsometric',
 *     exaggeration: 3,
 *   },
 * });
 * ```
 *
 * @throws {Error} On HTTP errors or unparseable responses.
 */
export async function fetchOpenTopoPoints(cfg: OpenTopoConfig): Promise<{
  points: Array<{ x: number; y: number; z: number }>;
  grid: AAIGridData;
  gridWidth: number;
  gridHeight: number;
}> {
  const url = buildUrl(cfg);
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenTopography API ${res.status}: ${body.slice(0, 256)}`);
  }

  const text = await res.text();

  // Detect error responses wrapped in a 200 OK (OT API occasionally does this).
  if (text.trimStart().startsWith('<') || text.trimStart().startsWith('{')) {
    throw new Error(`OpenTopography returned unexpected content: ${text.slice(0, 128)}`);
  }

  const grid   = parseAAIGrid(text);
  const points = aaigridToPoints(grid);

  if (points.length === 0) {
    throw new Error('OpenTopography returned an empty DEM for the requested bounding box.');
  }

  return { points, grid, gridWidth: grid.ncols, gridHeight: grid.nrows };
}
