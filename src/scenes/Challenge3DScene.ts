import type { EventBus } from '../core/EventBus';
import type {
  Challenge3DConfig,
  ChartConfig,
  ChartState,
  ColorValue,
  DataPoint,
  GradientDef,
  Rect,
  ThemeConfig,
} from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';

export const CHALLENGE_3D_CHART_TYPES = [
  'temporalGraphState3d',
  'alphaLaplacianGraph3d',
  'powerwalkGraph3d',
  'spectralSurface3d',
  'graphManifold3d',
  'forecastCone3d',
  'operationalSignalFusion3d',
  'weatherDisasterSignalMap3d',
  'raceOutcomeDistribution3d',
  'behaviorDrift3d',
  'controlEventTimeline3d',
  'deviceTelemetryLearning3d',
  'crossScaleIntelligence3d',
  'deviceFleetHealth3d',
  'missionOutcomes3d',
  'laplacianFabricCone3d',
  'laserPointMap3d',
  'geojsonExtrusion3d',
] as const;
export type Challenge3DChartType = typeof CHALLENGE_3D_CHART_TYPES[number];

interface Challenge3DSceneOptions {
  host: HTMLElement;
  bus: EventBus;
}

interface Challenge3DRenderContext {
  series: ProcessedSeries[];
  state: ChartState;
  theme: ThemeConfig;
  config: ChartConfig;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  depth: number;
}

interface PolygonGroup {
  id: string;
  label: string;
  height: number;
  color: string;
  points: DataPoint[];
}

const CHALLENGE_3D_TYPE_SET = new Set<string>(CHALLENGE_3D_CHART_TYPES);

export class Challenge3DScene {
  private readonly host: HTMLElement;
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLDivElement;
  private readonly bus: EventBus;
  private ctx: CanvasRenderingContext2D | null = null;
  private chartArea: Rect = { x: 0, y: 0, width: 400, height: 300 };
  private theme: ThemeConfig | null = null;
  private config: ChartConfig | null = null;
  private sceneConfig: Challenge3DConfig = {};
  private series: ProcessedSeries[] = [];
  private sceneType: Challenge3DChartType = 'laplacianFabricCone3d';
  private frameHandle = 0;
  private pointerDown = false;
  private lastPointer = { x: 0, y: 0 };
  private yaw = -0.55;
  private pitch = 0.64;
  private zoom = 1;

  constructor(options: Challenge3DSceneOptions) {
    this.host = options.host;
    this.bus = options.bus;
    this.root = document.createElement('div');
    this.root.setAttribute('data-uc-challenge3d', 'true');
    this.root.style.cssText = [
      'position:absolute',
      'overflow:hidden',
      'border-radius:16px',
      'z-index:12',
      'touch-action:none',
      'user-select:none',
      'background:#040b15',
      'border:1px solid rgba(148,163,184,0.14)',
      'box-shadow:inset 0 0 0 1px rgba(148,163,184,0.06)',
    ].join(';');

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-uc-challenge3d', 'true');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;background:transparent;';
    this.root.appendChild(this.canvas);

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = [
      'position:absolute',
      'left:14px',
      'bottom:12px',
      'right:14px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:12px',
      'pointer-events:none',
      'font:700 10px/1.4 "JetBrains Mono","Cascadia Code","Consolas",monospace',
      'text-transform:uppercase',
      'letter-spacing:0.12em',
      'color:rgba(226,242,255,0.68)',
      'text-shadow:0 0 16px rgba(56,189,248,0.42)',
    ].join(';');
    this.root.appendChild(this.overlay);

    this.attachEvents();
    this.host.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d');
  }

  update(ctx: Challenge3DRenderContext): void {
    this.theme = ctx.theme;
    this.config = ctx.config;
    this.sceneConfig = ctx.config.challenge3d ?? {};
    this.series = ctx.series;
    const nextType = ctx.series.find((series) => CHALLENGE_3D_TYPE_SET.has(series.type))?.type;
    if (isChallenge3DChartType(nextType)) this.sceneType = nextType;
    this.resize(ctx.state.chartArea);
    this.applyThemeStyles();
    this.overlay.innerHTML = [
      `<span>${escapeHtml(this.sceneLabel())}</span>`,
      `<span>${this.series.reduce((sum, series) => sum + series.data.length, 0)} pts</span>`,
    ].join('');

    if (!this.frameHandle) {
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  }

  resize(chartArea: Rect): void {
    this.chartArea = chartArea;
    this.root.style.left = `${chartArea.x}px`;
    this.root.style.top = `${chartArea.y}px`;
    this.root.style.width = `${chartArea.width}px`;
    this.root.style.height = `${chartArea.height}px`;

    const width = Math.max(1, Math.floor(chartArea.width));
    const height = Math.max(1, Math.floor(chartArea.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.floor(width * dpr);
    const nextHeight = Math.floor(height * dpr);
    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx = this.canvas.getContext('2d');
    }
  }

  async export(format: 'png' | 'svg' | 'jpeg' = 'png'): Promise<Blob | string> {
    this.renderFrame(performance.now() * 0.001);
    if (format === 'svg') {
      const raster = this.canvas.toDataURL('image/png');
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}" viewBox="0 0 ${this.canvas.width} ${this.canvas.height}">`,
        `<image href="${raster}" width="${this.canvas.width}" height="${this.canvas.height}" />`,
        '</svg>',
      ].join('');
    }

    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return await new Promise<Blob>((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Challenge3D export failed.'));
      }, mime, format === 'jpeg' ? 0.92 : undefined);
    });
  }

  destroy(): void {
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.root.remove();
  }

  private readonly frame = (time: number) => {
    this.frameHandle = requestAnimationFrame(this.frame);
    this.renderFrame(time * 0.001);
  };

  private renderFrame(time: number): void {
    const ctx = this.ctx;
    const theme = this.theme;
    if (!ctx || !theme) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, this.chartArea.width);
    const height = Math.max(1, this.chartArea.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    this.drawBackground(ctx, width, height, theme);
    this.drawFloor(ctx, width, height, time, theme);

    switch (this.sceneType) {
      case 'temporalGraphState3d':
        this.drawTemporalGraphState(ctx, width, height, time, theme);
        break;
      case 'alphaLaplacianGraph3d':
        this.drawAlphaLaplacianGraph(ctx, width, height, time, theme);
        break;
      case 'powerwalkGraph3d':
        this.drawPowerwalkGraph(ctx, width, height, time, theme);
        break;
      case 'spectralSurface3d':
        this.drawSpectralSurface(ctx, width, height, time, theme);
        break;
      case 'graphManifold3d':
        this.drawGraphManifold(ctx, width, height, time, theme);
        break;
      case 'forecastCone3d':
        this.drawForecastCone(ctx, width, height, time, theme);
        break;
      case 'operationalSignalFusion3d':
        this.drawOperationalSignalFusion(ctx, width, height, time, theme);
        break;
      case 'weatherDisasterSignalMap3d':
      case 'crossScaleIntelligence3d':
        this.drawOperationalSignalFusion(ctx, width, height, time, theme);
        break;
      case 'raceOutcomeDistribution3d':
        this.drawRaceOutcomeDistribution(ctx, width, height, time, theme);
        break;
      case 'behaviorDrift3d':
        this.drawBehaviorDrift(ctx, width, height, time, theme);
        break;
      case 'controlEventTimeline3d':
        this.drawControlEventTimeline(ctx, width, height, time, theme);
        break;
      case 'deviceTelemetryLearning3d':
        this.drawDeviceTelemetry(ctx, width, height, time, theme);
        break;
      case 'deviceFleetHealth3d':
      case 'missionOutcomes3d':
        this.drawMissionGauge(ctx, width, height, time, theme);
        break;
      case 'laserPointMap3d':
        this.drawLaserPointMap(ctx, width, height, time, theme);
        break;
      case 'geojsonExtrusion3d':
        this.drawGeojsonExtrusion(ctx, width, height, time, theme);
        break;
      case 'laplacianFabricCone3d':
      default:
        this.drawLaplacianFabricCone(ctx, width, height, time, theme);
        break;
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, theme: ThemeConfig): void {
    const bg = toCssColor(this.sceneConfig.backgroundColor ?? theme.colors?.background ?? theme.backgroundColor, '#04101f');
    const accent = theme.palette[0] ?? '#38bdf8';
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.38, 10, width * 0.5, height * 0.4, Math.max(width, height) * 0.72);
    gradient.addColorStop(0, alpha(accent, 0.18));
    gradient.addColorStop(0.42, alpha(bg, 0.95));
    gradient.addColorStop(1, '#020714');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = alpha(theme.palette[1] ?? '#7dd3fc', 0.18);
    ctx.lineWidth = 1;
    for (let x = -width; x < width * 1.5; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x + width * 0.18, height);
      ctx.lineTo(x + width * 0.46, height * 0.16);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFloor(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const center = { x: width * 0.5, y: height * 0.64 };
    const accent = theme.palette[0] ?? '#38bdf8';
    ctx.save();
    ctx.strokeStyle = alpha(accent, 0.22);
    ctx.lineWidth = 1;
    for (let ring = 0; ring < 7; ring += 1) {
      const rx = 70 + ring * 54;
      const ry = 14 + ring * 12;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y + ring * 8, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const sweep = (time * 0.32) % 1;
    const glow = ctx.createRadialGradient(center.x, center.y, 2, center.x, center.y, width * 0.38);
    glow.addColorStop(0, alpha(accent, 0.32));
    glow.addColorStop(Math.min(0.98, 0.18 + sweep * 0.42), alpha(theme.palette[2] ?? '#fbbf24', 0.08));
    glow.addColorStop(1, alpha(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private drawTemporalGraphState(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const points = source.length ? source : buildTemporalStatePoints();
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#a78bfa', '#f59e0b'];
    const slices = Math.max(2, Math.round(readNumber(points[points.length - 1]?.meta, 'slice') ?? 3) + 1);
    ctx.save();
    for (let slice = 0; slice < slices; slice += 1) {
      const z = -2.4 + slice * (4.8 / Math.max(1, slices - 1));
      const corners = [
        this.project({ x: -5.2, y: -3.4, z }, width, height), this.project({ x: 5.2, y: -3.4, z }, width, height),
        this.project({ x: 5.2, y: 3.4, z }, width, height), this.project({ x: -5.2, y: 3.4, z }, width, height),
      ];
      ctx.beginPath();
      corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = alpha(palette[slice % palette.length] ?? '#38bdf8', 0.035 + slice * 0.012);
      ctx.strokeStyle = alpha(palette[slice % palette.length] ?? '#38bdf8', 0.24);
      ctx.fill(); ctx.stroke();
    }
    this.drawConnectedPointCloud(ctx, points, width, height, time, theme, 1, true);
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Temporal Graph State', 'dynamic state evolution across latent time slices', width, theme);
    ctx.restore();
  }

  private drawAlphaLaplacianGraph(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const points = source.length ? source : buildAlphaGraphPoints();
    const alphaValue = this.sceneConfig.alpha ?? 0.72;
    ctx.save();
    this.drawConnectedPointCloud(ctx, points, width, height, time, theme, 3, false, alphaValue);
    const center = this.project({ x: 0, y: 0, z: 0 }, width, height);
    const pulse = 34 + Math.sin(time * 1.8) * 7;
    ctx.beginPath(); ctx.arc(center.x, center.y, pulse, 0, Math.PI * 2);
    ctx.strokeStyle = alpha(theme.palette[2] ?? '#f59e0b', 0.34); ctx.lineWidth = 1.2; ctx.stroke();
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Alpha-Laplacian Graph', `fractional diffusion field · alpha=${alphaValue.toFixed(2)}`, width, theme);
    ctx.restore();
  }

  private drawPowerwalkGraph(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const points = source.length ? source : buildPowerwalkPoints();
    ctx.save();
    this.drawConnectedPointCloud(ctx, points, width, height, time, theme, 5, true);
    const pathLength = Math.min(points.length, 18);
    const head = (time * 2.2) % pathLength;
    for (let trail = 0; trail < 9; trail += 1) {
      const index = Math.floor((head - trail + pathLength) % pathLength);
      const point = points[index]!;
      const projected = this.projectPointLike(point, width, height);
      drawGlowPoint(ctx, projected.x, projected.y, 7 - trail * 0.48, theme.palette[2] ?? '#fbbf24', 0.9 - trail * 0.085);
    }
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Predictive Powerwalks', 'physics-consistent exploration over weighted transition paths', width, theme);
    ctx.restore();
  }

  private drawSpectralSurface(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const points = source.length ? source : buildSpectralSurfacePoints();
    const cols = Math.max(4, Math.round(readNumber(points[0]?.meta, 'gridWidth') ?? Math.sqrt(points.length)));
    const rows = Math.max(2, Math.ceil(points.length / cols));
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#a78bfa', '#f59e0b'];
    ctx.save();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const point = points[index]; if (!point) continue;
        const a = this.projectPointLike(point, width, height, Number(point.z ?? 0) + Math.sin(time + index * .07) * .04);
        for (const neighbor of [col < cols - 1 ? index + 1 : -1, row < rows - 1 ? index + cols : -1]) {
          if (neighbor < 0 || !points[neighbor]) continue;
          const b = this.projectPointLike(points[neighbor]!, width, height);
          const magnitude = clamp((Number(point.z ?? 0) + 3) / 7, 0, 1);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = alpha(palette[Math.min(palette.length - 1, Math.floor(magnitude * palette.length))] ?? '#38bdf8', .18 + magnitude * .48);
          ctx.lineWidth = .7 + magnitude * 1.1; ctx.stroke();
        }
      }
    }
    points.filter((_, index) => index % Math.max(1, Math.floor(cols / 8)) === 0).forEach((point, index) => {
      const p = this.projectPointLike(point, width, height); drawGlowPoint(ctx, p.x, p.y, 1.6 + Math.max(0, Number(point.z ?? 0)) * .42, palette[index % palette.length] ?? '#38bdf8', .64);
    });
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Spectral Surfaces', 'eigenstructure reveals dominant modes and channels', width, theme);
    ctx.restore();
  }

  private drawGraphManifold(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const points = source.length ? source : buildManifoldPoints();
    ctx.save();
    this.drawConnectedPointCloud(ctx, points, width, height, time, theme, 12, false);
    const halo = this.project({ x: 0, y: 0, z: 0 }, width, height);
    ctx.beginPath(); ctx.ellipse(halo.x, halo.y, width * .18, height * .055, -.18, 0, Math.PI * 2);
    ctx.strokeStyle = alpha(theme.palette[1] ?? '#a78bfa', .22); ctx.lineWidth = 1; ctx.stroke();
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Abstract Graph Manifold', 'high-dimensional structure with continuous topology', width, theme);
    ctx.restore();
  }

  private drawForecastCone(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    this.drawLaplacianFabricCone(ctx, width, height, time, theme);
    const points = this.getPoints();
    if (!points.length) return;
    ctx.save();
    const control = theme.palette[2] ?? '#f59e0b';
    points.filter((_, index) => index % 9 === 0).forEach((point) => {
      const p = this.projectPointLike(point, width, height); drawGlowPoint(ctx, p.x, p.y, 5.5, control, .86);
    });
    ctx.restore();
  }

  private drawOperationalSignalFusion(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const points = source.length ? source : buildSignalFusionPoints();
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22d3ee', '#f59e0b'];
    ctx.save();
    const center = this.project({ x: 0, y: 0, z: 0 }, width, height);
    const globeRadius = Math.min(width, height) * .22;
    const globe = ctx.createRadialGradient(center.x - globeRadius * .3, center.y - globeRadius * .35, 4, center.x, center.y, globeRadius);
    globe.addColorStop(0, alpha(palette[0] ?? '#38bdf8', .22)); globe.addColorStop(.7, alpha('#071829', .38)); globe.addColorStop(1, alpha(palette[1] ?? '#22d3ee', .08));
    ctx.beginPath(); ctx.arc(center.x, center.y, globeRadius, 0, Math.PI * 2); ctx.fillStyle = globe; ctx.fill(); ctx.strokeStyle = alpha(palette[0] ?? '#38bdf8', .28); ctx.stroke();
    this.drawConnectedPointCloud(ctx, points, width, height, time, theme, 8, true);
    for (let ring = 0; ring < 3; ring += 1) { ctx.beginPath(); ctx.ellipse(center.x, center.y, globeRadius, globeRadius * (.3 + ring * .24), time * .04 + ring * .42, 0, Math.PI * 2); ctx.strokeStyle = alpha(palette[ring % palette.length] ?? '#38bdf8', .14); ctx.stroke(); }
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Operational Signal Fusion', 'device-to-fleet evidence fused into mission-level confidence', width, theme);
    ctx.restore();
  }

  private drawRaceOutcomeDistribution(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source: DataPoint[] = points.length ? points : Array.from({ length: 80 }, (_, index) => ({ x: index % 16, y: Math.floor(index / 16), z: Math.max(.08, Math.exp(-((((index % 16) - (4 + Math.floor(index / 16) * 1.6)) ** 2) / 12))) }));
    const palette = theme.palette.length ? theme.palette : ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
    ctx.save();
    source.forEach((point, index) => {
      const value = Number(point.z ?? point.y ?? 0);
      const base = this.project({ x: Number(point.x) * .55 - 4.2, y: Number(point.y) * .9 - 2.2, z: -1.2 }, width, height);
      const top = this.project({ x: Number(point.x) * .55 - 4.2, y: Number(point.y) * .9 - 2.2, z: -1.2 + value * 3.4 }, width, height);
      const color = toCssColor(point.color, palette[Math.floor(index / 16) % palette.length] ?? '#38bdf8');
      ctx.beginPath(); ctx.moveTo(base.x - 3, base.y); ctx.lineTo(base.x + 3, base.y); ctx.lineTo(top.x + 3, top.y); ctx.lineTo(top.x - 3, top.y); ctx.closePath();
      ctx.fillStyle = alpha(color, .42); ctx.strokeStyle = alpha(color, .82); ctx.fill(); ctx.stroke();
      if (value > .72) drawGlowPoint(ctx, top.x, top.y, 3.2 + Math.sin(time * 2 + index) * .4, color, .78);
    });
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Race Outcome Distributions', 'probability mass across finish position and scenario ensemble', width, theme);
    ctx.restore();
  }

  private drawBehaviorDrift(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source = points.length ? points : Array.from({ length: 72 }, (_, index) => ({ x: index / 8 - 4.4, y: Math.sin(index * .27) * .3, z: -1.6 + index * .055 + (index > 50 ? (index - 50) * .11 : 0) }));
    const projected = source.map(point => this.projectPointLike(point, width, height));
    ctx.save(); ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    const gradient = ctx.createLinearGradient(width * .2, 0, width * .8, 0); gradient.addColorStop(0, alpha(theme.palette[0] ?? '#38bdf8', .84)); gradient.addColorStop(.72, alpha(theme.palette[2] ?? '#f59e0b', .9)); gradient.addColorStop(1, alpha('#ef4444', .94));
    ctx.strokeStyle = gradient; ctx.lineWidth = 2.2; ctx.stroke();
    const leadIndex = Math.min(source.length - 1, Math.floor(source.length * .72)), lead = projected[leadIndex]!; drawGlowPoint(ctx, lead.x, lead.y, 6 + Math.sin(time * 2) * .8, '#f59e0b', .9);
    ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(width * .12, lead.y); ctx.lineTo(width * .88, lead.y); ctx.strokeStyle = alpha('#f59e0b', .38); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Behavior Drift Over Time', 'lead-signal identification before the forecast envelope breaks', width, theme);
    ctx.restore();
  }

  private drawControlEventTimeline(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source = points.length ? points : Array.from({ length: 8 }, (_, index) => ({ x: -4.5 + index * 1.3, y: 0, z: -.3 + (index % 3) * .45, label: `Control ${index + 1}` }));
    const projected = source.map(point => this.projectPointLike(point, width, height));
    ctx.save(); ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = alpha(theme.palette[0] ?? '#38bdf8', .58); ctx.lineWidth = 2; ctx.stroke();
    projected.forEach((point, index) => { const color = theme.palette[index % theme.palette.length] ?? '#38bdf8'; drawGlowPoint(ctx, point.x, point.y, 5.2, color, .84); ctx.fillStyle = alpha(theme.textColor as string, .72); ctx.font = '600 9px "Inter",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(source[index]?.label ?? `E${index + 1}`, point.x, point.y - 17); });
    const sweepIndex = Math.floor((time * 1.2) % source.length); if (projected[sweepIndex]) drawGlowPoint(ctx, projected[sweepIndex]!.x, projected[sweepIndex]!.y, 8, '#f59e0b', .76);
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Control Event Timeline', 'policy, contract, balance, and leadership decision windows', width, theme);
    ctx.restore();
  }

  private drawDeviceTelemetry(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source: DataPoint[] = points.length ? points : Array.from({ length: 144 }, (_, index) => { const channel = Math.floor(index / 24), sample = index % 24; return { x: sample * .38 - 4.4, y: channel * .72 - 1.8, z: Math.sin(sample * .48 + channel) * .42 + channel * .18 }; });
    const channels = new Map<number, DataPoint[]>(); source.forEach(point => { const channel = Math.round(readNumber(point.meta, 'channel') ?? Number(point.y ?? 0)); const row = channels.get(channel) ?? []; row.push(point); channels.set(channel, row); });
    ctx.save(); [...channels.entries()].forEach(([channel, row]) => { const projected = row.map(point => this.projectPointLike(point, width, height)); ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = alpha(theme.palette[channel % theme.palette.length] ?? '#38bdf8', .7); ctx.lineWidth = 1.5; ctx.stroke(); });
    const core = this.project({ x: 0, y: 0, z: 0 }, width, height); for (let ring = 0; ring < 4; ring += 1) { ctx.beginPath(); ctx.arc(core.x, core.y, 24 + ring * 13 + Math.sin(time * 1.5 + ring) * 3, 0, Math.PI * 2); ctx.strokeStyle = alpha(theme.palette[ring % theme.palette.length] ?? '#38bdf8', .16); ctx.stroke(); }
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Whole-Device Telemetry Learning', 'battery, memory, thermals, power, latency, and state learned together', width, theme);
    ctx.restore();
  }

  private drawMissionGauge(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const value = clamp(Number(this.getPoints()[0]?.y ?? this.getPoints()[0]?.z ?? 87), 0, 100);
    const center = { x: width * .5, y: height * .56 }, radius = Math.min(width, height) * .23, start = Math.PI * .78, span = Math.PI * 1.44;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(12, radius * .13); ctx.beginPath(); ctx.arc(center.x, center.y, radius, start, start + span); ctx.strokeStyle = alpha(theme.palette[0] ?? '#38bdf8', .14); ctx.stroke();
    const gradient = ctx.createLinearGradient(center.x - radius, 0, center.x + radius, 0); gradient.addColorStop(0, '#38bdf8'); gradient.addColorStop(.62, '#22c55e'); gradient.addColorStop(1, '#f59e0b'); ctx.beginPath(); ctx.arc(center.x, center.y, radius, start, start + span * value / 100); ctx.strokeStyle = gradient; ctx.stroke();
    const angle = start + span * value / 100, px = center.x + Math.cos(angle) * radius, py = center.y + Math.sin(angle) * radius; drawGlowPoint(ctx, px, py, 7 + Math.sin(time * 2) * .8, '#f8fafc', .92);
    ctx.fillStyle = toCssColor(theme.textColor, '#e2e8f0'); ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(28, radius * .38)}px "Inter",sans-serif`; ctx.fillText(`${Math.round(value)}%`, center.x, center.y + 8); ctx.font = '700 10px "Inter",sans-serif'; ctx.fillStyle = alpha(theme.textColor as string, .6); ctx.fillText(this.sceneType === 'deviceFleetHealth3d' ? 'FLEET HEALTH' : 'MISSION CONFIDENCE', center.x, center.y + 30);
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Mission Outcomes', 'confidence synthesized from cross-scale operational evidence', width, theme); ctx.restore();
  }

  private drawConnectedPointCloud(ctx: CanvasRenderingContext2D, points: DataPoint[], width: number, height: number, time: number, theme: ThemeConfig, skip: number, pulse: boolean, exponent = 1): void {
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22d3ee', '#a78bfa', '#f59e0b'];
    const projected = points.map((point) => this.projectPointLike(point, width, height));
    for (let index = 0; index < points.length; index += 1) {
      for (const target of [(index + 1) % points.length, (index + skip) % points.length]) {
        if (target === index || !projected[target]) continue;
        const weight = Math.pow(.26 + ((index * 17 + target * 11) % 70) / 100, exponent);
        ctx.beginPath(); ctx.moveTo(projected[index]!.x, projected[index]!.y); ctx.lineTo(projected[target]!.x, projected[target]!.y);
        ctx.strokeStyle = alpha(palette[index % palette.length] ?? '#38bdf8', .07 + weight * .34); ctx.lineWidth = .6 + weight * 1.1; ctx.stroke();
      }
    }
    points.map((point, index) => ({ point, index, projected: projected[index]! })).sort((a, b) => a.projected.depth - b.projected.depth).forEach(({ point, index, projected: p }) => {
      const color = toCssColor(point.color ?? readString(point.meta, 'color'), palette[index % palette.length] ?? '#38bdf8');
      const wave = pulse ? .5 + .5 * Math.sin(time * 1.7 + index * .43) : 0;
      drawGlowPoint(ctx, p.x, p.y, (2.2 + (readNumber(point.meta, 'size') ?? 1) * 1.7 + wave) * p.scale, color, .62 + wave * .24);
    });
  }

  private drawLaplacianFabricCone(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#a78bfa', '#f59e0b'];
    const origin = { x: -4.8, y: 0, z: 0 };
    const rings = Math.max(5, this.sceneConfig.layers ?? 7);
    const segments = 44;

    ctx.save();
    ctx.lineCap = 'round';
    this.drawLaplacianFabric(ctx, width, height, time, theme);

    for (let ring = 1; ring <= rings; ring += 1) {
      const t = ring / rings;
      const x = -4.2 + t * 8.6;
      const radiusY = 0.42 + t * 2.5;
      const radiusZ = 0.24 + t * 1.6;
      const color = palette[ring % palette.length] ?? '#38bdf8';
      const ringPoints: ProjectedPoint[] = [];
      for (let segment = 0; segment <= segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2;
        const wave = Math.sin(time * 1.6 + ring * 0.8 + segment * 0.22) * 0.05;
        ringPoints.push(this.project({ x, y: Math.cos(angle) * (radiusY + wave), z: Math.sin(angle) * radiusZ }, width, height));
      }
      ctx.beginPath();
      ringPoints.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.strokeStyle = alpha(color, 0.52);
      ctx.lineWidth = 1.1;
      ctx.stroke();

      if (ring % 2 === 1) {
        const projectedCenter = this.project({ x, y: 0, z: 0 }, width, height);
        for (let segment = 0; segment < segments; segment += 11) {
          const edge = ringPoints[segment]!;
          ctx.beginPath();
          ctx.moveTo(projectedCenter.x, projectedCenter.y);
          ctx.lineTo(edge.x, edge.y);
          ctx.strokeStyle = alpha(color, 0.14);
          ctx.stroke();
        }
      }
    }

    const projectedOrigin = this.project(origin, width, height);
    for (let ray = 0; ray < 16; ray += 1) {
      const angle = (ray / 16) * Math.PI * 2;
      const target = this.project({ x: 4.8, y: Math.cos(angle) * 3.1, z: Math.sin(angle) * 1.9 }, width, height);
      const rayGradient = ctx.createLinearGradient(projectedOrigin.x, projectedOrigin.y, target.x, target.y);
      rayGradient.addColorStop(0, alpha(palette[0] ?? '#38bdf8', 0.62));
      rayGradient.addColorStop(1, alpha(palette[2] ?? '#f59e0b', 0.08));
      ctx.beginPath();
      ctx.moveTo(projectedOrigin.x, projectedOrigin.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = rayGradient;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const particles = points.length ? points : buildDefaultConePoints();
    for (let index = 0; index < particles.length; index += 1) {
      const p = particles[index]!;
      const px = Number(p.x ?? 0);
      const py = Number(p.y ?? 0);
      const pz = Number(p.z ?? 0);
      const drift = Math.sin(time * 1.2 + index * 0.63) * 0.18;
      const projected = this.project({
        x: -4.4 + px * 8.8,
        y: py + drift,
        z: (pz / 10) - 0.8,
      }, width, height);
      const color = toCssColor(p.color, palette[index % palette.length] ?? '#38bdf8');
      drawGlowPoint(ctx, projected.x, projected.y, Math.max(2.5, 4.2 * projected.scale), color, 0.82);
    }

    const alphaValue = this.sceneConfig.alpha ?? 0.72;
    const title = this.config?.title?.text ?? 'Alpha-Laplacian Fabric Cones';
    this.drawSceneTitle(ctx, title, `alpha=${alphaValue.toFixed(2)} synthetic laplacian fabric with multi-horizon cones`, width, theme);
    ctx.restore();
  }

  private drawLaplacianFabric(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#a78bfa', '#f59e0b'];
    const alphaValue = this.sceneConfig.alpha ?? 0.72;
    const nodes: Array<Vec3 & { weight: number }> = [];
    const cols = 9;
    const rows = 7;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = -5.2 + (col / (cols - 1)) * 10.4;
        const y = -3.4 + (row / (rows - 1)) * 6.8;
        const radius = Math.hypot(x * 0.18, y * 0.22);
        const wave = Math.sin(time * 0.9 + col * 0.72) * 0.22 + Math.cos(time * 0.7 + row * 0.64) * 0.16;
        const laplacianLift = Math.cos((col - cols / 2) * (row - rows / 2) * 0.16) * alphaValue;
        nodes.push({ x, y, z: -1.05 + wave + laplacianLift * 0.42, weight: 1 / (1 + radius ** (1 + alphaValue)) });
      }
    }

    ctx.save();
    ctx.lineWidth = 0.85;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const nodeIndex = row * cols + col;
        const node = nodes[nodeIndex]!;
        const neighbors = [
          col < cols - 1 ? nodeIndex + 1 : -1,
          row < rows - 1 ? nodeIndex + cols : -1,
          col < cols - 1 && row < rows - 1 ? nodeIndex + cols + 1 : -1,
        ];
        for (const neighborIndex of neighbors) {
          if (neighborIndex < 0) continue;
          const neighbor = nodes[neighborIndex]!;
          const a = this.project(node, width, height);
          const b = this.project(neighbor, width, height);
          const edgeWeight = Math.pow((node.weight + neighbor.weight) * 0.5, alphaValue);
          const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          gradient.addColorStop(0, alpha(palette[0] ?? '#38bdf8', 0.08 + edgeWeight * 0.32));
          gradient.addColorStop(1, alpha(palette[1] ?? '#a78bfa', 0.08 + edgeWeight * 0.28));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = gradient;
          ctx.stroke();
        }
      }
    }

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]!;
      const projected = this.project(node, width, height);
      const color = palette[index % palette.length] ?? '#38bdf8';
      drawGlowPoint(ctx, projected.x, projected.y, 1.4 + node.weight * 3.2, color, 0.34 + node.weight * 0.38);
    }
    ctx.restore();
  }

  private drawLaserPointMap(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints().length ? this.getPoints() : buildDefaultLaserPoints();
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22c55e', '#f59e0b'];
    const baseColor = palette[0] ?? '#38bdf8';

    ctx.save();
    const ordered = points
      .map((point, index) => ({ point, index, projected: this.projectPointLike(point, width, height) }))
      .sort((a, b) => a.projected.depth - b.projected.depth);

    for (const entry of ordered) {
      const x = Number(entry.point.x ?? 0);
      const y = Number(entry.point.y ?? 0);
      const z = Number(entry.point.z ?? 0);
      const ground = this.project({ x, y, z: -1.2 }, width, height);
      const top = this.project({ x, y, z: z / 10 }, width, height);
      const color = toCssColor(entry.point.color, palette[entry.index % palette.length] ?? baseColor);
      ctx.beginPath();
      ctx.moveTo(ground.x, ground.y);
      ctx.lineTo(top.x, top.y);
      ctx.strokeStyle = alpha(color, 0.26);
      ctx.lineWidth = Math.max(1, 1.8 * top.scale);
      ctx.stroke();
      drawGlowPoint(ctx, top.x, top.y, Math.max(1.8, 3.8 * top.scale), color, 0.76);
    }

    const sweep = -5.4 + ((time * 1.3) % 1) * 10.8;
    const a = this.project({ x: sweep, y: -4.2, z: -1.2 }, width, height);
    const b = this.project({ x: sweep, y: 4.2, z: 2.6 }, width, height);
    const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, alpha(baseColor, 0));
    gradient.addColorStop(0.5, alpha(baseColor, 0.76));
    gradient.addColorStop(1, alpha(baseColor, 0));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();

    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Laser Point Mapping', 'point cloud returns, vertical intensity, and scan sweep', width, theme);
    ctx.restore();
  }

  private drawGeojsonExtrusion(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const groups = this.getPolygonGroups(theme);
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22c55e', '#f59e0b'];
    ctx.save();

    const sorted = groups.sort((a, b) => averageY(a.points) - averageY(b.points));
    for (const group of sorted) {
      this.drawExtrudedPolygon(ctx, group, width, height);
    }

    const routePoints = this.getPoints().filter((point) => readString(point.meta, 'kind') === 'route');
    const route = routePoints.length >= 2 ? routePoints : buildDefaultRoutePoints();
    ctx.beginPath();
    route.forEach((point, index) => {
      const projected = this.projectPointLike(point, width, height, 1.2 + Math.sin(time + index) * 0.08);
      if (index === 0) ctx.moveTo(projected.x, projected.y);
      else ctx.lineTo(projected.x, projected.y);
    });
    ctx.strokeStyle = alpha(palette[2] ?? '#f59e0b', 0.8);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    route.forEach((point, index) => {
      const projected = this.projectPointLike(point, width, height, 1.2 + Math.sin(time + index) * 0.08);
      drawGlowPoint(ctx, projected.x, projected.y, index === 0 || index === route.length - 1 ? 5 : 3, palette[index % palette.length] ?? '#38bdf8', 0.82);
    });

    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'GeoJSON / KML Extrusion', 'synthetic polygons, extruded zones, and route overlays', width, theme);
    ctx.restore();
  }

  private drawExtrudedPolygon(ctx: CanvasRenderingContext2D, group: PolygonGroup, width: number, height: number): void {
    if (group.points.length < 3) return;
    const top = group.points.map((point) => this.projectPointLike(point, width, height, group.height));
    const base = group.points.map((point) => this.projectPointLike(point, width, height, 0));

    for (let index = 0; index < group.points.length; index += 1) {
      const next = (index + 1) % group.points.length;
      ctx.beginPath();
      ctx.moveTo(base[index]!.x, base[index]!.y);
      ctx.lineTo(base[next]!.x, base[next]!.y);
      ctx.lineTo(top[next]!.x, top[next]!.y);
      ctx.lineTo(top[index]!.x, top[index]!.y);
      ctx.closePath();
      ctx.fillStyle = alpha(group.color, 0.18);
      ctx.strokeStyle = alpha(group.color, 0.34);
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    top.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = alpha(group.color, 0.28);
    ctx.strokeStyle = alpha(group.color, 0.74);
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();

    const centroid = centroid2D(top);
    ctx.fillStyle = alpha('#eaf6ff', 0.72);
    ctx.font = '700 10px "JetBrains Mono","Cascadia Code","Consolas",monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(group.label, centroid.x, centroid.y);
  }

  private drawSceneTitle(
    ctx: CanvasRenderingContext2D,
    title: string,
    subtitle: string,
    width: number,
    theme: ThemeConfig,
  ): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = toCssColor(theme.textColor, '#e2e8f0');
    ctx.font = '700 14px "Inter","Segoe UI",sans-serif';
    ctx.fillText(title, width * 0.5, 16);
    ctx.fillStyle = alpha(theme.textColor as string, 0.62);
    ctx.font = '600 10px "Inter","Segoe UI",sans-serif';
    ctx.fillText(subtitle, width * 0.5, 38);
    ctx.restore();
  }

  private projectPointLike(point: DataPoint, width: number, height: number, zOverride?: number): ProjectedPoint {
    return this.project({
      x: Number(point.x ?? 0),
      y: Number(point.y ?? 0),
      z: zOverride ?? Number(point.z ?? 0),
    }, width, height);
  }

  private project(point: Vec3, width: number, height: number): ProjectedPoint {
    const yaw = this.sceneConfig.initialAzimuth ?? this.yaw;
    const pitch = this.sceneConfig.initialPolar ?? this.pitch;
    const zoom = this.sceneConfig.zoom ?? this.zoom;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const x1 = point.x * cosY - point.y * sinY;
    const y1 = point.x * sinY + point.y * cosY;
    const z1 = point.z;
    const y2 = y1 * cosP - z1 * sinP;
    const z2 = y1 * sinP + z1 * cosP;
    const distance = this.sceneConfig.initialDistance ?? 11;
    const scale = (distance / (distance + y2)) * zoom;
    const screenScale = Math.min(width, height) * 0.055;
    return {
      x: width * 0.5 + x1 * screenScale * scale,
      y: height * 0.62 - z2 * screenScale * scale,
      scale,
      depth: y2,
    };
  }

  private getPoints(): DataPoint[] {
    return this.series.flatMap((series) => series.data);
  }

  private getPolygonGroups(theme: ThemeConfig): PolygonGroup[] {
    const points = this.getPoints();
    const polygonPoints = points.filter((point) => readString(point.meta, 'kind') === 'polygon');
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22c55e', '#f59e0b'];
    const source = polygonPoints.length ? polygonPoints : buildDefaultPolygonPoints();
    const byGroup = new Map<string, PolygonGroup>();
    for (let index = 0; index < source.length; index += 1) {
      const point = source[index]!;
      const groupId = readString(point.meta, 'group') ?? `zone-${Math.floor(index / 4) + 1}`;
      const label = readString(point.meta, 'label') ?? groupId.toUpperCase();
      const existing = byGroup.get(groupId);
      if (existing) {
        existing.points.push(point);
        continue;
      }
      byGroup.set(groupId, {
        id: groupId,
        label,
        height: readNumber(point.meta, 'height') ?? Number(point.z ?? 1.2),
        color: toCssColor(point.color, palette[byGroup.size % palette.length] ?? '#38bdf8'),
        points: [point],
      });
    }
    return [...byGroup.values()];
  }

  private sceneLabel(): string {
    switch (this.sceneType) {
      case 'temporalGraphState3d': return 'Temporal graph state';
      case 'alphaLaplacianGraph3d': return 'Alpha-Laplacian graph';
      case 'powerwalkGraph3d': return 'Predictive powerwalk';
      case 'spectralSurface3d': return 'Spectral surface';
      case 'graphManifold3d': return 'Graph manifold';
      case 'forecastCone3d': return 'Structured forecast cone';
      case 'operationalSignalFusion3d': return 'Operational signal fusion';
      case 'weatherDisasterSignalMap3d': return 'Weather & disaster signal map';
      case 'raceOutcomeDistribution3d': return 'Race outcome distribution';
      case 'behaviorDrift3d': return 'Behavior drift';
      case 'controlEventTimeline3d': return 'Control event timeline';
      case 'deviceTelemetryLearning3d': return 'Whole-device telemetry learning';
      case 'crossScaleIntelligence3d': return 'Cross-scale intelligence';
      case 'deviceFleetHealth3d': return 'Device fleet health';
      case 'missionOutcomes3d': return 'Mission outcomes';
      case 'laserPointMap3d':
        return 'Laser point map';
      case 'geojsonExtrusion3d':
        return 'GeoJSON / KML extrusion';
      case 'laplacianFabricCone3d':
      default:
        return 'Alpha-Laplacian fabric cones';
    }
  }

  private applyThemeStyles(): void {
    const theme = this.theme;
    if (!theme) return;
    const border = toCssColor(theme.colors?.border ?? theme.tooltip.borderColor, '#334155');
    this.root.style.border = `1px solid ${alpha(border, 0.32)}`;
    this.root.style.boxShadow = [
      `inset 0 0 0 1px ${alpha(theme.palette[0] ?? '#38bdf8', 0.12)}`,
      `0 24px 80px ${alpha(theme.palette[0] ?? '#38bdf8', 0.10)}`,
    ].join(',');
  }

  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    this.pointerDown = true;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.canvas.style.cursor = 'grabbing';
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.pointerDown) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.yaw += dx * 0.008;
    this.pitch = clamp(this.pitch + dy * 0.006, 0.2, 1.24);
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    this.pointerDown = false;
    this.canvas.style.cursor = 'grab';
    this.canvas.releasePointerCapture?.(event.pointerId);
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoom = clamp(this.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.62, 2.2);
  };

  private readonly handleDoubleClick = () => {
    this.yaw = -0.55;
    this.pitch = 0.64;
    this.zoom = 1;
  };
}

function isChallenge3DChartType(value: string | undefined): value is Challenge3DChartType {
  return !!value && CHALLENGE_3D_TYPE_SET.has(value);
}

function buildTemporalStatePoints(): DataPoint[] {
  return Array.from({ length: 40 }, (_, index) => {
    const slice = Math.floor(index / 10), state = index % 10, angle = state / 10 * Math.PI * 2 + slice * .24;
    return { id: `t${slice}-s${state}`, x: Math.cos(angle) * (2.6 + slice * .38), y: Math.sin(angle) * (2.6 + slice * .38), z: -2.4 + slice * 1.6, label: `T${slice}/S${state}`, meta: { slice, confidence: 0.94 - slice * .06 + state * .003, size: state === slice + 2 ? 1.8 : 1 } };
  });
}

function buildAlphaGraphPoints(): DataPoint[] {
  return Array.from({ length: 45 }, (_, index) => { const ring = 1 + index % 5, angle = index * 2.399963; return { id: `a${index}`, x: Math.cos(angle) * ring, y: Math.sin(angle) * ring, z: Math.cos(angle * .7) * 1.7, label: `L${index}`, meta: { alpha: .72, eigenvalue: .03 + index * .011, size: 1 + index % 6 * .12 } }; });
}

function buildPowerwalkPoints(): DataPoint[] {
  return Array.from({ length: 36 }, (_, index) => { const angle = index / 36 * Math.PI * 2, radius = 3.2 + Math.sin(index * .71) * 1.7; return { id: `p${index}`, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: Math.sin(index * .43) * 2.3, label: `P${index}`, meta: { probability: .96 - index * .014, impact: .2 + index % 11 * .07, size: index % 8 === 0 ? 1.8 : 1 } }; });
}

function buildSpectralSurfacePoints(): DataPoint[] {
  const size = 24;
  return Array.from({ length: size * size }, (_, index) => { const col = index % size, row = Math.floor(index / size), x = (col / (size - 1) - .5) * 9, y = (row / (size - 1) - .5) * 7; const z = 3.6 * Math.exp(-((x - 1.8) ** 2 + (y + .8) ** 2) / 2.2) + 2.8 * Math.exp(-((x + 2.1) ** 2 + (y - 1.4) ** 2) / 1.4) + Math.sin(x * 1.8) * Math.cos(y * 1.5) * .35; return { x, y, z, meta: { gridWidth: size, mode: z > 2 ? 'dominant' : 'residual' } }; });
}

function buildManifoldPoints(): DataPoint[] {
  return Array.from({ length: 60 }, (_, index) => { const u = index / 60 * Math.PI * 2, v = (index % 12) / 12 * Math.PI * 2; return { id: `m${index}`, x: (4.1 + 1.35 * Math.cos(v)) * Math.cos(u), y: (4.1 + 1.35 * Math.cos(v)) * Math.sin(u), z: 1.35 * Math.sin(v), label: `M${index}`, meta: { curvature: .14 + index % 13 * .027, size: index % 12 === 0 ? 1.7 : 1 } }; });
}

function buildSignalFusionPoints(): DataPoint[] {
  const sources = ['ISR', 'Comms', 'Logistics', 'Environment', 'Cyber', 'Human intel'];
  return Array.from({ length: 48 }, (_, index) => { const phi = Math.acos(1 - 2 * (index + .5) / 48), theta = Math.PI * (1 + Math.sqrt(5)) * index; return { id: `s${index}`, x: 4.5 * Math.sin(phi) * Math.cos(theta), y: 4.5 * Math.sin(phi) * Math.sin(theta), z: 4.5 * Math.cos(phi), label: `${sources[index % sources.length]} ${index + 1}`, meta: { source: sources[index % sources.length], confidence: .68 + index % 29 / 100, contribution: .12 + index % 17 * .031, size: index % 9 === 0 ? 1.8 : 1 } }; });
}

function buildDefaultConePoints(): DataPoint[] {
  return Array.from({ length: 42 }, (_, index) => {
    const t = index / 41;
    const angle = index * 1.618;
    const radius = 0.24 + t * 2.6;
    return {
      x: t,
      y: Math.cos(angle) * radius,
      z: 2 + Math.sin(angle) * radius * 1.6,
      label: `h${index}`,
    };
  });
}

function buildDefaultLaserPoints(): DataPoint[] {
  const points: DataPoint[] = [];
  for (let row = 0; row < 15; row += 1) {
    for (let col = 0; col < 18; col += 1) {
      const x = -5 + (col / 17) * 10;
      const y = -3.8 + (row / 14) * 7.6;
      const mound = Math.exp(-((x - 1.2) ** 2 + (y + 0.6) ** 2) / 7.5) * 12;
      const ridge = Math.sin(col * 0.65) * Math.cos(row * 0.42) * 2.4;
      points.push({ x, y, z: 1 + mound + ridge });
    }
  }
  return points;
}

function buildDefaultPolygonPoints(): DataPoint[] {
  return [
    polygonPoint('sector-a', 'SECTOR A', -4.6, -2.6, 1.1, 0),
    polygonPoint('sector-a', 'SECTOR A', -1.6, -2.2, 1.1, 1),
    polygonPoint('sector-a', 'SECTOR A', -1.2, 0.5, 1.1, 2),
    polygonPoint('sector-a', 'SECTOR A', -4.1, 0.2, 1.1, 3),
    polygonPoint('sector-b', 'SECTOR B', 0.2, -2.8, 1.8, 0),
    polygonPoint('sector-b', 'SECTOR B', 3.6, -2.1, 1.8, 1),
    polygonPoint('sector-b', 'SECTOR B', 3.0, 1.1, 1.8, 2),
    polygonPoint('sector-b', 'SECTOR B', -0.2, 0.4, 1.8, 3),
    polygonPoint('sector-c', 'SECTOR C', -2.6, 1.1, 1.35, 0),
    polygonPoint('sector-c', 'SECTOR C', 1.2, 1.2, 1.35, 1),
    polygonPoint('sector-c', 'SECTOR C', 2.0, 3.5, 1.35, 2),
    polygonPoint('sector-c', 'SECTOR C', -3.3, 3.1, 1.35, 3),
  ];
}

function buildDefaultRoutePoints(): DataPoint[] {
  return [
    { x: -4.4, y: -2.2, z: 1.1, meta: { kind: 'route' } },
    { x: -2.1, y: -0.8, z: 1.3, meta: { kind: 'route' } },
    { x: 0.4, y: 0.5, z: 1.2, meta: { kind: 'route' } },
    { x: 2.8, y: 1.8, z: 1.4, meta: { kind: 'route' } },
    { x: 4.2, y: 3.0, z: 1.2, meta: { kind: 'route' } },
  ];
}

function polygonPoint(group: string, label: string, x: number, y: number, height: number, order: number): DataPoint {
  return {
    x,
    y,
    z: height,
    meta: { kind: 'polygon', group, label, height, order },
  };
}

function drawGlowPoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number,
): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4.8);
  glow.addColorStop(0, alpha('#ffffff', opacity));
  glow.addColorStop(0.22, alpha(color, opacity * 0.82));
  glow.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', opacity);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.2, radius * 0.42), 0, Math.PI * 2);
  ctx.fill();
}

function averageY(points: DataPoint[]): number {
  return points.reduce((sum, point) => sum + Number(point.y ?? 0), 0) / Math.max(1, points.length);
}

function centroid2D(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / Math.max(1, points.length), y: sum.y / Math.max(1, points.length) };
}

function readString(meta: DataPoint['meta'], key: string): string | undefined {
  const value = meta?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(meta: DataPoint['meta'], key: string): number | undefined {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toCssColor(color: ColorValue | undefined, fallback: string): string {
  if (!color) return fallback;
  if (typeof color === 'string') return color;
  if (typeof (color as GradientDef).type === 'string') {
    return (color as GradientDef).stops[0]?.color ?? fallback;
  }
  const rgba = color as { r: number; g: number; b: number; a?: number };
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a ?? 1})`;
}

function alpha(color: string, opacity: number): string {
  const parsed = parseColor(color);
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${clamp(opacity, 0, 1)})`;
}

function parseColor(color: string): { r: number; g: number; b: number } {
  const value = color.trim();
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }
  const match = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (match) {
    const parts = match[1]!.split(',').map((part) => Number.parseFloat(part.trim()));
    return {
      r: clamp(Math.round(parts[0] ?? 255), 0, 255),
      g: clamp(Math.round(parts[1] ?? 255), 0, 255),
      b: clamp(Math.round(parts[2] ?? 255), 0, 255),
    };
  }
  return { r: 255, g: 255, b: 255 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
