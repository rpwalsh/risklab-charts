// ============================================================================
// RiskLab Charts — Interactive Tile Map + Choropleth
// Zoomable tile-based map with OSM tiles, pan/zoom, data overlay.
// Falls back to SVG choropleth when no container available for Canvas.
// Zero dependencies.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../core/types';
import type { ProcessedDataPoint, ProcessedSeries } from '../core/DataPipeline';
import { getBuiltinWorldGeoJSON } from './worldGeoSimplified';
import { escapeHtml } from '../utils/sanitize';

// ── GeoJSON minimal types ────────────────────────────────────────────────────

interface GeoPoint { type: 'Point'; coordinates: [number, number]; }
interface GeoMultiPoint { type: 'MultiPoint'; coordinates: [number, number][]; }
interface GeoLine { type: 'LineString'; coordinates: [number, number][]; }
interface GeoMultiLine { type: 'MultiLineString'; coordinates: [number, number][][]; }
interface GeoPoly { type: 'Polygon'; coordinates: [number, number][][]; }
interface GeoMultiPoly { type: 'MultiPolygon'; coordinates: [number, number][][][]; }
type GeoGeometry = GeoPoint | GeoMultiPoint | GeoLine | GeoMultiLine | GeoPoly | GeoMultiPoly;

interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: GeoGeometry;
}
interface GeoFeatureCollection { type: 'FeatureCollection'; features: GeoFeature[]; }

// ── Config ───────────────────────────────────────────────────────────────────

export interface MapChartConfig {
  geoJSON?: GeoFeatureCollection;
  joinBy?: string;
  projection?: 'equirectangular' | 'mercator' | 'naturalEarth';
  colorLow?: string;
  colorHigh?: string;
  nullColor?: string;
  borderColor?: string;
  borderWidth?: number;
  dataLabels?: boolean;
  /** Tile server URL (default: OSM). Use {z}/{x}/{y} placeholders */
  tileUrl?: string;
  /** Initial center [lon, lat] */
  center?: [number, number];
  /** Initial zoom (0-18, default: 2) */
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

// ── Tile Map State ───────────────────────────────────────────────────────────

interface TileMapState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  center: [number, number];
  zoom: number;
  tileUrl: string;
  minZoom: number;
  maxZoom: number;
  tileCache: Map<string, HTMLImageElement>;
  dragging: boolean;
  dragStart: { x: number; y: number };
  lastCenter: [number, number];
  data: { lon: number; lat: number; value: number; label: string }[];
  colorLow: string;
  colorHigh: string;
  vMin: number;
  vMax: number;
  tooltip: HTMLDivElement | null;
  focusEl: HTMLDivElement | null;
  hoveredLabel: string | null;
  pinnedLabel: string | null;
  didPan: boolean;
  animatingTo: { targetZoom: number; startZoom: number; startTime: number } | null;
  cleanup?: () => void;
}

interface TileMapHit {
  datum: { lon: number; lat: number; value: number; label: string };
  px: number;
  py: number;
  radius: number;
  color: string;
}

const tileMapStates = new WeakMap<HTMLElement, TileMapState>();

// ── Mercator math ────────────────────────────────────────────────────────────

function lonToTileX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}
function latToTileY(lat: number, zoom: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom);
}
function lonLatToPixel(
  lon: number, lat: number, zoom: number,
  cLon: number, cLat: number, w: number, h: number,
): [number, number] {
  const s = Math.pow(2, zoom) * 256;
  const cx = ((cLon + 180) / 360) * s;
  const cy = ((1 - Math.log(Math.tan((cLat * Math.PI) / 180) + 1 / Math.cos((cLat * Math.PI) / 180)) / Math.PI) / 2) * s;
  const px = ((lon + 180) / 360) * s;
  const r = (lat * Math.PI) / 180;
  const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s;
  return [w / 2 + (px - cx), h / 2 + (py - cy)];
}
function pixelToLonLat(
  px: number, py: number, zoom: number,
  cLon: number, cLat: number, w: number, h: number,
): [number, number] {
  const s = Math.pow(2, zoom) * 256;
  const cx = ((cLon + 180) / 360) * s;
  const cy = ((1 - Math.log(Math.tan((cLat * Math.PI) / 180) + 1 / Math.cos((cLat * Math.PI) / 180)) / Math.PI) / 2) * s;
  const wx = cx + (px - w / 2);
  const wy = cy + (py - h / 2);
  const lon = (wx / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * wy) / s;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lon, lat];
}

// ── Color helpers ────────────────────────────────────────────────────────────

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function interpolateColor(low: string, high: string, t: number): string {
  const [r1, g1, b1] = hexToRGB(low);
  const [r2, g2, b2] = hexToRGB(high);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

// ── Country center coordinates ───────────────────────────────────────────────

const CC: Record<string, [number, number]> = {
  'United States':[-98.58,39.83],'US':[-98.58,39.83],'USA':[-98.58,39.83],
  'China':[104.2,35.86],'CN':[104.2,35.86],
  'Japan':[138.25,36.2],'JP':[138.25,36.2],
  'Germany':[10.45,51.17],'DE':[10.45,51.17],
  'United Kingdom':[-3.44,55.38],'GB':[-3.44,55.38],'UK':[-3.44,55.38],
  'France':[2.21,46.23],'FR':[2.21,46.23],
  'India':[78.96,20.59],'IN':[78.96,20.59],
  'Italy':[12.57,41.87],'IT':[12.57,41.87],
  'Brazil':[-51.93,-14.24],'BR':[-51.93,-14.24],
  'Canada':[-106.35,56.13],'CA':[-106.35,56.13],
  'Russia':[105.32,61.52],'RU':[105.32,61.52],
  'South Korea':[127.77,35.91],'KR':[127.77,35.91],
  'Australia':[133.78,-25.27],'AU':[133.78,-25.27],
  'Spain':[-3.75,40.46],'ES':[-3.75,40.46],
  'Mexico':[-102.55,23.63],'MX':[-102.55,23.63],
  'Indonesia':[113.92,-0.79],'ID':[113.92,-0.79],
  'Netherlands':[5.29,52.13],'NL':[5.29,52.13],
  'Saudi Arabia':[45.08,23.89],'SA':[45.08,23.89],
  'Turkey':[35.24,38.96],'TR':[35.24,38.96],
  'Switzerland':[8.23,46.82],'CH':[8.23,46.82],
  'Poland':[19.15,51.92],'PL':[19.15,51.92],
  'Sweden':[18.64,60.13],'SE':[18.64,60.13],
  'Belgium':[4.47,50.5],'BE':[4.47,50.5],
  'Nigeria':[8.08,9.08],'NG':[8.08,9.08],
  'Argentina':[-63.62,-38.42],'AR':[-63.62,-38.42],
  'Norway':[8.47,60.47],'NO':[8.47,60.47],
  'Austria':[14.55,47.52],'AT':[14.55,47.52],
  'South Africa':[22.94,-30.56],'ZA':[22.94,-30.56],
  'Egypt':[30.8,26.82],'EG':[30.8,26.82],
  'Thailand':[100.99,15.87],'TH':[100.99,15.87],
  'Vietnam':[108.28,14.06],'VN':[108.28,14.06],
  'Colombia':[-74.3,4.57],'CO':[-74.3,4.57],
  'Chile':[-71.54,-35.68],'CL':[-71.54,-35.68],
  'Pakistan':[69.35,30.38],'PK':[69.35,30.38],
  'Bangladesh':[90.36,23.68],'BD':[90.36,23.68],
  'Philippines':[121.77,12.88],'PH':[121.77,12.88],
  'Malaysia':[101.98,4.21],'MY':[101.98,4.21],
  'Singapore':[103.82,1.35],'SG':[103.82,1.35],
  'Israel':[34.85,31.05],'IL':[34.85,31.05],
  'Ireland':[-8.24,53.41],'IE':[-8.24,53.41],
  'New Zealand':[174.89,-40.9],'NZ':[174.89,-40.9],
  'Portugal':[-8.22,39.4],'PT':[-8.22,39.4],
  'Greece':[21.82,39.07],'GR':[21.82,39.07],
  'Denmark':[9.5,56.26],'DK':[9.5,56.26],
  'Finland':[25.75,61.92],'FI':[25.75,61.92],
  'Czech Republic':[15.47,49.82],'CZ':[15.47,49.82],
  'Romania':[24.97,45.94],'RO':[24.97,45.94],
  'Peru':[-75.02,-9.19],'PE':[-75.02,-9.19],
  'Ukraine':[31.17,48.38],'UA':[31.17,48.38],
  'Morocco':[-7.09,31.79],'MA':[-7.09,31.79],
  'Ethiopia':[40.49,9.15],'ET':[40.49,9.15],
  'Kenya':[37.91,-0.02],'KE':[37.91,-0.02],
  'Ghana':[-1.02,7.95],'GH':[-1.02,7.95],
  'World':[0,20],
};

// ── Tile loading & drawing ───────────────────────────────────────────────────

function loadTile(url: string, cache: Map<string, HTMLImageElement>): HTMLImageElement | null {
  const cached = cache.get(url);
  if (cached) return cached.complete ? cached : null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  cache.set(url, img);
  return null;
}

function drawTiles(ms: TileMapState): void {
  const { canvas, ctx, center, zoom, tileUrl, tileCache } = ms;
  const w = canvas.width;
  const h = canvas.height;
  const z = Math.floor(zoom);
  const tileSize = 256;
  const numTiles = Math.pow(2, z);
  const subScale = Math.pow(2, zoom - z);
  const eTileSize = tileSize * subScale;
  const cTX = lonToTileX(center[0], z);
  const cTY = latToTileY(center[1], z);
  const cPxX = cTX * eTileSize;
  const cPxY = cTY * eTileSize;
  const vpLeft = cPxX - w / 2;
  const vpTop = cPxY - h / 2;
  const txMin = Math.floor(vpLeft / eTileSize);
  const tyMin = Math.floor(vpTop / eTileSize);
  const txMax = Math.ceil((vpLeft + w) / eTileSize);
  const tyMax = Math.ceil((vpTop + h) / eTileSize);
  let pending = false;

  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      const wtx = ((tx % numTiles) + numTiles) % numTiles;
      if (ty < 0 || ty >= numTiles) continue;
      const url = tileUrl.replace('{z}', String(z)).replace('{x}', String(wtx)).replace('{y}', String(ty));
      const img = loadTile(url, tileCache);
      const sx = tx * eTileSize - vpLeft;
      const sy = ty * eTileSize - vpTop;
      if (img) {
        ctx.drawImage(img, sx, sy, eTileSize, eTileSize);
      } else {
        ctx.fillStyle = '#1a2333';
        ctx.fillRect(sx, sy, eTileSize, eTileSize);
        pending = true;
        const c = tileCache.get(url);
        if (c && !c.complete) {
          c.onload = () => renderTileMap(ms);
          c.onerror = () => { tileCache.delete(url); };
        }
      }
    }
  }
  if (pending) setTimeout(() => renderTileMap(ms), 300);
}

// ── Data overlay ─────────────────────────────────────────────────────────────

function drawDataOverlay(ms: TileMapState): void {
  const { ctx, canvas, center, zoom, data, colorLow, colorHigh, vMin, vMax } = ms;
  const w = canvas.width;
  const h = canvas.height;
  const vSpan = vMax - vMin || 1;
  const baseR = Math.max(5, Math.min(16, 3 + zoom * 1.5));

  for (const d of data) {
    const [px, py] = lonLatToPixel(d.lon, d.lat, zoom, center[0], center[1], w, h);
    if (px < -30 || px > w + 30 || py < -30 || py > h + 30) continue;
    const t = Math.max(0, Math.min(1, (d.value - vMin) / vSpan));
    const col = interpolateColor(colorLow, colorHigh, t);
    const emphasized = d.label === ms.hoveredLabel || d.label === ms.pinnedLabel;
    const ringRadius = emphasized ? baseR + 8 : baseR + 4;
    const pointRadius = emphasized ? baseR + 2 : baseR;

    // Glow
    ctx.beginPath();
    ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
    ctx.fillStyle = col.replace('rgb', 'rgba').replace(')', emphasized ? ',0.32)' : ',0.2)');
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(px, py, pointRadius, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = emphasized ? 2.4 : 1.5;
    ctx.stroke();

    // Label at higher zoom
    if (zoom >= 3) {
      const fmt = d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : String(Math.round(d.value));
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(fmt, px, py - baseR - 5);
      ctx.fillText(fmt, px, py - baseR - 5);
    }
  }
}

function findNearestDatum(ms: TileMapState, mx: number, my: number, threshold = 60): TileMapHit | null {
  const { canvas, center, zoom, data, colorLow, colorHigh, vMin, vMax } = ms;
  const vSpan = vMax - vMin || 1;
  const baseR = Math.max(5, Math.min(16, 3 + zoom * 1.5));
  let best: TileMapHit | null = null;
  let bestDist = threshold;

  for (const datum of data) {
    const [px, py] = lonLatToPixel(datum.lon, datum.lat, zoom, center[0], center[1], canvas.width, canvas.height);
    const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
    if (dist <= bestDist) {
      const t = Math.max(0, Math.min(1, (datum.value - vMin) / vSpan));
      bestDist = dist;
      best = {
        datum,
        px,
        py,
        radius: baseR,
        color: interpolateColor(colorLow, colorHigh, t),
      };
    }
  }

  return best;
}

function buildMapTooltipHTML(hit: TileMapHit, pinned: boolean): string {
  const fmt = hit.datum.value >= 1000 ? `$${(hit.datum.value / 1000).toFixed(1)}k` : String(Math.round(hit.datum.value));
  return `<strong>${escapeHtml(String(hit.datum.label))}</strong><br/>${fmt}${pinned ? '<br/><span style="opacity:0.7;font-size:10px">Click again to release</span>' : ''}`;
}

function showMapTooltip(ms: TileMapState, hit: TileMapHit, pinned: boolean): void {
  const tip = ms.tooltip;
  if (!tip) return;
  tip.innerHTML = buildMapTooltipHTML(hit, pinned);
  tip.style.display = 'block';
  tip.style.left = `${Math.min(hit.px + 12, ms.canvas.width - 140)}px`;
  tip.style.top = `${Math.max(10, hit.py - 44)}px`;
  tip.style.pointerEvents = 'none';

  if (ms.focusEl) {
    ms.focusEl.style.display = 'block';
    ms.focusEl.style.left = `${hit.px}px`;
    ms.focusEl.style.top = `${hit.py}px`;
    ms.focusEl.style.opacity = pinned ? '1' : '0.88';
  }
}

function refreshPinnedTooltip(ms: TileMapState): void {
  if (!ms.pinnedLabel) return;
  const match = findNearestDatum(ms, ms.canvas.width / 2, ms.canvas.height / 2, Number.POSITIVE_INFINITY);
  const pinned = ms.data.find((datum) => datum.label === ms.pinnedLabel);
  if (!pinned || !ms.tooltip) return;

  const [px, py] = lonLatToPixel(pinned.lon, pinned.lat, ms.zoom, ms.center[0], ms.center[1], ms.canvas.width, ms.canvas.height);
  const vSpan = ms.vMax - ms.vMin || 1;
  const t = Math.max(0, Math.min(1, (pinned.value - ms.vMin) / vSpan));
  showMapTooltip(ms, {
    datum: pinned,
    px,
    py,
    radius: match?.radius ?? Math.max(5, Math.min(16, 3 + ms.zoom * 1.5)),
    color: interpolateColor(ms.colorLow, ms.colorHigh, t),
  }, true);
}

function hideMapTooltip(ms: TileMapState): void {
  if (ms.tooltip) {
    ms.tooltip.style.display = 'none';
  }
  if (ms.focusEl) {
    ms.focusEl.style.display = 'none';
  }
}

// ── Zoom animation ───────────────────────────────────────────────────────────

function animateZoom(ms: TileMapState, target: number): void {
  ms.animatingTo = { targetZoom: target, startZoom: ms.zoom, startTime: performance.now() };
  requestAnimationFrame(() => tickZoom(ms));
}
function tickZoom(ms: TileMapState): void {
  if (!ms.animatingTo) return;
  const { targetZoom, startZoom, startTime } = ms.animatingTo;
  const t = Math.min(1, (performance.now() - startTime) / 250);
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  ms.zoom = startZoom + (targetZoom - startZoom) * ease;
  renderTileMap(ms);
  if (t < 1) requestAnimationFrame(() => tickZoom(ms));
  else { ms.zoom = targetZoom; ms.animatingTo = null; renderTileMap(ms); }
}

// ── Composite render ─────────────────────────────────────────────────────────

function renderTileMap(ms: TileMapState): void {
  const { ctx, canvas } = ms;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTiles(ms);
  drawDataOverlay(ms);
  refreshPinnedTooltip(ms);
}

// ── Setup interactive tile map ───────────────────────────────────────────────

function setupTileMap(
  container: HTMLElement,
  series: ProcessedSeries[],
  config: ChartConfig,
  _theme: ThemeConfig,
): void {
  const mapCfg = config.map ?? {};
  const colorLow = mapCfg.colorLow ?? '#bfdbfe';
  const colorHigh = mapCfg.colorHigh ?? '#1d4ed8';

  // Parse data
  const dataPoints: TileMapState['data'] = [];
  for (const s of series) {
    for (const d of (s.processedData ?? s.data) as ProcessedDataPoint[]) {
      const label = String(d.x ?? d.label ?? '');
      const value = Number(d.y ?? 0);
      let lon = Number(d.meta?.lon ?? d.meta?.longitude ?? NaN);
      let lat = Number(d.meta?.lat ?? d.meta?.latitude ?? NaN);
      if (isNaN(lon) || isNaN(lat)) {
        const coords = CC[label] ?? CC[String(d.meta?.code ?? '')];
        if (coords) { lon = coords[0]; lat = coords[1]; }
      }
      if (!isNaN(lon) && !isNaN(lat)) dataPoints.push({ lon, lat, value, label });
    }
  }

  const vals = dataPoints.map(d => d.value);
  const vMin = vals.length ? Math.min(...vals) : 0;
  const vMax = vals.length ? Math.max(...vals) : 1;

  // Reuse existing tile map state if canvas is still alive & dimensions match
  const old = tileMapStates.get(container);
  const rect = container.getBoundingClientRect();
  const desiredW = rect.width || 520;
  const desiredH = rect.height || 350;
  if (old && old.canvas.parentElement === container &&
      old.canvas.width === desiredW && old.canvas.height === desiredH) {
    // Just update data overlay and re-render — keep existing canvas & listeners
    old.data = dataPoints;
    old.colorLow = colorLow;
    old.colorHigh = colorHigh;
    old.vMin = vals.length ? Math.min(...vals) : 0;
    old.vMax = vals.length ? Math.max(...vals) : 1;
    renderTileMap(old);
    tileMapStates.set(container, old);
    return;
  }

  // Cleanup previous
  if (old?.cleanup) old.cleanup();

  const pos = getComputedStyle(container).position;
  if (pos === 'static') container.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.width = desiredW;
  canvas.height = desiredH;
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;cursor:grab;z-index:5;border-radius:inherit;';
  canvas.setAttribute('data-uc-tilemap', 'true');
  container.querySelectorAll('[data-uc-tilemap]').forEach(el => el.remove());
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const ms: TileMapState = {
    canvas, ctx,
    center: mapCfg.center ?? [10, 25],
    zoom: mapCfg.zoom ?? 2,
    tileUrl: mapCfg.tileUrl ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: mapCfg.minZoom ?? 1,
    maxZoom: mapCfg.maxZoom ?? 12,
    tileCache: old?.tileCache ?? new Map(),
    dragging: false, dragStart: { x: 0, y: 0 }, lastCenter: mapCfg.center ?? [10, 25],
    data: dataPoints, colorLow, colorHigh, vMin, vMax,
    tooltip: null, focusEl: null, hoveredLabel: null, pinnedLabel: null, didPan: false, animatingTo: null,
  };

  // Tooltip
  const tip = document.createElement('div');
  tip.setAttribute('data-uc-tilemap', 'true');
  tip.style.cssText = 'position:absolute;display:none;padding:6px 10px;background:rgba(15,23,42,0.92);color:#f1f5f9;font-size:11px;border-radius:6px;pointer-events:none;z-index:20;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);backdrop-filter:blur(4px);';
  container.appendChild(tip);
  ms.tooltip = tip;

  if (!document.getElementById('uc-map-hover-style')) {
    const style = document.createElement('style');
    style.id = 'uc-map-hover-style';
    style.textContent = `
      @keyframes uc-map-hover-pulse {
        0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.34); transform: translate(-50%, -50%) scale(0.9); }
        70% { box-shadow: 0 0 0 18px rgba(59,130,246,0); transform: translate(-50%, -50%) scale(1.08); }
        100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); transform: translate(-50%, -50%) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }

  const focusEl = document.createElement('div');
  focusEl.setAttribute('data-uc-tilemap', 'true');
  focusEl.setAttribute('aria-hidden', 'true');
  focusEl.style.cssText = 'position:absolute;display:none;width:18px;height:18px;border-radius:999px;border:2px solid rgba(255,255,255,0.92);background:radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(59,130,246,0.78) 48%, rgba(59,130,246,0.08) 100%);pointer-events:none;z-index:18;transform:translate(-50%,-50%);animation:uc-map-hover-pulse 1.15s ease-out infinite;';
  container.appendChild(focusEl);
  ms.focusEl = focusEl;

  // Attribution
  const attr = document.createElement('div');
  attr.setAttribute('data-uc-tilemap', 'true');
  attr.innerHTML = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">OpenStreetMap</a>';
  attr.style.cssText = 'position:absolute;bottom:2px;right:4px;font-size:9px;color:rgba(255,255,255,0.6);z-index:10;pointer-events:auto;';
  container.appendChild(attr);

  // Zoom controls
  const ctrl = document.createElement('div');
  ctrl.setAttribute('data-uc-tilemap', 'true');
  ctrl.style.cssText = 'position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:2px;z-index:10;';
  const bs = 'width:30px;height:30px;border:none;background:rgba(255,255,255,0.9);color:#333;font-size:16px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;';
  const zi = document.createElement('button');
  zi.textContent = '+';
  zi.title = 'Zoom in';
  zi.style.cssText = bs + 'border-radius:4px 4px 0 0;';
  zi.onclick = (e) => { e.stopPropagation(); animateZoom(ms, Math.min(ms.maxZoom, Math.round(ms.zoom) + 1)); };
  const zo = document.createElement('button');
  zo.textContent = '−';
  zo.title = 'Zoom out';
  zo.style.cssText = bs + 'border-radius:0 0 4px 4px;border-top:1px solid #ddd;';
  zo.onclick = (e) => { e.stopPropagation(); animateZoom(ms, Math.max(ms.minZoom, Math.round(ms.zoom) - 1)); };
  ctrl.appendChild(zi);
  ctrl.appendChild(zo);
  container.appendChild(ctrl);

  // ── Mouse ─────────────────────────────────────────────────────────────
  const onDown = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    ms.dragging = true;
    ms.didPan = false;
    ms.dragStart = { x: e.clientX, y: e.clientY };
    ms.lastCenter = [...ms.center];
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (e: MouseEvent) => {
    if (ms.dragging) {
      e.preventDefault(); e.stopPropagation();
      const dx = e.clientX - ms.dragStart.x;
      const dy = e.clientY - ms.dragStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) ms.didPan = true;
      const scale = Math.pow(2, ms.zoom) * 256;
      const lpp = 360 / scale;
      const ls = Math.cos((ms.lastCenter[1] * Math.PI) / 180);
      ms.center = [ms.lastCenter[0] - dx * lpp, Math.max(-85, Math.min(85, ms.lastCenter[1] + dy * lpp * ls))];
      renderTileMap(ms);
    } else {
      e.stopPropagation();  // prevent Engine-level hover interference
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (ms.pinnedLabel) {
        canvas.style.cursor = findNearestDatum(ms, mx, my) ? 'pointer' : 'grab';
        return;
      }

      const hit = findNearestDatum(ms, mx, my);
      const nextHovered = hit?.datum.label ?? null;
      if (ms.hoveredLabel !== nextHovered) {
        ms.hoveredLabel = nextHovered;
        renderTileMap(ms);
      }

      if (hit) {
        showMapTooltip(ms, hit, false);
        canvas.style.cursor = 'pointer';
      } else {
        hideMapTooltip(ms);
        canvas.style.cursor = 'grab';
      }
    }
  };
  const onUp = () => { ms.dragging = false; canvas.style.cursor = ms.pinnedLabel ? 'pointer' : 'grab'; };
  const onLeave = () => {
    ms.dragging = false;
    if (!ms.pinnedLabel) {
      if (ms.hoveredLabel !== null) {
        ms.hoveredLabel = null;
        renderTileMap(ms);
      }
      hideMapTooltip(ms);
    }
    canvas.style.cursor = 'grab';
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (ms.didPan) {
      ms.didPan = false;
      return;
    }
    const r = canvas.getBoundingClientRect();
    const hit = findNearestDatum(ms, e.clientX - r.left, e.clientY - r.top);
    if (!hit) {
      ms.pinnedLabel = null;
      if (ms.hoveredLabel !== null) {
        ms.hoveredLabel = null;
        renderTileMap(ms);
      }
      hideMapTooltip(ms);
      canvas.style.cursor = 'grab';
      return;
    }

    if (ms.pinnedLabel === hit.datum.label) {
      ms.pinnedLabel = null;
      ms.hoveredLabel = hit.datum.label;
      showMapTooltip(ms, hit, false);
      renderTileMap(ms);
      return;
    }

    ms.pinnedLabel = hit.datum.label;
    ms.hoveredLabel = hit.datum.label;
    showMapTooltip(ms, hit, true);
    renderTileMap(ms);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault(); e.stopPropagation();
    // Smoother zoom steps — smaller delta for trackpad, larger for mouse wheel
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    const nz = Math.max(ms.minZoom, Math.min(ms.maxZoom, ms.zoom + delta));
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const [lBefore, tBefore] = pixelToLonLat(mx, my, ms.zoom, ms.center[0], ms.center[1], canvas.width, canvas.height);
    ms.zoom = nz;
    const [lAfter, tAfter] = pixelToLonLat(mx, my, ms.zoom, ms.center[0], ms.center[1], canvas.width, canvas.height);
    ms.center = [ms.center[0] - (lAfter - lBefore), Math.max(-85, Math.min(85, ms.center[1] - (tAfter - tBefore)))];
    renderTileMap(ms);
  };
  const onDbl = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const r = canvas.getBoundingClientRect();
    const [lon, lat] = pixelToLonLat(e.clientX - r.left, e.clientY - r.top, ms.zoom, ms.center[0], ms.center[1], canvas.width, canvas.height);
    ms.center = [lon, lat];
    animateZoom(ms, Math.min(ms.maxZoom, Math.round(ms.zoom) + 1));
  };

  // ── Touch ─────────────────────────────────────────────────────────────
  let tDist = 0, tZoom = ms.zoom;
  const onTS = (e: TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length === 1) {
      ms.dragging = true;
      ms.dragStart = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      ms.lastCenter = [...ms.center];
    } else if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      tDist = Math.sqrt(dx * dx + dy * dy);
      tZoom = ms.zoom;
    }
  };
  const onTM = (e: TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length === 1 && ms.dragging) {
      const dx = e.touches[0]!.clientX - ms.dragStart.x;
      const dy = e.touches[0]!.clientY - ms.dragStart.y;
      const scale = Math.pow(2, ms.zoom) * 256;
      const lpp = 360 / scale;
      const ls = Math.cos((ms.lastCenter[1] * Math.PI) / 180);
      ms.center = [ms.lastCenter[0] - dx * lpp, Math.max(-85, Math.min(85, ms.lastCenter[1] + dy * lpp * ls))];
      renderTileMap(ms);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      ms.zoom = Math.max(ms.minZoom, Math.min(ms.maxZoom, tZoom + Math.log2(Math.sqrt(dx * dx + dy * dy) / tDist)));
      renderTileMap(ms);
    }
  };
  const onTE = () => { ms.dragging = false; };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDbl);
  canvas.addEventListener('touchstart', onTS, { passive: false });
  canvas.addEventListener('touchmove', onTM, { passive: false });
  canvas.addEventListener('touchend', onTE);

  ms.cleanup = () => {
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mouseup', onUp);
    canvas.removeEventListener('mouseleave', onLeave);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('dblclick', onDbl);
    canvas.removeEventListener('touchstart', onTS);
    canvas.removeEventListener('touchmove', onTM);
    canvas.removeEventListener('touchend', onTE);
    tip.remove(); focusEl.remove(); attr.remove(); ctrl.remove(); canvas.remove();
  };

  tileMapStates.set(container, ms);
  renderTileMap(ms);
}

// ── SVG Projection (legacy choropleth fallback) ──────────────────────────────

function projectLegacy(
  lon: number, lat: number,
  type: MapChartConfig['projection'] = 'equirectangular',
): [number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  switch (type) {
    case 'mercator': {
      const x = (lon + 180) / 360;
      const sinLat = Math.sin(latRad);
      const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
      return [x, Math.max(0, Math.min(1, y))];
    }
    case 'naturalEarth': {
      const phi = latRad;
      const xNE = lonRad * (0.8707 - 0.131979 * phi * phi - 0.013791 * phi ** 4 + 0.003971 * phi ** 6 - 0.001529 * phi ** 8);
      const yNE = phi * (1.007226 + 0.015085 * phi * phi - 0.044475 * phi ** 6 + 0.028874 * phi ** 8 - 0.005916 * phi ** 10);
      return [(xNE / Math.PI + 1) / 2, (yNE / (Math.PI * 0.505) + 1) / 2];
    }
    default:
      return [(lon + 180) / 360, (90 - lat) / 180];
  }
}

function ringToPath(ring: [number, number][], ox: number, oy: number, sX: number, sY: number, proj: MapChartConfig['projection'], _first: boolean): string {
  if (!ring.length) return '';
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i]!;
    const [nx, ny] = projectLegacy(c[0], c[1], proj);
    d += (i === 0 ? 'M' : 'L') + `${(ox + nx * sX).toFixed(2)},${(oy + ny * sY).toFixed(2)}`;
  }
  return d + 'Z';
}

function geometryToPath(geom: GeoGeometry, ox: number, oy: number, sX: number, sY: number, proj: MapChartConfig['projection']): string {
  switch (geom.type) {
    case 'Polygon': return geom.coordinates.map((r, i) => ringToPath(r, ox, oy, sX, sY, proj, i === 0)).join('');
    case 'MultiPolygon': return geom.coordinates.flatMap(p => p.map((r, i) => ringToPath(r, ox, oy, sX, sY, proj, i === 0))).join('');
    case 'LineString': return ringToPath(geom.coordinates, ox, oy, sX, sY, proj, true).replace('Z', '');
    default: return '';
  }
}

function forEachCoord(geom: GeoGeometry, cb: (c: [number, number]) => void): void {
  switch (geom.type) {
    case 'Point': cb(geom.coordinates); break;
    case 'MultiPoint': geom.coordinates.forEach(cb); break;
    case 'LineString': geom.coordinates.forEach(cb); break;
    case 'MultiLineString': geom.coordinates.forEach(r => r.forEach(cb)); break;
    case 'Polygon': geom.coordinates.forEach(r => r.forEach(cb)); break;
    case 'MultiPolygon': geom.coordinates.forEach(p => p.forEach(r => r.forEach(cb))); break;
  }
}

function getGeometryCentroid(geom: GeoGeometry, ox: number, oy: number, sX: number, sY: number, proj: MapChartConfig['projection']): [number, number] | null {
  const coords: [number, number][] = [];
  forEachCoord(geom, c => coords.push(c));
  if (!coords.length) return null;
  let sx = 0, sy = 0;
  for (const [lon, lat] of coords) {
    const [nx, ny] = projectLegacy(lon, lat, proj);
    sx += ox + nx * sX; sy += oy + ny * sY;
  }
  return [sx / coords.length, sy / coords.length];
}

function renderColorScaleLegend(renderer: BaseRenderer, ca: { x: number; y: number; width: number; height: number }, cLow: string, cHigh: string, vMin: number, vMax: number, theme: ThemeConfig): void {
  const LW = 120, LH = 10, lx = ca.x + ca.width - LW - 10;
  // Keep legend inside chart area bottom — place it 20px from bottom edge
  const ly = ca.y + ca.height - LH - 18;
  const steps = 20, sw = LW / steps;
  for (let i = 0; i < steps; i++) { renderer.drawRect(lx + i * sw, ly, sw + 0.5, LH, { fill: interpolateColor(cLow, cHigh, i / (steps - 1)), stroke: 'none' }); }
  renderer.drawRect(lx, ly, LW, LH, { fill: 'none', stroke: (theme.axis.gridColor as string) ?? '#e5e7eb', strokeWidth: 0.5 });
  const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
  renderer.drawText(lx, ly + LH + 11, fmt(vMin), { fill: theme.textColor as string, fontSize: 9, fontFamily: theme.fontFamily });
  renderer.drawText(lx + LW, ly + LH + 11, fmt(vMax), { fill: theme.textColor as string, fontSize: 9, fontFamily: theme.fontFamily, textAnchor: 'end' });
}

// ── Main render — dispatches to tile or legacy ───────────────────────────────

export function renderMapChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config: ChartConfig,
): void {
  // Try to find the parent container for tile map
  const svgEl = (renderer as unknown as { svg?: SVGSVGElement }).svg ?? (renderer as unknown as { el?: SVGSVGElement }).el;
  const parentContainer = svgEl?.parentElement;

  if (parentContainer) {
    setupTileMap(parentContainer, series, config, theme);
    return;
  }

  // Fallback: SVG choropleth
  const mapCfg = config.map ?? {};
  const geoJSON = (mapCfg.geoJSON ?? (series[0]?.data[0]?.meta?.['geoJSON']) ?? getBuiltinWorldGeoJSON()) as GeoFeatureCollection | undefined;
  if (!geoJSON?.features?.length) {
    renderer.drawText(state.chartArea.x + state.chartArea.width / 2, state.chartArea.y + state.chartArea.height / 2,
      'No GeoJSON provided', { fill: theme.textColor as string, textAnchor: 'middle', fontSize: 14 });
    return;
  }

  const { chartArea: ca } = state;
  const proj = mapCfg.projection ?? 'equirectangular';
  const colorLow = mapCfg.colorLow ?? '#bfdbfe';
  const colorHigh = mapCfg.colorHigh ?? '#1d4ed8';
  const nullColor = mapCfg.nullColor ?? ((theme.axis.gridColor as string) ?? '#e5e7eb');
  const borderColor = mapCfg.borderColor ?? '#fff';
  const borderWidth = mapCfg.borderWidth ?? 0.5;
  const joinBy = mapCfg.joinBy ?? 'name';

  const dataMap = new Map<string, number>();
  for (const s of series) {
    for (const d of (s.processedData ?? s.data) as ProcessedDataPoint[]) {
      const key = String(d.x ?? d.id ?? d.label ?? '');
      const val = Number(d.y ?? 0);
      if (key) dataMap.set(key, val);
      const code = d.meta?.code as string | undefined;
      if (code) dataMap.set(code, val);
      const label = d.label as string | undefined;
      if (label && label !== key) dataMap.set(label, val);
    }
  }

  const vals = [...dataMap.values()];
  const vMin = vals.length ? Math.min(...vals) : 0;
  const vMax = vals.length ? Math.max(...vals) : 1;
  const vSpan = vMax - vMin || 1;

  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  for (const f of geoJSON.features) {
    forEachCoord(f.geometry, ([lon, lat]) => {
      if (lon < lonMin) lonMin = lon; if (lon > lonMax) lonMax = lon;
      if (lat < latMin) latMin = lat; if (lat > latMax) latMax = lat;
    });
  }

  const [pxMin, pyMin] = projectLegacy(lonMin, latMax, proj);
  const [pxMax, pyMax] = projectLegacy(lonMax, latMin, proj);
  const projW = pxMax - pxMin || 1, projH = pyMax - pyMin || 1;
  const aspect = projW / projH;
  let mapW = ca.width, mapH = ca.height;
  if (ca.width / ca.height > aspect) mapW = ca.height * aspect;
  else mapH = ca.width / aspect;
  const ox = ca.x + (ca.width - mapW) / 2 - pxMin * (mapW / projW);
  const oy = ca.y + (ca.height - mapH) / 2 - pyMin * (mapH / projH);
  const sX = mapW / projW, sY = mapH / projH;

  renderer.beginGroup('map-series', 'uc-map');
  for (let _fIdx = 0; _fIdx < geoJSON.features.length; _fIdx++) {
    const feature = geoJSON.features[_fIdx]!;
    const fKey = String(feature.properties?.[joinBy] ?? feature.id ?? '');
    const fCode = String(feature.properties?.['code'] ?? feature.id ?? '');
    const fId = String(feature.id ?? feature.properties?.['id'] ?? `__feat_${_fIdx}`);
    const value = dataMap.get(fKey) ?? dataMap.get(fCode) ?? dataMap.get(fId);
    const hasData = value !== undefined;
    const t = hasData ? (value - vMin) / vSpan : 0;
    const fillColor = hasData ? interpolateColor(colorLow, colorHigh, t) : nullColor;
    const pathD = geometryToPath(feature.geometry, ox, oy, sX, sY, proj);
    if (!pathD) continue;
    renderer.drawPath(pathD, { fill: fillColor, stroke: borderColor, strokeWidth: borderWidth, opacity: 1, id: `map-feat-${fId}`, cursor: 'pointer' });
    if (mapCfg.dataLabels && hasData) {
      const cx = getGeometryCentroid(feature.geometry, ox, oy, sX, sY, proj);
      if (cx) renderer.drawText(cx[0], cx[1], String(Math.round(value!)), { fill: '#fff', fontSize: 9, textAnchor: 'middle', dominantBaseline: 'middle', pointerEvents: 'none' });
    }
  }
  renderer.endGroup();
  renderColorScaleLegend(renderer, ca, colorLow, colorHigh, vMin, vMax, theme);
}
