// ============================================================================
// RiskLab Charts — X-Range Chart
// Horizontal bars spanning [x, x2] per category row.
// Identical to Highcharts' premium "xrange" series — free in RiskLab Charts.
// Use cases: project scheduling, task timelines, resource allocation.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';
import { createScale } from '../scales/index';

export interface XRangeDataPoint {
  /** Start x value (timestamp or numeric). */
  x: number;
  /** End x value. */
  x2: number;
  /** Y category index (0-based) or numeric y. */
  y: number;
  /** Optional label inside bar. */
  label?: string;
  /** Optional fill override. */
  color?: string;
  /** Optional partial fill (0–1) within the bar. */
  partialFill?: number;
}

export interface XRangeConfig {
  /** Height of each bar as fraction of row height (default 0.6). */
  barHeightFraction?: number;
  /** Corner radius (default 4). */
  cornerRadius?: number;
  /** Category labels for y axis (index → string). */
  categories?: string[];
  /** Show data labels (default true when bar is wide enough). */
  showLabels?: boolean;
  /** Show partial fill indicator (default true). */
  showPartialFill?: boolean;
}

export function renderXRange(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  if (!allSeries.length) return;

  const xrCfg = (config as ChartConfig & { xRange?: XRangeConfig })?.xRange ?? {};
  const { chartArea } = state;

  const barFrac  = xrCfg.barHeightFraction ?? 0.6;
  const rx       = xrCfg.cornerRadius      ?? 4;
  const showLbls = xrCfg.showLabels        !== false;
  const showPF   = xrCfg.showPartialFill   !== false;

  // Collect all data points across series
  interface Row { si: number; pt: XRangeDataPoint & { rawColor?: string } }
  const rows: Row[] = [];

  for (let si = 0; si < allSeries.length; si++) {
    const s = allSeries[si];
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
    for (const pt of data) {
      const raw = (pt as unknown as XRangeDataPoint);
      if (raw.x2 === undefined) continue;
      rows.push({ si, pt: { ...raw, rawColor: pt.color as string | undefined } });
    }
  }

  if (!rows.length) return;

  // x domain
  let xMin = Infinity, xMax = -Infinity;
  let yMax = -Infinity;
  for (const r of rows) {
    if (r.pt.x < xMin) xMin = r.pt.x;
    if (r.pt.x2 > xMax) xMax = r.pt.x2;
    if (r.pt.y > yMax) yMax = r.pt.y;
  }
  // y domain: category indices

  // Prefer state scales for zoom support; fall back to local scale
  const stateXScale = state.scales instanceof Map ? state.scales.get(allSeries[0]?.xAxisId ?? 'x0') : undefined;
  const xScale = stateXScale?.convert
    ?? createScale('linear', [xMin, xMax], [chartArea.x, chartArea.x + chartArea.width]).convert;
  const rowCount = yMax + 1;
  const rowH = chartArea.height / rowCount;
  const barH = rowH * barFrac;
  const barOffset = (rowH - barH) / 2;

  renderer.beginGroup('xrange-bars', 'uc-xrange-bars');

  for (const { si, pt } of rows) {
    const color = (pt.rawColor as string | undefined) ?? getSeriesColor(theme, si);
    const bx    = xScale(pt.x);
    const bx2   = xScale(pt.x2);
    const bw    = Math.max(1, bx2 - bx);
    const by    = chartArea.y + pt.y * rowH + barOffset;

    // Main bar
    renderer.drawRect(bx, by, bw, barH, { fill: color, rx, ry: rx }, rx, rx);

    // Partial fill overlay
    if (showPF && pt.partialFill !== undefined && pt.partialFill > 0) {
      const pfW = bw * Math.min(1, pt.partialFill);
      renderer.drawRect(bx, by + barH * 0.3, pfW, barH * 0.4, {
        fill: 'rgba(0,0,0,0.25)',
        rx: Math.min(rx, pfW / 2),
      }, Math.min(rx, pfW / 2), Math.min(rx, pfW / 2));
    }

    // Label inside bar
    if (showLbls && pt.label && bw > 30) {
      renderer.drawText(bx + bw / 2, by + barH / 2, pt.label, {
        fontSize: Math.min(11, barH * 0.55),
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: '#fff',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
  }

  renderer.endGroup();

  // Category labels on y-axis
  if (xrCfg.categories?.length) {
    renderer.beginGroup('xrange-cats', 'uc-xrange-cats');
    for (let yi = 0; yi < xrCfg.categories.length && yi <= yMax; yi++) {
      const ly = chartArea.y + yi * rowH + rowH / 2;
      const catLabelX = chartArea.x - 6;
      renderer.drawText(catLabelX, ly, xrCfg.categories[yi]!, {
        fontSize: 11,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: (theme.textColor as string) ?? '#333',
        textAnchor: 'end',
        dominantBaseline: 'middle',
      });
    }
    renderer.endGroup();
  }
}
