// ============================================================================
// RiskLab Charts — Terrain3DScene
// WebGL 3D terrain renderer for LiDAR / heightmap data.
//
// Data model:
//   series.data[i] = { x: lon/easting, y: lat/northing, z: elevation }
//   For structured grids supply terrain3d.gridWidth in ChartConfig.
//   For unordered LiDAR point clouds the scene builds a uniform grid
//   via nearest-neighbour assignment.
//
// Efficiency:
//   The terrain is chopped into TILE_VERTS×TILE_VERTS vertex tiles
//   automatically.  Each tile has its own VBO pair.  Only tiles that are
//   not trivially out of view are submitted to the GPU.
//   For streaming tile pyramids supply terrain3d.tileUrl — the API for
//   that loader is reserved but not yet implemented in v1.
// ============================================================================

import type { EventBus } from '../core/EventBus';
import type { ChartConfig, ChartState, Rect, Terrain3DConfig, ThemeConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { fetchOpenTopoPoints } from './openTopo';

// ── Constants ────────────────────────────────────────────────────────────────

export const TERRAIN_3D_CHART_TYPES = [
  'terrain3d',
  'spectralSurface3d',
  'threatSurface3d',
  'marketRegimeSurface3d',
  'adaptiveResourceUse3d',
  'signalConsolidation3d',
] as const;
export type Terrain3DChartType = typeof TERRAIN_3D_CHART_TYPES[number];
const TERRAIN_3D_CHART_TYPE_SET = new Set<string>(TERRAIN_3D_CHART_TYPES);

/** Vertex count per tile edge (covers 63 quads → 126 triangles per row) */
const TILE_VERTS = 65;

// ── Matrix helpers (column-major, WebGL convention) ──────────────────────────

type Vec3 = [number, number, number];
type Mat4 = Float32Array;

function m4id(): Mat4 { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }

function m4persp(fovRad: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovRad / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f;
  m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

function m4ortho(l: number, r: number, b: number, t: number, near: number, far: number): Mat4 {
  const m = new Float32Array(16);
  m[0]  = 2 / (r - l);  m[5]  = 2 / (t - b);  m[10] = -2 / (far - near);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(far + near) / (far - near);
  m[15] = 1;
  return m;
}

function m4lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const fx = center[0] - eye[0], fy = center[1] - eye[1], fz = center[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  const FX = fx / fl, FY = fy / fl, FZ = fz / fl;
  const ux = up[0], uy = up[1], uz = up[2];
  let sx = uy * FZ - uz * FY, sy = uz * FX - ux * FZ, sz = ux * FY - uy * FX;
  const sl = Math.hypot(sx, sy, sz) || 1;
  sx /= sl; sy /= sl; sz /= sl;
  const rx = sy * FZ - sz * FY, ry = sz * FX - sx * FZ, rz = sx * FY - sy * FX;
  const m = new Float32Array(16);
  m[0] = sx; m[4] = sy; m[8] = sz;    m[12] = -(sx * eye[0] + sy * eye[1] + sz * eye[2]);
  m[1] = -rx; m[5] = -ry; m[9] = -rz; m[13] =  (rx * eye[0] + ry * eye[1] + rz * eye[2]);
  m[2] = -FX; m[6] = -FY; m[10] = -FZ; m[14] = FX * eye[0] + FY * eye[1] + FZ * eye[2];
  m[15] = 1;
  return m;
}

function m4mul(a: Mat4, b: Mat4): Mat4 {
  const m = new Float32Array(16);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + i] * b[j * 4 + k];
    m[j * 4 + i] = s;
  }
  return m;
}

// ── Color utilities ───────────────────────────────────────────────────────────

function elevRGB(t: number, cmap: string): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  if (cmap === 'gray') return [c, c, c];
  if (cmap === 'thermal') {
    if (c < 0.33) { const s = c * 3; return [s * 0.5, 0, 0.5 + s * 0.5]; }
    if (c < 0.66) { const s = (c - 0.33) * 3; return [0.5 + s * 0.5, s * 0.3, 1 - s]; }
    const s = (c - 0.66) * 3; return [1, 0.3 + s * 0.7, s * 0.2];
  }
  if (cmap === 'viridis') {
    if (c < 0.25) { const s = c * 4; return [0.27, s * 0.3, 0.37 + s * 0.2]; }
    if (c < 0.5)  { const s = (c - 0.25) * 4; return [0.13 - s * 0.08, 0.3 + s * 0.2, 0.38 + s * 0.1]; }
    if (c < 0.75) { const s = (c - 0.5) * 4; return [0.13 + s * 0.5, 0.55 + s * 0.2, 0.24 - s * 0.1]; }
    const s = (c - 0.75) * 4; return [0.76 + s * 0.22, 0.88 + s * 0.1, 0.15 - s * 0.1];
  }
  // Default: hypsometric tinting (deep → sea → lowland → highland → mountain → snow)
  if (c < 0.05) return [0.05 + c * 2, 0.1 + c * 3, 0.4 + c * 2];
  if (c < 0.20) { const s = (c - 0.05) / 0.15; return [0.15 + s * 0.22, 0.25 + s * 0.45, 0.5 - s * 0.1]; }
  if (c < 0.45) { const s = (c - 0.20) / 0.25; return [0.22 + s * 0.38, 0.57, 0.25 - s * 0.1]; }
  if (c < 0.70) { const s = (c - 0.45) / 0.25; return [0.56 + s * 0.2, 0.47 + s * 0.05, 0.15 + s * 0.15]; }
  if (c < 0.88) { const s = (c - 0.70) / 0.18; return [0.70 + s * 0.22, 0.60 + s * 0.25, 0.35 + s * 0.40]; }
  const s = (c - 0.88) / 0.12; return [0.92 + s * 0.08, 0.86 + s * 0.14, 0.75 + s * 0.25];
}

function parseHexRGB(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255];
}

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = `
  precision mediump float;
  attribute vec3 a_pos;
  attribute vec3 a_normal;
  attribute vec3 a_color;
  attribute float a_elev;
  uniform mat4 u_mvp;
  uniform mat3 u_nmat;
  varying vec3 v_color;
  varying vec3 v_normal;
  varying float v_elev;
  void main() {
    v_color   = a_color;
    v_normal  = normalize(u_nmat * a_normal);
    v_elev    = a_elev;
    gl_Position = u_mvp * vec4(a_pos, 1.0);
  }`;

const FRAG = `
  precision mediump float;
  varying vec3  v_color;
  varying vec3  v_normal;
  varying float v_elev;
  uniform vec3  u_light;
  uniform float u_ambient;
  uniform float u_contourInt;
  uniform vec3  u_contourCol;
  uniform int   u_contours;
  void main() {
    float diff  = max(dot(normalize(v_normal), normalize(u_light)), 0.0);
    float light = u_ambient + (1.0 - u_ambient) * diff;
    vec3 col    = v_color * light;
    if (u_contours == 1) {
      float m = mod(v_elev, u_contourInt) / max(u_contourInt, 0.0001);
      float w = 0.008;
      if (m < w || m > (1.0 - w)) col = mix(col, u_contourCol, 0.85);
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

const WIRE_VERT = `
  precision mediump float;
  attribute vec3 a_pos;
  uniform mat4 u_mvp;
  void main() { gl_Position = u_mvp * vec4(a_pos + vec3(0.0, 0.001, 0.0), 1.0); }`;

const WIRE_FRAG = `
  precision mediump float;
  uniform vec4 u_color;
  void main() { gl_FragColor = u_color; }`;

// ── GL helpers ────────────────────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[Terrain3D] Shader error:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh); return null;
  }
  return sh;
}

function linkProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const v = compileShader(gl, gl.VERTEX_SHADER, vs);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('[Terrain3D] Link error:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

// ── Tile data structure ───────────────────────────────────────────────────────

interface TerrainTile {
  posBuffer:   WebGLBuffer;
  normBuffer:  WebGLBuffer;
  colBuffer:   WebGLBuffer;
  elevBuffer:  WebGLBuffer;
  idxBuffer:   WebGLBuffer;
  wIdxBuffer:  WebGLBuffer; // wireframe edge indices
  indexCount:  number;
  wIndexCount: number;
}

interface TerrainPointLike {
  x: number;
  y: number;
  z: number;
  color?: string | [number, number, number];
}

// ── Main scene class ──────────────────────────────────────────────────────────

interface TerrainCamera {
  azimuth:  number; // horizontal orbit angle (rad)
  polar:    number; // angle from top (rad)
  distance: number;
  fov:      number; // vertical field-of-view (rad)
  orthoHX:  number; // orthographic half-extent X (world units)
  orthoHZ:  number; // orthographic half-extent Z (world units)
  cx: number; cy: number; cz: number; // pivot centre
}

interface Terrain3DSceneOptions {
  host: HTMLElement;
  bus:  EventBus;
}

export class Terrain3DScene {
  private readonly host: HTMLElement;
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly infoEl: HTMLDivElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private wireProg: WebGLProgram | null = null;

  private tiles: TerrainTile[] = [];
  private buildingTiles: TerrainTile[] = [];
  private gridW = 0; // total grid width in vertices
  private gridH = 0;
  private minElev = 0;
  private maxElev = 1;
  private buildingCount = 0;
  private terrCfg: Terrain3DConfig = {};

  private cam: TerrainCamera = { azimuth: Math.PI, polar: 0.65, distance: 2.5, fov: 0.85, orthoHX: 1, orthoHZ: 1, cx: 0, cy: 0, cz: 0 };
  private chartArea: Rect = { x: 0, y: 0, width: 400, height: 300 };
  private animFrame = 0;
  private dirty = true;

  // OpenTopo async load state
  private openTopoLoading = false;

  // Interaction state
  private dragMode: 'none' | 'orbit' | 'pan' = 'none';
  private lastPX = 0; private lastPY = 0;

  constructor(opts: Terrain3DSceneOptions) {
    this.host = opts.host;

    this.root = document.createElement('div');
    this.root.setAttribute('data-uc-terrain3d', 'true');
    this.root.style.cssText = [
      'position:absolute', 'overflow:hidden', 'z-index:12',
      'touch-action:none', 'user-select:none', 'border-radius:4px',
    ].join(';');

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-uc-terrain3d', 'true');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;';
    this.root.appendChild(this.canvas);

    this.infoEl = document.createElement('div');
    this.infoEl.style.cssText = [
      'position:absolute', 'bottom:10px', 'right:12px',
      'font:700 0.62rem/1.4 "JetBrains Mono","Cascadia Code","Consolas",monospace',
      'text-transform:uppercase', 'letter-spacing:0.08em',
      'color:rgba(220,235,255,0.55)', 'pointer-events:none',
    ].join(';');
    this.root.appendChild(this.infoEl);

    this.bindEvents();
    this.host.appendChild(this.root);
    this.initGL();
    this.animFrame = requestAnimationFrame(this.frame);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  update(ctx: { series: ProcessedSeries[]; state: ChartState; theme: ThemeConfig; config: ChartConfig }): void {
    this.terrCfg = ctx.config.terrain3d ?? {};
    this.resize(ctx.state.chartArea);

    const series = ctx.series.filter(s => TERRAIN_3D_CHART_TYPE_SET.has(s.type));
    if (!series.length) return;

    const pts = series.flatMap(s => s.data.map(d => ({
      x: Number(d.x ?? 0),
      y: Number(d.y ?? 0),
      z: Number(d.z ?? 0),
    })));

    // Auto-fetch via OpenTopography API when no data + openTopo config present.
    if (pts.length === 0 && this.terrCfg.openTopo) {
      if (!this.openTopoLoading) {
        this.openTopoLoading = true;
        this.infoEl.textContent = 'FETCHING ELEVATION DATA — OPENTOPOGRAPHY.ORG';
        fetchOpenTopoPoints(this.terrCfg.openTopo)
          .then(result => {
            this.openTopoLoading = false;
            this.terrCfg = {
              ...this.terrCfg,
              gridWidth:  result.gridWidth,
              gridHeight: result.gridHeight,
            };
            this.buildTerrain(result.points, this.terrCfg);
            this.dirty = true;
          })
          .catch(err => {
            this.openTopoLoading = false;
            this.infoEl.textContent = `OT API ERROR: ${String(err.message).slice(0, 100)}`;
          });
      }
      return;
    }

    this.buildTerrain(pts, this.terrCfg);
    this.dirty = true;
  }

  resize(chartArea: Rect): void {
    this.chartArea = chartArea;
    this.root.style.left  = `${chartArea.x}px`;
    this.root.style.top   = `${chartArea.y}px`;
    this.root.style.width  = `${chartArea.width}px`;
    this.root.style.height = `${chartArea.height}px`;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const w = Math.max(1, Math.floor(chartArea.width));
    const h = Math.max(1, Math.floor(chartArea.height));
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width  = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width  = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
    this.dirty = true;
  }

  destroy(): void {
    cancelAnimationFrame(this.animFrame);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.disposeTiles();
    this.root.remove();
  }

  async export(format: 'png' | 'svg' | 'jpeg' = 'png'): Promise<Blob | string> {
    this.drawFrame(); // ensure latest frame
    if (format === 'svg') {
      const d = this.canvas.toDataURL('image/png');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}" viewBox="0 0 ${this.canvas.width} ${this.canvas.height}"><image href="${d}" width="${this.canvas.width}" height="${this.canvas.height}"/></svg>`;
    }
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return new Promise<Blob>((res, rej) => {
      this.canvas.toBlob(b => b ? res(b) : rej(new Error('Terrain3D export failed')), mime, format === 'jpeg' ? 0.92 : undefined);
    });
  }

  // ── Terrain build ───────────────────────────────────────────────────────────

  private buildTerrain(pts: TerrainPointLike[], cfg: Terrain3DConfig): void {
    const gl = this.gl;
    if (!gl || !pts.length) return;
    this.disposeTiles();
    this.buildingCount = 0;

    // Determine grid dimensions
    const W = cfg.gridWidth  ?? Math.round(Math.sqrt(pts.length * (4 / 3)));
    const H = cfg.gridHeight ?? Math.round(Math.sqrt(pts.length * (3 / 4)));
    this.gridW = Math.max(2, W);
    this.gridH = Math.max(2, H);

    // Extent
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
    this.minElev = minZ; this.maxElev = maxZ;

    // Build flat elevation grid via nearest-column assignment for unordered point clouds.
    // Structured grids (row-major, gridWidth set) are mapped directly.
    const elevGrid = new Float32Array(this.gridW * this.gridH); // row-major
    const hitCount = new Uint32Array(this.gridW * this.gridH);
    const colorGrid = new Float32Array(this.gridW * this.gridH * 3);
    const colorHits = new Uint32Array(this.gridW * this.gridH);
    let hasPointColors = false;

    for (const p of pts) {
      const col = Math.min(Math.floor(((p.x - minX) / rangeX) * (this.gridW - 1) + 0.5), this.gridW - 1);
      const row = Math.min(Math.floor(((p.y - minY) / rangeY) * (this.gridH - 1) + 0.5), this.gridH - 1);
      const idx = row * this.gridW + col;
      elevGrid[idx] += p.z;
      hitCount[idx] += 1;
      const pointColor = parsePointColor(p.color);
      if (pointColor) {
        colorGrid[idx * 3] += pointColor[0];
        colorGrid[idx * 3 + 1] += pointColor[1];
        colorGrid[idx * 3 + 2] += pointColor[2];
        colorHits[idx] += 1;
        hasPointColors = true;
      }
    }

    // Average multi-hit cells, spread values to empty cells (single flood pass)
    for (let i = 0; i < elevGrid.length; i++) {
      if (hitCount[i] > 0) elevGrid[i] /= hitCount[i];
      if (colorHits[i] > 0) {
        colorGrid[i * 3] /= colorHits[i];
        colorGrid[i * 3 + 1] /= colorHits[i];
        colorGrid[i * 3 + 2] /= colorHits[i];
      }
    }
    this.fillEmpty(elevGrid, hitCount, this.gridW, this.gridH);
    if (hasPointColors) {
      this.fillEmptyColors(colorGrid, colorHits, this.gridW, this.gridH);
    }

    // Build colormap
    const cmap = cfg.colormap ?? 'hypsometric';
    const elevRange = maxZ - minZ || 1;
    const exag = cfg.exaggeration ?? 1;

    // Preserve geographic aspect ratio
    const rangeXY = Math.max(rangeX, rangeY);
    const scaleX = rangeX / rangeXY;
    const scaleZ = rangeY / rangeXY;

    // Compute normals using world-space Y values so slopes are correct for lighting
    // Without this, raw metre elevations ~9000m range produce near-horizontal normals → black terrain
    const worldElev = new Float32Array(elevGrid.length);
    for (let i = 0; i < elevGrid.length; i++) {
      worldElev[i] = ((elevGrid[i] - minZ) / elevRange) * exag;
    }
    const normals = this.computeNormals(worldElev, this.gridW, this.gridH, scaleX, scaleZ);

    // Y positions: full elevation range mapped to [0, exag]
    // Sea level sits at normSeaLevel * exag in world space
    const normSeaLevel = minZ < 0 ? (-minZ) / elevRange : 0;
    const seaY  = normSeaLevel * exag;
    const peakY = exag;  // world-space Y at maxZ

    // Camera auto-fit
    const isOrtho = cfg.projection === 'orthographic';
    const autoPolar = isOrtho ? 0.55 : 1.15; // 66° from zenith = 24° above horizon
    const autoFov   = 0.72;
    const fitExtent = Math.max(scaleX, scaleZ);
    const distFromFov  = fitExtent / Math.tan(autoFov / 2) * 1.5;
    // Camera must clear peak
    const camY = seaY + Math.max(distFromFov, 2.5) * Math.cos(autoPolar);
    const autoDist = camY > peakY * 1.2
      ? Math.max(distFromFov, 2.5)
      : (peakY * 1.4 - seaY) / Math.cos(autoPolar);

    if (isOrtho) {
      this.cam.azimuth  = cfg.initialAzimuth ?? Math.PI;
      this.cam.polar    = cfg.initialPolar ?? autoPolar;
      this.cam.distance = cfg.initialDistance ?? autoDist;
      this.cam.orthoHX  = scaleX * 1.05;
      this.cam.orthoHZ  = scaleZ * 1.05;
    } else {
      this.cam.fov      = autoFov;
      this.cam.azimuth  = cfg.initialAzimuth ?? Math.PI;
      this.cam.polar    = cfg.initialPolar ?? autoPolar;
      this.cam.distance = cfg.initialDistance ?? autoDist;
    }
    this.cam.cx = 0;
    this.cam.cy = seaY;   // pivot at sea level
    this.cam.cz = 0;

    const colors = new Float32Array(this.gridW * this.gridH * 3);
    for (let i = 0; i < this.gridW * this.gridH; i++) {
      if (hasPointColors && colorHits[i] > 0) {
        colors[i * 3] = colorGrid[i * 3];
        colors[i * 3 + 1] = colorGrid[i * 3 + 1];
        colors[i * 3 + 2] = colorGrid[i * 3 + 2];
      } else {
        // Sea-level-aware normalization: ocean blues (t 0→0.35) | land colours (t 0.35→1)
        // This keeps lowland green / highland brown regardless of ocean depth.
        let t: number;
        const e = elevGrid[i];
        if (minZ < 0 && maxZ > 0) {
          t = e < 0
            ? 0.35 * (e - minZ) / (-minZ)
            : 0.35 + 0.65 * (e / maxZ);
        } else {
          t = (e - minZ) / elevRange;
        }
        const [r, g, b] = elevRGB(t, cmap);
        colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
      }
    }

    // Tile the grid
    for (let tr = 0; tr < this.gridH - 1; tr += TILE_VERTS - 1) {
      for (let tc = 0; tc < this.gridW - 1; tc += TILE_VERTS - 1) {
        const tw = Math.min(TILE_VERTS, this.gridW - tc);
        const th = Math.min(TILE_VERTS, this.gridH - tr);
        if (tw < 2 || th < 2) continue;

        const vcount = tw * th;
        const pos   = new Float32Array(vcount * 3);
        const norm  = new Float32Array(vcount * 3);
        const col   = new Float32Array(vcount * 3);
        const elev  = new Float32Array(vcount);

        for (let li = 0; li < th; li++) {
          for (let lj = 0; lj < tw; lj++) {
            const gi = tr + li, gj = tc + lj;
            const v = li * tw + lj;
            const g = gi * this.gridW + gj;
            const e = elevGrid[g];
            pos[v * 3]     = ((gj / (this.gridW - 1)) * 2 - 1) * scaleX;
            pos[v * 3 + 1] = ((e - minZ) / elevRange) * exag;  // Y: full range, no clamping
            pos[v * 3 + 2] = ((gi / (this.gridH - 1)) * 2 - 1) * scaleZ;
            norm[v * 3]     = normals[g * 3];
            norm[v * 3 + 1] = normals[g * 3 + 1];
            norm[v * 3 + 2] = normals[g * 3 + 2];
            col[v * 3]      = colors[g * 3];
            col[v * 3 + 1]  = colors[g * 3 + 1];
            col[v * 3 + 2]  = colors[g * 3 + 2];
            elev[v]         = (e - minZ) / elevRange; // normalized [0,1]
          }
        }

        // Triangle indices (CCW)
        const icount = (tw - 1) * (th - 1) * 6;
        const idx = new Uint32Array(icount);
        let ii = 0;
        for (let li = 0; li < th - 1; li++) {
          for (let lj = 0; lj < tw - 1; lj++) {
            const a = li * tw + lj, b = a + 1, c = (li + 1) * tw + lj, d = c + 1;
            idx[ii++] = a; idx[ii++] = c; idx[ii++] = b;
            idx[ii++] = b; idx[ii++] = c; idx[ii++] = d;
          }
        }

        // Wireframe edge indices (top + left edges per quad, bottom-right at boundary)
        const wcount = (tw - 1) * th * 2 + (th - 1) * tw * 2;
        const widx = new Uint32Array(wcount);
        let wi = 0;
        for (let li = 0; li < th; li++) {
          for (let lj = 0; lj < tw - 1; lj++) {
            widx[wi++] = li * tw + lj; widx[wi++] = li * tw + lj + 1;
          }
        }
        for (let li = 0; li < th - 1; li++) {
          for (let lj = 0; lj < tw; lj++) {
            widx[wi++] = li * tw + lj; widx[wi++] = (li + 1) * tw + lj;
          }
        }

        const tile = this.uploadTile(gl, pos, norm, col, elev, idx, widx);
        if (tile) this.tiles.push(tile);
      }
    }

    if (cfg.buildings && cfg.buildings.length > 0) {
      const buildingTile = this.buildBuildings(gl, cfg.buildings, {
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        elevRange,
        scaleX,
        scaleZ,
        exag,
        elevGrid,
      });
      if (buildingTile) {
        this.buildingTiles.push(buildingTile);
        this.buildingCount = cfg.buildings.length;
      }
    }

    this.updateInfoEl();
  }

  private fillEmpty(grid: Float32Array, hit: Uint32Array, W: number, H: number): void {
    // Simple 'smear' — copy from nearest filled neighbour (up to 3 passes)
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
          const i = r * W + c;
          if (hit[i] > 0) continue;
          const neighbours = [r > 0 ? i - W : -1, r < H - 1 ? i + W : -1, c > 0 ? i - 1 : -1, c < W - 1 ? i + 1 : -1];
          for (const n of neighbours) {
            if (n >= 0 && hit[n] > 0) { grid[i] = grid[n]; hit[i] = hit[n]; break; }
          }
        }
      }
    }
    // Fallback for any remaining empties
    const fallback = grid.reduce((a, v) => a + v, 0) / Math.max(1, grid.filter((_, i) => hit[i] > 0).length);
    for (let i = 0; i < grid.length; i++) { if (!hit[i]) grid[i] = fallback; }
  }

  private fillEmptyColors(grid: Float32Array, hit: Uint32Array, W: number, H: number): void {
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
          const i = r * W + c;
          if (hit[i] > 0) continue;
          const neighbours = [r > 0 ? i - W : -1, r < H - 1 ? i + W : -1, c > 0 ? i - 1 : -1, c < W - 1 ? i + 1 : -1];
          for (const n of neighbours) {
            if (n >= 0 && hit[n] > 0) {
              grid[i * 3] = grid[n * 3];
              grid[i * 3 + 1] = grid[n * 3 + 1];
              grid[i * 3 + 2] = grid[n * 3 + 2];
              hit[i] = hit[n];
              break;
            }
          }
        }
      }
    }
  }

  private buildBuildings(
    gl: WebGLRenderingContext,
    buildings: NonNullable<Terrain3DConfig['buildings']>,
    world: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      minZ: number;
      elevRange: number;
      scaleX: number;
      scaleZ: number;
      exag: number;
      elevGrid: Float32Array;
    },
  ): TerrainTile | null {
    if (buildings.length === 0) return null;

    const rangeX = world.maxX - world.minX || 1;
    const rangeY = world.maxY - world.minY || 1;
    const rangeXY = Math.max(rangeX, rangeY);
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const elevs: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    const addFace = (
      corners: Array<[number, number, number]>,
      normal: [number, number, number],
      color: [number, number, number],
      normalizedElev: number,
    ) => {
      for (const corner of corners) {
        positions.push(corner[0], corner[1], corner[2]);
        normals.push(normal[0], normal[1], normal[2]);
        colors.push(color[0], color[1], color[2]);
        elevs.push(normalizedElev);
      }
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3,
      );
      vertexOffset += 4;
    };

    for (const building of buildings) {
      const x = ((building.x - world.minX) / rangeX) * 2 - 1;
      const z = ((building.y - world.minY) / rangeY) * 2 - 1;
      const worldX = x * world.scaleX;
      const worldZ = z * world.scaleZ;
      const colIndex = clamp(Math.round(((building.x - world.minX) / rangeX) * (this.gridW - 1)), 0, this.gridW - 1);
      const rowIndex = clamp(Math.round(((building.y - world.minY) / rangeY) * (this.gridH - 1)), 0, this.gridH - 1);
      const groundElev = world.elevGrid[rowIndex * this.gridW + colIndex] ?? world.minZ;
      const baseY = ((groundElev - world.minZ) / world.elevRange) * world.exag;
      const topY = baseY + Math.max(0.02, building.height / 1000);
      const halfW = ((building.width ?? 0.00032) / rangeXY);
      const halfD = ((building.depth ?? 0.00032) / rangeXY);
      const color = parseHexRGB(building.color ?? '#bfc6d1');
      const sideColor: [number, number, number] = [color[0] * 0.84, color[1] * 0.84, color[2] * 0.88];
      const capColor: [number, number, number] = [Math.min(1, color[0] * 1.08), Math.min(1, color[1] * 1.08), Math.min(1, color[2] * 1.08)];
      const left = worldX - halfW;
      const right = worldX + halfW;
      const front = worldZ - halfD;
      const back = worldZ + halfD;
      const normElev = clamp((topY - baseY) / Math.max(world.exag, 1e-6), 0, 1);

      addFace([[left, topY, front], [right, topY, front], [right, topY, back], [left, topY, back]], [0, 1, 0], capColor, normElev);
      addFace([[left, baseY, back], [right, baseY, back], [right, topY, back], [left, topY, back]], [0, 0, 1], sideColor, normElev);
      addFace([[right, baseY, front], [left, baseY, front], [left, topY, front], [right, topY, front]], [0, 0, -1], sideColor, normElev);
      addFace([[left, baseY, front], [left, baseY, back], [left, topY, back], [left, topY, front]], [-1, 0, 0], sideColor, normElev);
      addFace([[right, baseY, back], [right, baseY, front], [right, topY, front], [right, topY, back]], [1, 0, 0], sideColor, normElev);
    }

    const wireIndices: number[] = [];
    for (let i = 0; i < vertexOffset; i += 4) {
      wireIndices.push(i, i + 1, i + 1, i + 2, i + 2, i + 3, i + 3, i);
    }

    return this.uploadTile(
      gl,
      new Float32Array(positions),
      new Float32Array(normals),
      new Float32Array(colors),
      new Float32Array(elevs),
      new Uint32Array(indices),
      new Uint32Array(wireIndices),
    );
  }

  private computeNormals(elev: Float32Array, W: number, H: number, scaleX = 1, scaleZ = 1): Float32Array {
    const normals = new Float32Array(W * H * 3);
    const sx = 2 * scaleX / Math.max(W - 1, 1);
    const sz = 2 * scaleZ / Math.max(H - 1, 1);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        const el = (c > 0 ? elev[i - 1] : elev[i]);
        const er = (c < W - 1 ? elev[i + 1] : elev[i]);
        const eu = (r > 0 ? elev[i - W] : elev[i]);
        const ed = (r < H - 1 ? elev[i + W] : elev[i]);
        // dE/dx, dE/dz scaled to normalise
        const nx = -(er - el) / sx;
        const nz = -(ed - eu) / sz;
        const ny = 1.0;
        const len = Math.hypot(nx, ny, nz) || 1;
        normals[i * 3]     = nx / len;
        normals[i * 3 + 1] = ny / len;
        normals[i * 3 + 2] = nz / len;
      }
    }
    return normals;
  }

  private uploadTile(
    gl: WebGLRenderingContext,
    pos: Float32Array, norm: Float32Array, col: Float32Array, elev: Float32Array,
    idx: Uint32Array, widx: Uint32Array,
  ): TerrainTile | null {
    const ext = gl.getExtension('OES_element_index_uint');
    const useUint32 = ext !== null;

    const pb = gl.createBuffer(); if (!pb) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

    const nb = gl.createBuffer(); if (!nb) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, norm, gl.STATIC_DRAW);

    const cb = gl.createBuffer(); if (!cb) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);

    const eb = gl.createBuffer(); if (!eb) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, eb); gl.bufferData(gl.ARRAY_BUFFER, elev, gl.STATIC_DRAW);

    const ib = gl.createBuffer(); if (!ib) return null;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, useUint32 ? idx : new Uint16Array(idx), gl.STATIC_DRAW);

    const wib = gl.createBuffer(); if (!wib) return null;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, useUint32 ? widx : new Uint16Array(widx), gl.STATIC_DRAW);

    return { posBuffer: pb, normBuffer: nb, colBuffer: cb, elevBuffer: eb, idxBuffer: ib, wIdxBuffer: wib, indexCount: idx.length, wIndexCount: widx.length };
  }

  // ── GL init ─────────────────────────────────────────────────────────────────

  private initGL(): void {
    const gl = this.canvas.getContext('webgl', { antialias: true, alpha: false, depth: true }) as WebGLRenderingContext | null;
    if (!gl) { this.infoEl.textContent = 'WebGL not available'; return; }
    this.gl = gl;
    this.prog     = linkProgram(gl, VERT, FRAG);
    this.wireProg = linkProgram(gl, WIRE_VERT, WIRE_FRAG);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CW);
    gl.cullFace(gl.BACK);
  }

  // ── Render loop ─────────────────────────────────────────────────────────────

  private readonly frame = () => {
    this.animFrame = requestAnimationFrame(this.frame);
    if (this.dirty) { this.drawFrame(); this.dirty = false; }
  };

  private drawFrame(): void {
    const gl = this.gl;
    if (!gl || !this.prog || (!this.tiles.length && !this.buildingTiles.length)) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const w = Math.max(1, Math.floor(this.chartArea.width) * dpr);
    const h = Math.max(1, Math.floor(this.chartArea.height) * dpr);
    gl.viewport(0, 0, w, h);

    // Background
    const bg = this.terrCfg.backgroundColor ?? '#040b15';
    const [br, bg2, bb] = parseHexRGB(bg);
    gl.clearColor(br, bg2, bb, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Camera
    const { azimuth, polar, distance, cx, cy, cz } = this.cam;
    const camX = cx + distance * Math.sin(polar) * Math.sin(azimuth);
    const camY = cy + distance * Math.cos(polar);
    const camZ = cz + distance * Math.sin(polar) * Math.cos(azimuth);
    const isOrtho = this.terrCfg.projection === 'orthographic';
    let proj: Mat4;
    if (isOrtho) {
      const aspect = w / h;
      let ox = this.cam.orthoHX;
      let oz = this.cam.orthoHZ;
      // expand whichever axis is too tight for the screen aspect ratio
      if (ox / oz > aspect) { oz = ox / aspect; } else { ox = oz * aspect; }
      proj = m4ortho(-ox, ox, -oz, oz, -5, 5);
    } else {
      proj = m4persp(this.cam.fov, w / h, 0.01, 20);
    }
    const view = m4lookAt([camX, camY, camZ], [cx, cy, cz], [0, 1, 0]);
    const mvp  = m4mul(proj, view);
    // Normal matrix = upper-left 3x3 of view (pure rotation, no non-uniform scale)
    const nmat = new Float32Array([
      view[0], view[1], view[2],
      view[4], view[5], view[6],
      view[8], view[9], view[10],
    ]);

    const cfg = this.terrCfg;
    const lightDir = cfg.lightDirection ?? [0.5, 1.0, 0.8];
    const ambient  = cfg.lighting === false ? 1.0 : 0.28;
    const contours = cfg.contours ? 1 : 0;
    const contourInt = (cfg.contourInterval ?? 0.1) / Math.max(this.maxElev - this.minElev, 1);
    const cColor = parseHexRGB(cfg.contourColor ?? '#ffffff');
    const extUint = gl.getExtension('OES_element_index_uint') != null;
    const idxType = extUint ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

    // Draw filled terrain
    gl.useProgram(this.prog);
    const uMVP    = gl.getUniformLocation(this.prog, 'u_mvp');
    const uNmat   = gl.getUniformLocation(this.prog, 'u_nmat');
    const uLight  = gl.getUniformLocation(this.prog, 'u_light');
    const uAmb    = gl.getUniformLocation(this.prog, 'u_ambient');
    const uConInt = gl.getUniformLocation(this.prog, 'u_contourInt');
    const uConCol = gl.getUniformLocation(this.prog, 'u_contourCol');
    const uCon    = gl.getUniformLocation(this.prog, 'u_contours');
    gl.uniformMatrix4fv(uMVP, false, mvp);
    gl.uniformMatrix3fv(uNmat, false, nmat);
    gl.uniform3fv(uLight, lightDir);
    gl.uniform1f(uAmb, ambient);
    gl.uniform1f(uConInt, contourInt);
    gl.uniform3fv(uConCol, cColor);
    gl.uniform1i(uCon, contours);

    const aPos  = gl.getAttribLocation(this.prog, 'a_pos');
    const aNorm = gl.getAttribLocation(this.prog, 'a_normal');
    const aCol  = gl.getAttribLocation(this.prog, 'a_color');
    const aElev = gl.getAttribLocation(this.prog, 'a_elev');

    for (const tile of this.tiles) {
      gl.bindBuffer(gl.ARRAY_BUFFER, tile.posBuffer);
      gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, tile.normBuffer);
      gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, tile.colBuffer);
      gl.enableVertexAttribArray(aCol);  gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, tile.elevBuffer);
      gl.enableVertexAttribArray(aElev); gl.vertexAttribPointer(aElev, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.idxBuffer);
      gl.drawElements(gl.TRIANGLES, tile.indexCount, idxType, 0);
    }

    if (this.buildingTiles.length > 0) {
      gl.uniform1i(uCon, 0);
      for (const tile of this.buildingTiles) {
        gl.bindBuffer(gl.ARRAY_BUFFER, tile.posBuffer);
        gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, tile.normBuffer);
        gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, tile.colBuffer);
        gl.enableVertexAttribArray(aCol);  gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, tile.elevBuffer);
        gl.enableVertexAttribArray(aElev); gl.vertexAttribPointer(aElev, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.idxBuffer);
        gl.drawElements(gl.TRIANGLES, tile.indexCount, idxType, 0);
      }
      gl.uniform1i(uCon, contours);
    }

    // Optional wireframe overlay
    if (cfg.wireframe && this.wireProg) {
      gl.useProgram(this.wireProg);
      const wMVP = gl.getUniformLocation(this.wireProg, 'u_mvp');
      const wCol = gl.getUniformLocation(this.wireProg, 'u_color');
      gl.uniformMatrix4fv(wMVP, false, mvp);
      const wc = parseHexRGB(cfg.wireframeColor ?? '#ffffff');
      gl.uniform4f(wCol, wc[0], wc[1], wc[2], 0.18);
      const waPos = gl.getAttribLocation(this.wireProg, 'a_pos');
      for (const tile of this.tiles) {
        gl.bindBuffer(gl.ARRAY_BUFFER, tile.posBuffer);
        gl.enableVertexAttribArray(waPos); gl.vertexAttribPointer(waPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.wIdxBuffer);
        gl.drawElements(gl.LINES, tile.wIndexCount, idxType, 0);
      }
    }
  }

  // ── Info overlay ─────────────────────────────────────────────────────────────

  private updateInfoEl(): void {
    const pts = this.gridW * this.gridH;
    const tileCount = this.tiles.length;
    const buildingInfo = this.buildingCount > 0 ? `  //  ${this.buildingCount} bldgs` : '';
    this.infoEl.textContent = `${this.gridW}×${this.gridH}  //  ${tileCount} tile${tileCount !== 1 ? 's' : ''}${buildingInfo}  //  elev ${this.minElev.toFixed(0)}–${this.maxElev.toFixed(0)} m`;
  }

  // ── GL cleanup ───────────────────────────────────────────────────────────────

  private disposeTiles(): void {
    const gl = this.gl;
    if (!gl) { this.tiles = []; return; }
    for (const t of this.tiles) {
      gl.deleteBuffer(t.posBuffer); gl.deleteBuffer(t.normBuffer);
      gl.deleteBuffer(t.colBuffer); gl.deleteBuffer(t.elevBuffer);
      gl.deleteBuffer(t.idxBuffer); gl.deleteBuffer(t.wIdxBuffer);
    }
    this.tiles = [];
    for (const t of this.buildingTiles) {
      gl.deleteBuffer(t.posBuffer); gl.deleteBuffer(t.normBuffer);
      gl.deleteBuffer(t.colBuffer); gl.deleteBuffer(t.elevBuffer);
      gl.deleteBuffer(t.idxBuffer); gl.deleteBuffer(t.wIdxBuffer);
    }
    this.buildingTiles = [];
  }

  // ── Mouse / touch interaction ─────────────────────────────────────────────

  private readonly onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.dragMode = e.shiftKey || e.button === 2 ? 'pan' : 'orbit';
    this.lastPX = e.clientX; this.lastPY = e.clientY;
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly onMove = (e: PointerEvent) => {
    if (this.dragMode === 'none') return;
    const dx = e.clientX - this.lastPX;
    const dy = e.clientY - this.lastPY;
    this.lastPX = e.clientX; this.lastPY = e.clientY;
    const W = this.chartArea.width || 400, H = this.chartArea.height || 300;

    if (this.dragMode === 'orbit') {
      this.cam.azimuth += dx / W * Math.PI * 2;
      this.cam.polar = Math.max(0.06, Math.min(Math.PI - 0.06, this.cam.polar + dy / H * Math.PI));
    } else {
      // Pan: move centre in view-right and view-up directions
      const { azimuth, polar, distance } = this.cam;
      const scale = distance / Math.max(W, H) * 2;
      const rightX = Math.cos(azimuth), rightZ = -Math.sin(azimuth);
      const upX = Math.cos(polar) * Math.sin(azimuth);
      const upY = -Math.sin(polar);
      const upZ = Math.cos(polar) * Math.cos(azimuth);
      this.cam.cx -= (dx * rightX + dy * upX) * scale;
      this.cam.cy -= dy * upY * scale;
      this.cam.cz -= (dx * rightZ + dy * upZ) * scale;
    }
    this.dirty = true;
  };

  private readonly onUp = (e: PointerEvent) => {
    this.dragMode = 'none';
    this.canvas.releasePointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grab';
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.1 : 0.91;
    this.cam.distance = Math.max(0.2, Math.min(10, this.cam.distance * delta));
    this.dirty = true;
  };

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
}

function parsePointColor(input: unknown): [number, number, number] | null {
  if (Array.isArray(input) && input.length >= 3) {
    return [Number(input[0]) || 0, Number(input[1]) || 0, Number(input[2]) || 0];
  }
  if (typeof input === 'string') {
    return parseHexRGB(input);
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
