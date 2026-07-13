import type { AxisConfig, ChartConfig, ChartType, DataPoint, SeriesConfig } from '../../core/types';
import { mount, type VanillaChartInstance } from '../vanilla';
import { getChartSVG, serializeSVG } from '../../plugins/ExportPlugin';

export type LegacyChartPoint = number | [number | string, number] | [number, number, number, number, number] | Record<string, unknown>;

export interface LegacySeriesOptions {
  id?: string;
  name?: string;
  type?: string;
  data?: LegacyChartPoint[];
  color?: string;
  visible?: boolean;
  lineWidth?: number;
  dashStyle?: string;
  yAxis?: number | string;
  xAxis?: number | string;
  stacking?: string;
  stack?: string;
  marker?: { enabled?: boolean; radius?: number; symbol?: string };
}

export interface LegacyAxisOptions {
  id?: string;
  type?: 'linear' | 'logarithmic' | 'datetime' | 'category';
  title?: { text?: string };
  categories?: string[];
  min?: number;
  max?: number;
  opposite?: boolean;
  reversed?: boolean;
  visible?: boolean;
  gridLineWidth?: number;
  gridLineColor?: string;
  tickInterval?: number;
  labels?: { enabled?: boolean; rotation?: number; format?: string };
}

export interface LegacyChartOptions {
  chart?: { type?: string; width?: number; height?: number; inverted?: boolean; animation?: boolean; zoomType?: 'x' | 'y' | 'xy'; panning?: boolean | { enabled?: boolean; type?: 'x' | 'y' | 'xy' }; backgroundColor?: string; events?: Record<string, (...args: unknown[]) => void> };
  title?: { text?: string; align?: 'left' | 'center' | 'right'; style?: { color?: string; fontSize?: string; fontWeight?: string } };
  subtitle?: { text?: string; align?: 'left' | 'center' | 'right'; style?: { color?: string; fontSize?: string } };
  xAxis?: LegacyAxisOptions | LegacyAxisOptions[];
  yAxis?: LegacyAxisOptions | LegacyAxisOptions[];
  series?: LegacySeriesOptions[];
  colors?: string[];
  legend?: { enabled?: boolean; layout?: 'horizontal' | 'vertical'; align?: 'left' | 'center' | 'right'; verticalAlign?: 'top' | 'middle' | 'bottom'; reversed?: boolean; floating?: boolean };
  tooltip?: { enabled?: boolean; shared?: boolean; followPointer?: boolean; valueDecimals?: number; backgroundColor?: string; borderColor?: string; borderRadius?: number };
  plotOptions?: { series?: { animation?: boolean; lineWidth?: number; stacking?: string; marker?: { enabled?: boolean; radius?: number }; allowPointSelect?: boolean } } & Record<string, unknown>;
  exporting?: { enabled?: boolean; filename?: string };
  accessibility?: { enabled?: boolean; description?: string };
  credits?: { enabled?: boolean };
  lang?: { locale?: string; decimalPoint?: string; thousandsSep?: string };
}

const TYPE_ALIASES: Record<string, ChartType> = {
  areaspline: 'area', areasplinerange: 'arearange', column: 'column', bar: 'bar', line: 'line', spline: 'spline',
  scatter: 'scatter', bubble: 'bubble', pie: 'pie', variablepie: 'pie', heatmap: 'heatmap', treemap: 'treemap',
  candlestick: 'candlestick', ohlc: 'ohlc', waterfall: 'waterfall', funnel: 'funnel', gauge: 'gauge',
  solidgauge: 'solidGauge', boxplot: 'boxPlot', errorbar: 'errorBand', histogram: 'histogram', xrange: 'xrange',
  packedbubble: 'packedBubble', dependencywheel: 'dependencyWheel', organization: 'organization', item: 'item',
  streamgraph: 'streamgraph', tilemap: 'tilemap', treegraph: 'treegraph', venn: 'venn', variwide: 'variwide',
  columnrange: 'columnrange', arearange: 'arearange', bellcurve: 'bellcurve', sankey: 'sankey', polygon: 'scatter',
};

const DASHES: Record<string, number[]> = { dash: [6, 4], dot: [2, 3], shortdash: [4, 3], longdash: [10, 4], dashdot: [6, 3, 2, 3] };

function chartType(value?: string): ChartType { return TYPE_ALIASES[(value ?? 'line').toLowerCase()] ?? (value as ChartType) ?? 'line'; }
function numericFontSize(value?: string): number | undefined { if (!value) return undefined; const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : undefined; }
function axisArray(value?: LegacyAxisOptions | LegacyAxisOptions[]): LegacyAxisOptions[] { return value ? (Array.isArray(value) ? value : [value]) : [{}]; }

function mapPoint(point: LegacyChartPoint, index: number, categories?: string[]): DataPoint {
  if (typeof point === 'number') return { x: categories?.[index] ?? index, y: point };
  if (Array.isArray(point)) {
    if (point.length >= 5) return { x: point[0], open: Number(point[1]), high: Number(point[2]), low: Number(point[3]), close: Number(point[4]), y: Number(point[4]) };
    return { x: point[0], y: point[1] };
  }
  const value = point as Record<string, unknown>;
  return {
    ...value,
    x: (value.x as DataPoint['x']) ?? categories?.[index] ?? index,
    y: (value.y as DataPoint['y']) ?? (value.value as DataPoint['y']) ?? 0,
    label: typeof value.name === 'string' ? value.name : value.label as string | undefined,
    id: typeof value.id === 'string' ? value.id : undefined,
    color: typeof value.color === 'string' ? value.color : undefined,
    meta: value.custom && typeof value.custom === 'object' ? value.custom as Record<string, unknown> : undefined,
  } as DataPoint;
}

function mapAxis(axis: LegacyAxisOptions, dimension: 'x' | 'y', index: number): AxisConfig {
  const type = axis.categories ? 'band' : axis.type === 'datetime' ? 'time' : axis.type === 'logarithmic' ? 'logarithmic' : axis.type === 'category' ? 'band' : 'linear';
  return {
    id: axis.id ?? `${dimension}${index}`,
    type,
    position: dimension === 'x' ? (axis.opposite ? 'top' : 'bottom') : (axis.opposite ? 'right' : 'left'),
    title: axis.title?.text ? { text: axis.title.text } : undefined,
    min: axis.min,
    max: axis.max,
    inverted: axis.reversed,
    lineVisible: axis.visible !== false,
    opposite: axis.opposite,
    gridLines: { enabled: (axis.gridLineWidth ?? 1) > 0, width: axis.gridLineWidth, color: axis.gridLineColor },
    ticks: { interval: axis.tickInterval, values: axis.categories },
    labels: { enabled: axis.labels?.enabled, rotation: axis.labels?.rotation, format: axis.labels?.format },
  };
}

export function fromLegacyChartOptions(options: LegacyChartOptions): Omit<ChartConfig, 'container'> {
  const xAxes = axisArray(options.xAxis);
  const yAxes = axisArray(options.yAxis);
  const defaultType = chartType(options.chart?.type);
  const common = options.plotOptions?.series;
  const series: SeriesConfig[] = (options.series ?? []).map((item, index) => {
    const xAxisIndex = typeof item.xAxis === 'number' ? item.xAxis : 0;
    const yAxisIndex = typeof item.yAxis === 'number' ? item.yAxis : 0;
    const type = chartType(item.type ?? options.chart?.type);
    const stacking = item.stacking ?? common?.stacking;
    return {
      id: item.id ?? `series-${index + 1}`,
      name: item.name ?? `Series ${index + 1}`,
      type: type ?? defaultType,
      data: (item.data ?? []).map((point, pointIndex) => mapPoint(point, pointIndex, xAxes[xAxisIndex]?.categories)),
      color: item.color ?? options.colors?.[index % Math.max(1, options.colors.length)],
      visible: item.visible,
      lineWidth: item.lineWidth ?? common?.lineWidth,
      dashArray: item.dashStyle ? DASHES[item.dashStyle.toLowerCase()] : undefined,
      marker: { enabled: item.marker?.enabled ?? common?.marker?.enabled, radius: item.marker?.radius ?? common?.marker?.radius },
      stackGroup: stacking ? (item.stack ?? 'default') : undefined,
      xAxisId: typeof item.xAxis === 'string' ? item.xAxis : xAxes[xAxisIndex]?.id ?? `x${xAxisIndex}`,
      yAxisId: typeof item.yAxis === 'string' ? item.yAxis : yAxes[yAxisIndex]?.id ?? `y${yAxisIndex}`,
    };
  });
  const pan = typeof options.chart?.panning === 'object' ? options.chart.panning : { enabled: options.chart?.panning };
  return {
    width: options.chart?.width,
    height: options.chart?.height,
    title: options.title?.text ? { text: options.title.text, align: options.title.align, color: options.title.style?.color, fontSize: numericFontSize(options.title.style?.fontSize), fontWeight: options.title.style?.fontWeight } : undefined,
    subtitle: options.subtitle?.text ? { text: options.subtitle.text, align: options.subtitle.align, color: options.subtitle.style?.color, fontSize: numericFontSize(options.subtitle.style?.fontSize) } : undefined,
    axes: [...xAxes.map((axis, index) => mapAxis(axis, 'x', index)), ...yAxes.map((axis, index) => mapAxis(axis, 'y', index))],
    series,
    legend: options.legend,
    tooltip: { enabled: options.tooltip?.enabled, shared: options.tooltip?.shared, followCursor: options.tooltip?.followPointer, backgroundColor: options.tooltip?.backgroundColor, borderColor: options.tooltip?.borderColor, borderRadius: options.tooltip?.borderRadius },
    animation: { enabled: options.chart?.animation !== false },
    interaction: {
      selection: { enabled: common?.allowPointSelect ?? false, mode: 'single' },
      zoom: { enabled: Boolean(options.chart?.zoomType), axis: options.chart?.zoomType === 'xy' ? 'both' : options.chart?.zoomType },
      pan: { enabled: pan?.enabled ?? false, axis: pan?.type === 'xy' ? 'both' : pan?.type },
    },
    export: { enabled: options.exporting?.enabled !== false, filename: options.exporting?.filename },
    accessibility: { enabled: options.accessibility?.enabled !== false, summary: options.accessibility?.description, keyboardNavigation: true },
    locale: options.lang?.locale,
  };
}

export interface LegacyCompatibleSeries {
  readonly id: string;
  setData(data: LegacyChartPoint[], redraw?: boolean): void;
  addPoint(point: LegacyChartPoint, redraw?: boolean, shift?: boolean): void;
  remove(redraw?: boolean): void;
  setVisible(visible?: boolean, redraw?: boolean): void;
  update(options: Partial<LegacySeriesOptions>, redraw?: boolean): void;
}

export interface LegacyCompatibleChart {
  readonly container: HTMLElement;
  readonly risklab: VanillaChartInstance;
  readonly series: LegacyCompatibleSeries[];
  update(options: LegacyChartOptions, redraw?: boolean, oneToOne?: boolean): void;
  addSeries(options: LegacySeriesOptions, redraw?: boolean): LegacyCompatibleSeries;
  get(id: string): LegacyCompatibleSeries | undefined;
  redraw(): void;
  reflow(): void;
  setSize(width?: number, height?: number): void;
  getSVG(): string;
  destroy(): void;
}

export function legacyChart(container: string | HTMLElement, options: LegacyChartOptions, callback?: (chart: LegacyCompatibleChart) => void): LegacyCompatibleChart {
  const config = fromLegacyChartOptions(options);
  const risklab = mount(container, config);
  const wrappers = new Map<string, LegacyCompatibleSeries>();
  const wrapSeries = (series: SeriesConfig): LegacyCompatibleSeries => {
    const existing = wrappers.get(series.id);
    if (existing) return existing;
    let visible = series.visible !== false;
    const wrapped: LegacyCompatibleSeries = {
      id: series.id,
      setData(data) { const current = risklab.getConfig().series.map((item) => item.id === series.id ? { ...item, data: data.map((point, index) => mapPoint(point, index)) } : item); risklab.setData(current); },
      addPoint(point, redraw = true, shift = false) { risklab.addPoint(series.id, mapPoint(point, risklab.getConfig().series.find((item) => item.id === series.id)?.data.length ?? 0), { redraw, shift }); },
      remove() { risklab.removeSeries(series.id); wrappers.delete(series.id); },
      setVisible(next = !visible) { if (next !== visible) risklab.toggleSeries(series.id); visible = next; },
      update(next) { const current = risklab.getConfig().series.map((item) => item.id === series.id ? { ...item, name: next.name ?? item.name, color: next.color ?? item.color, lineWidth: next.lineWidth ?? item.lineWidth, visible: next.visible ?? item.visible, data: next.data ? next.data.map((point, index) => mapPoint(point, index)) : item.data } : item); risklab.setData(current); },
    };
    wrappers.set(series.id, wrapped);
    return wrapped;
  };
  const api: LegacyCompatibleChart = {
    container: risklab.container,
    risklab,
    get series() { return risklab.getConfig().series.map(wrapSeries); },
    update(next) { risklab.update(fromLegacyChartOptions({ ...options, ...next })); },
    addSeries(next) { const translated = fromLegacyChartOptions({ chart: { type: options.chart?.type }, series: [next] }).series[0]!; risklab.addSeries(translated); return wrapSeries(translated); },
    get(id) { const found = risklab.getConfig().series.find((item) => item.id === id); return found ? wrapSeries(found) : undefined; },
    redraw() { risklab.update({}); },
    reflow() { risklab.resize(); },
    setSize(width, height) { risklab.resize(width, height); },
    getSVG() { const svg = getChartSVG(risklab.container); return svg ? serializeSVG(svg) : ''; },
    destroy() { wrappers.clear(); risklab.destroy(); },
  };
  callback?.(api);
  return api;
}

export function legacyStockChart(container: string | HTMLElement, options: LegacyChartOptions, callback?: (chart: LegacyCompatibleChart) => void): LegacyCompatibleChart {
  return legacyChart(container, options, callback);
}

export const LegacyChartAPI = { chart: legacyChart, stockChart: legacyStockChart, fromOptions: fromLegacyChartOptions } as const;
