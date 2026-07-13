// ============================================================================
// RiskLab Charts — Column Range & Dumbbell Charts
// ColumnRange: vertical bars spanning [low, high] at each x category.
// Dumbbell: like ColumnRange but rendered as a thin line + two endpoint dots.
// Both are commercial charting "columnrange" / "dumbbell" series types — free here.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';
import { createScale } from '../scales/index';

export interface ColumnRangeConfig {
  /** Column width fraction of available slot (default 0.6). */
  barWidthFraction?: number;
  /** Corner radius (default 3). */
  cornerRadius?: number;
  /** Show value labels at high end (default false). */
  showLabels?: boolean;
  /** Use low color for bottom half + high color for top? (default false = single color) */
  splitColor?: boolean;
}

export interface DumbbellConfig {
  /** Dot radius at endpoints (default 6). */
  dotRadius?: number;
  /** Connector line width (default 3). */
  lineWidth?: number;
  /** Low dot color (default lighter shade of series color). */
  lowColor?: string;
  /** High dot color (default series color). */
  highColor?: string;
  /** Show value labels (default false). */
  showLabels?: boolean;
}

// ---- Shared helpers ---------------------------------------------------------

interface RangePt {
  x: number;
  low: number;
  high: number;
  color?: string;
}

function extractRangePoints(s: ProcessedSeries): RangePt[] {
  const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
  return data.map((pt, idx) => {
    const raw = pt as unknown as { x: number; low?: number; high?: number; y?: number; y2?: number; color?: string };
    const low  = raw.low  ?? raw.y  ?? 0;
    const high = raw.high ?? raw.y2 ?? low;
    // Use numeric x if available; fall back to index for categorical/band labels
    const numX = Number(pt.xNum ?? pt.x);
    return {
      x: Number.isFinite(numX) ? numX : idx,
      low:  Math.min(low, high),
      high: Math.max(low, high),
      color: raw.color,
    };
  });
}

function buildYScale(points: RangePt[], chartArea: { y: number; height: number }): (v: import('../core/types').DataValue) => number {
  const allY = points.flatMap(p => [p.low, p.high]);
  const yMin = Math.min(...allY, 0);
  const yMax = Math.max(...allY);
  return createScale('linear', [yMin, yMax], [chartArea.y + chartArea.height, chartArea.y]).convert;
}

// ---- ColumnRange ------------------------------------------------------------

export function renderColumnRange(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  if (!allSeries.length) return;

  const crCfg = (config as ChartConfig & { columnRange?: ColumnRangeConfig })?.columnRange ?? {};
  const { chartArea } = state;
  const barFrac  = crCfg.barWidthFraction ?? 0.6;
  const rx       = crCfg.cornerRadius     ?? 3;
  const showLbls = crCfg.showLabels       ?? false;

  // Build all points and x→slot maps
  const allPoints = allSeries.flatMap((s, si) =>
    extractRangePoints(s).map(p => ({ ...p, si }))
  );
  if (!allPoints.length) return;

  const xVals = [...new Set(allPoints.map(p => p.x))].sort((a, b) => a - b);
  const slotW = chartArea.width / xVals.length;
  const barW  = slotW * barFrac;
  const xIdxMap = new Map(xVals.map((x, i) => [x, i]));

  // Prefer state scales for proper zoom support; fall back to local scale
  const stateYS = state.scales instanceof Map ? state.scales.get('y0') : undefined;
  const yScale = stateYS?.convert ?? buildYScale(allPoints, chartArea);

  renderer.beginGroup('colrange-bars', 'uc-colrange-bars');

  for (const pt of allPoints) {
    const xi   = xIdxMap.get(pt.x) ?? 0;
    const bx   = chartArea.x + xi * slotW + (slotW - barW) / 2;
    const yLow = yScale(pt.low);
    const yHigh = yScale(pt.high);
    const bh   = Math.abs(yLow - yHigh);
    const by   = Math.min(yLow, yHigh);
    const color = (pt.color as string | undefined) ?? getSeriesColor(theme, pt.si);

    renderer.drawRect(bx, by, barW, bh, { fill: color, rx, ry: rx }, rx, rx);

    if (showLbls && bh > 16) {
      renderer.drawText(bx + barW / 2, by - 4, String(pt.high), {
        fontSize: 9,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: (theme.textColor as string) ?? '#333',
        textAnchor: 'middle',
        dominantBaseline: 'auto',
      });
    }
  }

  renderer.endGroup();
}

// ---- Dumbbell ---------------------------------------------------------------

export function renderDumbbellChart(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  if (!allSeries.length) return;

  const dbCfg   = (config as ChartConfig & { dumbbell?: DumbbellConfig })?.dumbbell ?? {};
  const { chartArea } = state;
  const dotR     = dbCfg.dotRadius  ?? 6;
  const lineW    = dbCfg.lineWidth  ?? 3;
  const showLbls = dbCfg.showLabels ?? false;

  const allPoints = allSeries.flatMap((s, si) =>
    extractRangePoints(s).map(p => ({ ...p, si }))
  );
  if (!allPoints.length) return;

  const xVals   = [...new Set(allPoints.map(p => p.x))].sort((a, b) => a - b);
  const slotW   = chartArea.width / xVals.length;
  const xIdxMap = new Map(xVals.map((x, i) => [x, i]));

  // Prefer state scales for proper zoom support; fall back to local scale
  const dbStateYS = state.scales instanceof Map ? state.scales.get('y0') : undefined;
  const yScale  = dbStateYS?.convert ?? buildYScale(allPoints, chartArea);

  renderer.beginGroup('dumbbell-connectors', 'uc-dumbbell-connectors');

  for (const pt of allPoints) {
    const xi  = xIdxMap.get(pt.x) ?? 0;
    const cx  = chartArea.x + xi * slotW + slotW / 2;
    const yLo = yScale(pt.low);
    const yHi = yScale(pt.high);
    const color    = getSeriesColor(theme, pt.si);

    // Connector line
    renderer.drawLine(cx, yLo, cx, yHi, {
      stroke: color,
      strokeWidth: lineW,
      opacity: 0.5,
    });

    // Low dot
    renderer.drawCircle(cx, yLo, dotR, {
      fill: dbCfg.lowColor ?? color,
      opacity: 0.65,
    });

    // High dot
    renderer.drawCircle(cx, yHi, dotR, {
      fill: dbCfg.highColor ?? color,
    });

    if (showLbls) {
      renderer.drawText(cx + dotR + 3, yHi, String(pt.high), {
        fontSize: 9,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: (theme.textColor as string) ?? '#333',
        dominantBaseline: 'middle',
      });
    }
  }

  renderer.endGroup();
}
