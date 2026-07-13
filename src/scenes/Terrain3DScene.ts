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

function projectM4(matrix: Mat4, point: Vec3, width: number, height: number): { x: number; y: number; visible: boolean } {
  const [x, y, z] = point;
  const cx = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
  const cy = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
  const cz = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!;
  const cw = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;
  if (!Number.isFinite(cw) || Math.abs(cw) < 1e-6) return { x: 0, y: 0, visible: false };
  const nx = cx / cw;
  const ny = cy / cw;
  const nz = cz / cw;
  return { x: (nx * .5 + .5) * width, y: (1 - (ny * .5 + .5)) * height, visible: nz >= -1.2 && nz <= 1.2 };
}

// ── Color utilities ───────────────────────────────────────────────────────────

function elevRGB(t: number, cmap: string, colorRamp?: string[]): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  if (colorRamp && colorRamp.length > 0) {
    if (colorRamp.length === 1) return parseHexRGB(colorRamp[0]!);
    const scaled = c * (colorRamp.length - 1);
    const index = Math.min(colorRamp.length - 2, Math.floor(scaled));
    const mix = scaled - index;
    const a = parseHexRGB(colorRamp[index]!); const b = parseHexRGB(colorRamp[index + 1]!);
    return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix, a[2] + (b[2] - a[2]) * mix];
  }
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
  uniform float u_time;
  uniform float u_seaLevel;
  uniform float u_waterEnabled;
  varying vec3 v_color;
  varying vec3 v_normal;
  varying float v_elev;
  varying float v_water;
  varying vec3 v_position;
  void main() {
    vec3 position = a_pos;
    v_water = u_waterEnabled > 0.5 && abs(a_elev - u_seaLevel) < 0.0005 ? 1.0 : 0.0;
    if (v_water > 0.5) {
      float wave = sin(a_pos.x * 34.0 + u_time * 0.85) + cos(a_pos.z * 29.0 - u_time * 0.68);
      position.y += wave * 0.0017;
    }
    v_color   = a_color;
    v_normal  = normalize(u_nmat * a_normal);
    v_elev    = a_elev;
    v_position = position;
    gl_Position = u_mvp * vec4(position, 1.0);
  }`;

const FRAG = `
  precision mediump float;
  varying vec3  v_color;
  varying vec3  v_normal;
  varying float v_elev;
  varying float v_water;
  varying vec3  v_position;
  uniform vec3  u_light;
  uniform float u_ambient;
  uniform float u_contourInt;
  uniform vec3  u_contourCol;
  uniform int   u_contours;
  uniform float u_time;
  void main() {
    float diff  = max(dot(normalize(v_normal), normalize(u_light)), 0.0);
    float light = u_ambient + (1.0 - u_ambient) * diff;
    vec3 col    = v_color * light;
    if (v_water > 0.5) {
      float ripple = sin(v_position.x * 72.0 + u_time * 1.25) * cos(v_position.z * 64.0 - u_time * 0.92);
      float glint = pow(max(0.0, 0.5 + ripple * 0.5), 10.0);
      col = v_color * (0.72 + ripple * 0.08) + vec3(0.10, 0.32, 0.46) * glint;
    } else if (u_contours == 1) {
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

type TerrainOverlayNode = NonNullable<NonNullable<Terrain3DConfig['overlays']>['nodes']>[number];
interface OverlayMotionValues { x: number; y: number; z: number; headingDeg: number; speedKts: number; altitudeM: number; linkQualityPct: number; confidencePct: number }
interface OverlayTween { current: OverlayMotionValues; from: OverlayMotionValues; to: OverlayMotionValues; startedAt: number; duration: number }

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
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly infoEl: HTMLDivElement;
  private readonly axesEl: HTMLDivElement;
  private readonly hoverEl: HTMLDivElement;
  private readonly flightHudEl: HTMLDivElement;
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
  private sourcePoints: TerrainPointLike[] = [];
  private terrCfg: Terrain3DConfig = {};
  private analyticalSurface = false;
  private terrainDataSignature = '';
  private overlayHitTargets: Array<{ x: number; y: number; radius: number; node: TerrainOverlayNode }> = [];
  private selectedOverlayId = '';
  private firstPersonOverlayId = '';
  private sensorMode: 'optical' | 'night' | 'thermal' | 'lowLight' = 'optical';
  private desiredFlightCam: TerrainCamera | null = null;
  private readonly overlayDisplayNodes = new Map<string, OverlayTween>();
  private terrainSpace = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, scaleX: 1, scaleZ: 1, exaggeration: 1 };

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

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.setAttribute('data-uc-terrain-overlays', 'true');
    this.overlayCanvas.style.cssText = 'position:absolute;inset:0;z-index:3;width:100%;height:100%;pointer-events:none;';
    this.root.appendChild(this.overlayCanvas);

    this.infoEl = document.createElement('div');
    this.infoEl.style.cssText = [
      'position:absolute', 'bottom:10px', 'right:12px',
      'font:700 0.62rem/1.4 "JetBrains Mono","Cascadia Code","Consolas",monospace',
      'text-transform:uppercase', 'letter-spacing:0.08em',
      'color:rgba(220,235,255,0.55)', 'pointer-events:none',
    ].join(';');
    this.root.appendChild(this.infoEl);

    this.axesEl = document.createElement('div');
    this.axesEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;font:600 10px Inter,"Segoe UI",Arial,sans-serif;letter-spacing:.02em;color:rgba(205,232,250,.82);text-transform:uppercase;';
    this.root.appendChild(this.axesEl);

    this.hoverEl = document.createElement('div');
    this.hoverEl.setAttribute('role', 'tooltip');
    this.hoverEl.style.cssText = 'position:absolute;z-index:8;display:none;min-width:210px;padding:10px 12px;border:1px solid rgba(125,211,252,.46);border-radius:2px;background:rgba(3,12,21,.97);box-shadow:0 8px 20px rgba(0,0,0,.3);color:#dff5ff;font:600 11px/1.55 Inter,"Segoe UI",Arial,sans-serif;pointer-events:none;';
    this.hoverEl.addEventListener('click', this.onTooltipClick);
    this.root.appendChild(this.hoverEl);

    this.flightHudEl = document.createElement('div');
    this.flightHudEl.style.cssText = 'position:absolute;inset:0;z-index:7;display:none;pointer-events:none;color:#dff5ff;font:600 11px Inter,Segoe UI,sans-serif;text-shadow:0 1px 3px #000;';
    this.flightHudEl.addEventListener('pointerdown', this.onFlightHudPointerDown);
    this.root.appendChild(this.flightHudEl);

    this.bindEvents();
    this.host.appendChild(this.root);
    this.initGL();
    this.animFrame = requestAnimationFrame(this.frame);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  update(ctx: { series: ProcessedSeries[]; state: ChartState; theme: ThemeConfig; config: ChartConfig }): void {
    this.terrCfg = { ...(ctx.config.terrain3d ?? {}) };
    const requestedFirstPerson = this.terrCfg.firstPersonNodeId;
    if (requestedFirstPerson && requestedFirstPerson !== this.firstPersonOverlayId) {
      this.selectedOverlayId = '';
      this.firstPersonOverlayId = requestedFirstPerson;
      this.desiredFlightCam = null;
      this.sensorMode = 'optical';
      this.hoverEl.style.display = 'none';
    }
    this.applySensorConfig();
    this.retargetOverlayNodes();
    const themeBackground = ctx.theme.colors?.background ?? (typeof ctx.theme.backgroundColor === 'string' ? ctx.theme.backgroundColor : '#020812');
    const themeText = ctx.theme.colors?.text ?? (typeof ctx.theme.textColor === 'string' ? ctx.theme.textColor : '#dff5ff');
    this.hoverEl.style.background = themeBackground;
    this.hoverEl.style.color = themeText;
    this.hoverEl.style.borderColor = ctx.theme.palette[0] ?? '#7dd3fc';
    this.infoEl.style.color = themeText;
    this.renderAxes();
    this.resize(ctx.state.chartArea);

    const series = ctx.series.filter(s => TERRAIN_3D_CHART_TYPE_SET.has(s.type));
    if (!series.length) return;
    const analyticalSurface = series.some((entry) => (
      entry.type === 'signalConsolidation3d'
      || entry.type === 'marketRegimeSurface3d'
      || entry.type === 'adaptiveResourceUse3d'
    ));
    this.analyticalSurface = analyticalSurface;
    if (analyticalSurface && !this.terrCfg.colorRamp?.length) {
      this.terrCfg.colorRamp = [...ctx.theme.palette];
      this.terrCfg.colormap = 'gray';
    }

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

    const signature = `${pts.length}:${this.terrCfg.gridWidth ?? 0}:${this.terrCfg.gridHeight ?? 0}:${pts[0]?.x ?? 0}:${pts[0]?.y ?? 0}:${pts.at(-1)?.x ?? 0}:${pts.at(-1)?.y ?? 0}`;
    if (this.terrCfg.preserveGeometryOnUpdate && this.terrainDataSignature === signature && this.tiles.length > 0) {
      this.applyFocusCamera();
      this.drawFrame();
      this.dirty = false;
      return;
    }
    this.terrainDataSignature = signature;
    this.buildTerrain(pts, this.terrCfg);
    this.applyFocusCamera();
    this.drawFrame();
    this.dirty = false;
  }

  resize(chartArea: Rect): void {
    this.chartArea = chartArea;
    this.root.style.left  = `${chartArea.x}px`;
    this.root.style.top   = `${chartArea.y}px`;
    this.root.style.width  = `${chartArea.width}px`;
    this.root.style.height = `${chartArea.height}px`;
    const dpr = Math.min(Math.max(window.devicePixelRatio ?? 1, 1), 2);
    const w = Math.max(1, Math.floor(chartArea.width));
    const h = Math.max(1, Math.floor(chartArea.height));
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width  = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width  = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
    if (this.overlayCanvas.width !== Math.floor(w * dpr) || this.overlayCanvas.height !== Math.floor(h * dpr)) {
      this.overlayCanvas.width = Math.floor(w * dpr);
      this.overlayCanvas.height = Math.floor(h * dpr);
      this.overlayCanvas.style.width = `${w}px`;
      this.overlayCanvas.style.height = `${h}px`;
    }
    this.dirty = true;
    // A mounted chart can receive its final non-zero layout after the scene's
    // first animation frame. Draw synchronously so terrain is visible on first
    // selection instead of waiting for a pointer or wheel event.
    this.drawFrame();
    this.dirty = false;
  }

  destroy(): void {
    cancelAnimationFrame(this.animFrame);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.hoverEl.removeEventListener('click', this.onTooltipClick);
    this.flightHudEl.removeEventListener('pointerdown', this.onFlightHudPointerDown);
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
    this.sourcePoints = pts;
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
    const waterLevel = cfg.water?.seaLevel ?? 0;
    const waterEnabled = cfg.water?.enabled === true && minZ < waterLevel;
    const deepWater = parseHexRGB(cfg.water?.deepColor ?? '#031b42');
    const shallowWater = parseHexRGB(cfg.water?.shallowColor ?? '#1686a8');
    this.root.dataset.waterCellCount = String(waterEnabled ? Array.from(elevGrid).filter(elevation => elevation <= waterLevel).length : 0);
    this.root.dataset.waterLevel = String(waterLevel);

    // Preserve geographic aspect ratio
    const rangeXY = Math.max(rangeX, rangeY);
    const scaleX = rangeX / rangeXY;
    const scaleZ = rangeY / rangeXY;
    this.terrainSpace = { minX, maxX, minY, maxY, minZ, maxZ, scaleX, scaleZ, exaggeration: exag };

    // Compute normals using world-space Y values so slopes are correct for lighting
    // Without this, raw metre elevations ~9000m range produce near-horizontal normals → black terrain
    const worldElev = new Float32Array(elevGrid.length);
    for (let i = 0; i < elevGrid.length; i++) {
      const displayElevation = waterEnabled ? Math.max(elevGrid[i], waterLevel) : elevGrid[i];
      worldElev[i] = ((displayElevation - minZ) / elevRange) * exag;
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
      this.cam.distance = cfg.initialDistance != null && cfg.initialDistance > 0.2 && cfg.initialDistance <= 10
        ? cfg.initialDistance
        : autoDist;
      this.cam.orthoHX  = scaleX * 1.05;
      this.cam.orthoHZ  = scaleZ * 1.05;
    } else {
      this.cam.fov      = autoFov;
      this.cam.azimuth  = cfg.initialAzimuth ?? Math.PI;
      this.cam.polar    = cfg.initialPolar ?? autoPolar;
      this.cam.distance = cfg.initialDistance != null && cfg.initialDistance > 0.2 && cfg.initialDistance <= 10
        ? cfg.initialDistance
        : autoDist;
    }
    this.cam.cx = 0;
    this.cam.cy = this.analyticalSurface ? seaY + (peakY - seaY) * 0.62 : seaY;
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
        if (waterEnabled && e <= waterLevel) {
          const depthMix = clamp((e - minZ) / Math.max(1e-9, waterLevel - minZ), 0, 1);
          colors[i * 3] = deepWater[0] + (shallowWater[0] - deepWater[0]) * depthMix;
          colors[i * 3 + 1] = deepWater[1] + (shallowWater[1] - deepWater[1]) * depthMix;
          colors[i * 3 + 2] = deepWater[2] + (shallowWater[2] - deepWater[2]) * depthMix;
          continue;
        }
        if (minZ < 0 && maxZ > 0) {
          t = e < 0
            ? 0.35 * (e - minZ) / (-minZ)
            : 0.35 + 0.65 * (e / maxZ);
        } else {
          t = (e - minZ) / elevRange;
        }
        const [r, g, b] = elevRGB(t, cmap, cfg.colorRamp);
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
            const displayElevation = waterEnabled ? Math.max(e, waterLevel) : e;
            pos[v * 3]     = ((gj / (this.gridW - 1)) * 2 - 1) * scaleX;
            pos[v * 3 + 1] = ((displayElevation - minZ) / elevRange) * exag;
            pos[v * 3 + 2] = ((gi / (this.gridH - 1)) * 2 - 1) * scaleZ;
            norm[v * 3]     = normals[g * 3];
            norm[v * 3 + 1] = normals[g * 3 + 1];
            norm[v * 3 + 2] = normals[g * 3 + 2];
            col[v * 3]      = colors[g * 3];
            col[v * 3 + 1]  = colors[g * 3 + 1];
            col[v * 3 + 2]  = colors[g * 3 + 2];
            elev[v]         = (displayElevation - minZ) / elevRange;
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
    this.updateSemanticInfoEl();
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
    if (this.terrCfg.water?.enabled) this.dirty = true;
    const now = performance.now();
    for (const tween of this.overlayDisplayNodes.values()) {
      const progress = clamp((now - tween.startedAt) / Math.max(1, tween.duration), 0, 1);
      for (const key of Object.keys(tween.current) as Array<keyof OverlayMotionValues>) tween.current[key] = tween.from[key] + (tween.to[key] - tween.from[key]) * progress;
      if (progress < 1) this.dirty = true;
    }
    if (this.firstPersonOverlayId) {
      const sourceNode = this.terrCfg.overlays?.nodes?.find(node => node.id === this.firstPersonOverlayId);
      const motion = this.overlayDisplayNodes.get(this.firstPersonOverlayId)?.current;
      if (sourceNode && motion) {
        const displayNode = { ...sourceNode, x: motion.x, y: motion.y, z: motion.z, data: { ...sourceNode.data, headingDeg: motion.headingDeg } };
        const target = this.firstPersonCameraForNode(displayNode);
        this.cam = target;
        this.desiredFlightCam = target;
        this.dirty = true;
      }
    } else if (this.desiredFlightCam) {
      const target = this.desiredFlightCam;
      const blend = .08;
      this.cam.azimuth += shortestAngle(target.azimuth - this.cam.azimuth) * blend;
      this.cam.polar += (target.polar - this.cam.polar) * blend;
      this.cam.distance += (target.distance - this.cam.distance) * blend;
      this.cam.cx += (target.cx - this.cam.cx) * blend;
      this.cam.cy += (target.cy - this.cam.cy) * blend;
      this.cam.cz += (target.cz - this.cam.cz) * blend;
      this.dirty = true;
    }
    if (this.dirty) { this.drawFrame(); this.dirty = false; }
  };

  private overlayValues(node: TerrainOverlayNode): OverlayMotionValues {
    return { x: node.x, y: node.y, z: node.z, headingDeg: Number(node.data?.headingDeg ?? 0), speedKts: Number(node.data?.speedKts ?? 0), altitudeM: Number(node.data?.altitudeM ?? node.z), linkQualityPct: Number(node.data?.linkQualityPct ?? 0), confidencePct: Number(node.data?.confidencePct ?? 0) };
  }

  private retargetOverlayNodes(): void {
    const now = performance.now();
    const duration = Math.max(80, this.terrCfg.overlayTransitionMs ?? 620);
    for (const node of this.terrCfg.overlays?.nodes ?? []) {
      const target = this.overlayValues(node);
      const tween = this.overlayDisplayNodes.get(node.id);
      if (!tween) {
        this.overlayDisplayNodes.set(node.id, { current: { ...target }, from: { ...target }, to: { ...target }, startedAt: now, duration });
        continue;
      }
      const changed = Object.keys(target).some((key) => Math.abs(target[key as keyof OverlayMotionValues] - tween.to[key as keyof OverlayMotionValues]) > 1e-7);
      if (!changed) continue;
      const headingTarget = tween.current.headingDeg + shortestAngle((target.headingDeg - tween.current.headingDeg) * Math.PI / 180) * 180 / Math.PI;
      tween.from = { ...tween.current };
      tween.to = { ...target, headingDeg: headingTarget };
      tween.startedAt = now;
      tween.duration = duration;
    }
  }

  private drawFrame(): void {
    const gl = this.gl;
    if (!gl || !this.prog || (!this.tiles.length && !this.buildingTiles.length)) return;

    const dpr = Math.min(Math.max(window.devicePixelRatio ?? 1, 1), 2);
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
    this.root.dataset.cameraState = `${azimuth.toFixed(4)},${polar.toFixed(4)},${distance.toFixed(4)},${cx.toFixed(4)},${cz.toFixed(4)}`;
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
    const uTime   = gl.getUniformLocation(this.prog, 'u_time');
    const uSea    = gl.getUniformLocation(this.prog, 'u_seaLevel');
    const uWater  = gl.getUniformLocation(this.prog, 'u_waterEnabled');
    gl.uniformMatrix4fv(uMVP, false, mvp);
    gl.uniformMatrix3fv(uNmat, false, nmat);
    gl.uniform3fv(uLight, lightDir);
    gl.uniform1f(uAmb, ambient);
    gl.uniform1f(uConInt, contourInt);
    gl.uniform3fv(uConCol, cColor);
    gl.uniform1i(uCon, contours);
    gl.uniform1f(uTime, performance.now() / 1000);
    gl.uniform1f(uSea, (this.terrCfg.water?.seaLevel ?? 0) <= this.minElev ? 0 : ((this.terrCfg.water?.seaLevel ?? 0) - this.minElev) / Math.max(1, this.maxElev - this.minElev));
    gl.uniform1f(uWater, this.terrCfg.water?.enabled ? 1 : 0);

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
      gl.uniform4f(wCol, wc[0], wc[1], wc[2], clamp(cfg.wireframeOpacity ?? .18, 0, 1));
      const waPos = gl.getAttribLocation(this.wireProg, 'a_pos');
      for (const tile of this.tiles) {
        gl.bindBuffer(gl.ARRAY_BUFFER, tile.posBuffer);
        gl.enableVertexAttribArray(waPos); gl.vertexAttribPointer(waPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.wIdxBuffer);
        gl.drawElements(gl.LINES, tile.wIndexCount, idxType, 0);
      }
    }
    this.drawOverlays(mvp, w / dpr, h / dpr, dpr);
  }

  private drawOverlays(mvp: Mat4, width: number, height: number, dpr: number): void {
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    this.overlayHitTargets = [];
    const overlays = this.terrCfg.overlays;
    if (!overlays) {
      this.root.dataset.rfBubbleCount = '0';
      this.root.dataset.rfRingCount = '0';
      this.updateFlightHud();
      return;
    }
    this.root.dataset.rfBubbleCount = String((overlays.zones ?? []).filter(zone => zone.kind === 'rfBubble').length);
    this.root.dataset.rfRingCount = String((overlays.zones ?? []).filter(zone => zone.kind === 'rfRings').length);
    const displayNodes = (overlays.nodes ?? []).map((node) => {
      const display = this.overlayDisplayNodes.get(node.id)?.current;
      return display ? { ...node, x: display.x, y: display.y, z: display.z, data: { ...node.data, headingDeg: display.headingDeg, speedKts: display.speedKts, altitudeM: display.altitudeM, linkQualityPct: display.linkQualityPct, confidencePct: display.confidencePct } } : node;
    });
    const world = (point: { x: number; y: number; z: number }) => {
      return projectM4(mvp, this.toTerrainWorld(point), width, height);
    };
    for (const track of overlays.tracks ?? []) {
      const points = track.points.map(world).filter(point => point.visible);
      if (points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = withAlpha(track.color ?? '#ef4444', .9);
      ctx.shadowColor = track.color ?? '#ef4444'; ctx.shadowBlur = track.dashed ? 0 : 6;
      ctx.lineWidth = track.width ?? 2;
      if (track.dashed) ctx.setLineDash([6, 4]);
      ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
      ctx.restore();
    }
    for (const zone of overlays.zones ?? []) {
      if (zone.kind === 'rfRings' && zone.center && zone.radiusX && zone.radiusY) {
        const center = world(zone.center);
        const east = world({ x: zone.center.x + zone.radiusX, y: zone.center.y, z: zone.center.z });
        const north = world({ x: zone.center.x, y: zone.center.y + zone.radiusY, z: zone.center.z });
        if (!center.visible) continue;
        const radiusX = Math.max(12, Math.hypot(east.x - center.x, east.y - center.y));
        const radiusY = Math.max(8, Math.hypot(north.x - center.x, north.y - center.y));
        const color = zone.color ?? '#38bdf8';
        const opacity = clamp(zone.opacity ?? .52, .12, .9) * clamp(zone.confidence ?? 1, .2, 1);
        ctx.save();
        ctx.strokeStyle = withAlpha(color, opacity);
        ctx.lineWidth = 1;
        for (const scale of [.34, .67, 1]) {
          ctx.globalAlpha = .42 + scale * .42;
          ctx.beginPath(); ctx.ellipse(center.x, center.y, radiusX * scale, radiusY * scale, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(center.x, center.y, 2.5, 0, Math.PI * 2); ctx.fill();
        if (zone.label) {
          ctx.font = '700 9px Inter,"Segoe UI",sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(zone.label, center.x, center.y - radiusY - 6);
        }
        ctx.restore();
        continue;
      }
      if (zone.kind === 'rfBubble' && zone.center && zone.radiusX && zone.radiusY && zone.radiusZ) {
        const center = world(zone.center);
        const east = world({ x: zone.center.x + zone.radiusX, y: zone.center.y, z: zone.center.z });
        const north = world({ x: zone.center.x, y: zone.center.y + zone.radiusY, z: zone.center.z });
        const top = world({ x: zone.center.x, y: zone.center.y, z: zone.center.z + zone.radiusZ });
        const bottom = world({ x: zone.center.x, y: zone.center.y, z: zone.center.z - zone.radiusZ });
        if (!center.visible) continue;
        const radiusX = Math.max(18, Math.hypot(east.x - center.x, east.y - center.y));
        const groundRadiusY = Math.max(12, Math.hypot(north.x - center.x, north.y - center.y));
        const verticalRadius = Math.max(10, Math.hypot(top.x - bottom.x, top.y - bottom.y) * .5);
        const radiusY = Math.max(groundRadiusY * .62, verticalRadius);
        const color = zone.color ?? '#38bdf8';
        const opacity = clamp(zone.opacity ?? .24, .04, .48);
        const confidence = clamp(zone.confidence ?? 1, .1, 1);
        const intensity = clamp(zone.intensity ?? 1, .1, 1);
        ctx.save();
        ctx.fillStyle = withAlpha(color, opacity * .12 * intensity);
        ctx.beginPath(); ctx.ellipse(center.x, center.y, radiusX, radiusY, 0, 0, Math.PI * 2); ctx.fill();
        for (let layer = -1; layer <= 1; layer += 1) {
          const normalized = layer / 1.45;
          const ringCenter = world({ x: zone.center.x, y: zone.center.y, z: zone.center.z + normalized * zone.radiusZ });
          if (!ringCenter.visible) continue;
          const scale = Math.sqrt(Math.max(.06, 1 - normalized * normalized));
          ctx.strokeStyle = withAlpha(color, opacity * confidence * (layer === 0 ? .82 : .34));
          ctx.lineWidth = layer === 0 ? 1.35 : .7;
          ctx.setLineDash(layer === 0 ? [] : [5, 7]);
          ctx.beginPath(); ctx.ellipse(ringCenter.x, ringCenter.y, radiusX * scale, groundRadiusY * scale, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = withAlpha(color, opacity * confidence * .72);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(center.x, center.y, radiusX, radiusY, 0, 0, Math.PI * 2); ctx.stroke();
        if (zone.label) {
          ctx.fillStyle = color; ctx.font = '700 9px Inter,"Segoe UI",sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(zone.label, center.x, center.y - radiusY - 7);
        }
        ctx.restore();
        continue;
      }
      const points = zone.points.map(world).filter(point => point.visible);
      if (points.length < 3) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = withAlpha(zone.color ?? '#ef4444', .14);
      ctx.strokeStyle = withAlpha(zone.color ?? '#ef4444', .9);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 5]);
      ctx.fill(); ctx.stroke();
      if (zone.label) {
        const center = points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });
        ctx.fillStyle = zone.color ?? '#ef4444';
        ctx.font = '700 10px "JetBrains Mono",monospace';
        ctx.textAlign = 'center';
        ctx.fillText(zone.label, center.x, center.y);
      }
      ctx.restore();
    }
    const byId = new Map(displayNodes.map(node => [node.id, node]));
    for (const edge of overlays.edges ?? []) {
      const source = byId.get(edge.source); const target = byId.get(edge.target);
      if (!source || !target) continue;
      const a = world(source); const b = world(target);
      if (!a.visible || !b.visible) continue;
      ctx.save();
      ctx.strokeStyle = withAlpha(edge.color ?? '#38bdf8', .92);
      ctx.shadowColor = edge.color ?? '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.lineWidth = edge.width ?? 2;
      if (edge.dashed) ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }
    for (const node of displayNodes) {
      const point = world(node);
      if (!point.visible) continue;
      const color = node.color ?? '#38bdf8';
      const radius = node.size ?? 5;
      this.overlayHitTargets.push({ x: point.x, y: point.y, radius: Math.max(12, radius + 7), node });
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = node.data?.cameraView === true ? 3 : 10;
      ctx.fillStyle = color; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 1.25;
      if (node.data?.cameraView === true) {
        const heading = Number(node.data.headingDeg ?? 0) * Math.PI / 180;
        ctx.translate(point.x, point.y);
        ctx.rotate(heading);
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 5); ctx.lineTo(0, 3); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.rotate(-heading);
        ctx.translate(-point.x, -point.y);
      } else if (node.data?.symbolType) {
        const symbolType = String(node.data.symbolType);
        ctx.translate(point.x, point.y);
        ctx.beginPath();
        if (symbolType === 'launch') { ctx.moveTo(0, -6); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath(); }
        else if (symbolType === 'objective') { ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath(); }
        else if (symbolType === 'infrastructure') { ctx.rect(-5, -5, 10, 10); }
        else { ctx.arc(0, 0, 5, 0, Math.PI * 2); }
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke();
        ctx.translate(-point.x, -point.y);
      } else {
        ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (node.label) {
        ctx.font = '700 10px "JetBrains Mono",monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e0f2fe';
        ctx.strokeStyle = 'rgba(2,7,17,.95)'; ctx.lineWidth = 3;
        ctx.strokeText(node.label, point.x + radius + 5, point.y - 2);
        ctx.fillText(node.label, point.x + radius + 5, point.y - 2);
        if (node.detail) {
          ctx.font = '700 8px "JetBrains Mono",monospace'; ctx.fillStyle = color;
          ctx.fillText(node.detail, point.x + radius + 5, point.y + 10);
        }
      }
      ctx.restore();
    }
    if (this.selectedOverlayId) {
      const selected = this.overlayHitTargets.find(target => target.node.id === this.selectedOverlayId);
      if (selected) this.showOverlayTooltip(selected);
    }
    this.overlayCanvas.dataset.hitTargetCount = String(this.overlayHitTargets.length);
    this.overlayCanvas.dataset.hitTargets = JSON.stringify(this.overlayHitTargets.map(target => ({ id: target.node.id, x: Math.round(target.x), y: Math.round(target.y) })));
    this.updateFlightHud();
  }

  private toTerrainWorld(point: { x: number; y: number; z: number }): Vec3 {
    const s = this.terrainSpace;
    return [
      (((point.x - s.minX) / Math.max(1e-9, s.maxX - s.minX)) * 2 - 1) * s.scaleX,
      ((point.z - s.minZ) / Math.max(1e-9, s.maxZ - s.minZ)) * s.exaggeration + .035,
      (((point.y - s.minY) / Math.max(1e-9, s.maxY - s.minY)) * 2 - 1) * s.scaleZ,
    ];
  }

  private applyFocusCamera(): void {
    const focusId = this.firstPersonOverlayId || this.terrCfg.focusNodeId;
    if (!focusId) return;
    const node = this.terrCfg.overlays?.nodes?.find(candidate => candidate.id === focusId);
    if (!node) return;
    if (this.firstPersonOverlayId === node.id) {
      this.applyFirstPersonCamera(node);
      return;
    }
    const [x, y, z] = this.toTerrainWorld(node);
    this.cam.cx = x; this.cam.cy = y; this.cam.cz = z;
    this.cam.azimuth = -0.72; this.cam.polar = 1.02; this.cam.distance = 1.32;
  }

  private applyFirstPersonCamera(node: TerrainOverlayNode): void {
    const target = this.firstPersonCameraForNode(node);
    if (!this.desiredFlightCam) this.cam = { ...target };
    this.desiredFlightCam = target;
  }

  private firstPersonCameraForNode(node: TerrainOverlayNode): TerrainCamera {
    const [x, y, z] = this.toTerrainWorld(node);
    const heading = Number(node.data?.headingDeg ?? 0) * Math.PI / 180;
    const forward = .30;
    const down = .13;
    const distance = Math.hypot(forward, down);
    return {
      ...this.cam,
      cx: x + Math.sin(heading) * forward,
      cy: y - down,
      cz: z + Math.cos(heading) * forward,
      azimuth: heading + Math.PI,
      distance,
      polar: Math.acos(down / distance),
    };
  }

  private applySensorConfig(): void {
    if (!this.firstPersonOverlayId || this.sensorMode === 'optical') {
      this.terrCfg.colormap = 'hypsometric';
      this.terrCfg.colorRamp = undefined;
      return;
    }
    if (this.sensorMode === 'night') {
      this.terrCfg.colormap = 'gray';
      this.terrCfg.colorRamp = ['#000803', '#00230c', '#006c25', '#32d75c', '#dcffe5'];
      return;
    }
    if (this.sensorMode === 'thermal') {
      this.terrCfg.colormap = 'thermal';
      this.terrCfg.colorRamp = undefined;
      return;
    }
    this.terrCfg.colormap = 'gray';
    this.terrCfg.colorRamp = ['#010304', '#101a21', '#51626c', '#b8c8d1', '#f2f7fa'];
  }

  private setSensorMode(mode: 'optical' | 'night' | 'thermal' | 'lowLight'): void {
    if (this.sensorMode === mode) return;
    this.sensorMode = mode;
    const camera = { ...this.cam };
    const desired = this.desiredFlightCam ? { ...this.desiredFlightCam } : null;
    this.applySensorConfig();
    if (this.sourcePoints.length) this.buildTerrain(this.sourcePoints, this.terrCfg);
    this.cam = camera;
    this.desiredFlightCam = desired;
    this.dirty = true;
  }

  private leaveFlightView(): void {
    const needsTerrainRestore = this.sensorMode !== 'optical';
    const camera = { ...this.cam };
    this.firstPersonOverlayId = '';
    this.desiredFlightCam = null;
    this.sensorMode = 'optical';
    this.flightHudEl.style.display = 'none';
    delete this.root.dataset.cameraMode;
    delete this.root.dataset.flightPhase;
    this.applySensorConfig();
    if (needsTerrainRestore && this.sourcePoints.length) {
      this.buildTerrain(this.sourcePoints, this.terrCfg);
      this.cam = camera;
    }
  }

  private updateFlightHud(): void {
    const sourceNode = this.terrCfg.overlays?.nodes?.find(candidate => candidate.id === this.firstPersonOverlayId);
    if (!sourceNode) {
      this.flightHudEl.style.display = 'none';
      return;
    }
    const motion = this.overlayDisplayNodes.get(sourceNode.id)?.current;
    const node = motion ? { ...sourceNode, z: motion.z, data: { ...sourceNode.data, headingDeg: motion.headingDeg, speedKts: motion.speedKts, altitudeM: motion.altitudeM, linkQualityPct: motion.linkQualityPct, confidencePct: motion.confidencePct } } : sourceNode;
    const data = node.data ?? {};
    const heading = Number(data.headingDeg ?? 0);
    const altitude = Number(data.altitudeM ?? node.z);
    const speed = Number(data.speedKts ?? 0);
    const link = Number(data.linkQualityPct ?? 0);
    const confidence = Number(data.confidencePct ?? 0);
    const flightPhase = String(data.flightPhase ?? 'IN FLIGHT');
    const hudColor = this.sensorMode === 'night' ? '#69ff88' : this.sensorMode === 'thermal' ? '#ffb347' : this.sensorMode === 'lowLight' ? '#d4e2ea' : '#dff5ff';
    const modeLabel = this.sensorMode === 'night' ? 'NIGHT VISION' : this.sensorMode === 'thermal' ? 'THERMAL' : this.sensorMode === 'lowLight' ? 'LOW LIGHT' : 'OPTICAL';
    this.flightHudEl.style.display = 'block';
    this.flightHudEl.style.color = hudColor;
    this.flightHudEl.dataset.sensorMode = this.sensorMode;
    this.root.dataset.cameraMode = 'first-person';
    this.root.dataset.flightPhase = flightPhase;
    this.flightHudEl.innerHTML = `
      <div style="position:absolute;inset:14px;border:1px solid ${withAlpha(hudColor, .34)};box-shadow:inset 0 0 42px rgba(0,0,0,.42)"></div>
      <div style="position:absolute;left:50%;top:16px;transform:translateX(-50%);padding:4px 12px;border-top:1px solid ${hudColor};letter-spacing:.14em">HDG ${String(Math.round(heading)).padStart(3, '0')}°</div>
      <div style="position:absolute;right:22px;top:18px;display:flex;gap:3px;pointer-events:auto">${([['optical','OPT'],['night','NV'],['thermal','THM'],['lowLight','LL']] as const).map(([mode,label]) => `<button type="button" data-terrain-hud-sensor="${mode}" style="padding:3px 6px;border:1px solid ${this.sensorMode === mode ? hudColor : withAlpha(hudColor,.35)};background:${this.sensorMode === mode ? withAlpha(hudColor,.18) : 'rgba(0,0,0,.42)'};color:${hudColor};font:700 9px Inter,Segoe UI,sans-serif;cursor:pointer">${label}</button>`).join('')}</div>
      <div style="position:absolute;left:24px;top:50%;transform:translateY(-50%);line-height:1.7">SPD<br><b style="font-size:16px">${Math.round(speed)}</b> KT</div>
      <div style="position:absolute;right:24px;top:50%;transform:translateY(-50%);text-align:right;line-height:1.7">ALT<br><b style="font-size:16px">${Math.round(altitude)}</b> M</div>
      <div style="position:absolute;left:50%;top:50%;width:108px;height:54px;transform:translate(-50%,-50%)"><i style="position:absolute;left:0;right:0;top:27px;border-top:1px solid ${hudColor}"></i><i style="position:absolute;left:53px;top:0;bottom:0;border-left:1px solid ${hudColor}"></i><i style="position:absolute;left:43px;top:17px;width:20px;height:20px;border:1px solid ${hudColor};border-radius:50%"></i></div>
      <div style="position:absolute;left:24px;bottom:22px">LINK ${Math.round(link)}%</div>
      <div style="position:absolute;right:24px;bottom:22px">TRACK ${Math.round(confidence)}%</div>
      <div style="position:absolute;left:50%;bottom:20px;transform:translateX(-50%);letter-spacing:.16em">${modeLabel} · ${escapeTerrainHtml(flightPhase)} · ${escapeTerrainHtml(node.label ?? node.id)}</div>`;
    this.hoverEl.querySelectorAll<HTMLButtonElement>('[data-terrain-sensor]').forEach((button) => {
      const active = button.dataset.terrainSensor === this.sensorMode;
      button.style.borderColor = active ? '#f8fafc' : '#40576a';
      button.style.background = active ? '#203343' : '#07121c';
      button.style.color = active ? '#fff' : '#a9bdca';
    });
  }

  // ── Info overlay ─────────────────────────────────────────────────────────────

  private updateSemanticInfoEl(): void {
    const tileCount = this.tiles.length;
    const buildingInfo = this.buildingCount > 0 ? `  //  ${this.buildingCount} bldgs` : '';
    const zAxis = this.terrCfg.axes?.z;
    const metricLabel = zAxis?.label ?? 'Elevation';
    const metricUnit = zAxis?.unit ?? (zAxis ? '' : 'm');
    const precision = Math.abs(this.maxElev - this.minElev) < 10 ? 2 : 0;
    const metricRange = `${this.minElev.toFixed(precision)}-${this.maxElev.toFixed(precision)}${metricUnit ? ` ${metricUnit}` : ''}`;
    this.infoEl.textContent = `${this.gridW}x${this.gridH}  //  ${tileCount} tile${tileCount !== 1 ? 's' : ''}${buildingInfo}  //  ${metricLabel} ${metricRange}`;
  }

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
    const overlayTarget = this.findOverlayHit(e.clientX, e.clientY);
    if (overlayTarget) {
      this.selectedOverlayId = overlayTarget.node.id;
      this.leaveFlightView();
      if (overlayTarget.node.data?.cameraView === true) {
        const [x, y, z] = this.toTerrainWorld(overlayTarget.node);
        this.cam.cx = x; this.cam.cy = y; this.cam.cz = z;
        this.cam.azimuth = -0.72; this.cam.polar = 1.02; this.cam.distance = 1.32;
      }
      this.showOverlayTooltip(overlayTarget);
      this.dirty = true;
      return;
    }
    this.selectedOverlayId = '';
    this.leaveFlightView();
    this.hoverEl.style.display = 'none';
    this.canvas.setPointerCapture(e.pointerId);
    this.dragMode = e.shiftKey || e.button === 2 ? 'pan' : 'orbit';
    this.lastPX = e.clientX; this.lastPY = e.clientY;
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly onMove = (e: PointerEvent) => {
    if (this.dragMode === 'none') {
      this.updateHover(e);
      return;
    }
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

  private readonly onLeave = () => {
    if (this.dragMode === 'none' && !this.selectedOverlayId) this.hoverEl.style.display = 'none';
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
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private renderAxes(): void {
    const axes = this.terrCfg.axes;
    if (!axes) {
      this.axesEl.replaceChildren();
      return;
    }
    const label = (axis: { label: string; unit?: string }) => `${axis.label}${axis.unit ? ` (${axis.unit})` : ''}`;
    const tickValues = (axis: { min?: number; max?: number; tickCount?: number }) => {
      if (!Number.isFinite(axis.min) || !Number.isFinite(axis.max)) return [];
      const count = Math.max(2, axis.tickCount ?? 5);
      return Array.from({ length: count }, (_, index) => Number(axis.min) + (Number(axis.max) - Number(axis.min)) * index / (count - 1));
    };
    const formatTick = (value: number) => Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(2) : value.toFixed(3);
    const xTicks = tickValues(axes.x);
    const yTicks = tickValues(axes.y);
    const zTicks = tickValues(axes.z);
    const xColor = axes.x.color ?? '#67e8f9'; const yColor = axes.y.color ?? '#a5b4fc'; const zColor = axes.z.color ?? '#fbbf24';
    this.axesEl.innerHTML = `
      <div style="position:absolute;left:14px;right:14px;bottom:12px;height:24px;border-bottom:1px solid ${xColor}">
        <b style="position:absolute;left:0;bottom:12px;color:${xColor}">X · ${label(axes.x)}</b>
        ${xTicks.map((value, index) => `<i style="position:absolute;left:${index / Math.max(1,xTicks.length - 1) * 100}%;bottom:-2px;transform:translateX(-50%);font-style:normal;color:${xColor};opacity:.76">${formatTick(value)}</i>`).join('')}
      </div>
      <div style="position:absolute;left:8px;top:44px;bottom:46px;width:42px;border-left:1px solid ${yColor}">
        <b style="position:absolute;left:5px;top:-17px;color:${yColor}">Y · ${label(axes.y)}</b>
        ${yTicks.map((value, index) => `<i style="position:absolute;left:5px;top:${(1 - index / Math.max(1,yTicks.length - 1)) * 100}%;transform:translateY(-50%);font-style:normal;color:${yColor};opacity:.76">${formatTick(value)}</i>`).join('')}
      </div>
      <div style="position:absolute;right:8px;top:44px;bottom:46px;width:52px;border-right:1px solid ${zColor};text-align:right">
        <b style="position:absolute;right:5px;top:-17px;color:${zColor}">Z · ${label(axes.z)}</b>
        ${zTicks.map((value, index) => `<i style="position:absolute;right:5px;top:${(1 - index / Math.max(1,zTicks.length - 1)) * 100}%;transform:translateY(-50%);font-style:normal;color:${zColor};opacity:.76">${formatTick(value)}</i>`).join('')}
      </div>`;
  }

  private updateHover(event: PointerEvent): void {
    if (this.firstPersonOverlayId) {
      this.hoverEl.style.display = 'none';
      return;
    }
    const overlayTarget = this.findOverlayHit(event.clientX, event.clientY);
    if (overlayTarget) {
      this.showOverlayTooltip(overlayTarget);
      return;
    }
    if (this.selectedOverlayId) {
      const selected = this.overlayHitTargets.find(target => target.node.id === this.selectedOverlayId);
      if (selected) this.showOverlayTooltip(selected);
      return;
    }
    if (this.terrCfg.pointTooltip === false) {
      this.hoverEl.style.display = 'none';
      return;
    }
    if (!this.sourcePoints.length || this.gridW < 1 || this.gridH < 1) return;
    const rect = this.canvas.getBoundingClientRect();
    const u = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const v = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    const column = Math.round(u * (this.gridW - 1));
    const row = Math.round((1 - v) * (this.gridH - 1));
    const point = this.sourcePoints[Math.min(this.sourcePoints.length - 1, row * this.gridW + column)];
    if (!point) return;
    const axes = this.terrCfg.axes;
    const format = (value: number, unit?: string) => `${Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3)}${unit ? ` ${unit}` : ''}`;
    this.hoverEl.innerHTML = `${axes?.x.label ?? 'X'} <b>${format(point.x, axes?.x.unit)}</b><br>${axes?.y.label ?? 'Y'} <b>${format(point.y, axes?.y.unit)}</b><br>${axes?.z.label ?? 'Z'} <b>${format(point.z, axes?.z.unit)}</b>`;
    this.hoverEl.style.left = `${clamp(event.clientX - rect.left + 14, 8, Math.max(8, rect.width - 180))}px`;
    this.hoverEl.style.top = `${clamp(event.clientY - rect.top + 14, 8, Math.max(8, rect.height - 86))}px`;
    this.hoverEl.style.display = 'block';
  }

  private findOverlayHit(clientX: number, clientY: number): { x: number; y: number; radius: number; node: TerrainOverlayNode } | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return [...this.overlayHitTargets].reverse().find(target => Math.hypot(target.x - x, target.y - y) <= target.radius);
  }

  private showOverlayTooltip(target: { x: number; y: number; node: TerrainOverlayNode }): void {
    const node = target.node;
    const rows = Object.entries(node.data ?? {}).filter(([key]) => key !== 'cameraView').map(([key, value]) => `<div style="display:flex;justify-content:space-between;gap:18px"><span style="color:#7893aa">${escapeTerrainHtml(key.replace(/([A-Z])/g, ' $1').toUpperCase())}</span><b>${escapeTerrainHtml(String(value))}</b></div>`).join('');
    const pinned = this.selectedOverlayId === node.id;
    const cameraButton = pinned && node.data?.cameraView === true ? `<button type="button" data-terrain-first-person="${escapeTerrainHtml(node.id)}" style="width:100%;margin-top:8px;padding:7px 9px;border:1px solid #ef4444;background:#240b10;color:#fee2e2;font:700 10px Inter,Segoe UI,sans-serif;cursor:pointer">${this.firstPersonOverlayId === node.id ? 'DRONE CAMERA ACTIVE' : 'DRONE CAMERA VIEW'}</button>` : '';
    const sensors = pinned && node.data?.cameraView === true ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px">${([
      ['optical', 'OPTICAL'], ['night', 'NIGHT VISION'], ['thermal', 'THERMAL'], ['lowLight', 'LOW LIGHT'],
    ] as const).map(([mode, label]) => `<button type="button" data-terrain-sensor="${mode}" style="padding:6px 4px;border:1px solid ${this.sensorMode === mode ? '#f8fafc' : '#40576a'};background:${this.sensorMode === mode ? '#203343' : '#07121c'};color:${this.sensorMode === mode ? '#fff' : '#a9bdca'};font:700 9px Inter,Segoe UI,sans-serif;cursor:pointer">${label}</button>`).join('')}</div>` : '';
    this.hoverEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:5px"><strong style="color:${node.color ?? '#38bdf8'}">${escapeTerrainHtml(node.label ?? node.id)}</strong><span style="color:#607d94">${pinned ? 'PINNED' : 'LIVE'}</span></div>${node.detail ? `<div style="margin-bottom:6px;color:#b9d4e6">${escapeTerrainHtml(node.detail)}</div>` : ''}${rows}<div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(125,211,252,.16);color:#607d94">${escapeTerrainHtml(node.id)} · click to pin</div>${cameraButton}`;
    this.hoverEl.insertAdjacentHTML('beforeend', sensors);
    this.hoverEl.style.left = `${clamp(target.x + 14, 8, Math.max(8, this.chartArea.width - 230))}px`;
    this.hoverEl.style.top = `${clamp(target.y - 18, 8, Math.max(8, this.chartArea.height - 190))}px`;
    this.hoverEl.style.display = 'block';
    this.hoverEl.style.pointerEvents = pinned ? 'auto' : 'none';
  }

  private readonly onTooltipClick = (event: MouseEvent) => {
    const sensorButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-terrain-sensor]');
    if (sensorButton) {
      event.stopPropagation();
      const mode = sensorButton.dataset.terrainSensor;
      const node = this.terrCfg.overlays?.nodes?.find(candidate => candidate.id === this.selectedOverlayId);
      if (node?.data?.cameraView === true) {
        this.firstPersonOverlayId = node.id;
        this.applyFirstPersonCamera(node);
      }
      if (mode === 'optical' || mode === 'night' || mode === 'thermal' || mode === 'lowLight') this.setSensorMode(mode);
      this.selectedOverlayId = '';
      this.hoverEl.style.display = 'none';
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-terrain-first-person]');
    if (!button) return;
    event.stopPropagation();
    const node = this.terrCfg.overlays?.nodes?.find(candidate => candidate.id === button.dataset.terrainFirstPerson);
    if (!node) return;
    this.selectedOverlayId = node.id;
    this.firstPersonOverlayId = node.id;
    this.applyFirstPersonCamera(node);
    this.dirty = true;
    this.selectedOverlayId = '';
    this.hoverEl.style.display = 'none';
  };

  private readonly onFlightHudPointerDown = (event: PointerEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-terrain-hud-sensor]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const mode = button.dataset.terrainHudSensor;
    if (mode === 'optical' || mode === 'night' || mode === 'thermal' || mode === 'lowLight') this.setSensorMode(mode);
  };
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

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color;
  const [r, g, b] = parseHexRGB(color).map(value => Math.round(value * 255));
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeTerrainHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function shortestAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
