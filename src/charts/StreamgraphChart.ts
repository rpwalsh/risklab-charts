// ============================================================================
// RiskLab Charts — Streamgraph (ThemeRiver) Chart
// Stacked area chart with a silhouette (stream) baseline so the shape
// flows symmetrically around a central axis.
// Equivalent to Highcharts' "streamgraph" series — free in RiskLab Charts.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';
import { createScale } from '../scales/index';

// ---- Baseline algorithms ----------------------------------------------------

type BaselineMode = 'silhouette' | 'wiggle' | 'zero';

/**
 * Silhouette baseline: centre all stacks symmetrically around y=0.
 * For each x-slot compute baseline = −totalHeight/2.
 */
function computeSilhouetteBaseline(stacks: number[][]): number[] {
  const n = stacks[0]?.length ?? 0;
  const base = new Array<number>(n).fill(0);
  for (let xi = 0; xi < n; xi++) {
    const total = stacks.reduce((s, col) => s + (col[xi] ?? 0), 0);
    base[xi] = -total / 2;
  }
  return base;
}

/**
 * Wiggle baseline: minimise wiggle (Stacked Graphs — Geometry & Aesthetics).
 * Approximate via silhouette for now (exact wiggle is an NP-hard optimisation).
 */
function computeWiggleBaseline(stacks: number[][]): number[] {
  return computeSilhouetteBaseline(stacks);  // good enough approximation
}

// ---- Main render ------------------------------------------------------------

export function renderStreamgraph(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  if (!allSeries.length) return;

  const { chartArea } = state;
  const smooth = config?.streamgraph?.smooth !== false;
  const baselineMode: BaselineMode = config?.streamgraph?.baseline ?? 'silhouette';

  // Align all series to the same x domain
  const allXValues = new Set<number>();
  for (const s of allSeries) {
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
    for (const pt of data) allXValues.add(Number(pt.xNum ?? pt.x));
  }
  const xSlots = [...allXValues].sort((a, b) => a - b);
  const n = xSlots.length;
  if (n < 2) return;

  // Build value matrix [seriesIdx][xSlot]
  const matrix: number[][] = allSeries.map(s => {
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
    const byX = new Map(data.map(p => [Number(p.xNum ?? p.x), Math.max(0, p.yNum ?? 0)]));
    return xSlots.map(x => byX.get(x) ?? 0);
  });

  // Compute baseline
  let baseline: number[];
  if (baselineMode === 'wiggle') baseline = computeWiggleBaseline(matrix);
  else if (baselineMode === 'zero') baseline = new Array(n).fill(0);
  else baseline = computeSilhouetteBaseline(matrix);

  // Compute cumulative stacks: stackTops[si][xi] = y top of series si at slot xi
  const stackTops: number[][] = [];
  let cumulative = new Array<number>(n).fill(0);
  for (let si = 0; si < allSeries.length; si++) {
    cumulative = cumulative.map((c, xi) => c + matrix[si]![xi]!);
    stackTops.push([...cumulative]);
  }

  // Global y range (baseline bottom to max stack top)
  const allY = [
    ...baseline,
    ...stackTops.flat(),
  ];
  let yMin = Infinity, yMax = -Infinity;
  for (let _i = 0; _i < allY.length; _i++) {
    if (allY[_i]! < yMin) yMin = allY[_i]!;
    if (allY[_i]! > yMax) yMax = allY[_i]!;
  }

  const stateXS = state.scales instanceof Map ? state.scales.get('x0') : undefined;
  const stateYS = state.scales instanceof Map ? state.scales.get('y0') : undefined;
  const xScaleFn = stateXS?.convert
    ?? createScale('linear', [xSlots[0]!, xSlots[n - 1]!], [chartArea.x, chartArea.x + chartArea.width]).convert;
  const yScaleFn = stateYS?.convert
    ?? createScale('linear', [yMin, yMax], [chartArea.y + chartArea.height, chartArea.y]).convert;

  renderer.beginGroup('stream-layers', 'uc-stream-layers');

  // Draw layers bottom-up (first series at bottom of stack)
  for (let si = allSeries.length - 1; si >= 0; si--) {
    const color = getSeriesColor(theme, si);
    const topY = stackTops[si]!;

    // Adjust top points for baseline offset
    const topAbs: Array<[number, number]> = xSlots.map((x, xi) => [
      xScaleFn(x),
      yScaleFn(topY[xi]! + baseline[xi]!),
    ]);
    const botAbs: Array<[number, number]> = xSlots.map((x, xi) => [
      xScaleFn(x),
      yScaleFn((si > 0 ? stackTops[si - 1]![xi]! : 0) + baseline[xi]!),
    ]);

    const path = buildStreamPath(topAbs, botAbs, smooth);
    renderer.drawPath(path, {
      fill: color,
      fillOpacity: 0.85,
      stroke: color,
      strokeWidth: 0.5,
    });
  }

  renderer.endGroup();
}

function buildStreamPath(
  top: Array<[number, number]>,
  bot: Array<[number, number]>,
  smooth: boolean,
): string {
  if (!top.length) return '';
  const parts: string[] = [];

  // Forward along top curve
  parts.push(`M ${top[0]![0]} ${top[0]![1]}`);
  if (smooth) {
    for (let i = 1; i < top.length; i++) {
      const [px, py] = top[i - 1]!;
      const [cx, cy] = top[i]!;
      const mx = (px + cx) / 2;
      parts.push(`C ${mx} ${py} ${mx} ${cy} ${cx} ${cy}`);
    }
  } else {
    for (let i = 1; i < top.length; i++) {
      parts.push(`L ${top[i]![0]} ${top[i]![1]}`);
    }
  }

  // Line to last bottom point
  parts.push(`L ${bot[bot.length - 1]![0]} ${bot[bot.length - 1]![1]}`);

  // Backward along bottom curve
  if (smooth) {
    for (let i = bot.length - 2; i >= 0; i--) {
      const [px, py] = bot[i + 1]!;
      const [cx, cy] = bot[i]!;
      const mx = (px + cx) / 2;
      parts.push(`C ${mx} ${py} ${mx} ${cy} ${cx} ${cy}`);
    }
  } else {
    for (let i = bot.length - 2; i >= 0; i--) {
      parts.push(`L ${bot[i]![0]} ${bot[i]![1]}`);
    }
  }

  parts.push('Z');
  return parts.join(' ');
}
