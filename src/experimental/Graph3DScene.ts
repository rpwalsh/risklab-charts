import type { EventBus } from '../core/EventBus';
import type { ProcessedSeries } from '../core/DataPipeline';
import type {
  ChartConfig,
  ChartState,
  ColorValue,
  DataPoint,
  GradientDef,
  Graph3DConfig,
  Rect,
  ThemeConfig,
} from '../core/types';
import { escapeHtml } from '../utils/sanitize';

type Vec3 = [number, number, number];
type Mat4 = Float32Array;

interface Graph3DRenderableNode {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: [number, number, number, number];
  point: DataPoint;
  degree: number;
}

interface Graph3DRenderableLink {
  source: string;
  target: string;
  sourceIndex: number;
  targetIndex: number;
  weight: number;
  kind?: string;
  color: [number, number, number, number];
}

export interface Graph3DRenderableData {
  nodes: Graph3DRenderableNode[];
  links: Graph3DRenderableLink[];
  radius: number;
  center: Vec3;
}

interface WalkerState {
  from: number;
  to: number;
  progress: number;
  speed: number;
  color: [number, number, number, number];
  size: number;
}

interface TrailState {
  from: Vec3;
  to: Vec3;
  color: [number, number, number, number];
  life: number;
}

interface EdgeDraft {
  source: string;
  target: string;
  weight?: number;
  kind?: string;
  color?: ColorValue;
}

interface Graph3DSceneOptions {
  host: HTMLElement;
  bus: EventBus;
}

interface Graph3DRenderContext {
  series: ProcessedSeries[];
  state: ChartState;
  theme: ThemeConfig;
  config: ChartConfig;
}

interface GLProgramBundle {
  program: WebGLProgram;
  attribs: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export function normalizeGraph3DSeries(
  series: Array<Pick<ProcessedSeries, 'id' | 'data' | 'color'>>,
  graphConfig: Graph3DConfig | undefined,
  palette: string[] = [],
): Graph3DRenderableData {
  const nodes: Graph3DRenderableNode[] = [];
  const links: EdgeDraft[] = [];
  const nodeIndex = new Map<string, number>();

  for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
    const currentSeries = series[seriesIndex]!;
    const fallbackColor = palette[seriesIndex % Math.max(1, palette.length)] ?? '#4f46e5';

    for (let pointIndex = 0; pointIndex < currentSeries.data.length; pointIndex += 1) {
      const point = currentSeries.data[pointIndex]!;
      const meta = asRecord(point.meta);
      const inferredId = String(point.id ?? meta.id ?? point.label ?? point.x ?? `node-${seriesIndex}-${pointIndex}`);
      const looksLikeEdge = typeof point.from === 'string'
        && typeof point.to === 'string'
        && !isFiniteNumber(point.x)
        && !isFiniteNumber(point.y)
        && !isFiniteNumber(point.z);

      if (looksLikeEdge) {
        links.push({
          source: point.from!,
          target: point.to!,
          weight: point.weight ?? 1,
          kind: readString(meta.kind) ?? readString(meta.type) ?? undefined,
          color: point.color ?? readColorValue(meta.color),
        });
        continue;
      }

      if (!nodeIndex.has(inferredId)) {
        nodeIndex.set(inferredId, nodes.length);
        nodes.push({
          id: inferredId,
          label: String(point.label ?? inferredId),
          x: isFiniteNumber(point.x) ? Number(point.x) : Number.NaN,
          y: isFiniteNumber(point.y) ? Number(point.y) : Number.NaN,
          z: isFiniteNumber(point.z) ? Number(point.z) : Number.NaN,
          size: readNumber(meta.size) ?? (isFiniteNumber(point.z) ? Math.max(0.8, Math.min(2, Number(point.z) / 12)) : 1),
          color: parseColor(point.color ?? readColorValue(meta.color), fallbackColor),
          point,
          degree: 0,
        });
      }

      const rawEdges = meta.edges;
      if (Array.isArray(rawEdges)) {
        for (const edge of rawEdges) {
          if (typeof edge === 'string') {
            links.push({ source: inferredId, target: edge, weight: 1 });
            continue;
          }
          const edgeRecord = asRecord(edge);
          const target = readString(edgeRecord.target) ?? readString(edgeRecord.to) ?? readString(edgeRecord.id);
          if (!target) continue;
          links.push({
            source: inferredId,
            target,
            weight: readNumber(edgeRecord.weight) ?? 1,
            kind: readString(edgeRecord.kind) ?? readString(edgeRecord.type) ?? undefined,
            color: readColorValue(edgeRecord.color),
          });
        }
      }
    }
  }

  for (const explicitLink of graphConfig?.links ?? []) {
    links.push({
      source: explicitLink.source,
      target: explicitLink.target,
      weight: explicitLink.weight ?? 1,
      kind: explicitLink.kind,
      color: explicitLink.color,
    });
  }

  const dedupedLinks = new Map<string, EdgeDraft>();
  for (const edge of links) {
    if (!nodeIndex.has(edge.source) || !nodeIndex.has(edge.target) || edge.source === edge.target) continue;
    const key = [edge.source, edge.target].sort().join('::');
    if (!dedupedLinks.has(key)) dedupedLinks.set(key, edge);
  }

  const resolvedLinks: Graph3DRenderableLink[] = [];
  for (const edge of dedupedLinks.values()) {
    const sourceIndex = nodeIndex.get(edge.source);
    const targetIndex = nodeIndex.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const sourceNode = nodes[sourceIndex]!;
    const targetNode = nodes[targetIndex]!;
    sourceNode.degree += 1;
    targetNode.degree += 1;
    resolvedLinks.push({
      source: edge.source,
      target: edge.target,
      sourceIndex,
      targetIndex,
      weight: edge.weight ?? 1,
      kind: edge.kind,
      color: parseColor(edge.color, '#7dd3fc', 0.58),
    });
  }

  const needsLayout = graphConfig?.layout === 'force'
    || (graphConfig?.layout !== 'fixed' && nodes.some((node) => !isFinite(node.x) || !isFinite(node.y) || !isFinite(node.z)));

  if (needsLayout) applyForceLayout(nodes, resolvedLinks, graphConfig?.layout === 'force');

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    minZ = Math.min(minZ, node.z);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
    maxZ = Math.max(maxZ, node.z);
  }

  const center: Vec3 = nodes.length > 0
    ? [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5]
    : [0, 0, 0];

  let radius = 1;
  for (const node of nodes) {
    const dx = node.x - center[0];
    const dy = node.y - center[1];
    const dz = node.z - center[2];
    radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  return { nodes, links: resolvedLinks, radius, center };
}

const LINE_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec4 aColor;
uniform mat4 uMatrix;
varying vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = uMatrix * vec4(aPosition, 1.0);
}
`;

const LINE_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}
`;

const POINT_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec4 aColor;
attribute float aSize;
uniform mat4 uMatrix;
uniform float uPixelRatio;
varying vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  gl_PointSize = aSize * uPixelRatio;
}
`;

const POINT_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = dot(uv, uv);
  if (dist > 1.0) discard;
  float glow = smoothstep(1.0, 0.0, dist);
  float core = smoothstep(0.42, 0.0, dist);
  gl_FragColor = vec4(vColor.rgb, vColor.a * max(glow * 0.62, core));
}
`;

export const GRAPH_3D_CHART_TYPES = ['graph3d'] as const;
export type Graph3DChartType = typeof GRAPH_3D_CHART_TYPES[number];

export class Graph3DScene {
  private readonly host: HTMLElement;
  private readonly bus: EventBus;
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly labelLayer: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private fallback: HTMLDivElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private linesProgram: GLProgramBundle | null = null;
  private pointsProgram: GLProgramBundle | null = null;
  private edgePositionBuffer: WebGLBuffer | null = null;
  private edgeColorBuffer: WebGLBuffer | null = null;
  private nodePositionBuffer: WebGLBuffer | null = null;
  private nodeColorBuffer: WebGLBuffer | null = null;
  private nodeSizeBuffer: WebGLBuffer | null = null;
  private walkerPositionBuffer: WebGLBuffer | null = null;
  private walkerColorBuffer: WebGLBuffer | null = null;
  private walkerSizeBuffer: WebGLBuffer | null = null;
  private trailPositionBuffer: WebGLBuffer | null = null;
  private trailColorBuffer: WebGLBuffer | null = null;
  private chartArea: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private theme: ThemeConfig | null = null;
  private sceneConfig: Graph3DConfig = {};
  private chartConfig: ChartConfig | null = null;
  private chartState: ChartState | null = null;
  private data: Graph3DRenderableData = { nodes: [], links: [], radius: 1, center: [0, 0, 0] };
  private adjacency: number[][] = [];
  private walkers: WalkerState[] = [];
  private trails: TrailState[] = [];
  private seriesId = '';
  private hoveredIndex = -1;
  private pinnedIndex = -1;
  private pointerDown = false;
  private movedWhileDown = false;
  private lastPointer = { x: 0, y: 0 };
  private lastInteractionAt = 0;
  private animationFrame = 0;
  private lastFrameAt = 0;
  private signature = '';
  private orbit = { theta: 0.86, phi: 1.1, distance: 18 };
  private target: Vec3 = [0, 0, 0];
  private desiredTarget: Vec3 = [0, 0, 0];
  private projectedNodes: Array<{ x: number; y: number; visible: boolean; depth: number }> = [];

  constructor(options: Graph3DSceneOptions) {
    this.host = options.host;
    this.bus = options.bus;
    this.root = document.createElement('div');
    this.root.setAttribute('data-uc-graph3d', 'true');
    this.root.style.cssText = [
      'position:absolute',
      'overflow:hidden',
      'border-radius:16px',
      'z-index:12',
      'touch-action:none',
      'user-select:none',
      'background:radial-gradient(circle at 50% 38%, rgba(22,34,58,0.92), rgba(6,12,24,0.98) 72%)',
      'border:1px solid rgba(148,163,184,0.08)',
      'box-shadow:inset 0 0 0 1px rgba(148,163,184,0.05)',
    ].join(';');

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-uc-graph3d', 'true');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;background:transparent;';
    this.root.appendChild(this.canvas);

    this.labelLayer = document.createElement('div');
    this.labelLayer.style.cssText = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',
      'z-index:18',
    ].join(';');
    this.root.appendChild(this.labelLayer);

    this.card = document.createElement('div');
    this.card.style.cssText = [
      'position:absolute',
      'right:14px',
      'top:14px',
      'width:212px',
      'padding:9px 11px',
      'border-radius:12px',
      'pointer-events:none',
      'opacity:0',
      'transform:translateY(4px)',
      'transition:opacity 120ms ease, transform 120ms ease',
      'z-index:20',
      'font-size:11px',
      'line-height:1.4',
      'font-family:Inter, Segoe UI, sans-serif',
      'backdrop-filter:blur(12px)',
    ].join(';');
    this.root.appendChild(this.card);

    this.attachEvents();
    this.host.appendChild(this.root);
    this.initGL();
  }

  update(ctx: Graph3DRenderContext): void {
    this.theme = ctx.theme;
    this.chartConfig = ctx.config;
    this.chartState = ctx.state;
    this.sceneConfig = ctx.config.graph3d ?? {};
    this.applyThemeStyles();
    this.seriesId = ctx.series[0]?.id ?? '';
    this.resize(ctx.state.chartArea);

    const nextSignature = JSON.stringify({
      ids: ctx.series.flatMap((series) => series.data.map((point) => point.id ?? point.label ?? point.x)),
      links: ctx.config.graph3d?.links?.length ?? 0,
      size: ctx.series.reduce((sum, series) => sum + series.data.length, 0),
    });

    this.data = normalizeGraph3DSeries(ctx.series, this.sceneConfig, ctx.theme.palette);
    this.adjacency = buildAdjacency(this.data.nodes.length, this.data.links);

    if (nextSignature !== this.signature) {
      this.signature = nextSignature;
      this.resetOrbit();
      this.initWalkers();
      this.trails = [];
      if (this.pinnedIndex >= this.data.nodes.length) this.pinnedIndex = -1;
      if (this.hoveredIndex >= this.data.nodes.length) this.hoveredIndex = -1;
    }

    if (this.sceneConfig.selectedNodeId) {
      const externalIndex = this.data.nodes.findIndex((node) => node.id === this.sceneConfig.selectedNodeId);
      if (externalIndex >= 0) {
        this.pinnedIndex = externalIndex;
        const pinnedNode = this.data.nodes[externalIndex]!;
        this.desiredTarget = [pinnedNode.x, pinnedNode.y, pinnedNode.z];
        if (this.chartState) {
          this.chartState.selectedPoints = [{ seriesId: this.seriesId, index: externalIndex }];
        }
      }
    }

    if (!this.gl) {
      this.renderFallback('WebGL unavailable');
      return;
    }

    if (this.fallback) {
      this.fallback.remove();
      this.fallback = null;
    }

    this.updateCard();

    if (!this.animationFrame) {
      this.lastFrameAt = performance.now();
      this.animationFrame = requestAnimationFrame(this.frame);
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

    if (this.canvas.width !== Math.floor(width * dpr) || this.canvas.height !== Math.floor(height * dpr)) {
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
  }

  async export(format: 'png' | 'svg' | 'jpeg' = 'png'): Promise<Blob | string> {
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
        else reject(new Error('Graph3D export failed.'));
      }, mime, format === 'jpeg' ? 0.92 : undefined);
    });
  }

  destroy(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.disposeGL();
    this.root.remove();
  }

  private readonly frame = (time: number) => {
    this.animationFrame = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0.001, (time - this.lastFrameAt) / 1000));
    this.lastFrameAt = time;
    this.renderFrame(time * 0.001, dt);
  };

  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
  }

  private initGL(): void {
    const gl = this.canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false });
    if (!gl) return;
    this.gl = gl;
    this.linesProgram = createProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER, ['aPosition', 'aColor'], ['uMatrix']);
    this.pointsProgram = createProgram(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER, ['aPosition', 'aColor', 'aSize'], ['uMatrix', 'uPixelRatio']);
    this.edgePositionBuffer = gl.createBuffer();
    this.edgeColorBuffer = gl.createBuffer();
    this.nodePositionBuffer = gl.createBuffer();
    this.nodeColorBuffer = gl.createBuffer();
    this.nodeSizeBuffer = gl.createBuffer();
    this.walkerPositionBuffer = gl.createBuffer();
    this.walkerColorBuffer = gl.createBuffer();
    this.walkerSizeBuffer = gl.createBuffer();
    this.trailPositionBuffer = gl.createBuffer();
    this.trailColorBuffer = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private applyThemeStyles(): void {
    const theme = this.theme;
    if (!theme) return;

    const surface = parseColor(theme.colors?.background ?? theme.backgroundColor, '#08111f');
    const tooltipBg = parseColor(theme.tooltip.backgroundColor ?? theme.backgroundColor, '#0f172a');
    const border = parseColor(theme.colors?.border ?? theme.tooltip.borderColor, '#334155');
    const text = parseColor(theme.colors?.text ?? theme.textColor, '#e2e8f0');
    const accent = parseColor(theme.palette[0] ?? '#38bdf8', '#38bdf8');
    const lightTheme = relativeLuminance(surface) > 0.58;
    const topGlow = rgbaCss(mixColors(surface, accent, lightTheme ? 0.08 : 0.16), lightTheme ? 0.96 : 0.94);
    const baseFill = rgbaCss(mixColors(tooltipBg, surface, lightTheme ? 0.28 : 0.52), 0.98);
    const borderCss = rgbaCss(border, lightTheme ? 0.4 : 0.16);
    const insetCss = rgbaCss(mixColors(border, text, 0.16), lightTheme ? 0.08 : 0.06);

    this.root.style.background = `radial-gradient(circle at 50% 38%, ${topGlow}, ${baseFill} 72%)`;
    this.root.style.border = `1px solid ${borderCss}`;
    this.root.style.boxShadow = `inset 0 0 0 1px ${insetCss}`;
  }

  private renderFrame(time: number, dt: number): void {
    const gl = this.gl;
    const theme = this.theme;
    if (!gl || !theme) return;

    const width = Math.max(1, Math.floor(this.chartArea.width));
    const height = Math.max(1, Math.floor(this.chartArea.height));
    if (width <= 1 || height <= 1) return;

    this.updateIdleOrbit(dt);
    this.updateTarget(dt);
    this.updateWalkers(dt);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const bg = parseColor(this.sceneConfig.backgroundColor ?? theme.backgroundColor, '#08111f');
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const matrix = buildViewProjectionMatrix(
      width / Math.max(1, height),
      this.orbit,
      this.target,
      Math.max(10, this.sceneConfig.initialDistance ?? this.data.radius * 2.8),
    );

    this.projectNodes(matrix, width, height);
    this.drawLines(matrix, time);
    this.drawNodes(matrix, dpr, time);
    this.drawWalkers(matrix, dpr);
    this.renderLabels();
  }

  private drawLines(matrix: Mat4, time: number): void {
    const gl = this.gl;
    const bundle = this.linesProgram;
    if (!gl || !bundle || !this.edgePositionBuffer || !this.edgeColorBuffer || !this.trailPositionBuffer || !this.trailColorBuffer) return;

    const highlighted = new Set<number>();
    if (this.hoveredIndex >= 0) highlighted.add(this.hoveredIndex);
    if (this.pinnedIndex >= 0) highlighted.add(this.pinnedIndex);
    for (const index of highlighted) {
      for (const neighbor of this.adjacency[index] ?? []) highlighted.add(neighbor);
    }

    const edgePositions: number[] = [];
    const edgeColors: number[] = [];
    for (const link of this.data.links) {
      const from = this.data.nodes[link.sourceIndex]!;
      const to = this.data.nodes[link.targetIndex]!;
      const incident = highlighted.size === 0 || highlighted.has(link.sourceIndex) || highlighted.has(link.targetIndex);
      const pulse = highlighted.has(link.sourceIndex) || highlighted.has(link.targetIndex)
        ? 0.28 + Math.sin(time * 5.4) * 0.08
        : 0;
      const alpha = clamp((incident ? link.color[3] + pulse : link.color[3] * 0.32), 0.16, 0.92);
      const segmentCount = incident ? 14 : 9;
      const arcHeight = clamp(distance3(from, to) * 0.14 + link.weight * 0.08, 0.45, 2.2);
      appendCurvedEdge(edgePositions, from, to, this.data.center, segmentCount, arcHeight);
      for (let segment = 0; segment < segmentCount; segment += 1) {
        edgeColors.push(
          link.color[0], link.color[1], link.color[2], alpha,
          link.color[0], link.color[1], link.color[2], alpha,
        );
      }
    }

    const trailPositions: number[] = [];
    const trailColors: number[] = [];
    for (const trail of this.trails) {
      appendCurvedEdge(
        trailPositions,
        { x: trail.from[0], y: trail.from[1], z: trail.from[2] },
        { x: trail.to[0], y: trail.to[1], z: trail.to[2] },
        this.data.center,
        4,
        0.3,
      );
      const alpha = clamp(trail.life * 0.55, 0, 0.55);
      for (let segment = 0; segment < 4; segment += 1) {
        trailColors.push(
          trail.color[0], trail.color[1], trail.color[2], alpha,
          trail.color[0], trail.color[1], trail.color[2], alpha,
        );
      }
    }

    gl.useProgram(bundle.program);
    gl.uniformMatrix4fv(bundle.uniforms.uMatrix, false, matrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgePositions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aPosition);
    gl.vertexAttribPointer(bundle.attribs.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeColors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aColor);
    gl.vertexAttribPointer(bundle.attribs.aColor, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, edgePositions.length / 3);

    if (trailPositions.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.trailPositionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(trailPositions), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(bundle.attribs.aPosition, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.trailColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(trailColors), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(bundle.attribs.aColor, 4, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, trailPositions.length / 3);
    }
  }

  private drawNodes(matrix: Mat4, dpr: number, time: number): void {
    const gl = this.gl;
    const bundle = this.pointsProgram;
    if (!gl || !bundle || !this.nodePositionBuffer || !this.nodeColorBuffer || !this.nodeSizeBuffer) return;

    const haloPositions: number[] = [];
    const haloColors: number[] = [];
    const haloSizes: number[] = [];
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const baseSize = this.sceneConfig.nodeBaseSize ?? 14;
    const hoverScale = this.sceneConfig.hoverScale ?? 1.26;

    for (let index = 0; index < this.data.nodes.length; index += 1) {
      const node = this.data.nodes[index]!;
      const isHovered = index === this.hoveredIndex;
      const isPinned = index === this.pinnedIndex;
      const isAdjacent = (this.pinnedIndex >= 0 && (this.adjacency[this.pinnedIndex] ?? []).includes(index))
        || (this.hoveredIndex >= 0 && (this.adjacency[this.hoveredIndex] ?? []).includes(index));
      const emphasis = isPinned || isHovered ? hoverScale + Math.sin(time * 7.2) * 0.08 : isAdjacent ? 1.08 : 1;
      const alpha = isPinned || isHovered ? 1 : isAdjacent ? 0.98 : 0.9;
      const haloAlpha = isPinned || isHovered ? 0.34 : isAdjacent ? 0.18 : 0.1;
      const haloSize = baseSize * node.size * emphasis * (isPinned || isHovered ? 3.1 : isAdjacent ? 2.4 : 1.85);
      haloPositions.push(node.x, node.y, node.z);
      haloColors.push(node.color[0], node.color[1], node.color[2], haloAlpha);
      haloSizes.push(haloSize);
      positions.push(node.x, node.y, node.z);
      colors.push(node.color[0], node.color[1], node.color[2], alpha);
      sizes.push(baseSize * node.size * emphasis);
    }

    this.drawPointLayer(
      bundle,
      this.nodePositionBuffer,
      this.nodeColorBuffer,
      this.nodeSizeBuffer,
      matrix,
      dpr,
      haloPositions,
      haloColors,
      haloSizes,
    );
    this.drawPointLayer(
      bundle,
      this.nodePositionBuffer,
      this.nodeColorBuffer,
      this.nodeSizeBuffer,
      matrix,
      dpr,
      positions,
      colors,
      sizes,
    );
  }

  private drawPointLayer(
    bundle: GLProgramBundle,
    positionBuffer: WebGLBuffer,
    colorBuffer: WebGLBuffer,
    sizeBuffer: WebGLBuffer,
    matrix: Mat4,
    dpr: number,
    positions: number[],
    colors: number[],
    sizes: number[],
  ): void {
    const gl = this.gl;
    if (!gl || positions.length === 0) return;

    gl.useProgram(bundle.program);
    gl.uniformMatrix4fv(bundle.uniforms.uMatrix, false, matrix);
    gl.uniform1f(bundle.uniforms.uPixelRatio, dpr);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aPosition);
    gl.vertexAttribPointer(bundle.attribs.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aColor);
    gl.vertexAttribPointer(bundle.attribs.aColor, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aSize);
    gl.vertexAttribPointer(bundle.attribs.aSize, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, positions.length / 3);
  }

  private drawWalkers(matrix: Mat4, dpr: number): void {
    const gl = this.gl;
    const bundle = this.pointsProgram;
    if (!gl || !bundle || !this.walkerPositionBuffer || !this.walkerColorBuffer || !this.walkerSizeBuffer || this.walkers.length === 0) return;

    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    for (const walker of this.walkers) {
      const from = this.data.nodes[walker.from];
      const to = this.data.nodes[walker.to];
      if (!from || !to) continue;
      const x = lerp(from.x, to.x, walker.progress);
      const y = lerp(from.y, to.y, walker.progress);
      const z = lerp(from.z, to.z, walker.progress);
      positions.push(x, y, z);
      colors.push(walker.color[0], walker.color[1], walker.color[2], 0.9);
      sizes.push(walker.size * 1.4);
    }

    if (positions.length === 0) return;

    gl.useProgram(bundle.program);
    gl.uniformMatrix4fv(bundle.uniforms.uMatrix, false, matrix);
    gl.uniform1f(bundle.uniforms.uPixelRatio, dpr);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.walkerPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aPosition);
    gl.vertexAttribPointer(bundle.attribs.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.walkerColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aColor);
    gl.vertexAttribPointer(bundle.attribs.aColor, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.walkerSizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(bundle.attribs.aSize);
    gl.vertexAttribPointer(bundle.attribs.aSize, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, positions.length / 3);
  }

  private projectNodes(matrix: Mat4, width: number, height: number): void {
    this.projectedNodes = this.data.nodes.map((node) => {
      const clip = multiplyMat4Vec4(matrix, [node.x, node.y, node.z, 1]);
      const w = clip[3] || 1;
      const ndcX = clip[0] / w;
      const ndcY = clip[1] / w;
      const ndcZ = clip[2] / w;
      return {
        x: (ndcX * 0.5 + 0.5) * width,
        y: (1 - (ndcY * 0.5 + 0.5)) * height,
        visible: ndcZ > -1.25 && ndcZ < 1.15,
        depth: ndcZ,
      };
    });
  }

  private updateIdleOrbit(dt: number): void {
    if (this.pointerDown) return;
    const autoRotate = this.sceneConfig.autoRotate ?? true;
    if (!autoRotate) return;
    const idleFor = performance.now() - this.lastInteractionAt;
    if (idleFor < 1800) return;
    this.orbit.theta += dt * 0.16;
  }

  private updateTarget(dt: number): void {
    this.target[0] = lerp(this.target[0], this.desiredTarget[0], clamp(dt * 4.5, 0.04, 0.2));
    this.target[1] = lerp(this.target[1], this.desiredTarget[1], clamp(dt * 4.5, 0.04, 0.2));
    this.target[2] = lerp(this.target[2], this.desiredTarget[2], clamp(dt * 4.5, 0.04, 0.2));
  }

  private initWalkers(): void {
    const walkConfig = this.sceneConfig.walks ?? {};
    if (walkConfig.enabled === false || this.data.nodes.length === 0 || this.data.links.length === 0) {
      this.walkers = [];
      return;
    }

    const count = clamp(Math.round(walkConfig.count ?? Math.min(10, Math.max(4, this.data.nodes.length / 2))), 2, 18);
    const baseSpeed = walkConfig.speed ?? 0.34;
    this.walkers = Array.from({ length: count }, (_, index) => {
      const start = index % this.data.nodes.length;
      const next = chooseNextHop(start, this.adjacency, this.data.nodes) ?? start;
      const startColor = readColorValue(asRecord(this.data.nodes[start]!.point.meta).color);
      return {
        from: start,
        to: next,
        progress: Math.random(),
        speed: baseSpeed + (index % 4) * 0.04,
        color: parseColor(startColor, '#facc15', 0.95),
        size: 8 + (this.data.nodes[start]?.size ?? 1) * 2,
      };
    });
  }

  private updateWalkers(dt: number): void {
    const maxTrails = clamp(Math.round(this.sceneConfig.walks?.trailLength ?? 36), 8, 128);
    for (const walker of this.walkers) {
      walker.progress += dt * walker.speed;
      if (walker.progress < 1) continue;

      const from = this.data.nodes[walker.from];
      const to = this.data.nodes[walker.to];
      if (from && to) {
        this.trails.push({
          from: [from.x, from.y, from.z],
          to: [to.x, to.y, to.z],
          color: walker.color,
          life: 1,
        });
      }

      walker.from = walker.to;
      walker.to = chooseNextHop(walker.from, this.adjacency, this.data.nodes) ?? walker.from;
      walker.progress = 0;
      const nextNode = this.data.nodes[walker.from];
      const nextColor = nextNode ? readColorValue(asRecord(nextNode.point.meta).color) : undefined;
      walker.color = parseColor(nextColor, '#facc15', 0.94);
      walker.size = 8 + (nextNode?.size ?? 1) * 2;
    }

    this.trails = this.trails
      .map((trail) => ({ ...trail, life: trail.life - dt * 0.52 }))
      .filter((trail) => trail.life > 0)
      .slice(-maxTrails);
  }

  private updateCard(): void {
    const node = this.data.nodes[this.pinnedIndex] ?? this.data.nodes[this.hoveredIndex];
    const theme = this.theme;
    if (!node || !theme) {
      this.root.dataset.selectedNode = this.pinnedIndex >= 0 ? this.data.nodes[this.pinnedIndex]?.id ?? '' : '';
      this.root.dataset.activeNode = '';
      this.card.style.opacity = '0';
      this.card.style.transform = 'translateY(4px)';
      return;
    }

    this.root.dataset.selectedNode = this.pinnedIndex >= 0 ? node.id : '';
    this.root.dataset.activeNode = node.id;

    const meta = asRecord(node.point.meta);
    const tooltipRows = Array.isArray(meta.tooltipRows) ? meta.tooltipRows.map(asRecord) : [];
    const lightTheme = relativeLuminance(parseColor(theme.backgroundColor, '#08111f')) > 0.58;
    this.card.style.background = colorToString(theme.tooltip.backgroundColor) ?? '#0f172a';
    this.card.style.color = colorToString(theme.tooltip.textColor) ?? '#e2e8f0';
    this.card.style.border = `1px solid ${colorToString(theme.tooltip.borderColor) ?? '#334155'}`;
    this.card.style.boxShadow = lightTheme ? '0 16px 32px rgba(15, 23, 42, 0.12)' : '0 20px 40px rgba(15, 23, 42, 0.35)';

    const rowsHtml = tooltipRows.slice(0, 4).map((row) => {
      const label = escapeHtml(String(row.label ?? ''));
      const value = escapeHtml(String(row.value ?? ''));
      const color = readString(row.color);
      const style = color ? ` style="color:${escapeHtml(color)}"` : '';
      return `<div class="uc-graph3d-row"><span>${label}</span><strong${style}>${value}</strong></div>`;
    }).join('');
    const community = escapeHtml(String(meta.community ?? meta.partition ?? 'graph'));
    const layer = escapeHtml(String(meta.layer ?? meta.kind ?? 'node'));

    this.card.innerHTML = [
      `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px;">`,
      `<div>`,
      `<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.58;">${this.pinnedIndex >= 0 ? 'Lock' : 'Hover'}</div>`,
      `<div style="font-size:14px;font-weight:700;line-height:1.2;">${escapeHtml(node.label)}</div>`,
      `<div style="font-size:10px;opacity:.64;text-transform:uppercase;letter-spacing:.1em;margin-top:2px;">${community} | ${layer}</div>`,
      `</div>`,
      `<div style="font-variant-numeric:tabular-nums;font-size:11px;opacity:.7;">deg ${node.degree}</div>`,
      `</div>`,
      `<div style="display:flex;flex-direction:column;gap:5px;">${rowsHtml}</div>`,
    ].join('');
    this.card.style.opacity = '1';
    this.card.style.transform = 'translateY(0)';
  }

  private renderLabels(): void {
    const theme = this.theme;
    const background = parseColor(theme?.backgroundColor, '#08111f');
    const tooltipBg = parseColor(theme?.tooltip.backgroundColor ?? theme?.backgroundColor, '#0f172a');
    const border = parseColor(theme?.colors?.border ?? theme?.tooltip.borderColor, '#334155');
    const text = parseColor(theme?.colors?.text ?? theme?.textColor, '#e2e8f0');
    const accent = parseColor(theme?.palette[0] ?? '#3b82f6', '#3b82f6');
    const accentAlt = parseColor(theme?.palette[1] ?? theme?.palette[0] ?? '#0ea5e9', '#0ea5e9');
    const lightTheme = relativeLuminance(background) > 0.58;
    const candidates = new Set<number>();
    if (this.pinnedIndex >= 0) candidates.add(this.pinnedIndex);
    if (this.hoveredIndex >= 0) candidates.add(this.hoveredIndex);

    const topByDegree = this.data.nodes
      .map((node, index) => ({ index, degree: node.degree, bridgeRisk: readNumber(asRecord(node.point.meta).bridgeRisk) ?? 0 }))
      .sort((a, b) => (b.bridgeRisk - a.bridgeRisk) || (b.degree - a.degree))
      .slice(0, 4);

    for (const entry of topByDegree) candidates.add(entry.index);

    const chosen = [...candidates]
      .filter((index) => this.projectedNodes[index]?.visible)
      .sort((a, b) => this.projectedNodes[a]!.depth - this.projectedNodes[b]!.depth)
      .slice(0, 5);

    const labels: string[] = [];
    const occupied: Array<{ x: number; y: number }> = [];
    for (const index of chosen) {
      const projected = this.projectedNodes[index];
      const node = this.data.nodes[index];
      if (!projected || !node || !projected.visible) continue;
      if (occupied.some((entry) => Math.abs(entry.x - projected.x) < 84 && Math.abs(entry.y - projected.y) < 18)) continue;
      occupied.push({ x: projected.x, y: projected.y });
      const tint = lightTheme
        ? rgbaCss(mixColors(node.color, text, 0.68), 1)
        : rgbaCss(node.color, index === this.pinnedIndex ? 1 : 0.9);
      const emphasis = index === this.pinnedIndex
        ? rgbaCss(mixColors(accent, tooltipBg, lightTheme ? 0.32 : 0.54), lightTheme ? 0.2 : 0.28)
        : index === this.hoveredIndex
          ? rgbaCss(mixColors(accentAlt, tooltipBg, lightTheme ? 0.28 : 0.48), lightTheme ? 0.18 : 0.24)
          : rgbaCss(mixColors(tooltipBg, background, lightTheme ? 0.18 : 0.42), lightTheme ? 0.92 : 0.74);
      const borderCss = rgbaCss(border, lightTheme ? 0.34 : 0.18);
      const shadowCss = lightTheme ? '0 8px 20px rgba(15,23,42,0.08)' : '0 8px 20px rgba(2,8,23,0.18)';
      labels.push([
        `<div style="position:absolute;left:${projected.x}px;top:${projected.y - 12}px;transform:translate(-50%,-100%);`,
        `padding:4px 8px;border-radius:999px;background:${emphasis};border:1px solid ${borderCss};`,
        `font:600 10px/1.1 Inter,Segoe UI,sans-serif;letter-spacing:.04em;color:${tint};white-space:nowrap;`,
        `box-shadow:${shadowCss};">`,
        `${escapeHtml(node.label)}`,
        `</div>`,
      ].join(''));
    }

    this.labelLayer.innerHTML = labels.join('');
  }

  private renderFallback(text: string): void {
    if (!this.fallback) {
      this.fallback = document.createElement('div');
      this.fallback.style.cssText = [
        'position:absolute',
        'inset:0',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:12px',
        'letter-spacing:.08em',
        'text-transform:uppercase',
      ].join(';');
      this.root.appendChild(this.fallback);
    }
    const theme = this.theme;
    const lightTheme = theme ? relativeLuminance(parseColor(theme.backgroundColor, '#08111f')) > 0.58 : false;
    const bg = theme
      ? rgbaCss(mixColors(parseColor(theme.tooltip.backgroundColor ?? theme.backgroundColor, '#0f172a'), parseColor(theme.backgroundColor, '#08111f'), lightTheme ? 0.2 : 0.46), lightTheme ? 0.94 : 0.78)
      : 'rgba(15,23,42,0.72)';
    const border = theme
      ? rgbaCss(parseColor(theme.tooltip.borderColor, '#334155'), lightTheme ? 0.34 : 0.18)
      : 'transparent';
    this.fallback.style.color = colorToString(theme?.textColor) ?? '#94a3b8';
    this.fallback.style.background = bg;
    this.fallback.style.border = `1px solid ${border}`;
    this.fallback.textContent = text;
  }

  private resetOrbit(): void {
    const radius = Math.max(1, this.data.radius);
    this.orbit.theta = 0.54;
    this.orbit.phi = 1.02;
    this.orbit.distance = clamp(this.sceneConfig.initialDistance ?? radius * 2.5, Math.max(6, radius * 1.15), Math.max(20, radius * 7));
    this.target = [...this.data.center];
    this.desiredTarget = [...this.data.center];
    this.lastInteractionAt = performance.now();
  }

  private setHovered(nextIndex: number, originalEvent?: Event): void {
    if (this.hoveredIndex === nextIndex) return;
    if (nextIndex < 0) {
      this.hoveredIndex = -1;
      if (this.chartState) this.chartState.hoveredPoint = undefined;
      this.bus.emit('leave', { originalEvent });
      this.updateCard();
      return;
    }

    this.hoveredIndex = nextIndex;
    const node = this.data.nodes[nextIndex];
    if (!node) return;
    if (this.chartState) {
      this.chartState.hoveredPoint = { seriesId: this.seriesId, index: nextIndex };
    }
    this.bus.emit('hover', {
      seriesId: this.seriesId,
      point: node.point,
      pointIndex: nextIndex,
      originalEvent,
    });
    this.updateCard();
  }

  private setPinned(nextIndex: number, originalEvent?: Event): void {
    const node = this.data.nodes[nextIndex];
    if (!node) return;
    this.pinnedIndex = nextIndex;
    this.desiredTarget = [node.x, node.y, node.z];
    if (this.chartState) {
      this.chartState.selectedPoints = [{ seriesId: this.seriesId, index: nextIndex }];
    }
    this.bus.emit('click', {
      seriesId: this.seriesId,
      point: node.point,
      pointIndex: nextIndex,
      originalEvent,
    });
    if (this.chartConfig?.interaction?.selection?.enabled) {
      this.bus.emit('select', {
        seriesId: this.seriesId,
        point: node.point,
        pointIndex: nextIndex,
        originalEvent,
      });
    }
    this.updateCard();
  }

  private clearPinned(originalEvent?: Event): void {
    if (this.pinnedIndex < 0) return;
    const oldIndex = this.pinnedIndex;
    this.pinnedIndex = -1;
    this.desiredTarget = [...this.data.center];
    if (this.chartState) this.chartState.selectedPoints = [];
    if (this.chartConfig?.interaction?.selection?.enabled) {
      this.bus.emit('deselect', {
        seriesId: this.seriesId,
        pointIndex: oldIndex,
        originalEvent,
      });
    }
    this.updateCard();
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    this.pointerDown = true;
    this.movedWhileDown = false;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.lastInteractionAt = performance.now();
    this.canvas.style.cursor = 'grabbing';
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    if (this.pointerDown) {
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.movedWhileDown = true;
      this.orbit.theta -= dx * 0.007;
      this.orbit.phi = clamp(this.orbit.phi + dy * 0.007, 0.16, Math.PI - 0.16);
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.lastInteractionAt = performance.now();
      return;
    }

    const hitIndex = this.hitTest(localX, localY);
    this.setHovered(hitIndex, event);
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    this.canvas.style.cursor = 'grab';
    if (!this.pointerDown) return;
    this.pointerDown = false;

    const rect = this.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const hitIndex = this.hitTest(localX, localY);

    if (!this.movedWhileDown) {
      if (hitIndex >= 0) {
        this.setPinned(hitIndex, event);
      } else {
        this.clearPinned(event);
        this.setHovered(-1, event);
      }
    }

    this.lastInteractionAt = performance.now();
  };

  private readonly handlePointerLeave = (event: PointerEvent) => {
    if (this.pointerDown) return;
    if (this.pinnedIndex < 0) this.setHovered(-1, event);
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const radius = Math.max(1, this.data.radius);
    const minDistance = this.sceneConfig.minDistance ?? Math.max(5.2, radius * 1.05);
    const maxDistance = this.sceneConfig.maxDistance ?? Math.max(22, radius * 8.5);
    const scale = event.deltaY > 0 ? 1.09 : 0.91;
    this.orbit.distance = clamp(this.orbit.distance * scale, minDistance, maxDistance);
    this.lastInteractionAt = performance.now();
  };

  private readonly handleDoubleClick = (event: MouseEvent) => {
    this.clearPinned(event);
    this.resetOrbit();
  };

  private hitTest(x: number, y: number): number {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < this.projectedNodes.length; index += 1) {
      const projected = this.projectedNodes[index]!;
      if (!projected.visible) continue;
      const node = this.data.nodes[index]!;
      const threshold = 10 + node.size * 8;
      const dx = projected.x - x;
      const dy = projected.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  private disposeGL(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const buffer of [
      this.edgePositionBuffer,
      this.edgeColorBuffer,
      this.nodePositionBuffer,
      this.nodeColorBuffer,
      this.nodeSizeBuffer,
      this.walkerPositionBuffer,
      this.walkerColorBuffer,
      this.walkerSizeBuffer,
      this.trailPositionBuffer,
      this.trailColorBuffer,
    ]) {
      if (buffer) gl.deleteBuffer(buffer);
    }

    for (const bundle of [this.linesProgram, this.pointsProgram]) {
      if (bundle) gl.deleteProgram(bundle.program);
    }

    this.gl = null;
    this.linesProgram = null;
    this.pointsProgram = null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readColorValue(value: unknown): ColorValue | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value as ColorValue;
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function parseColor(color: ColorValue | undefined, fallback: string, alpha = 1): [number, number, number, number] {
  const raw = colorToString(color) ?? fallback;
  const rgba = parseColorString(raw);
  return [rgba[0], rgba[1], rgba[2], alpha * rgba[3]];
}

function colorToString(color: ColorValue | undefined): string | null {
  if (!color) return null;
  if (typeof color === 'string') return color;
  if (typeof (color as GradientDef).type === 'string') {
    return (color as GradientDef).stops[0]?.color ?? null;
  }
  const rgba = color as { r: number; g: number; b: number; a?: number };
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a ?? 1})`;
}

function parseColorString(value: string): [number, number, number, number] {
  const hex = value.trim();
  if (/^#([0-9a-f]{3})$/i.test(hex)) {
    const [, short] = /^#([0-9a-f]{3})$/i.exec(hex) ?? [];
    if (!short) return [1, 1, 1, 1];
    return [
      Number.parseInt(short[0] + short[0], 16) / 255,
      Number.parseInt(short[1] + short[1], 16) / 255,
      Number.parseInt(short[2] + short[2], 16) / 255,
      1,
    ];
  }
  if (/^#([0-9a-f]{6})$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(1, 3), 16) / 255,
      Number.parseInt(hex.slice(3, 5), 16) / 255,
      Number.parseInt(hex.slice(5, 7), 16) / 255,
      1,
    ];
  }
  const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(hex);
  if (rgbaMatch) {
    const parts = rgbaMatch[1]!.split(',').map((part) => Number.parseFloat(part.trim()));
    return [
      clamp((parts[0] ?? 255) / 255, 0, 1),
      clamp((parts[1] ?? 255) / 255, 0, 1),
      clamp((parts[2] ?? 255) / 255, 0, 1),
      clamp(parts[3] ?? 1, 0, 1),
    ];
  }
  return [1, 1, 1, 1];
}

function applyForceLayout(
  nodes: Graph3DRenderableNode[],
  links: Graph3DRenderableLink[],
  ignoreExistingCoords = false,
): void {
  if (nodes.length === 0) return;

  const positions = new Float32Array(nodes.length * 3);
  const communities = Array.from(new Set(nodes.map((node) => readString(asRecord(node.point.meta).community) ?? 'graph')));
  const layers = Array.from(new Set(nodes.map((node) => readString(asRecord(node.point.meta).layer) ?? 'layer')));
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    const hasCoords = !ignoreExistingCoords && Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z);
    if (hasCoords) {
      positions[index * 3] = node.x;
      positions[index * 3 + 1] = node.y;
      positions[index * 3 + 2] = node.z;
      continue;
    }

    const [seedX, seedY, seedZ] = seedGraphPosition(node, index, communities, layers);
    positions[index * 3] = seedX;
    positions[index * 3 + 1] = seedY;
    positions[index * 3 + 2] = seedZ;
  }

  const k = Math.max(5, 16 / Math.sqrt(nodes.length));
  const disp = new Float32Array(nodes.length * 3);
  let temperature = Math.max(3, k * 0.9);

  for (let iteration = 0; iteration < 56; iteration += 1) {
    disp.fill(0);

    for (let i = 0; i < nodes.length; i += 1) {
      const ix = i * 3;
      for (let j = i + 1; j < nodes.length; j += 1) {
        const jx = j * 3;
        let dx = positions[ix] - positions[jx];
        let dy = positions[ix + 1] - positions[jx + 1];
        let dz = positions[ix + 2] - positions[jx + 2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.12;
        const force = (k * k) / distance;
        dx = (dx / distance) * force;
        dy = (dy / distance) * force;
        dz = (dz / distance) * force;
        disp[ix] += dx;
        disp[ix + 1] += dy;
        disp[ix + 2] += dz;
        disp[jx] -= dx;
        disp[jx + 1] -= dy;
        disp[jx + 2] -= dz;
      }
    }

    for (const link of links) {
      const sx = link.sourceIndex * 3;
      const tx = link.targetIndex * 3;
      let dx = positions[sx] - positions[tx];
      let dy = positions[sx + 1] - positions[tx + 1];
      let dz = positions[sx + 2] - positions[tx + 2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.12;
      const force = (distance * distance) / (k * 3.2);
      dx = (dx / distance) * force;
      dy = (dy / distance) * force;
      dz = (dz / distance) * force;
      disp[sx] -= dx;
      disp[sx + 1] -= dy;
      disp[sx + 2] -= dz;
      disp[tx] += dx;
      disp[tx + 1] += dy;
      disp[tx + 2] += dz;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const ix = i * 3;
      const distance = Math.sqrt(disp[ix] * disp[ix] + disp[ix + 1] * disp[ix + 1] + disp[ix + 2] * disp[ix + 2]) + 0.0001;
      const scale = Math.min(distance, temperature) / distance;
      positions[ix] += disp[ix] * scale;
      positions[ix + 1] += disp[ix + 1] * scale;
      positions[ix + 2] += disp[ix + 2] * scale;
    }

    temperature *= 0.94;
  }

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    cx += positions[index * 3];
    cy += positions[index * 3 + 1];
    cz += positions[index * 3 + 2];
  }
  cx /= nodes.length;
  cy /= nodes.length;
  cz /= nodes.length;

  for (let index = 0; index < nodes.length; index += 1) {
    nodes[index]!.x = positions[index * 3] - cx;
    nodes[index]!.y = positions[index * 3 + 1] - cy;
    nodes[index]!.z = positions[index * 3 + 2] - cz;
  }
}

function seedGraphPosition(
  node: Graph3DRenderableNode,
  index: number,
  communities: string[],
  layers: string[],
): Vec3 {
  const meta = asRecord(node.point.meta);
  const community = readString(meta.community) ?? communities[0] ?? 'graph';
  const layer = readString(meta.layer) ?? layers[0] ?? 'layer';
  const communityIndex = Math.max(0, communities.indexOf(community));
  const layerIndex = Math.max(0, layers.indexOf(layer));
  const communityCount = Math.max(1, communities.length);
  const layerCenter = (layers.length - 1) / 2;
  const angle = ((communityIndex + 0.35) / communityCount) * Math.PI * 2 + (index % 5) * 0.42;
  const clusterRadius = 8.6 + (layerIndex % 2) * 1.4;
  const jitter = 1.25 + (index % 3) * 0.45;
  const y = (layerIndex - layerCenter) * 4.6 + Math.sin(index * 1.13 + communityIndex * 0.6) * 0.9;
  return [
    Math.cos(angle) * clusterRadius + Math.cos(index * 1.9) * jitter,
    y,
    Math.sin(angle) * clusterRadius + Math.sin(index * 1.37) * jitter,
  ];
}

function distance3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function appendCurvedEdge(
  sink: number[],
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  center: Vec3,
  segments: number,
  arcHeight: number,
): void {
  const mid: Vec3 = [(from.x + to.x) * 0.5, (from.y + to.y) * 0.5, (from.z + to.z) * 0.5];
  let nx = mid[0] - center[0];
  let ny = mid[1] - center[1];
  let nz = mid[2] - center[2];
  let len = Math.hypot(nx, ny, nz);
  if (len < 0.0001) {
    nx = from.y - to.y;
    ny = to.x - from.x;
    nz = from.z - to.z;
    len = Math.hypot(nx, ny, nz) || 1;
  }
  nx /= len;
  ny /= len;
  nz /= len;
  const control: Vec3 = [mid[0] + nx * arcHeight, mid[1] + ny * arcHeight, mid[2] + nz * arcHeight];

  for (let segment = 0; segment < segments; segment += 1) {
    const t0 = segment / segments;
    const t1 = (segment + 1) / segments;
    const p0 = quadraticPoint(from, control, to, t0);
    const p1 = quadraticPoint(from, control, to, t1);
    sink.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
  }
}

function quadraticPoint(
  from: { x: number; y: number; z: number },
  control: Vec3,
  to: { x: number; y: number; z: number },
  t: number,
): Vec3 {
  const inv = 1 - t;
  return [
    inv * inv * from.x + 2 * inv * t * control[0] + t * t * to.x,
    inv * inv * from.y + 2 * inv * t * control[1] + t * t * to.y,
    inv * inv * from.z + 2 * inv * t * control[2] + t * t * to.z,
  ];
}

function rgbaCss(color: [number, number, number, number], alpha = color[3]): string {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${alpha})`;
}

function mixColors(
  from: [number, number, number, number],
  to: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  return [
    lerp(from[0], to[0], t),
    lerp(from[1], to[1], t),
    lerp(from[2], to[2], t),
    lerp(from[3], to[3], t),
  ];
}

function relativeLuminance(color: [number, number, number, number]): number {
  const linearize = (channel: number) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  const r = linearize(color[0]);
  const g = linearize(color[1]);
  const b = linearize(color[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function buildAdjacency(nodeCount: number, links: Graph3DRenderableLink[]): number[][] {
  const adjacency = Array.from({ length: nodeCount }, () => [] as number[]);
  for (const link of links) {
    adjacency[link.sourceIndex]!.push(link.targetIndex);
    adjacency[link.targetIndex]!.push(link.sourceIndex);
  }
  return adjacency;
}

function chooseNextHop(index: number, adjacency: number[][], nodes: Graph3DRenderableNode[]): number | null {
  const neighbors = adjacency[index] ?? [];
  if (neighbors.length === 0) return null;
  const weighted = neighbors.map((neighbor) => {
    const pointMeta = asRecord(nodes[neighbor]?.point.meta);
    const bridgeRisk = readNumber(pointMeta.bridgeRisk) ?? 0.25;
    return { neighbor, score: 0.35 + bridgeRisk + (nodes[neighbor]?.degree ?? 0) * 0.03 };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.score, 0);
  let target = Math.random() * total;
  for (const entry of weighted) {
    target -= entry.score;
    if (target <= 0) return entry.neighbor;
  }
  return weighted[weighted.length - 1]?.neighbor ?? neighbors[0] ?? null;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attribNames: string[],
  uniformNames: string[],
): GLProgramBundle {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Graph3D program creation failed.');
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'Unknown WebGL link error';
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(info);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  const attribs: Record<string, number> = {};
  for (const name of attribNames) attribs[name] = gl.getAttribLocation(program, name);
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, attribs, uniforms };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Graph3D shader creation failed.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown WebGL shader error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function buildViewProjectionMatrix(
  aspect: number,
  orbit: { theta: number; phi: number; distance: number },
  target: Vec3,
  fallbackDistance: number,
): Mat4 {
  const distance = Math.max(orbit.distance || 0, fallbackDistance);
  const eye: Vec3 = [
    target[0] + distance * Math.sin(orbit.phi) * Math.sin(orbit.theta),
    target[1] + distance * Math.cos(orbit.phi),
    target[2] + distance * Math.sin(orbit.phi) * Math.cos(orbit.theta),
  ];
  const view = lookAt(eye, target, [0, 1, 0]);
  const projection = perspective(46 * (Math.PI / 180), aspect, 0.1, Math.max(240, distance * 18));
  return multiplyMat4(projection, view);
}

function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const out = new Float32Array(16);
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function multiplyMat4Vec4(matrix: Mat4, vector: [number, number, number, number]): [number, number, number, number] {
  const x = vector[0];
  const y = vector[1];
  const z = vector[2];
  const w = vector[3];
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w,
  ];
}
