// ============================================================================
// RiskLab Charts — Bell Curve (Normal Distribution) Chart
// Renders a probability density curve (PDF) from raw data or explicit
// mean/sigma parameters. Includes optional histogram overlay.
// Equivalent to commercial charting' "bellcurve" series — free in RiskLab Charts.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';
import { createScale } from '../scales/index';

export interface BellCurveConfig {
  /** Pre-computed mean. If omitted, computed from data. */
  mean?: number;
  /** Pre-computed standard deviation. If omitted, computed from data. */
  stdDev?: number;
  /** Number of sample points for the curve (default 200). */
  resolution?: number;
  /** How many std-deviations to plot either side of mean (default 4). */
  sigmaRange?: number;
  /** Show a histogram behind the curve (default false). */
  showHistogram?: boolean;
  /** Number of histogram bins when showHistogram is true (default auto). */
  histogramBins?: number;
  /** Show mu (μ) and sigma (σ) annotation lines (default true). */
  showAnnotations?: boolean;
  /** Fill under the curve (default true). */
  fill?: boolean;
  /** Fill under ±1σ band (default false). */
  fillSigmaBand?: boolean;
}

function normalPDF(x: number, mean: number, sigma: number): number {
  const z = (x - mean) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function computeStats(values: number[]): { mean: number; stdDev: number } {
  const n = values.length;
  if (!n) return { mean: 0, stdDev: 1 };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return { mean, stdDev: Math.sqrt(variance) || 1 };
}

export function renderBellCurve(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const bcCfg = (config as ChartConfig & { bellCurve?: BellCurveConfig })?.bellCurve ?? {};
  const { chartArea } = state;

  const resolution     = bcCfg.resolution    ?? 200;
  const sigmaRange     = bcCfg.sigmaRange    ?? 4;
  const showHistogram  = bcCfg.showHistogram ?? false;
  const showAnnotation = bcCfg.showAnnotations === true;
  const doFill         = bcCfg.fill !== false;
  const doSigmaBand    = bcCfg.fillSigmaBand ?? false;

  for (let si = 0; si < allSeries.length; si++) {
    const s = allSeries[si];
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
    const rawValues = data.map(p => p.yNum ?? 0).filter(isFinite);

    if (!rawValues.length && bcCfg.mean === undefined) continue;

    const stats = computeStats(rawValues);
    const mean   = bcCfg.mean   ?? stats.mean;
    const sigma  = bcCfg.stdDev ?? stats.stdDev;
    const xMin   = mean - sigmaRange * sigma;
    const xMax   = mean + sigmaRange * sigma;

    const color = getSeriesColor(theme, si);

    // Optional histogram
    if (showHistogram && rawValues.length > 1) {
      const bins = bcCfg.histogramBins ?? Math.max(5, Math.round(Math.sqrt(rawValues.length)));
      const binW = (xMax - xMin) / bins;
      const counts = new Array<number>(bins).fill(0);
      for (const v of rawValues) {
        const bi = Math.min(bins - 1, Math.floor((v - xMin) / binW));
        if (bi >= 0) counts[bi]!++;
      }
      const density = counts.map(c => c / (rawValues.length * binW));
      const maxDensity = Math.max(...density, normalPDF(mean, mean, sigma));

      const xScaleH = createScale('linear', [xMin, xMax], [chartArea.x, chartArea.x + chartArea.width]).convert;
      const yScaleH = createScale('linear', [0, maxDensity * 1.05], [chartArea.y + chartArea.height, chartArea.y]).convert;

      renderer.beginGroup(`bell-hist-${si}`, `uc-bell-hist`);
      for (let bi = 0; bi < bins; bi++) {
        const bx = xScaleH(xMin + bi * binW);
        const bx2 = xScaleH(xMin + (bi + 1) * binW);
        const bh = Math.max(0, yScaleH(0) - yScaleH(density[bi]!));
        renderer.drawRect(bx, yScaleH(density[bi]!), bx2 - bx - 1, bh, {
          fill: color,
          fillOpacity: 0.3,
          stroke: color,
          strokeWidth: 0.5,
        });
      }
      renderer.endGroup();
    }

    // Curve sample points
    const maxPDF = normalPDF(mean, mean, sigma);
    const pdfScale = 1.05;
    // Prefer state scales for zoom support; fall back to local scales
    const stateXS = state.scales instanceof Map ? state.scales.get('x0') : undefined;
    const stateYS = state.scales instanceof Map ? state.scales.get('y0') : undefined;
    const xScale = stateXS?.convert
      ?? createScale('linear', [xMin, xMax], [chartArea.x, chartArea.x + chartArea.width]).convert;
    const yScale = stateYS?.convert
      ?? createScale('linear', [0, maxPDF * pdfScale], [chartArea.y + chartArea.height, chartArea.y]).convert;

    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= resolution; i++) {
      const x = xMin + (i / resolution) * (xMax - xMin);
      const y = normalPDF(x, mean, sigma);
      pts.push([xScale(x), yScale(y)]);
    }

    // ±1σ fill band
    if (doSigmaBand) {
      const bandPts = pts.filter(([px]) => {
        const xVal = xMin + ((px - chartArea.x) / chartArea.width) * (xMax - xMin);
        return Math.abs(xVal - mean) <= sigma;
      });
      if (bandPts.length >= 2) {
        const baseY = yScale(0);
        const bPath = `M ${bandPts[0]![0]} ${bandPts[0]![1]} `
          + bandPts.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ')
          + ` L ${bandPts[bandPts.length - 1]![0]} ${baseY} L ${bandPts[0]![0]} ${baseY} Z`;
        renderer.drawPath(bPath, { fill: color, fillOpacity: 0.15 });
      }
    }

    // Full fill
    if (doFill && pts.length > 1) {
      const baseY = yScale(0);
      const fillPath = `M ${pts[0]![0]} ${baseY} L ${pts[0]![0]} ${pts[0]![1]} `
        + pts.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ')
        + ` L ${pts[pts.length - 1]![0]} ${baseY} Z`;
      renderer.drawPath(fillPath, { fill: color, fillOpacity: 0.2 });
    }

    // Curve line
    if (pts.length > 1) {
      const curvePath = `M ${pts[0]![0]} ${pts[0]![1]} `
        + pts.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ');
      renderer.drawPath(curvePath, { fill: 'none', stroke: color, strokeWidth: 2 });
    }

    // Annotations: mean + sigma lines
    if (showAnnotation) {
      const meanX = xScale(mean);
      const baseY = yScale(0);
      const peakY = yScale(maxPDF);

      // μ line
      renderer.drawLine(meanX, Math.max(chartArea.y, peakY - 8), meanX, baseY, {
        stroke: color,
        strokeWidth: 1,
        dashArray: [4, 3],
        opacity: 0.7,
      });
      renderer.drawText(meanX, Math.max(chartArea.y + 4, peakY - 12), 'μ', {
        fontSize: 11,
        fill: color,
        textAnchor: 'middle',
        dominantBaseline: 'auto',
        fontFamily: theme.fontFamily ?? 'sans-serif',
      });

      // ±1σ lines
      for (const sigmaX of [mean - sigma, mean + sigma]) {
        const sx = xScale(sigmaX);
        renderer.drawLine(sx, yScale(normalPDF(sigmaX, mean, sigma)), sx, baseY, {
          stroke: color,
          strokeWidth: 1,
          dashArray: [3, 3],
          opacity: 0.45,
        });
      }

      // ±1σ labels
      const sigmaMinusX = xScale(mean - sigma);
      const sigmaPlusX = xScale(mean + sigma);
      renderer.drawText(sigmaMinusX, Math.max(chartArea.y + 4, peakY - 12), '−1σ', {
        fontSize: 10, fill: color, textAnchor: 'middle', dominantBaseline: 'auto',
        fontFamily: theme.fontFamily ?? 'sans-serif',
      });
      renderer.drawText(sigmaPlusX, Math.max(chartArea.y + 4, peakY - 12), '+1σ', {
        fontSize: 10, fill: color, textAnchor: 'middle', dominantBaseline: 'auto',
        fontFamily: theme.fontFamily ?? 'sans-serif',
      });

      // ±2σ lines
      for (const sigmaX of [mean - 2 * sigma, mean + 2 * sigma]) {
        const sx = xScale(sigmaX);
        if (sx >= chartArea.x && sx <= chartArea.x + chartArea.width) {
          renderer.drawLine(sx, yScale(normalPDF(sigmaX, mean, sigma)), sx, baseY, {
            stroke: color,
            strokeWidth: 0.8,
            dashArray: [2, 4],
            opacity: 0.3,
          });
        }
      }

      // ±2σ labels
      const sigma2MinusX = xScale(mean - 2 * sigma);
      const sigma2PlusX = xScale(mean + 2 * sigma);
      if (sigma2MinusX >= chartArea.x) {
        renderer.drawText(sigma2MinusX, baseY + 12, '−2σ', {
          fontSize: 9, fill: color, textAnchor: 'middle', dominantBaseline: 'auto',
          fontFamily: theme.fontFamily ?? 'sans-serif', opacity: 0.6,
        });
      }
      if (sigma2PlusX <= chartArea.x + chartArea.width) {
        renderer.drawText(sigma2PlusX, baseY + 12, '+2σ', {
          fontSize: 9, fill: color, textAnchor: 'middle', dominantBaseline: 'auto',
          fontFamily: theme.fontFamily ?? 'sans-serif', opacity: 0.6,
        });
      }

      // Stat info line: μ = ..., σ = ...
      renderer.drawText(chartArea.x + chartArea.width - 8, chartArea.y + 14,
        `μ = ${mean.toFixed(1)}   σ = ${sigma.toFixed(1)}`, {
          fontSize: 10, fill: color, textAnchor: 'end', dominantBaseline: 'auto',
          fontFamily: theme.fontFamily ?? 'sans-serif', opacity: 0.8,
        });
    }
  }
}
