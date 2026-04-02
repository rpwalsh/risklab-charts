// ============================================================================
// RiskLab Charts — Histogram Chart
// Auto-bins continuous data using Sturges/Scott/Freedman-Diaconis rules
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';

export type BinningRule = 'auto' | 'sturges' | 'scott' | 'freedman-diaconis' | 'sqrt';

export interface HistogramSeriesConfig {
  binCount?: number;
  binRule?: BinningRule;
  /** Explicit bin boundaries */
  breaks?: number[];
  cumulative?: boolean;
  density?: boolean;
  showFrequency?: boolean;
}

interface Bin {
  x0: number;
  x1: number;
  count: number;
  density: number;
  cumulative: number;
}

// ---------------------------------------------------------------------------
// Binning algorithms
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[], m?: number): number {
  const mu = m ?? mean(values);
  const variance = values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function iqr(sorted: number[]): number {
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  return q3 - q1;
}

function computeBinCount(values: number[], rule: BinningRule): number {
  const n = values.length;
  if (n === 0) return 1;

  if (rule === 'sturges') return Math.ceil(Math.log2(n) + 1);
  if (rule === 'sqrt') return Math.ceil(Math.sqrt(n));

  const sorted = [...values].sort((a, b) => a - b);
  const range = sorted[sorted.length - 1]! - sorted[0]!;

  if (rule === 'scott') {
    const sigma = stdDev(values);
    const h = (3.49 * sigma) / Math.cbrt(n);
    return h > 0 ? Math.ceil(range / h) : 10;
  }

  if (rule === 'freedman-diaconis') {
    const iqrVal = iqr(sorted);
    const h = (2 * iqrVal) / Math.cbrt(n);
    return h > 0 ? Math.ceil(range / h) : 10;
  }

  // 'auto' — use Freedman-Diaconis, fall back to Sturges
  const iqrVal = iqr(sorted);
  if (iqrVal > 0) {
    const h = (2 * iqrVal) / Math.cbrt(n);
    return Math.min(50, Math.max(5, Math.ceil(range / h)));
  }
  return Math.ceil(Math.log2(n) + 1);
}

function buildBins(values: number[], binCount: number, breaks?: number[]): Bin[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;

  let boundaries: number[];

  if (breaks && breaks.length >= 2) {
    boundaries = [...breaks].sort((a, b) => a - b);
  } else {
    const step = (max - min) / binCount;
    boundaries = Array.from({ length: binCount + 1 }, (_, i) => min + i * step);
    // Extend last boundary slightly to include max
    boundaries[boundaries.length - 1]! += 1e-10;
  }

  const bins: Bin[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    bins.push({ x0: boundaries[i]!, x1: boundaries[i + 1]!, count: 0, density: 0, cumulative: 0 });
  }

  for (const v of sorted) {
    for (const bin of bins) {
      if (v >= bin.x0 && v < bin.x1) {
        bin.count++;
        break;
      }
    }
  }

  const totalCount = values.length;
  let cumSum = 0;
  for (const bin of bins) {
    cumSum += bin.count;
    bin.cumulative = cumSum;
    bin.density = bin.count / (totalCount * (bin.x1 - bin.x0));
  }

  return bins;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function renderHistogramChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  config: ChartConfig,
  theme: ThemeConfig,
): void {
  const { chartArea: _ca } = state;
  const xScale = state.scales.get('x0');
  const yScale = state.scales.get('y0');
  if (!xScale || !yScale) return;

  renderer.beginGroup('histogram', 'uc-histogram');

  let colorIndex = 0;
  for (const s of series) {
    if (s.visible === false) { colorIndex++; continue; }

    const histConf = s.histogram ?? {};
    const rule: BinningRule = histConf.binRule ?? 'auto';
    const values = s.data
      .map(d => {
        const v = d.y;
        return typeof v === 'number' ? v : Number(v);
      })
      .filter(v => isFinite(v));

    if (values.length === 0) { colorIndex++; continue; }

    const binCount = histConf.binCount ?? computeBinCount(values, rule);
    const bins = buildBins(values, binCount, histConf.breaks);

    const color = (s.color as string) ?? theme.palette[colorIndex % theme.palette.length] ?? '#4f46e5';
    // Check bin membership by looking up the hovered/selected data-point VALUE in the bin range,
    // not by comparing the bin array index to hoveredPoint.index (those are raw data-point indices)
    const isSelected = (bin: Bin) => state.selectedPoints.some(p => {
      if (p.seriesId !== s.id) return false;
      const v = values[p.index];
      return v !== undefined && v >= bin.x0 && v < bin.x1;
    });
    const isHovered = (bin: Bin) => {
      if (state.hoveredPoint?.seriesId !== s.id) return false;
      const v = values[state.hoveredPoint.index];
      return v !== undefined && v >= bin.x0 && v < bin.x1;
    };

    const barGap = 1;

    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i]!;

      const yVal = histConf.density ? bin.density : (histConf.cumulative ? bin.cumulative : bin.count);

      const x1 = xScale.convert(bin.x0);
      const x2 = xScale.convert(bin.x1);
      const barW = Math.max(1, x2 - x1 - barGap);
      const barTop = yScale.convert(yVal);
      const barBot = yScale.convert(0);
      const barH = Math.abs(barBot - barTop);

      renderer.drawRect(
        x1,
        Math.min(barTop, barBot),
        barW,
        barH,
        {
          fill: color,
          opacity: isHovered(bin) ? 1 : (isSelected(bin) ? 0.95 : 0.78),
          stroke: '#fff',
          strokeWidth: 0.5,
        },
        0,
      );

      // Count label on tall bars
      if (barH > 20) {
        const label = histConf.density ? bin.density.toFixed(4) : String(Math.round(yVal));
        const labelYPos = Math.max(_ca.y + 4, Math.min(barTop, barBot) - 4);
        renderer.drawText(x1 + barW / 2, labelYPos, label, {
          fontSize: 9,
          fontFamily: theme.fontFamily,
          fill: (theme.textColor as string) ?? '#374151',
          textAnchor: 'middle',
          clipPath: 'chart-clip',
        });
      }
    }

    colorIndex++;
  }

  renderer.endGroup();
}
