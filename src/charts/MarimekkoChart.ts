// ============================================================================
// RiskLab Charts — Marimekko Chart (Variable-Width Column / Mekko Chart)
// Bars are variable-width (proportional to a second data dimension) AND
// variable-height (100% stacked). Highcharts charges for this as "variwide".
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

// ---- Public config ----------------------------------------------------------

export interface MarimekkoDataPoint {
  /** Category label. */
  category: string;
  /** X-width weight (e.g. market size — proportional to column width). */
  width: number;
  /** Values per segment (stacked layers). Keys = segment names. */
  values: Record<string, number>;
}

export interface MarimekkoConfig {
  data: MarimekkoDataPoint[];
  /** Segment keys to display (default: all). */
  segments?: string[];
  /** Colors per segment (mapped by segment key). */
  colors?: Record<string, string>;
  /** Show category labels on x-axis (default true). */
  showCategoryLabels?: boolean;
  /** Show value labels inside segments (default true when segment tall enough). */
  showValueLabels?: boolean;
  /** Show width labels below columns (default true). */
  showWidthLabels?: boolean;
  /** Corner radius for top segment (default 2). */
  cornerRadius?: number;
  /** Gap between columns in px (default 2). */
  gap?: number;
}

// ---- Main render ------------------------------------------------------------

export function renderMarimekko(
  renderer: BaseRenderer,
  _allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const mCfg = (config as ChartConfig & { marimekko?: MarimekkoConfig })?.marimekko;
  if (!mCfg || !mCfg.data.length) return;

  const { chartArea } = state;
  const plotX = chartArea.x;
  const plotY = chartArea.y;
  const plotW = chartArea.width;
  const plotH = chartArea.height;

  const gap         = mCfg.gap          ?? 2;
  const rx          = mCfg.cornerRadius ?? 2;
  const showCatLbls = mCfg.showCategoryLabels !== false;
  const showValLbls = mCfg.showValueLabels    !== false;
  const showWLbls   = mCfg.showWidthLabels    !== false;

  const data = mCfg.data;

  // Collect all segment keys
  const segSet = new Set<string>();
  for (const col of data) Object.keys(col.values).forEach(k => segSet.add(k));
  const segments = mCfg.segments ?? [...segSet];

  // Build color map
  const colorMap = new Map<string, string>();
  for (let i = 0; i < segments.length; i++) {
    colorMap.set(segments[i], mCfg.colors?.[segments[i]] ?? getSeriesColor(theme, i));
  }

  // Total width for x scaling
  const totalWidth = data.reduce((s, d) => s + d.width, 0);

  // Draw
  renderer.beginGroup('mm-cols', 'uc-mm-cols');

  let xCursor = plotX;
  const labelFontSize = 10;
  const valueAreaH = plotH - (showCatLbls ? 18 : 0) - (showWLbls ? 14 : 0);

  for (let ci = 0; ci < data.length; ci++) {
    const col = data[ci];
    const colW = (col.width / totalWidth) * plotW - gap;

    // Total value for this column (for 100% stacking)
    const colTotal = segments.reduce((s, k) => s + (col.values[k] ?? 0), 0);

    let yCursor = plotY;
    // Draw segments bottom-to-top in reverse so the "first" segment is closest to top
    const orderedSegs = [...segments].reverse();

    for (let si = 0; si < orderedSegs.length; si++) {
      const seg = orderedSegs[si];
      const v = col.values[seg] ?? 0;
      if (v <= 0 || colTotal <= 0) continue;

      const segH = (v / colTotal) * valueAreaH;
      const fill = colorMap.get(seg) ?? getSeriesColor(theme, si);

      const isTopSeg = si === 0 || orderedSegs.slice(0, si).every(s => (col.values[s] ?? 0) <= 0);
      const topRx = isTopSeg ? rx : 0;

      renderer.drawRect(xCursor, yCursor, colW, segH, {
        fill,
        stroke: (theme.backgroundColor as string) ?? '#fff',
        strokeWidth: 0.5,
      }, topRx, topRx);

      // Value label inside segment
      if (showValLbls && segH >= 18) {
        renderer.drawText(xCursor + colW / 2, yCursor + segH / 2,
          `${Math.round((v / colTotal) * 100)}%`, {
            fontSize: Math.min(labelFontSize, segH - 4),
            fill: '#fff',
            fontFamily: theme.fontFamily ?? 'sans-serif',
            textAnchor: 'middle',
            dominantBaseline: 'middle',
          });
      }

      yCursor += segH;
    }

    // Category label below column
    if (showCatLbls) {
      renderer.drawText(xCursor + colW / 2, plotY + valueAreaH + 10, col.category, {
        fontSize: labelFontSize,
        fill: (theme.textColor as string) ?? '#333',
        fontFamily: theme.fontFamily ?? 'sans-serif',
        textAnchor: 'middle',
        dominantBaseline: 'hanging',
      });
    }

    // Width label (proportional width / market share)
    if (showWLbls) {
      const pct = Math.round((col.width / totalWidth) * 100);
      renderer.drawText(xCursor + colW / 2, plotY + plotH - 4, `${pct}%`, {
        fontSize: 9,
        fill: (theme.textColor as string) ?? '#666',
        fontFamily: theme.fontFamily ?? 'sans-serif',
        textAnchor: 'middle',
        dominantBaseline: 'auto',
        opacity: 0.75,
      });
    }

    xCursor += colW + gap;
  }

  renderer.endGroup();

  // ── Segment legend (opt-in, rendered when legend entries are enabled) ─────
  const showSegLegend = (config as ChartConfig & { legend?: { enabled?: boolean } })?.legend?.enabled === true
    && segments.length > 0 && data.length > 0;
  if (showSegLegend) {
    renderer.beginGroup('mm-legend', 'uc-mm-legend');
    const legendY2 = plotY + plotH - 4;
    let legendCursorX = plotX;
    const swatchW = 10;
    for (const seg of segments) {
      const segColor = colorMap.get(seg) ?? '#888';
      renderer.drawRect(legendCursorX, legendY2, swatchW, swatchW, { fill: segColor }, 2, 2);
      renderer.drawText(legendCursorX + swatchW + 3, legendY2 + swatchW - 1, seg, {
        fontSize: 10,
        fill: (theme.textColor as string) ?? '#333',
        fontFamily: theme.fontFamily ?? 'sans-serif',
        textAnchor: 'start',
      });
      legendCursorX += swatchW + 6 + seg.length * 6;
    }
    renderer.endGroup();
  }
}