import type { ChartConfig, DataPoint, SeriesConfig } from '../core/types';

export const MISSION_DOCUMENT_VERSION = 'risklab.mission/v1' as const;

export type MissionDataset =
  | SurfaceGridDataset
  | TemporalGraphDataset
  | GraphDataset
  | ForecastConeDataset
  | MultiSurfaceDataset
  | Histogram3DDataset
  | ScatterEnvelopeDataset
  | EventTimelineDataset
  | GeoSurfaceDataset
  | CompositeDataset;

export interface MissionDocument {
  version: typeof MISSION_DOCUMENT_VERSION;
  meta: { synthetic: true; displayOnly: true; source?: string; generatedAt?: string };
  panels: MissionPanel[];
  datasets: Record<string, MissionDataset>;
}

export interface MissionPanel {
  id: string;
  title: string;
  type: 'temporalGraph3d' | 'surface3d' | 'graphWalk3d' | 'multiSurface3d' | 'graph3d' | 'forecastCone3d' | 'histogram3d' | 'scatterEnvelope3d' | 'geoSurface3d' | 'eventTimeline3d' | 'composite';
  dataRef: string;
  subtitle?: string;
}

export interface SurfaceGridDataset {
  kind: 'surfaceGrid' | 'geoSurface';
  x: number[];
  y: number[];
  z: number[][];
  axes?: MissionAxes;
  values?: Record<string, string | number | boolean>;
}

export interface GraphDataset {
  kind: 'graph' | 'graphWalk';
  nodes: Array<{ id: string; x: number; y: number; z: number; label?: string; size?: number; color?: string; slice?: number; meta?: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; weight?: number; color?: string; pathId?: string; meta?: Record<string, unknown> }>;
  axes?: MissionAxes;
  paths?: Array<{ id: string; nodeIds: string[]; color?: string; confidence?: number }>;
  walks?: Array<{ id: string; weight?: number; steps: Array<{ nodeId: string; t: number }> }>;
}

export interface TemporalGraphDataset {
  kind: 'temporalGraph';
  frames: Array<{ t: string; nodes: GraphDataset['nodes']; edges: GraphDataset['edges'] }>;
  axes?: MissionAxes;
}

export interface ForecastConeDataset {
  kind: 'forecastCone';
  origin: Vec3;
  slices: Array<{ horizon: number; center: Vec3; radiusY: number; radiusZ: number; confidence: number; label?: string }>;
  axes?: MissionAxes;
}

export interface MultiSurfaceDataset {
  kind: 'multiSurface' | 'multiSurfaceGrid';
  surfaces?: Array<{ id: string; label: string; x: number[]; y: number[]; z: number[][]; color?: string }>;
  layers?: Array<{ id: string; label?: string; x: number[]; y: number[]; z: number[][]; color?: string }>;
  axes?: MissionAxes;
}

export interface Histogram3DDataset {
  kind: 'histogram3d';
  x?: string[];
  y?: string[];
  values?: number[][];
  xKey?: string;
  yKey?: string;
  zKey?: string;
  seriesKey?: string;
  bins?: Array<Record<string, string | number>>;
  axes?: MissionAxes;
}

export interface ScatterEnvelopeDataset {
  kind: 'scatterEnvelope3d';
  points?: Array<Vec3 & { id: string; label?: string; anomaly?: boolean; score?: number; color?: string }>;
  baseline?: Array<Vec3 & { score?: number }>;
  anomalies?: Array<Vec3 & { score?: number }>;
  observedPath?: Array<Vec3 & { t?: number }>;
  envelope?: Array<Vec3> | { center: [number, number, number]; radii: [number, number, number]; opacity?: number };
  thresholds?: { leadSignal?: number; signalShift?: number };
  axes?: MissionAxes;
}

export interface EventTimelineDataset {
  kind: 'eventTimeline3d';
  events: Array<{ id: string; time: string; lane: string; value: number; label: string; status?: string; relatedIds?: string[] }>;
  axes?: MissionAxes;
}

interface Vec3 { x: number; y: number; z: number }
interface MissionAxes { x?: AxisContract; y?: AxisContract; z?: AxisContract }
interface AxisContract { label: string; unit?: string; min?: number; max?: number }

export interface GeoSurfaceDataset {
  kind: 'geoSurfaceGrid';
  lat: number[];
  lon: number[];
  z: number[][];
  events?: Array<{ id: string; lat: number; lon: number; type: string; severity: number }>;
}

export interface CompositeDataset {
  kind: 'composite';
  eventGraph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
  behaviorDrift: { points: Array<Record<string, unknown>>; leadSignalAt?: number; signalShiftAt?: number };
  transactionFlows: { links: Array<Record<string, unknown>> };
  controlTimeline: { events: Array<Record<string, unknown>> };
}

export function validateMissionDocument(value: unknown): MissionDocument {
  const root = record(value, 'document');
  if (root.version !== MISSION_DOCUMENT_VERSION) throw new Error(`Unsupported mission document version: ${String(root.version)}`);
  const meta = record(root.meta, 'meta');
  if (meta.synthetic !== true || meta.displayOnly !== true) throw new Error('Mission document must be synthetic and display-only.');
  const panels = array(root.panels, 'panels').map((value, index) => validatePanel(value, index));
  const rawDatasets = record(root.datasets, 'datasets');
  const datasets: Record<string, MissionDataset> = {};
  for (const [id, dataset] of Object.entries(rawDatasets)) datasets[id] = validateDataset(dataset, `datasets.${id}`);
  const ids = new Set<string>();
  for (const panel of panels) {
    if (ids.has(panel.id)) throw new Error(`Duplicate panel id: ${panel.id}`);
    ids.add(panel.id);
    if (!datasets[panel.dataRef]) throw new Error(`Panel ${panel.id} references missing dataset ${panel.dataRef}.`);
  }
  return { version: MISSION_DOCUMENT_VERSION, meta: meta as MissionDocument['meta'], panels, datasets };
}

export function missionPanelToChartConfig(document: MissionDocument, panelId: string): Omit<ChartConfig, 'container'> {
  const panel = document.panels.find((candidate) => candidate.id === panelId);
  if (!panel) throw new Error(`Unknown mission panel: ${panelId}`);
  const dataset = document.datasets[panel.dataRef]!;
  const series = adaptDataset(panel, dataset);
  return {
    title: { text: panel.title },
    subtitle: panel.subtitle ? { text: panel.subtitle } : undefined,
    series,
    legend: { enabled: false },
    tooltip: { enabled: true, trigger: 'both', pinnable: true, followCursor: true },
    interaction: { selection: { enabled: true, mode: 'single' }, zoom: { enabled: true, wheel: true }, pan: { enabled: true, axis: 'both' } },
    accessibility: { enabled: true, keyboardNavigation: true, summary: `${panel.title}. Synthetic display-only output product.` },
  };
}

function adaptDataset(panel: MissionPanel, dataset: MissionDataset): SeriesConfig[] {
  if (dataset.kind === 'temporalGraph') {
    const frame = dataset.frames[0];
    if (!frame) return [];
    const edges = new Map<string, GraphDataset['edges']>();
    frame.edges.forEach((edge) => edges.set(edge.source, [...(edges.get(edge.source) ?? []), edge]));
    return [{ id: panel.id, name: panel.title, type: 'temporalGraphState3d', data: frame.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, z: node.z, label: node.label, color: node.color, meta: { ...node.meta, slice: 0, score: node.meta?.score, size: node.size, edges: (edges.get(node.id) ?? []).map((edge) => ({ target: edge.target, weight: edge.weight, color: edge.color })) } })) }];
  }
  if (dataset.kind === 'surfaceGrid' || dataset.kind === 'geoSurface') {
    return [{ id: panel.id, name: panel.title, type: dataset.kind === 'geoSurface' ? 'threatSurface3d' : 'terrain3d', data: flattenSurface(dataset) }];
  }
  if (dataset.kind === 'multiSurface' || dataset.kind === 'multiSurfaceGrid') {
    const surfaces = dataset.surfaces ?? dataset.layers ?? [];
    return surfaces.map((surface) => ({ id: surface.id, name: surface.label ?? surface.id, type: 'spectralSurface3d', color: surface.color, data: flattenSurface({ kind: 'surfaceGrid', x: surface.x, y: surface.y, z: surface.z }) }));
  }
  if (dataset.kind === 'graph' || dataset.kind === 'graphWalk') {
    const edgeMap = new Map<string, GraphDataset['edges']>();
    for (const edge of dataset.edges) edgeMap.set(edge.source, [...(edgeMap.get(edge.source) ?? []), edge]);
    return [{ id: panel.id, name: panel.title, type: dataset.kind === 'graphWalk' ? 'powerwalkGraph3d' : 'graph3d', data: dataset.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, z: node.z, label: node.label, color: node.color, meta: { ...node.meta, slice: node.slice, size: node.size, edges: (edgeMap.get(node.id) ?? []).map((edge) => ({ target: edge.target, weight: edge.weight, color: edge.color, pathId: edge.pathId })) } })) }];
  }
  if (dataset.kind === 'forecastCone') {
    const data: DataPoint[] = [];
    for (const slice of dataset.slices) {
      for (let index = 0; index < 32; index += 1) {
        const angle = index / 32 * Math.PI * 2;
        data.push({ x: slice.horizon, y: slice.center.y + Math.cos(angle) * slice.radiusY, z: slice.center.z + Math.sin(angle) * slice.radiusZ, label: slice.label ?? `H+${slice.horizon}`, meta: { horizon: slice.horizon, confidence: slice.confidence, ringIndex: index } });
      }
    }
    return [{ id: panel.id, name: panel.title, type: 'forecastCone3d', data }];
  }
  if (dataset.kind === 'histogram3d') {
    if (dataset.bins?.length) {
      const seriesKey = dataset.seriesKey ?? 'series';
      const xKey = dataset.xKey ?? 'x', yKey = dataset.yKey ?? 'y', zKey = dataset.zKey ?? 'z';
      const groups = Array.from(new Set(dataset.bins.map((bin) => String(bin[seriesKey] ?? bin[yKey] ?? 'Series'))));
      return groups.map((group, rowIndex) => ({ id: `${panel.id}-${rowIndex}`, name: group, type: 'raceOutcomeDistribution3d', data: dataset.bins!.filter((bin) => String(bin[seriesKey] ?? bin[yKey] ?? 'Series') === group).map((bin) => ({ x: Number(bin[xKey] ?? 0), y: rowIndex, z: Number(bin[zKey] ?? 0), label: String(bin[xKey] ?? ''), meta: { ...bin } })) }));
    }
    return (dataset.y ?? []).map((row, rowIndex) => ({ id: `${panel.id}-${rowIndex}`, name: row, type: 'raceOutcomeDistribution3d', data: (dataset.x ?? []).map((label, columnIndex) => ({ x: columnIndex, y: rowIndex, z: dataset.values?.[rowIndex]?.[columnIndex] ?? 0, label, meta: { row, value: dataset.values?.[rowIndex]?.[columnIndex] ?? 0 } })) }));
  }
  if (dataset.kind === 'scatterEnvelope3d') {
    const points = dataset.points ?? [
      ...(dataset.baseline ?? []).map((point, index) => ({ ...point, id: `baseline-${index}`, anomaly: false, color: '#38bdf8' })),
      ...(dataset.anomalies ?? []).map((point, index) => ({ ...point, id: `anomaly-${index}`, anomaly: true, color: '#ef4444' })),
    ];
    return [{ id: panel.id, name: panel.title, type: 'anomalyDetectionField3d', data: points.map((point) => ({ id: point.id, x: point.x, y: point.y, z: point.z, label: 'label' in point ? point.label : undefined, color: point.color, meta: { anomaly: point.anomaly, score: point.score, thresholds: dataset.thresholds } })) }];
  }
  if (dataset.kind === 'geoSurfaceGrid') {
    return [{ id: panel.id, name: panel.title, type: 'threatSurface3d', data: dataset.lat.flatMap((lat, row) => dataset.lon.map((lon, column) => ({ x: lon, y: lat, z: dataset.z[row]?.[column] ?? 0, meta: { row, column, gridWidth: dataset.lon.length } }))) }];
  }
  if (dataset.kind === 'composite') {
    const nodes = dataset.eventGraph.nodes;
    const edges = dataset.eventGraph.edges;
    return [{ id: panel.id, name: panel.title, type: 'graph3d', data: nodes.map((node, index) => ({ id: String(node.id ?? index), x: Number(node.x ?? 0), y: Number(node.y ?? 0), z: Number(node.z ?? 0), label: String(node.label ?? node.id ?? index), meta: { ...node, edges: edges.filter((edge) => edge.source === node.id).map((edge) => ({ target: edge.target, weight: edge.weight })) } })) }];
  }
  const timeline = dataset as EventTimelineDataset;
  return [{ id: panel.id, name: panel.title, type: 'controlEventTimeline3d', data: timeline.events.map((event, index) => ({ id: event.id, x: index, y: event.lane, z: event.value, label: event.label, meta: { time: event.time, status: event.status, relatedIds: event.relatedIds } })) }];
}

function flattenSurface(dataset: SurfaceGridDataset): DataPoint[] {
  if (dataset.z.length !== dataset.y.length || dataset.z.some((row) => row.length !== dataset.x.length)) throw new Error('Surface grid dimensions do not match x/y coordinates.');
  return dataset.y.flatMap((y, row) => dataset.x.map((x, column) => ({ x, y, z: dataset.z[row]![column]!, meta: { row, column, gridWidth: dataset.x.length } })));
}

function validatePanel(value: unknown, index: number): MissionPanel {
  const panel = record(value, `panels[${index}]`);
  return { id: text(panel.id, 'panel.id'), title: text(panel.title, 'panel.title'), type: text(panel.type, 'panel.type') as MissionPanel['type'], dataRef: text(panel.dataRef, 'panel.dataRef'), subtitle: typeof panel.subtitle === 'string' ? panel.subtitle : undefined };
}

function validateDataset(value: unknown, path: string): MissionDataset {
  const dataset = record(value, path);
  const kind = text(dataset.kind, `${path}.kind`);
  if (kind === 'surfaceGrid' || kind === 'geoSurface') {
    const x = numbers(dataset.x, `${path}.x`), y = numbers(dataset.y, `${path}.y`);
    const z = array(dataset.z, `${path}.z`).map((row, index) => numbers(row, `${path}.z[${index}]`));
    if (z.length !== y.length || z.some((row) => row.length !== x.length)) throw new Error(`${path} grid dimensions do not match.`);
  }
  if (!['surfaceGrid', 'geoSurface', 'geoSurfaceGrid', 'graph', 'temporalGraph', 'graphWalk', 'forecastCone', 'multiSurface', 'multiSurfaceGrid', 'histogram3d', 'scatterEnvelope3d', 'eventTimeline3d', 'composite'].includes(kind)) throw new Error(`${path}.kind is unsupported: ${kind}`);
  return dataset as unknown as MissionDataset;
}

function record(value: unknown, path: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`); return value as Record<string, unknown>; }
function array(value: unknown, path: string): unknown[] { if (!Array.isArray(value)) throw new Error(`${path} must be an array.`); return value; }
function text(value: unknown, path: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be a non-empty string.`); return value; }
function numbers(value: unknown, path: string): number[] { return array(value, path).map((item, index) => { if (typeof item !== 'number' || !Number.isFinite(item)) throw new Error(`${path}[${index}] must be finite.`); return item; }); }
