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
  'transactionFlowAnomaly3d',
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

export interface Challenge3DHitCandidate {
  x: number;
  y: number;
  radius: number;
  depth?: number;
  visible?: boolean;
}

interface Challenge3DHitTarget extends Challenge3DHitCandidate {
  point: DataPoint;
  pointIndex: number;
  seriesId: string;
  seriesName: string;
}

interface Challenge3DPointSource {
  point: DataPoint;
  pointIndex: number;
  seriesId: string;
  seriesName: string;
}

interface PolygonGroup {
  id: string;
  label: string;
  height: number;
  color: string;
  points: DataPoint[];
}

const CHALLENGE_3D_TYPE_SET = new Set<string>(CHALLENGE_3D_CHART_TYPES);

/**
 * Return the closest visible 3D mark under a chart-relative pointer.
 * Distances are normalized by each mark's hit radius so larger rendered marks
 * remain easier to target without unfairly masking a smaller nearby mark.
 */
export function findChallenge3DHitTarget(
  candidates: readonly Challenge3DHitCandidate[],
  x: number,
  y: number,
): number {
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestDepth = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    if (candidate.visible === false || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) continue;
    const radius = Math.max(4, candidate.radius);
    const dx = candidate.x - x;
    const dy = candidate.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) continue;
    const score = distance / radius;
    const depth = candidate.depth ?? 0;
    if (score < bestScore - 0.025 || (Math.abs(score - bestScore) <= 0.025 && depth > bestDepth)) {
      bestIndex = index;
      bestScore = score;
      bestDepth = depth;
    }
  }

  return bestIndex;
}

export class Challenge3DScene {
  private readonly host: HTMLElement;
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLDivElement;
  private readonly tooltipCard: HTMLDivElement;
  private readonly bus: EventBus;
  private ctx: CanvasRenderingContext2D | null = null;
  private chartArea: Rect = { x: 0, y: 0, width: 400, height: 300 };
  private theme: ThemeConfig | null = null;
  private config: ChartConfig | null = null;
  private chartState: ChartState | null = null;
  private sceneConfig: Challenge3DConfig = {};
  private series: ProcessedSeries[] = [];
  private sceneType: Challenge3DChartType = 'laplacianFabricCone3d';
  private frameHandle = 0;
  private pointerDown = false;
  private movedWhileDown = false;
  private lastPointer = { x: 0, y: 0 };
  private pointerStart = { x: 0, y: 0 };
  private localPointer = { x: 0, y: 0 };
  private hoveredIndex = -1;
  private selectedIndex = -1;
  private hitTargets: Challenge3DHitTarget[] = [];
  private cameraSignature = '';
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
    this.canvas.setAttribute('aria-label', 'Interactive 3D analytical chart. Drag to orbit, use the mouse wheel to zoom, and select marks for details.');
    this.canvas.tabIndex = 0;
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

    this.tooltipCard = document.createElement('div');
    this.tooltipCard.setAttribute('role', 'tooltip');
    this.tooltipCard.setAttribute('aria-hidden', 'true');
    this.tooltipCard.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'width:220px',
      'max-width:calc(100% - 16px)',
      'padding:10px 12px',
      'border-radius:10px',
      'pointer-events:none',
      'opacity:0',
      'transform:translateY(4px)',
      'transition:opacity 100ms ease,transform 100ms ease',
      'z-index:24',
      'font:500 11px/1.45 "Inter","Segoe UI",sans-serif',
      'backdrop-filter:blur(14px)',
      'box-sizing:border-box',
    ].join(';');
    this.root.appendChild(this.tooltipCard);

    this.attachEvents();
    this.host.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d');
  }

  update(ctx: Challenge3DRenderContext): void {
    this.theme = ctx.theme;
    this.config = ctx.config;
    this.chartState = ctx.state;
    this.sceneConfig = ctx.config.challenge3d ?? {};
    this.series = ctx.series;
    const nextType = ctx.series.find((series) => CHALLENGE_3D_TYPE_SET.has(series.type))?.type;
    if (isChallenge3DChartType(nextType)) this.sceneType = nextType;
    this.applyInitialCamera();
    const pointCount = this.series.reduce((sum, series) => sum + series.data.length, 0);
    if (this.hoveredIndex >= pointCount) this.hoveredIndex = -1;
    if (this.selectedIndex >= pointCount) this.clearSelection();
    this.resize(ctx.state.chartArea);
    this.applyThemeStyles();
    this.overlay.innerHTML = [
      `<span>${escapeHtml(this.sceneLabel())}</span>`,
      `<span>${this.series.reduce((sum, series) => sum + series.data.length, 0)} pts</span>`,
    ].join('');

    // Produce the first frame immediately so background tabs, throttled rAF,
    // and freshly laid-out previews do not remain blank until interaction.
    this.renderFrame(performance.now() * 0.001);
    this.requestRender();
  }

  resize(chartArea: Rect): void {
    this.chartArea = chartArea;
    this.root.style.left = `${chartArea.x}px`;
    this.root.style.top = `${chartArea.y}px`;
    this.root.style.width = `${chartArea.width}px`;
    this.root.style.height = `${chartArea.height}px`;

    const width = Math.max(1, Math.floor(chartArea.width));
    const height = Math.max(1, Math.floor(chartArea.height));
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
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
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    this.root.remove();
  }

  private readonly frame = (time: number) => {
    this.frameHandle = 0;
    if (!this.root.isConnected || this.chartArea.width <= 1 || this.chartArea.height <= 1) return;
    this.renderFrame(time * 0.001);
  };

  private requestRender(): void {
    if (!this.frameHandle) this.frameHandle = requestAnimationFrame(this.frame);
  }

  private renderFrame(time: number): void {
    const ctx = this.ctx;
    const theme = this.theme;
    if (!ctx || !theme) return;

    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    const width = Math.max(1, this.chartArea.width);
    const height = Math.max(1, this.chartArea.height);
    this.root.dataset.cameraState = `${this.yaw.toFixed(4)},${this.pitch.toFixed(4)},${this.zoom.toFixed(4)}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    this.drawBackground(ctx, width, height, theme);
    if (this.sceneType !== 'weatherDisasterSignalMap3d') {
      this.drawFloor(ctx, width, height, time, theme);
      this.drawSceneAxes(ctx, width, height, theme);
    }

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
        this.drawWeatherDisasterSignalMap(ctx, width, height, time, theme);
        break;
      case 'crossScaleIntelligence3d':
        this.drawOperationalSignalFusion(ctx, width, height, time, theme);
        break;
      case 'raceOutcomeDistribution3d':
        this.drawRaceOutcomeDistribution(ctx, width, height, time, theme);
        break;
      case 'behaviorDrift3d':
        this.drawBehaviorDrift(ctx, width, height, time, theme);
        break;
      case 'transactionFlowAnomaly3d':
        this.drawTransactionFlow(ctx, width, height, time, theme);
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

    this.updateHitTargets(width, height, time);
    this.drawInteractionState(ctx, theme);
    this.updateTooltipCard();
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

  private drawSceneAxes(ctx: CanvasRenderingContext2D, width: number, height: number, theme: ThemeConfig): void {
    const axisLabels: Partial<Record<Challenge3DChartType, [string, string, string]>> = {
      spectralSurface3d: ['CHANNEL', 'MODE INDEX', 'ENERGY'],
      forecastCone3d: ['HORIZON', 'SCENARIO', 'CONFIDENCE'],
      weatherDisasterSignalMap3d: ['LONGITUDE', 'LATITUDE', 'INTENSITY'],
      raceOutcomeDistribution3d: ['FINISH POSITION', 'SCENARIO', 'PROBABILITY'],
      behaviorDrift3d: ['TIME', 'BEHAVIOR', 'DEVIATION'],
      transactionFlowAnomaly3d: ['TIME WINDOW', 'EVIDENCE LANE', 'DEVIATION'],
      controlEventTimeline3d: ['TIME', 'CONTROL', 'STATE'],
      deviceTelemetryLearning3d: ['SAMPLE', 'CHANNEL', 'HEALTH'],
    };
    const configuredAxes = this.sceneConfig.axes;
    const formatAxis = (axis: { label: string; unit?: string }) => `${axis.label}${axis.unit ? ` (${axis.unit})` : ''}`.toUpperCase();
    const labels: [string, string, string] | undefined = configuredAxes
      ? [formatAxis(configuredAxes.x), formatAxis(configuredAxes.y), formatAxis(configuredAxes.z)]
      : axisLabels[this.sceneType];
    // Network, topology, manifold, and anomaly scenes are not Cartesian plots.
    // Without an explicit display contract for axis semantics, drawing generic
    // X/Y/Z labels is misleading, so those scenes intentionally have no axes.
    if (!labels) return;
    const origin = this.project({ x: -4.8, y: -3.2, z: -2.3 }, width, height);
    const ends = [
      this.project({ x: 5.1, y: -3.2, z: -2.3 }, width, height),
      this.project({ x: -4.8, y: 3.6, z: -2.3 }, width, height),
      this.project({ x: -4.8, y: -3.2, z: 3.2 }, width, height),
    ];
    ctx.save();
    ctx.font = '700 9px "JetBrains Mono", "Cascadia Code", monospace';
    ctx.textBaseline = 'middle';
    ends.forEach((end, index) => {
      const color = theme.palette[index % Math.max(1, theme.palette.length)] ?? '#38bdf8';
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = alpha(color, 0.54); ctx.lineWidth = 1.15; ctx.shadowColor = alpha(color, 0.55); ctx.shadowBlur = 8; ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = alpha('#e6f5ff', 0.72);
      ctx.fillText(labels[index]!, end.x + (index === 1 ? -8 : 8), end.y + (index === 2 ? -8 : 8));
    });
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
    const modeCount = 6;
    for (let mode = 0; mode < modeCount; mode += 1) {
      const row = Math.min(rows - 1, Math.round((mode + 1) * (rows - 1) / (modeCount + 1)));
      const samples = points.slice(row * cols, row * cols + cols);
      const color = palette[mode % palette.length] ?? '#38bdf8';
      const top = samples.map((point, col) => this.project({
        x: Number(point.x ?? col),
        y: -2.8 + mode * 1.08,
        z: Number(point.z ?? 0) * 0.72 + Math.sin(time * 0.55 + mode) * 0.04,
      }, width, height));
      const base = samples.map((point, col) => this.project({ x: Number(point.x ?? col), y: -2.8 + mode * 1.08, z: -0.32 }, width, height));
      if (top.length < 2) continue;
      ctx.beginPath();
      top.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      [...base].reverse().forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      const ribbon = ctx.createLinearGradient(0, Math.min(...top.map((point) => point.y)), 0, Math.max(...base.map((point) => point.y)));
      ribbon.addColorStop(0, alpha(color, 0.54)); ribbon.addColorStop(1, alpha(color, 0.035));
      ctx.fillStyle = ribbon; ctx.shadowColor = alpha(color, 0.74); ctx.shadowBlur = 16; ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = alpha(color, 0.88); ctx.lineWidth = 1.5; ctx.stroke();
      top.filter((_, index) => index % 5 === 0).forEach((point) => drawGlowPoint(ctx, point.x, point.y, 2.4, color, 0.8));
    }
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
    const points = this.getPoints();
    if (!points.length) {
      this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Structured Forecast Cones', 'no forecast geometry available', width, theme);
      return;
    }

    const grouped = new Map<number, DataPoint[]>();
    points.forEach((point) => {
      const horizon = readNumber(point.meta, 'horizon');
      if (horizon === undefined) return;
      const ring = grouped.get(horizon) ?? [];
      ring.push(point);
      grouped.set(horizon, ring);
    });
    const rings = [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([horizon, ring]) => ({
        horizon,
        points: ring.sort((a, b) => (readNumber(a.meta, 'ringIndex') ?? 0) - (readNumber(b.meta, 'ringIndex') ?? 0)),
        confidence: ring.reduce((sum, point) => sum + (readNumber(point.meta, 'confidence') ?? 0), 0) / Math.max(1, ring.length),
      }))
      .filter((ring) => ring.points.length >= 3);
    if (!rings.length) return;

    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#a78bfa', '#f59e0b'];
    const primary = palette[0] ?? '#38bdf8';
    const forecast = palette[1] ?? '#a78bfa';
    const decision = palette[2] ?? '#f59e0b';
    const horizonValues = points.map((point) => Number(point.x ?? 0));
    const horizonCenter = (Math.min(...horizonValues) + Math.max(...horizonValues)) / 2;
    const projectForecastPoint = (point: DataPoint) => this.project({
      x: Number(point.x ?? 0) - horizonCenter,
      y: Number(point.y ?? 0),
      z: Number(point.z ?? 0),
    }, width, height);
    const minSegments = Math.min(...rings.map((ring) => ring.points.length));
    const railStep = Math.max(1, Math.ceil(minSegments / 10));
    const centers = rings.map((ring) => {
      const center = ring.points.reduce<Vec3>((sum, point) => ({
        x: sum.x + Number(point.x ?? 0),
        y: sum.y + Number(point.y ?? 0),
        z: sum.z + Number(point.z ?? 0),
      }), { x: 0, y: 0, z: 0 });
      return {
        ...ring,
        center: {
          x: center.x / ring.points.length,
          y: center.y / ring.points.length,
          z: center.z / ring.points.length,
        },
      };
    });

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Confidence slices are the actual JSON rings, not an illustrative cone primitive.
    centers.forEach((ring, index) => {
      const projected = ring.points.map(projectForecastPoint);
      const progress = centers.length > 1 ? index / (centers.length - 1) : 0;
      const color = progress < 0.55 ? primary : (progress < 0.84 ? forecast : decision);
      const confidenceAlpha = clamp(0.1 + ring.confidence * 0.34, 0.12, 0.46);
      ctx.beginPath();
      projected.forEach((point, pointIndex) => pointIndex ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      if (index > 0) {
        ctx.fillStyle = alpha(color, confidenceAlpha * 0.11);
        ctx.fill();
      }
      ctx.strokeStyle = alpha(color, confidenceAlpha + (index % 3 === 0 ? 0.22 : 0.06));
      ctx.lineWidth = index % 3 === 0 ? 1.45 : 0.85;
      ctx.stroke();
    });

    // Longitudinal rails connect identical scenario samples across horizons.
    for (let segment = 0; segment < minSegments; segment += railStep) {
      ctx.beginPath();
      centers.forEach((ring, ringIndex) => {
        const projected = projectForecastPoint(ring.points[segment]!);
        if (ringIndex > 0) ctx.lineTo(projected.x, projected.y);
        else ctx.moveTo(projected.x, projected.y);
      });
      ctx.strokeStyle = alpha(forecast, 0.28);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    const projectedCenters = centers.map((ring) => this.project({ ...ring.center, x: ring.center.x - horizonCenter }, width, height));
    ctx.beginPath();
    projectedCenters.forEach((point, index) => {
      if (index > 0) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
    });
    ctx.strokeStyle = alpha(decision, 0.82);
    ctx.lineWidth = 2.2;
    ctx.shadowColor = alpha(decision, 0.58);
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const markerStep = Math.max(1, Math.floor((centers.length - 1) / 4));
    centers.forEach((ring, index) => {
      if (index % markerStep !== 0 && index !== centers.length - 1) return;
      const point = projectedCenters[index]!;
      const pulse = index === centers.length - 1 ? Math.sin(time * 1.6) * 0.35 : 0;
      drawGlowPoint(ctx, point.x, point.y, 3.2 + pulse, index === 0 ? primary : decision, 0.88);
      ctx.fillStyle = alpha(theme.textColor as string, 0.74);
      ctx.font = '700 9px "Inter",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`H+${ring.horizon}  ${Math.round(ring.confidence * 100)}%`, point.x, point.y - 12);
    });

    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Structured Forecast Cones', 'confidence slices across forecast horizon and scenario spread', width, theme);
    ctx.restore();
  }

  private drawOperationalSignalFusion(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const points = source.length ? source : buildSignalFusionPoints();
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22d3ee', '#f59e0b'];
    const bySource = new Map<string, DataPoint[]>();
    points.forEach((point) => {
      const sourceName = readString(point.meta, 'source') ?? readString(point.meta, 'scale') ?? 'Evidence';
      const track = bySource.get(sourceName) ?? [];
      track.push(point);
      bySource.set(sourceName, track);
    });
    const sourceNames = [...bySource.keys()];
    const fusionCycles = Array.from({ length: Math.ceil(points.length / Math.max(1, sourceNames.length)) }, (_, cycle) => {
      const observations = points.slice(cycle * sourceNames.length, (cycle + 1) * sourceNames.length);
      const totalWeight = observations.reduce((sum, point) => sum + (readNumber(point.meta, 'confidence') ?? 0.5), 0);
      const center = observations.reduce<Vec3>((sum, point) => {
        const weight = readNumber(point.meta, 'confidence') ?? 0.5;
        return {
          x: sum.x + Number(point.x ?? 0) * weight,
          y: sum.y + Number(point.y ?? 0) * weight,
          z: sum.z + Number(point.z ?? 0) * weight,
        };
      }, { x: 0, y: 0, z: 0 });
      return {
        observations,
        confidence: totalWeight / Math.max(1, observations.length),
        center: {
          x: center.x / Math.max(0.001, totalWeight),
          y: center.y / Math.max(0.001, totalWeight),
          z: center.z / Math.max(0.001, totalWeight),
        },
      };
    }).filter((cycle) => cycle.observations.length > 0);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Every fusion node is a confidence-weighted centroid of one complete JSON observation cycle.
    fusionCycles.forEach((cycle, cycleIndex) => {
      const fused = this.project(cycle.center, width, height);
      cycle.observations.forEach((point) => {
        const observed = this.projectPointLike(point, width, height);
        ctx.beginPath();
        ctx.moveTo(observed.x, observed.y);
        ctx.lineTo(fused.x, fused.y);
        const fusionAlpha = this.sceneType === 'crossScaleIntelligence3d'
          ? 0.025 + cycle.confidence * 0.055
          : 0.08 + cycle.confidence * 0.12;
        ctx.strokeStyle = alpha(palette[cycleIndex % palette.length] ?? '#38bdf8', fusionAlpha);
        ctx.lineWidth = this.sceneType === 'crossScaleIntelligence3d' ? 0.5 : 0.65;
        ctx.stroke();
      });
    });

    [...bySource.entries()].forEach(([sourceName, track], sourceIndex) => {
      const color = palette[sourceIndex % palette.length] ?? '#38bdf8';
      const projected = track.map((point) => this.projectPointLike(point, width, height));
      ctx.beginPath();
      projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = alpha(color, this.sceneType === 'crossScaleIntelligence3d' ? 0.42 : 0.58);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      projected.forEach((point, index) => {
        const confidence = readNumber(track[index]!.meta, 'confidence') ?? 0.5;
        drawGlowPoint(
          ctx,
          point.x,
          point.y,
          1.4 + confidence * (this.sceneType === 'crossScaleIntelligence3d' ? 1.25 : 1.8),
          color,
          (this.sceneType === 'crossScaleIntelligence3d' ? 0.32 : 0.46) + confidence * 0.34,
        );
      });
    });

    const legendWidth = Math.min(width * 0.72, sourceNames.length * 112);
    sourceNames.forEach((sourceName, sourceIndex) => {
      const x = width * 0.5 - legendWidth * 0.5 + sourceIndex * (legendWidth / sourceNames.length) + 6;
      const color = palette[sourceIndex % palette.length] ?? '#38bdf8';
      drawGlowPoint(ctx, x, 59, 2.2, color, 0.8);
      ctx.fillStyle = alpha(theme.textColor as string, 0.68);
      ctx.font = '700 8px "Inter",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sourceName.toUpperCase(), x + 8, 56);
    });

    const fusedPath = fusionCycles.map((cycle) => this.project(cycle.center, width, height));
    ctx.beginPath();
    fusedPath.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = alpha(theme.textColor as string, 0.72);
    ctx.lineWidth = 2.4;
    ctx.shadowColor = alpha(palette[0] ?? '#38bdf8', 0.62);
    ctx.shadowBlur = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    fusionCycles.forEach((cycle, index) => {
      const point = fusedPath[index]!;
      const isCurrent = index === fusionCycles.length - 1;
      drawGlowPoint(ctx, point.x, point.y, (isCurrent ? 4.2 : 2.5) + (isCurrent ? Math.sin(time * 1.7) * 0.3 : 0), isCurrent ? (palette[2] ?? '#f59e0b') : (theme.textColor as string), 0.84);
    });

    this.drawSceneTitle(
      ctx,
      this.config?.title?.text ?? (this.sceneType === 'crossScaleIntelligence3d' ? 'Cross-Scale Intelligence' : 'Operational Signal Fusion'),
      this.sceneType === 'crossScaleIntelligence3d'
        ? 'device, fleet, regional, and global evidence converge by adaptation cycle'
        : 'source tracks converge into confidence-weighted fusion cycles',
      width,
      theme,
    );
    ctx.restore();
  }

  private drawWeatherDisasterSignalMap(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#f59e0b', '#ef4444', '#a78bfa'];
    const hazards = [...new Set(points.map((point) => readString(point.meta, 'hazard') ?? 'Signal'))];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let latitude = -60; latitude <= 60; latitude += 20) {
      const ring: ProjectedPoint[] = [];
      for (let longitude = -180; longitude <= 180; longitude += 8) {
        ring.push(this.projectSpherical(longitude, latitude, 3.15, width, height));
      }
      ctx.beginPath();
      ring.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = alpha(theme.textColor as string, latitude === 0 ? 0.24 : 0.12);
      ctx.lineWidth = latitude === 0 ? 1.1 : 0.65;
      ctx.stroke();
    }
    for (let longitude = -150; longitude <= 180; longitude += 30) {
      const arc: ProjectedPoint[] = [];
      for (let latitude = -88; latitude <= 88; latitude += 4) {
        arc.push(this.projectSpherical(longitude, latitude, 3.15, width, height));
      }
      ctx.beginPath();
      arc.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = alpha(palette[0] ?? '#38bdf8', 0.13);
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }

    const plotted = points.map((point) => ({
      point,
      projected: this.project(this.weatherPointVector(point), width, height),
      intensity: readNumber(point.meta, 'intensity') ?? 0,
      probability: readNumber(point.meta, 'probability') ?? 0,
      hazard: readString(point.meta, 'hazard') ?? 'Signal',
    })).sort((a, b) => a.projected.depth - b.projected.depth);
    plotted.forEach(({ point, projected, intensity, probability, hazard }) => {
      const hazardIndex = Math.max(0, hazards.indexOf(hazard));
      const color = palette[hazardIndex % palette.length] ?? '#38bdf8';
      const pulse = intensity >= 85 ? Math.sin(time * 1.8 + intensity) * 0.35 : 0;
      drawGlowPoint(ctx, projected.x, projected.y, 1.8 + intensity * 0.027 + probability * 1.6 + pulse, color, 0.42 + probability * 0.5);
    });

    plotted
      .filter((entry) => entry.intensity >= 88 && entry.projected.depth < 1.4)
      .slice(0, 5)
      .forEach(({ point, projected, probability }) => {
        ctx.fillStyle = alpha(theme.textColor as string, 0.76);
        ctx.font = '700 8px "Inter",sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${String(point.label ?? 'Hazard').toUpperCase()} · ${Math.round(probability * 100)}%`, projected.x + 7, projected.y - 5);
      });

    const legendWidth = Math.min(width * 0.68, hazards.length * 118);
    hazards.forEach((hazard, index) => {
      const x = width * 0.5 - legendWidth * 0.5 + index * (legendWidth / hazards.length) + 6;
      const color = palette[index % palette.length] ?? '#38bdf8';
      drawGlowPoint(ctx, x, 59, 2.2, color, 0.82);
      ctx.fillStyle = alpha(theme.textColor as string, 0.66);
      ctx.font = '700 8px "Inter",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(hazard.toUpperCase(), x + 8, 56);
    });
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Weather & Disaster Signal Map', 'hazard probability and intensity across regional forecast windows', width, theme);
    ctx.restore();
  }

  private drawRaceOutcomeDistribution(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source: DataPoint[] = points.length ? points : Array.from({ length: 80 }, (_, index) => ({ x: index % 16, y: Math.floor(index / 16), z: Math.max(.08, Math.exp(-((((index % 16) - (4 + Math.floor(index / 16) * 1.6)) ** 2) / 12))) }));
    const palette = theme.palette.length ? theme.palette : ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
    const maxProbability = Math.max(0.001, ...source.map((point) => Number(point.z ?? point.y ?? 0)));
    ctx.save();
    source.forEach((point, index) => {
      const value = Number(point.z ?? point.y ?? 0);
      const normalized = value / maxProbability;
      const base = this.project({ x: Number(point.x) * .55 - 4.2, y: Number(point.y) * .9 - 2.2, z: -1.2 }, width, height);
      const top = this.project({ x: Number(point.x) * .55 - 4.2, y: Number(point.y) * .9 - 2.2, z: -1.2 + normalized * 3.4 }, width, height);
      const color = toCssColor(point.color, palette[Math.floor(index / 16) % palette.length] ?? '#38bdf8');
      ctx.beginPath(); ctx.moveTo(base.x - 3, base.y); ctx.lineTo(base.x + 3, base.y); ctx.lineTo(top.x + 3, top.y); ctx.lineTo(top.x - 3, top.y); ctx.closePath();
      ctx.fillStyle = alpha(color, .42); ctx.strokeStyle = alpha(color, .82); ctx.fill(); ctx.stroke();
      if (normalized > .78) drawGlowPoint(ctx, top.x, top.y, 3.2 + Math.sin(time * 2 + index) * .4, color, .78);
    });
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Race Outcome Distributions', 'probability mass across finish position and scenario ensemble', width, theme);
    ctx.restore();
  }

  private drawBehaviorDrift(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source: DataPoint[] = points.length ? points : Array.from({ length: 72 }, (_, index) => ({ x: index / 8 - 4.4, y: Math.sin(index * .27) * .3, z: -1.6 + index * .055 + (index > 50 ? (index - 50) * .11 : 0) }));
    const observedScores = source.map(point => readNumber(point.meta, 'behaviorScore')).filter((value): value is number => value !== undefined);
    const observedZ = source.map(point => Number(point.z ?? 0));
    const scoreMin = observedScores.length ? Math.min(...observedScores) : 0;
    const scoreMax = observedScores.length ? Math.max(...observedScores) : 1;
    const zMin = Math.min(...observedZ);
    const zMax = Math.max(...observedZ);
    const scoreToZ = (score: number) => zMin + ((score - scoreMin) / Math.max(.001, scoreMax - scoreMin)) * (zMax - zMin);
    const observed = source.map(point => this.projectPointLike(point, width, height));
    const forecast = source.map(point => this.project({
      x: Number(point.x ?? 0),
      y: Number(point.y ?? 0) + .72,
      z: scoreToZ(readNumber(point.meta, 'forecast') ?? readNumber(point.meta, 'behaviorScore') ?? Number(point.z ?? 0)),
    }, width, height));
    const envelope = source.map((point, index) => {
      const forecastScore = readNumber(point.meta, 'forecast') ?? readNumber(point.meta, 'behaviorScore') ?? 0;
      const residual = Math.abs(readNumber(point.meta, 'residual') ?? 0);
      const halfWidth = Math.max(1.6, 4.4 - Math.min(2.4, residual * .08));
      return {
        upper: this.project({ x: Number(point.x ?? 0), y: Number(point.y ?? 0) + .72, z: scoreToZ(forecastScore + halfWidth) }, width, height),
        lower: this.project({ x: Number(point.x ?? 0), y: Number(point.y ?? 0) + .72, z: scoreToZ(forecastScore - halfWidth) }, width, height),
        phase: readString(point.meta, 'phase') ?? 'baseline',
        index,
      };
    });
    const observedColor = theme.palette[0] ?? '#38bdf8';
    const forecastColor = theme.palette[1] ?? '#a78bfa';
    const leadColor = theme.palette[2] ?? '#f59e0b';

    ctx.save();
    ctx.beginPath();
    envelope.forEach((entry, index) => index ? ctx.lineTo(entry.upper.x, entry.upper.y) : ctx.moveTo(entry.upper.x, entry.upper.y));
    [...envelope].reverse().forEach(entry => ctx.lineTo(entry.lower.x, entry.lower.y));
    ctx.closePath();
    const corridor = ctx.createLinearGradient(width * .18, 0, width * .82, 0);
    corridor.addColorStop(0, alpha(forecastColor, .07));
    corridor.addColorStop(.7, alpha(forecastColor, .16));
    corridor.addColorStop(1, alpha('#ef4444', .2));
    ctx.fillStyle = corridor;
    ctx.fill();

    for (let index = 0; index < source.length; index += 4) {
      const a = observed[index]!;
      const b = forecast[index]!;
      const residual = Math.abs(readNumber(source[index]!.meta, 'residual') ?? 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = alpha(residual > 8 ? '#ef4444' : leadColor, .12 + Math.min(.42, residual * .022));
      ctx.lineWidth = residual > 8 ? 1.4 : .8;
      ctx.stroke();
    }

    ctx.beginPath(); forecast.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.setLineDash([7, 5]); ctx.strokeStyle = alpha(forecastColor, .76); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);

    ctx.beginPath(); observed.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    const gradient = ctx.createLinearGradient(width * .2, 0, width * .8, 0); gradient.addColorStop(0, alpha(observedColor, .9)); gradient.addColorStop(.7, alpha(leadColor, .94)); gradient.addColorStop(1, alpha('#ef4444', .98));
    ctx.strokeStyle = gradient; ctx.lineWidth = 2.6; ctx.shadowColor = alpha(observedColor, .48); ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;

    const transitionIndices = source.map((point, index) => ({ index, phase: readString(point.meta, 'phase') ?? 'baseline' })).filter((entry, index, all) => index === 0 || entry.phase !== all[index - 1]!.phase);
    transitionIndices.forEach(({ index, phase }) => {
      const point = observed[index]!;
      const color = phase === 'signal shift' ? '#ef4444' : phase === 'lead signal' ? leadColor : observedColor;
      drawGlowPoint(ctx, point.x, point.y, 5.4 + Math.sin(time * 2 + index) * .35, color, .9);
      ctx.fillStyle = alpha(theme.textColor as string, .78); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(phase.toUpperCase(), point.x + 8, point.y - 9);
    });

    ctx.fillStyle = alpha(theme.textColor as string, .68); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('OBSERVED', width * .1, 67); ctx.fillStyle = alpha(forecastColor, .82); ctx.fillText('FORECAST / CONFIDENCE', width * .19, 67);
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Behavior Drift Over Time', 'lead-signal identification before the forecast envelope breaks', width, theme);
    ctx.restore();
  }

  private drawControlEventTimeline(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source: DataPoint[] = points.length ? points : Array.from({ length: 8 }, (_, index) => ({ x: -4.5 + index * 1.3, y: 0, z: -.3 + (index % 3) * .45, label: `Control ${index + 1}` }));
    const projected = source.map(point => this.projectPointLike(point, width, height));
    const floor = source.map(point => this.project({ x: Number(point.x ?? 0), y: Number(point.y ?? 0), z: -1.45 }, width, height));
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22d3ee', '#a78bfa', '#f59e0b'];
    ctx.save();

    ctx.beginPath(); floor.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = alpha(palette[0] ?? '#38bdf8', .16); ctx.lineWidth = 1; ctx.stroke();

    projected.forEach((point, index) => {
      const datum = source[index]!;
      const color = toCssColor(datum.color, palette[index % palette.length] ?? '#38bdf8');
      const severity = readNumber(datum.meta, 'severity') ?? 0;
      const owner = readString(datum.meta, 'owner') ?? 'Control';
      ctx.beginPath(); ctx.moveTo(floor[index]!.x, floor[index]!.y); ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = alpha(color, .18 + severity * .004); ctx.lineWidth = 1.1; ctx.stroke();
      drawGlowPoint(ctx, point.x, point.y, 4.4 + severity * .025, color, .88);
      if (datum.meta?.reversible === false) {
        ctx.beginPath(); ctx.arc(point.x, point.y, 8, 0, Math.PI * 2); ctx.strokeStyle = alpha('#ef4444', .7); ctx.lineWidth = 1.2; ctx.stroke();
      }
      const labelY = point.y + (index % 2 ? 19 : -18);
      ctx.fillStyle = alpha(theme.textColor as string, .82); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(datum.label ?? `Event ${index + 1}`).toUpperCase(), point.x, labelY);
      ctx.fillStyle = alpha(theme.textColor as string, .52); ctx.font = '600 7px "Inter",sans-serif';
      ctx.fillText(`DAY ${Math.round(readNumber(datum.meta, 'day') ?? index)} / ${owner.toUpperCase()} / ${Math.round(severity)}`, point.x, labelY + (index % 2 ? 10 : -9));
    });

    ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    const pathGradient = ctx.createLinearGradient(projected[0]?.x ?? 0, 0, projected[projected.length - 1]?.x ?? width, 0);
    pathGradient.addColorStop(0, alpha(palette[0] ?? '#38bdf8', .7)); pathGradient.addColorStop(.68, alpha(palette[2] ?? '#a78bfa', .78)); pathGradient.addColorStop(1, alpha('#ef4444', .88));
    ctx.strokeStyle = pathGradient; ctx.lineWidth = 2.2; ctx.shadowColor = alpha(palette[0] ?? '#38bdf8', .38); ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0;

    if (projected.length > 1) {
      const position = (time * .34) % (projected.length - 1);
      const segment = Math.floor(position);
      const t = position - segment;
      const a = projected[segment]!;
      const b = projected[segment + 1]!;
      drawGlowPoint(ctx, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 6.5, palette[2] ?? '#f59e0b', .84);
    }
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Control Event Timeline', 'policy, contract, balance, and leadership decision windows', width, theme);
    ctx.restore();
  }

  private drawDeviceTelemetry(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const points = this.getPoints();
    const source: DataPoint[] = points.length ? points : Array.from({ length: 144 }, (_, index) => { const channel = Math.floor(index / 24), sample = index % 24; return { x: sample * .38 - 4.4, y: channel * .72 - 1.8, z: Math.sin(sample * .48 + channel) * .42 + channel * .18 }; });
    const channels = new Map<number, DataPoint[]>(); source.forEach(point => { const channel = Math.round(readNumber(point.meta, 'channel') ?? Number(point.y ?? 0)); const row = channels.get(channel) ?? []; row.push(point); channels.set(channel, row); });
    channels.forEach(row => row.sort((a, b) => Number(a.x ?? 0) - Number(b.x ?? 0)));
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22d3ee', '#a78bfa', '#f59e0b', '#fb7185', '#22c55e'];
    ctx.save();
    [...channels.entries()].forEach(([channel, row]) => {
      const color = palette[channel % palette.length] ?? '#38bdf8';
      const projected = row.map(point => this.projectPointLike(point, width, height));
      const baseline = row.map(point => this.project({ x: Number(point.x ?? 0), y: Number(point.y ?? 0), z: -.72 }, width, height));
      ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); [...baseline].reverse().forEach(point => ctx.lineTo(point.x, point.y)); ctx.closePath();
      const fill = ctx.createLinearGradient(0, Math.min(...projected.map(point => point.y)), 0, Math.max(...baseline.map(point => point.y)));
      fill.addColorStop(0, alpha(color, .16)); fill.addColorStop(1, alpha(color, .015)); ctx.fillStyle = fill; ctx.fill();

      ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = alpha(color, .78); ctx.lineWidth = 1.65; ctx.shadowColor = alpha(color, .32); ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0;

      row.forEach((datum, index) => {
        const risk = readNumber(datum.meta, 'predictiveRisk') ?? 0;
        if (risk < .24) return;
        const point = projected[index]!;
        const floor = baseline[index]!;
        ctx.beginPath(); ctx.moveTo(floor.x, floor.y); ctx.lineTo(point.x, point.y); ctx.strokeStyle = alpha('#ef4444', .2 + risk); ctx.lineWidth = 1; ctx.stroke();
        drawGlowPoint(ctx, point.x, point.y, 3.5 + risk * 7, '#ef4444', .86);
      });

      const labelDatum = row[row.length - 1]!;
      const labelPoint = projected[projected.length - 1]!;
      const metric = readString(labelDatum.meta, 'metric') ?? `Channel ${channel + 1}`;
      const health = readNumber(labelDatum.meta, 'healthScore') ?? 0;
      const risk = readNumber(labelDatum.meta, 'predictiveRisk') ?? 0;
      ctx.fillStyle = alpha(theme.textColor as string, .76); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`${metric.toUpperCase()} / H${Math.round(health)} / R${Math.round(risk * 100)}%`, labelPoint.x + 8, labelPoint.y + 3);
    });

    const scanX = -4.7 + ((time * .28) % 1) * 9.4;
    const scanBottom = this.project({ x: scanX, y: -.25, z: -.72 }, width, height);
    const scanTop = this.project({ x: scanX, y: 5.25, z: 2.7 }, width, height);
    const scan = ctx.createLinearGradient(scanBottom.x, scanBottom.y, scanTop.x, scanTop.y);
    scan.addColorStop(0, alpha(palette[0] ?? '#38bdf8', 0)); scan.addColorStop(.5, alpha(palette[0] ?? '#38bdf8', .62)); scan.addColorStop(1, alpha(palette[0] ?? '#38bdf8', 0));
    ctx.beginPath(); ctx.moveTo(scanBottom.x, scanBottom.y); ctx.lineTo(scanTop.x, scanTop.y); ctx.strokeStyle = scan; ctx.lineWidth = 1.4; ctx.stroke();
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Whole-Device Telemetry Learning', 'battery, memory, thermals, power, latency, and state learned together', width, theme);
    ctx.restore();
  }

  private drawMissionGauge(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const datum = this.getPoints()[0];
    const value = clamp(Number(datum?.y ?? datum?.z ?? 87), 0, 100);
    const center = { x: width * .5, y: height * .56 }, radius = Math.min(width, height) * .23, start = Math.PI * .78, span = Math.PI * 1.44;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(12, radius * .13); ctx.beginPath(); ctx.arc(center.x, center.y, radius, start, start + span); ctx.strokeStyle = alpha(theme.palette[0] ?? '#38bdf8', .14); ctx.stroke();
    const gradient = ctx.createLinearGradient(center.x - radius, 0, center.x + radius, 0); gradient.addColorStop(0, '#38bdf8'); gradient.addColorStop(.62, '#22c55e'); gradient.addColorStop(1, '#f59e0b'); ctx.beginPath(); ctx.arc(center.x, center.y, radius, start, start + span * value / 100); ctx.strokeStyle = gradient; ctx.stroke();
    const angle = start + span * value / 100, px = center.x + Math.cos(angle) * radius, py = center.y + Math.sin(angle) * radius; drawGlowPoint(ctx, px, py, 7 + Math.sin(time * 2) * .8, '#f8fafc', .92);
    ctx.fillStyle = toCssColor(theme.textColor, '#e2e8f0'); ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(28, radius * .38)}px "Inter",sans-serif`; ctx.fillText(`${Math.round(value)}%`, center.x, center.y + 8); ctx.font = '700 10px "Inter",sans-serif'; ctx.fillStyle = alpha(theme.textColor as string, .6); ctx.fillText(this.sceneType === 'deviceFleetHealth3d' ? 'FLEET HEALTH' : 'MISSION CONFIDENCE', center.x, center.y + 30);

    const stats = this.sceneType === 'deviceFleetHealth3d'
      ? [
          { label: 'HEALTHY', value: readNumber(datum?.meta, 'healthy') ?? 0, color: theme.palette[1] ?? '#22c55e' },
          { label: 'DEGRADED', value: readNumber(datum?.meta, 'degraded') ?? 0, color: theme.palette[2] ?? '#f59e0b' },
          { label: 'CRITICAL', value: readNumber(datum?.meta, 'critical') ?? 0, color: '#ef4444' },
        ]
      : [
          { label: 'PREDICTED', value: readNumber(datum?.meta, 'predicted') ?? 0, color: theme.palette[0] ?? '#38bdf8' },
          { label: 'CONTROLLED', value: readNumber(datum?.meta, 'controlled') ?? 0, color: theme.palette[1] ?? '#22c55e' },
          { label: 'PENDING', value: readNumber(datum?.meta, 'pending') ?? 0, color: theme.palette[2] ?? '#f59e0b' },
        ];
    const total = Math.max(1, stats.reduce((sum, stat) => sum + stat.value, 0));
    const barWidth = Math.min(330, width * .38);
    let barX = center.x - barWidth * .5;
    stats.forEach((stat, index) => {
      const segmentWidth = barWidth * stat.value / total;
      ctx.fillStyle = alpha(stat.color, .74); ctx.fillRect(barX, center.y + 49, segmentWidth, 4); barX += segmentWidth;
      const labelX = center.x - barWidth * .5 + (index + .5) * (barWidth / stats.length);
      ctx.fillStyle = alpha(theme.textColor as string, .62); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${stat.label} ${Math.round(stat.value)}`, labelX, center.y + 70);
    });
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

  private drawTransactionFlow(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: ThemeConfig): void {
    const source = this.getPoints();
    const laneOrder = ['Volume', 'Counterparty', 'Timing', 'Jurisdiction', 'Contract'];
    const lanes = new Map<string, DataPoint[]>();
    source.forEach(point => {
      const lane = readString(point.meta, 'lane') ?? 'Evidence';
      const row = lanes.get(lane) ?? [];
      row.push(point);
      lanes.set(lane, row);
    });
    lanes.forEach(row => row.sort((a, b) => Number(a.x ?? 0) - Number(b.x ?? 0)));
    const palette = theme.palette.length ? theme.palette : ['#38bdf8', '#22d3ee', '#a78bfa', '#f59e0b', '#fb7185'];
    const labeledAnomalies = new Set(source
      .filter(point => point.meta?.anomaly === true)
      .sort((a, b) => (readNumber(b.meta, 'deviationSigma') ?? 0) - (readNumber(a.meta, 'deviationSigma') ?? 0))
      .slice(0, 4));
    ctx.save();

    laneOrder.forEach((lane, laneIndex) => {
      const row = lanes.get(lane) ?? [];
      if (!row.length) return;
      const color = palette[laneIndex % palette.length] ?? '#38bdf8';
      const baseline = row.map(point => this.project({ x: Number(point.x ?? 0), y: laneIndex * .86 - 1.72, z: -.9 }, width, height));
      ctx.beginPath(); baseline.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = alpha(color, .16); ctx.lineWidth = .8; ctx.stroke();

      const projected = row.map(point => this.projectPointLike(point, width, height));
      ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = alpha(color, .68); ctx.lineWidth = 1.65; ctx.shadowColor = alpha(color, .38); ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;

      row.forEach((point, index) => {
        const projectedPoint = projected[index]!;
        const anomaly = point.meta?.anomaly === true;
        const deviation = readNumber(point.meta, 'deviationSigma') ?? 0;
        if (anomaly) {
          const floor = this.project({ x: Number(point.x ?? 0), y: Number(point.y ?? 0), z: -.9 }, width, height);
          ctx.beginPath(); ctx.moveTo(floor.x, floor.y); ctx.lineTo(projectedPoint.x, projectedPoint.y);
          ctx.strokeStyle = alpha('#ef4444', .62); ctx.lineWidth = 1.35; ctx.stroke();
          drawGlowPoint(ctx, projectedPoint.x, projectedPoint.y, 5.5 + Math.sin(time * 2.2 + index) * .45, '#ef4444', .94);
          if (labeledAnomalies.has(point)) {
            ctx.fillStyle = alpha(theme.textColor as string, .8); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(`${lane.toUpperCase()} ${deviation.toFixed(1)}sigma`, projectedPoint.x + 7, projectedPoint.y - 6);
          }
        } else if (index % 3 === 0) {
          drawGlowPoint(ctx, projectedPoint.x, projectedPoint.y, 2.2, color, .58);
        }
      });

      const labelPoint = projected[0]!;
      ctx.fillStyle = alpha(theme.textColor as string, .7); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(lane.toUpperCase(), labelPoint.x - 10, labelPoint.y + 3);
    });

    ctx.fillStyle = alpha(theme.textColor as string, .62); ctx.font = '700 8px "Inter",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('NOMINAL FLOW', width * .1, 67); ctx.fillStyle = alpha('#ef4444', .86); ctx.fillText('ANOMALY / SIGMA EXCURSION', width * .2, 67);
    this.drawSceneTitle(ctx, this.config?.title?.text ?? 'Transaction Flow Anomalies', 'time-aligned evidence lanes with deviation-weighted anomaly excursions', width, theme);
    ctx.restore();
  }

  private projectSpherical(longitudeDeg: number, latitudeDeg: number, radius: number, width: number, height: number): ProjectedPoint {
    const longitude = longitudeDeg * Math.PI / 180;
    const latitude = latitudeDeg * Math.PI / 180;
    return this.project({
      x: Math.cos(latitude) * Math.cos(longitude) * radius,
      y: Math.cos(latitude) * Math.sin(longitude) * radius,
      z: Math.sin(latitude) * radius,
    }, width, height);
  }

  private weatherPointVector(point: DataPoint): Vec3 {
    const region = readString(point.meta, 'region') ?? 'Global';
    const regionLongitude: Record<string, number> = {
      Americas: -95,
      Atlantic: -32,
      Europe: 14,
      Africa: 25,
      Asia: 92,
      Pacific: 158,
      Global: 0,
    };
    const longitude = (regionLongitude[region] ?? 0) + Number(point.x ?? 0) * 7.5;
    const latitude = clamp(Number(point.z ?? 0) * 12.5, -68, 68);
    const probability = readNumber(point.meta, 'probability') ?? 0;
    const radius = 3.18 + probability * 0.2;
    const longitudeRad = longitude * Math.PI / 180;
    const latitudeRad = latitude * Math.PI / 180;
    return {
      x: Math.cos(latitudeRad) * Math.cos(longitudeRad) * radius,
      y: Math.cos(latitudeRad) * Math.sin(longitudeRad) * radius,
      z: Math.sin(latitudeRad) * radius,
    };
  }

  private project(point: Vec3, width: number, height: number): ProjectedPoint {
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    const x1 = point.x * cosY - point.y * sinY;
    const y1 = point.x * sinY + point.y * cosY;
    const z1 = point.z;
    const y2 = y1 * cosP - z1 * sinP;
    const z2 = y1 * sinP + z1 * cosP;
    const distance = this.sceneConfig.initialDistance ?? 11;
    const scale = (distance / (distance + y2)) * this.zoom;
    const screenScale = Math.min(width, height) * 0.055;
    const verticalCenter = this.sceneType === 'deviceTelemetryLearning3d' ? 0.69 : 0.62;
    return {
      x: width * 0.5 + x1 * screenScale * scale,
      y: height * verticalCenter - z2 * screenScale * scale,
      scale,
      depth: y2,
    };
  }

  private applyInitialCamera(force = false): void {
    const signature = JSON.stringify({
      type: this.sceneType,
      yaw: this.sceneConfig.initialAzimuth ?? -0.55,
      pitch: this.sceneConfig.initialPolar ?? 0.64,
      zoom: this.sceneConfig.zoom ?? 1,
    });
    if (!force && signature === this.cameraSignature) return;
    this.cameraSignature = signature;
    this.yaw = this.sceneConfig.initialAzimuth ?? -0.55;
    this.pitch = clamp(this.sceneConfig.initialPolar ?? 0.64, 0.2, 1.24);
    this.zoom = clamp(this.sceneConfig.zoom ?? 1, 0.62, 2.2);
  }

  private getPointSources(): Challenge3DPointSource[] {
    return this.series.flatMap((series) => series.data.map((point, pointIndex) => ({
      point,
      pointIndex,
      seriesId: series.id,
      seriesName: series.name,
    })));
  }

  private updateHitTargets(width: number, height: number, time: number): void {
    const seriesSources = this.getPointSources();
    const sourceByPoint = new Map(seriesSources.map((source) => [source.point, source]));
    const dataPoints = seriesSources.map((source) => source.point);
    let points: DataPoint[] = dataPoints;
    let projectPoint = (point: DataPoint) => this.projectPointLike(point, width, height);
    let radiusForPoint = (point: DataPoint, projected: ProjectedPoint) => (
      Math.max(8, (7 + (readNumber(point.meta, 'size') ?? 1) * 3.5) * Math.max(0.72, projected.scale))
    );

    switch (this.sceneType) {
      case 'temporalGraphState3d':
        points = dataPoints.length ? dataPoints : buildTemporalStatePoints();
        break;
      case 'alphaLaplacianGraph3d':
        points = dataPoints.length ? dataPoints : buildAlphaGraphPoints();
        break;
      case 'powerwalkGraph3d':
        points = dataPoints.length ? dataPoints : buildPowerwalkPoints();
        break;
      case 'spectralSurface3d':
        points = dataPoints.length ? dataPoints : buildSpectralSurfacePoints();
        radiusForPoint = (_point, projected) => Math.max(6, 7 * Math.max(0.72, projected.scale));
        break;
      case 'forecastCone3d': {
        const horizonValues = points.map((point) => Number(point.x ?? 0));
        const horizonCenter = horizonValues.length
          ? (Math.min(...horizonValues) + Math.max(...horizonValues)) / 2
          : 0;
        projectPoint = (point) => this.project({
          x: Number(point.x ?? 0) - horizonCenter,
          y: Number(point.y ?? 0),
          z: Number(point.z ?? 0),
        }, width, height);
        radiusForPoint = (_point, projected) => Math.max(6, 6 * Math.max(0.72, projected.scale));
        break;
      }
      case 'graphManifold3d':
        points = dataPoints.length ? dataPoints : buildManifoldPoints();
        break;
      case 'operationalSignalFusion3d':
      case 'crossScaleIntelligence3d':
        points = dataPoints.length ? dataPoints : buildSignalFusionPoints();
        break;
      case 'weatherDisasterSignalMap3d':
        points = dataPoints;
        projectPoint = (point) => this.project(this.weatherPointVector(point), width, height);
        radiusForPoint = (point, projected) => Math.max(7, (5 + (readNumber(point.meta, 'intensity') ?? 0) * 0.045) * Math.max(0.72, projected.scale));
        break;
      case 'raceOutcomeDistribution3d':
        points = dataPoints.length ? dataPoints : Array.from({ length: 80 }, (_, index) => ({
          x: index % 16,
          y: Math.floor(index / 16),
          z: Math.max(0.08, Math.exp(-((((index % 16) - (4 + Math.floor(index / 16) * 1.6)) ** 2) / 12))),
        }));
        projectPoint = (point) => {
          const value = Number(point.z ?? point.y ?? 0);
          const maxProbability = Math.max(0.001, ...points.map((candidate) => Number(candidate.z ?? candidate.y ?? 0)));
          return this.project({
            x: Number(point.x) * 0.55 - 4.2,
            y: Number(point.y) * 0.9 - 2.2,
            z: -1.2 + (value / maxProbability) * 3.4,
          }, width, height);
        };
        radiusForPoint = (_point, projected) => Math.max(8, 9 * Math.max(0.72, projected.scale));
        break;
      case 'behaviorDrift3d':
        points = dataPoints.length ? dataPoints : Array.from({ length: 72 }, (_, index) => ({
          x: index / 8 - 4.4,
          y: Math.sin(index * 0.27) * 0.3,
          z: -1.6 + index * 0.055 + (index > 50 ? (index - 50) * 0.11 : 0),
        }));
        break;
      case 'transactionFlowAnomaly3d':
        points = dataPoints;
        radiusForPoint = (point, projected) => Math.max(point.meta?.anomaly === true ? 11 : 7, 8 * Math.max(.72, projected.scale));
        break;
      case 'controlEventTimeline3d':
        points = dataPoints.length ? dataPoints : Array.from({ length: 8 }, (_, index) => ({
          x: -4.5 + index * 1.3,
          y: 0,
          z: -0.3 + (index % 3) * 0.45,
          label: `Control ${index + 1}`,
        }));
        radiusForPoint = (_point, projected) => Math.max(10, 12 * Math.max(0.72, projected.scale));
        break;
      case 'deviceTelemetryLearning3d':
        points = dataPoints.length ? dataPoints : Array.from({ length: 144 }, (_, index) => {
          const channel = Math.floor(index / 24);
          const sample = index % 24;
          return {
            x: sample * 0.38 - 4.4,
            y: channel * 0.72 - 1.8,
            z: Math.sin(sample * 0.48 + channel) * 0.42 + channel * 0.18,
          };
        });
        radiusForPoint = (_point, projected) => Math.max(6, 8 * Math.max(0.72, projected.scale));
        break;
      case 'deviceFleetHealth3d':
      case 'missionOutcomes3d': {
        points = dataPoints.length ? dataPoints : [{
          x: 0,
          y: this.sceneType === 'deviceFleetHealth3d' ? 92 : 87,
          label: this.sceneType === 'deviceFleetHealth3d' ? 'Fleet health' : 'Mission confidence',
        }];
        const value = clamp(Number(points[0]?.y ?? points[0]?.z ?? 87), 0, 100);
        const center = { x: width * 0.5, y: height * 0.56 };
        const gaugeRadius = Math.min(width, height) * 0.23;
        const angle = Math.PI * 0.78 + Math.PI * 1.44 * value / 100;
        projectPoint = () => ({
          x: center.x + Math.cos(angle) * gaugeRadius,
          y: center.y + Math.sin(angle) * gaugeRadius,
          scale: 1,
          depth: 0,
        });
        radiusForPoint = () => 18;
        break;
      }
      case 'laserPointMap3d':
        points = dataPoints.length ? dataPoints : buildDefaultLaserPoints();
        projectPoint = (point) => this.project({
          x: Number(point.x ?? 0),
          y: Number(point.y ?? 0),
          z: Number(point.z ?? 0) / 10,
        }, width, height);
        radiusForPoint = (_point, projected) => Math.max(6, 8 * Math.max(0.72, projected.scale));
        break;
      case 'geojsonExtrusion3d':
        points = dataPoints.length ? dataPoints : [...buildDefaultPolygonPoints(), ...buildDefaultRoutePoints()];
        projectPoint = (point) => {
          const kind = readString(point.meta, 'kind');
          const z = kind === 'polygon'
            ? readNumber(point.meta, 'height') ?? Number(point.z ?? 1.2)
            : kind === 'route'
              ? 1.2 + Math.sin(time + points.indexOf(point)) * 0.08
              : Number(point.z ?? 0);
          return this.projectPointLike(point, width, height, z);
        };
        radiusForPoint = (_point, projected) => Math.max(9, 10 * Math.max(0.72, projected.scale));
        break;
      case 'laplacianFabricCone3d':
      default:
        points = dataPoints.length ? dataPoints : buildDefaultConePoints();
        projectPoint = (point) => this.project({
          x: -4.4 + Number(point.x ?? 0) * 8.8,
          y: Number(point.y ?? 0) + Math.sin(time * 1.2 + points.indexOf(point) * 0.63) * 0.18,
          z: Number(point.z ?? 0) / 10 - 0.8,
        }, width, height);
        break;
    }

    this.hitTargets = points.map((point, fallbackIndex) => {
      const source = sourceByPoint.get(point);
      const projected = projectPoint(point);
      const radius = radiusForPoint(point, projected);
      return {
        point,
        pointIndex: source?.pointIndex ?? fallbackIndex,
        seriesId: source?.seriesId ?? '',
        seriesName: source?.seriesName ?? this.sceneLabel(),
        x: projected.x,
        y: projected.y,
        depth: projected.depth,
        radius,
        visible: projected.scale > 0
          && projected.x >= -radius
          && projected.x <= width + radius
          && projected.y >= -radius
          && projected.y <= height + radius,
      };
    });

    if (this.hoveredIndex >= this.hitTargets.length) this.hoveredIndex = -1;
    if (this.selectedIndex >= this.hitTargets.length) this.selectedIndex = -1;
  }

  private drawInteractionState(ctx: CanvasRenderingContext2D, theme: ThemeConfig): void {
    const drawRing = (target: Challenge3DHitTarget | undefined, selected: boolean) => {
      if (!target || target.visible === false) return;
      const color = selected ? theme.palette[2] ?? '#f59e0b' : theme.palette[0] ?? '#38bdf8';
      const pulse = selected ? 2 + Math.sin(performance.now() * 0.004) * 1.4 : 0;
      ctx.save();
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius + 3 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(color, selected ? 0.92 : 0.72);
      ctx.lineWidth = selected ? 2 : 1.25;
      ctx.shadowColor = alpha(color, 0.8);
      ctx.shadowBlur = selected ? 14 : 8;
      ctx.stroke();
      ctx.restore();
    };

    drawRing(this.hitTargets[this.selectedIndex], true);
    if (this.hoveredIndex !== this.selectedIndex) drawRing(this.hitTargets[this.hoveredIndex], false);
  }

  private updateTooltipCard(): void {
    const theme = this.theme;
    const tooltip = this.config?.tooltip;
    const trigger = tooltip?.trigger ?? 'hover';
    const hoverAllowed = trigger === 'hover' || trigger === 'both';
    const clickAllowed = trigger === 'click' || trigger === 'both' || tooltip?.pinnable === true;
    const hoverTarget = hoverAllowed ? this.hitTargets[this.hoveredIndex] : undefined;
    const selectedTarget = clickAllowed ? this.hitTargets[this.selectedIndex] : undefined;
    const target = hoverTarget ?? selectedTarget;

    if (!theme || tooltip?.enabled === false || !target) {
      this.tooltipCard.style.opacity = '0';
      this.tooltipCard.style.transform = 'translateY(4px)';
      this.tooltipCard.setAttribute('aria-hidden', 'true');
      this.root.dataset.activePoint = '';
      if (this.chartState) this.chartState.tooltipVisible = false;
      return;
    }

    const selected = target === this.hitTargets[this.selectedIndex];
    const label = target.point.label ?? target.point.id ?? `${target.seriesName} ${target.pointIndex + 1}`;
    const rows = buildTooltipRows(target.point);
    const tooltipBackground = toCssColor(tooltip?.backgroundColor ?? theme.tooltip.backgroundColor, '#0f172a');
    const tooltipBorder = toCssColor(tooltip?.borderColor ?? theme.tooltip.borderColor, '#334155');
    const tooltipText = toCssColor(tooltip?.style?.color ?? theme.tooltip.textColor, '#e2e8f0');
    const accent = toCssColor(target.point.color, theme.palette[0] ?? '#38bdf8');

    this.tooltipCard.style.background = tooltipBackground;
    this.tooltipCard.style.color = tooltipText;
    this.tooltipCard.style.border = `${tooltip?.borderWidth ?? 1}px solid ${tooltipBorder}`;
    this.tooltipCard.style.borderRadius = `${tooltip?.borderRadius ?? 10}px`;
    this.tooltipCard.style.boxShadow = `0 18px 44px ${alpha('#020617', 0.46)},0 0 24px ${alpha(accent, 0.12)}`;
    this.tooltipCard.style.fontSize = `${tooltip?.style?.fontSize ?? 11}px`;
    if (tooltip?.style?.fontFamily) this.tooltipCard.style.fontFamily = tooltip.style.fontFamily;
    this.tooltipCard.innerHTML = [
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:7px">',
      '<div>',
      `<div style="font:700 9px/1.2 'JetBrains Mono','Cascadia Code',monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.58">${selected ? 'Selected' : 'Inspect'}</div>`,
      `<div style="font-size:14px;font-weight:750;line-height:1.25;margin-top:2px">${escapeHtml(String(label))}</div>`,
      `<div style="font-size:9px;letter-spacing:.09em;text-transform:uppercase;opacity:.55;margin-top:2px">${escapeHtml(target.seriesName)}</div>`,
      '</div>',
      `<span style="width:8px;height:8px;border-radius:50%;background:${escapeHtml(accent)};box-shadow:0 0 12px ${escapeHtml(accent)};margin-top:4px"></span>`,
      '</div>',
      `<div style="display:grid;gap:4px">${rows.map(([key, value]) => (
        `<div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid ${alpha(tooltipBorder, 0.35)};padding-top:4px">`
        + `<span style="opacity:.58">${escapeHtml(key)}</span><strong style="font-variant-numeric:tabular-nums;text-align:right">${escapeHtml(value)}</strong></div>`
      )).join('')}</div>`,
    ].join('');

    const anchor = tooltip?.followCursor ? this.localPointer : { x: target.x, y: target.y };
    const cardWidth = Math.min(220, Math.max(120, this.chartArea.width - 16));
    const estimatedHeight = 75 + rows.length * 24;
    const left = clamp(anchor.x + 14, 8, Math.max(8, this.chartArea.width - cardWidth - 8));
    const top = clamp(anchor.y - 18, 8, Math.max(8, this.chartArea.height - estimatedHeight - 8));
    this.tooltipCard.style.left = `${left}px`;
    this.tooltipCard.style.top = `${top}px`;
    this.tooltipCard.style.opacity = '1';
    this.tooltipCard.style.transform = 'translateY(0)';
    this.tooltipCard.setAttribute('aria-hidden', 'false');
    this.root.dataset.activePoint = target.point.id ?? String(target.pointIndex);
    this.root.dataset.selectedPoint = this.hitTargets[this.selectedIndex]?.point.id ?? '';
    if (this.chartState) this.chartState.tooltipVisible = true;
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
      case 'transactionFlowAnomaly3d': return 'Transaction flow anomalies';
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
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.pointerDown = true;
    this.movedWhileDown = false;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.pointerStart = { ...this.lastPointer };
    this.canvas.style.cursor = 'grabbing';
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    this.localPointer = { x: localX, y: localY };

    if (this.pointerDown) {
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 3) {
        this.movedWhileDown = true;
      }
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.yaw += dx * 0.008;
      this.pitch = clamp(this.pitch + dy * 0.006, 0.2, 1.24);
      this.requestRender();
      return;
    }

    const hitIndex = this.hitTest(localX, localY);
    this.setHovered(hitIndex, event, localX, localY);
    this.requestRender();
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    const rect = this.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    this.localPointer = { x: localX, y: localY };
    const hitIndex = this.hitTest(localX, localY);

    if (!this.movedWhileDown) {
      if (hitIndex >= 0) {
        this.selectTarget(hitIndex, event, localX, localY);
        this.setHovered(hitIndex, event, localX, localY);
      } else {
        this.clearSelection(event, localX, localY);
        this.setHovered(-1, event, localX, localY);
      }
    }

    this.canvas.style.cursor = hitIndex >= 0 ? 'pointer' : 'grab';
    this.requestRender();
    try {
      this.canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // The pointer may have been released by the browser before window pointerup.
    }
  };

  private readonly handlePointerLeave = (event: PointerEvent) => {
    if (this.pointerDown) return;
    this.setHovered(-1, event);
    this.requestRender();
  };

  private readonly handleWheel = (event: WheelEvent) => {
    if (this.config?.interaction?.zoom?.enabled === false) return;
    event.preventDefault();
    this.zoom = clamp(this.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.62, 2.2);
    this.requestRender();
    this.bus.emit('zoom', {
      chartX: this.localPointer.x,
      chartY: this.localPointer.y,
      originalEvent: event,
      payload: { zoom: this.zoom, sceneType: this.sceneType },
    });
  };

  private readonly handleDoubleClick = (event: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    this.clearSelection(event, localX, localY);
    this.applyInitialCamera(true);
    this.requestRender();
    this.bus.emit('dblclick', {
      chartX: localX,
      chartY: localY,
      originalEvent: event,
      payload: { sceneType: this.sceneType, resetCamera: true },
    });
  };

  private readonly handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private hitTest(x: number, y: number): number {
    return findChallenge3DHitTarget(this.hitTargets, x, y);
  }

  private setHovered(nextIndex: number, originalEvent?: Event, chartX?: number, chartY?: number): void {
    if (this.hoveredIndex === nextIndex) return;
    this.hoveredIndex = nextIndex;
    const target = this.hitTargets[nextIndex];

    if (!target) {
      if (this.chartState) this.chartState.hoveredPoint = undefined;
      this.canvas.style.cursor = 'grab';
      this.bus.emit('leave', { chartX, chartY, originalEvent });
      this.updateTooltipCard();
      return;
    }

    if (this.chartState && target.seriesId) {
      this.chartState.hoveredPoint = { seriesId: target.seriesId, index: target.pointIndex };
    }
    this.canvas.style.cursor = 'pointer';
    this.bus.emit('hover', {
      seriesId: target.seriesId || undefined,
      point: target.point,
      pointIndex: target.pointIndex,
      chartX,
      chartY,
      originalEvent,
      payload: { sceneType: this.sceneType, depth: target.depth },
    });
    this.updateTooltipCard();
  }

  private selectTarget(index: number, originalEvent?: Event, chartX?: number, chartY?: number): void {
    const target = this.hitTargets[index];
    if (!target) return;
    const selectionEnabled = this.config?.interaction?.selection?.enabled === true;
    const pinTooltip = this.config?.tooltip?.pinnable === true;

    this.bus.emit('click', {
      seriesId: target.seriesId || undefined,
      point: target.point,
      pointIndex: target.pointIndex,
      chartX,
      chartY,
      originalEvent,
      payload: { sceneType: this.sceneType, depth: target.depth },
    });

    if (!selectionEnabled && !pinTooltip) return;
    const previousIndex = this.selectedIndex;
    this.selectedIndex = index;
    if (this.chartState && selectionEnabled && target.seriesId) {
      this.chartState.selectedPoints = [{ seriesId: target.seriesId, index: target.pointIndex }];
    }
    if (selectionEnabled && previousIndex !== index) {
      this.bus.emit('select', {
        seriesId: target.seriesId || undefined,
        point: target.point,
        pointIndex: target.pointIndex,
        chartX,
        chartY,
        originalEvent,
        payload: { sceneType: this.sceneType, depth: target.depth },
      });
    }
    this.updateTooltipCard();
  }

  private clearSelection(originalEvent?: Event, chartX?: number, chartY?: number): void {
    const oldTarget = this.hitTargets[this.selectedIndex];
    if (this.selectedIndex < 0) return;
    this.selectedIndex = -1;
    if (this.chartState) this.chartState.selectedPoints = [];
    if (this.config?.interaction?.selection?.enabled) {
      this.bus.emit('deselect', {
        seriesId: oldTarget?.seriesId || undefined,
        point: oldTarget?.point,
        pointIndex: oldTarget?.pointIndex,
        chartX,
        chartY,
        originalEvent,
        payload: { sceneType: this.sceneType },
      });
    }
    this.updateTooltipCard();
  }
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

function buildTooltipRows(point: DataPoint): Array<[string, string]> {
  const configuredRows = Array.isArray(point.meta?.tooltipRows)
    ? point.meta.tooltipRows
      .map((row) => row && typeof row === 'object' ? row as Record<string, unknown> : null)
      .filter((row): row is Record<string, unknown> => row !== null)
      .map((row) => [String(row.label ?? ''), formatTooltipValue(row.value)] as [string, string])
      .filter(([label]) => label.length > 0)
    : [];
  if (configuredRows.length) return configuredRows.slice(0, 6);

  const rows: Array<[string, string]> = [];
  for (const [key, value] of [['x', point.x], ['y', point.y], ['z', point.z]] as const) {
    if (value !== undefined && value !== null) rows.push([key.toUpperCase(), formatTooltipValue(value)]);
  }

  const excluded = new Set(['color', 'size', 'edges', 'tooltipRows']);
  for (const [key, value] of Object.entries(point.meta ?? {})) {
    if (excluded.has(key) || value === undefined || value === null || typeof value === 'object') continue;
    rows.push([formatTooltipKey(key), formatTooltipValue(value)]);
    if (rows.length >= 6) break;
  }
  return rows.slice(0, 6);
}

function formatTooltipKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatTooltipValue(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'n/a';
    const magnitude = Math.abs(value);
    if (magnitude > 0 && magnitude < 0.01) return value.toExponential(2);
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: magnitude < 10 ? 3 : magnitude < 100 ? 2 : 1,
    }).format(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
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
