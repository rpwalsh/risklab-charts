// ============================================================================
// RiskLab Charts — Statistics Plugin
// Regression lines, moving averages, bands, trendlines, outlier detection.
// Surpasses Highcharts' "regression" add-on — no extra cost, built-in.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedDataPoint, ProcessedSeries } from '../core/DataPipeline';
import { createPlugin } from './PluginSystem';

/** Monotonic counter for unique pane clip-rect IDs within a single render pass. */
let _paneClipCounter = 0;

/** Reset at the start of each statistics render pass to keep IDs deterministic. */
function resetPaneClipCounter(): void { _paneClipCounter = 0; }

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegressionType = 'linear' | 'polynomial' | 'logarithmic' | 'exponential' | 'power' | 'loess';

export interface RegressionSeries {
  seriesId: string;
  type: RegressionType;
  /** Polynomial degree (only for 'polynomial', default: 2) */
  degree?: number;
  /** LOESS bandwidth 0–1 (default: 0.25) */
  bandwidth?: number;
  color?: string;
  lineWidth?: number;
  dashArray?: number[];
  label?: string;
  /** Show equation on chart */
  showEquation?: boolean;
}

export interface MovingAverageSeries {
  seriesId: string;
  type: 'sma' | 'ema' | 'wma' | 'bollinger' | 'rsi' | 'macd';
  period: number;
  /** Bollinger Bands standard deviation multiplier (default: 2) */
  stdDevMultiplier?: number;
  /** RSI overbought threshold (default: 70) */
  overbought?: number;
  /** RSI oversold threshold (default: 30) */
  oversold?: number;
  /** MACD fast period (default: 12) */
  fastPeriod?: number;
  /** MACD slow period (default: 26) */
  slowPeriod?: number;
  /** MACD signal period (default: 9) */
  signalPeriod?: number;
  /** Height of the sub-pane as fraction of total chart area (default: 0.22) */
  paneHeight?: number;
  color?: string;
  lineWidth?: number;
  dashArray?: number[];
  fillOpacity?: number;
}

export interface StatisticsPluginConfig {
  regression?: RegressionSeries[];
  movingAverages?: MovingAverageSeries[];
  /** Render a mean line across each series */
  meanLines?: boolean;
  /** Shade ±1σ band */
  stdDevBands?: boolean;
  stdDevColor?: string;
}

// ── Math utilities ───────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length || 1));
}

// ── Regression algorithms ─────────────────────────────────────────────────────

function linearRegression(xs: number[], ys: number[]): (x: number) => number {
  const mx = mean(xs), my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = den !== 0 ? num / den : 0;
  const intercept = my - slope * mx;
  return (x: number) => slope * x + intercept;
}

function polynomialRegression(xs: number[], ys: number[], degree: number): (x: number) => number {
  // OLS using Vandermonde matrix (Gaussian elimination)
  const d = degree + 1;
  const A: number[][] = Array.from({ length: d }, () => new Array(d + 1).fill(0));

  for (let row = 0; row < d; row++) {
    for (let col = 0; col < d; col++) {
      A[row]![col] = xs.reduce((s, x) => s + x ** (row + col), 0);
    }
    A[row]![d] = xs.reduce((s, x, i) => s + x ** row * ys[i]!, 0);
  }

  // Forward elimination
  for (let i = 0; i < d; i++) {
    for (let j = i + 1; j < d; j++) {
      const ratio = A[j]![i]! / (A[i]![i]! || 1e-10);
      for (let k = i; k <= d; k++) {
        A[j]![k]! -= ratio * A[i]![k]!;
      }
    }
  }

  // Back substitution
  const coeff = new Array(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    coeff[i] = A[i]![d]!;
    for (let j = i + 1; j < d; j++) {
      coeff[i] -= A[i]![j]! * coeff[j];
    }
    coeff[i] /= A[i]![i]! || 1e-10;
  }

  return (x: number) => coeff.reduce((s, c, i) => s + c * x ** i, 0);
}

function logarithmicRegression(xs: number[], ys: number[]): (x: number) => number {
  const logXs = xs.map(x => Math.log(Math.max(x, 1e-10)));
  const fn = linearRegression(logXs, ys);
  return (x: number) => fn(Math.log(Math.max(x, 1e-10)));
}

function exponentialRegression(xs: number[], ys: number[]): (x: number) => number {
  const logYs = ys.map(y => Math.log(Math.max(y, 1e-10)));
  const fn = linearRegression(xs, logYs);
  return (x: number) => Math.exp(fn(x));
}

function powerRegression(xs: number[], ys: number[]): (x: number) => number {
  const logXs = xs.map(x => Math.log(Math.max(x, 1e-10)));
  const logYs = ys.map(y => Math.log(Math.max(y, 1e-10)));
  const fn = linearRegression(logXs, logYs);
  return (x: number) => Math.exp(fn(Math.log(Math.max(x, 1e-10))));
}

/** LOESS (Locally Weighted Scatterplot Smoothing) - Cleveland 1979 */
function loessRegression(xs: number[], ys: number[], bandwidth: number): (x: number) => number {
  const n = xs.length;
  const k = Math.max(2, Math.floor(bandwidth * n));

  return (x0: number): number => {
    const dists = xs.map((xi, i) => ({ dist: Math.abs(xi - x0), i }));
    dists.sort((a, b) => a.dist - b.dist);
    const nearest = dists.slice(0, k);
    const maxDist = nearest[nearest.length - 1]!.dist || 1;

    let sw = 0, swy = 0, swx = 0, swxx = 0, swxy = 0;
    for (const { dist, i } of nearest) {
      const u = dist / maxDist;
      const w = (1 - u * u * u) ** 3; // tricube weight
      const xi = xs[i]!;
      const yi = ys[i]!;
      sw += w; swy += w * yi; swx += w * xi;
      swxx += w * xi * xi; swxy += w * xi * yi;
    }

    const det = sw * swxx - swx * swx;
    if (Math.abs(det) < 1e-10) return swy / (sw || 1);
    const b = (sw * swxy - swx * swy) / det;
    const a = (swy - b * swx) / sw;
    return a + b * x0;
  };
}

function getRegressionFn(
  type: RegressionType,
  xs: number[], ys: number[],
  degree: number,
  bandwidth: number,
): (x: number) => number {
  switch (type) {
    case 'linear': return linearRegression(xs, ys);
    case 'polynomial': return polynomialRegression(xs, ys, degree);
    case 'logarithmic': return logarithmicRegression(xs, ys);
    case 'exponential': return exponentialRegression(xs, ys);
    case 'power': return powerRegression(xs, ys);
    case 'loess': return loessRegression(xs, ys, bandwidth);
  }
}

// ── Moving averages ───────────────────────────────────────────────────────────

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    return mean(values.slice(i - period + 1, i + 1));
  });
}

function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(values.length).fill(null);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (prev === null) {
      if (i >= period - 1) {
        prev = mean(values.slice(0, period));
        result[i] = prev;
      }
    } else {
      prev = values[i]! * k + prev * (1 - k);
      result[i] = prev;
    }
  }
  return result;
}

function wma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    let weightedSum = 0, weightSum = 0;
    for (let w = 1; w <= period; w++) {
      weightedSum += slice[w - 1]! * w;
      weightSum += w;
    }
    return weightedSum / weightSum;
  });
}

// ── RSI ───────────────────────────────────────────────────────────────────────

/** Wilder's smoothed RSI. Returns array of values (0–100), null where not yet computable. */
function rsi(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return result;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i]! - values[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result[period] = firstRsi;

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ── MACD ──────────────────────────────────────────────────────────────────────

interface MACDResult {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
}

function macd(values: number[], fast: number, slow: number, signal: number): MACDResult {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) => {
    const f = fastEma[i], s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });
  // Compute signal EMA only on the non-null suffix to avoid seeding on fake zeros
  const firstValid = macdLine.findIndex(v => v !== null);
  const macdValid = firstValid >= 0 ? macdLine.slice(firstValid).map(v => v!) : [];
  const signalCompact = macdValid.length >= signal ? ema(macdValid, signal) : [];
  const signalLine: (number | null)[] = [
    ...new Array(firstValid < 0 ? values.length : firstValid).fill(null),
    ...signalCompact,
  ];
  const histogram: (number | null)[] = macdLine.map((m, i) => {
    const sig = signalLine[i];
    return m !== null && sig !== null ? m - sig : null;
  });
  return { macdLine, signalLine, histogram };
}

// ── Sub-pane helpers ──────────────────────────────────────────────────────────

function linearMap(v: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const range = fromMax - fromMin;
  if (range === 0) return (toMin + toMax) / 2;
  return toMin + ((v - fromMin) / range) * (toMax - toMin);
}

function renderRSIPane(
  renderer: BaseRenderer,
  xs: number[],
  rsiValues: (number | null)[],
  paneX: number, paneY: number, paneW: number, paneH: number,
  color: string,
  overbought: number,
  oversold: number,
  theme: ThemeConfig,
): void {
  // Clip to pane
  const clipId = `rsi-pane-clip-${++_paneClipCounter}`;
  renderer.defineClipRect(clipId, paneX, paneY, paneW, paneH);

  // Background
  renderer.drawRect(paneX, paneY, paneW, paneH, {
    fill: String(theme.backgroundColor ?? '#fff'),
    fillOpacity: 0.95,
    stroke: String(theme.axis.lineColor ?? '#e5e7eb'),
    strokeWidth: 0.5,
  });

  // Overbought / oversold bands
  const yOB = linearMap(overbought, 0, 100, paneY + paneH, paneY);
  const yOS = linearMap(oversold, 0, 100, paneY + paneH, paneY);
  renderer.drawRect(paneX, paneY, paneW, yOB - paneY, { fill: '#ef444420', stroke: 'none' });
  renderer.drawRect(paneX, yOS, paneW, (paneY + paneH) - yOS, { fill: '#22c55e20', stroke: 'none' });
  renderer.drawLine(paneX, yOB, paneX + paneW, yOB, { stroke: '#ef4444', strokeWidth: 0.7, dashArray: [4, 2], opacity: 0.6 });
  renderer.drawLine(paneX, yOS, paneX + paneW, yOS, { stroke: '#22c55e', strokeWidth: 0.7, dashArray: [4, 2], opacity: 0.6 });
  // 50 line
  const y50 = linearMap(50, 0, 100, paneY + paneH, paneY);
  renderer.drawLine(paneX, y50, paneX + paneW, y50, { stroke: '#9ca3af', strokeWidth: 0.5, dashArray: [3, 3], opacity: 0.4 });

  // RSI line
  const pts: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    const v = rsiValues[i];
    if (v === null) continue;
    pts.push([xs[i]!, linearMap(v, 0, 100, paneY + paneH - 2, paneY + 2)]);
  }
  if (pts.length >= 2) {
    let d = `M${pts[0]![0]},${pts[0]![1]}`;
    for (let i = 1; i < pts.length; i++) d += `L${pts[i]![0]},${pts[i]![1]}`;
    renderer.drawPath(d, { stroke: color, strokeWidth: 1.5, fill: 'none', clipPath: `url(#${clipId})` });
  }

  // Label
  renderer.drawText(paneX + 6, paneY + 10, 'RSI', {
    fill: String(theme.textColor),
    fontSize: 9,
    fontFamily: theme.fontFamily,
    fontWeight: '600',
    opacity: 0.6,
  });

  renderer.removeClipRect();
}

function renderMACDPane(
  renderer: BaseRenderer,
  xs: number[],
  result: MACDResult,
  paneX: number, paneY: number, paneW: number, paneH: number,
  color: string,
  theme: ThemeConfig,
): void {
  const allVals = [
    ...result.macdLine.filter((v): v is number => v !== null),
    ...result.signalLine.filter((v): v is number => v !== null),
    ...result.histogram.filter((v): v is number => v !== null),
  ];
  if (allVals.length === 0) return;

  const vMin = Math.min(0, ...allVals);
  const vMax = Math.max(0, ...allVals);
  const clipId = `macd-pane-clip-${++_paneClipCounter}`;
  renderer.defineClipRect(clipId, paneX, paneY, paneW, paneH);

  // Background
  renderer.drawRect(paneX, paneY, paneW, paneH, {
    fill: String(theme.backgroundColor ?? '#fff'),
    fillOpacity: 0.95,
    stroke: String(theme.axis.lineColor ?? '#e5e7eb'),
    strokeWidth: 0.5,
  });

  // Zero line
  const y0 = linearMap(0, vMin, vMax, paneY + paneH - 2, paneY + 2);
  renderer.drawLine(paneX, y0, paneX + paneW, y0, { stroke: '#9ca3af', strokeWidth: 0.5, opacity: 0.5 });

  // Bar width (approximate from spacing)
  const barW = xs.length > 1 ? Math.max(1, (xs[1]! - xs[0]!) * 0.6) : 4;

  // Histogram bars
  for (let i = 0; i < xs.length; i++) {
    const h = result.histogram[i];
    if (h === null) continue;
    const barX = xs[i]! - barW / 2;
    const yH = linearMap(h, vMin, vMax, paneY + paneH - 2, paneY + 2);
    renderer.drawRect(barX, Math.min(y0, yH), barW, Math.abs(yH - y0), {
      fill: h >= 0 ? '#22c55e' : '#ef4444',
      fillOpacity: 0.6,
      stroke: 'none',
      clipPath: `url(#${clipId})`,
    });
  }

  // MACD line
  const macdPts: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    const v = result.macdLine[i];
    if (v === null) continue;
    macdPts.push([xs[i]!, linearMap(v, vMin, vMax, paneY + paneH - 2, paneY + 2)]);
  }
  if (macdPts.length >= 2) {
    let d = `M${macdPts[0]![0]},${macdPts[0]![1]}`;
    for (let i = 1; i < macdPts.length; i++) d += `L${macdPts[i]![0]},${macdPts[i]![1]}`;
    renderer.drawPath(d, { stroke: color, strokeWidth: 1.5, fill: 'none', clipPath: `url(#${clipId})` });
  }

  // Signal line
  const sigPts: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    const v = result.signalLine[i];
    if (v === null) continue;
    sigPts.push([xs[i]!, linearMap(v, vMin, vMax, paneY + paneH - 2, paneY + 2)]);
  }
  if (sigPts.length >= 2) {
    let d = `M${sigPts[0]![0]},${sigPts[0]![1]}`;
    for (let i = 1; i < sigPts.length; i++) d += `L${sigPts[i]![0]},${sigPts[i]![1]}`;
    renderer.drawPath(d, { stroke: '#f97316', strokeWidth: 1, fill: 'none', dashArray: [4, 2], clipPath: `url(#${clipId})` });
  }

  // Label
  renderer.drawText(paneX + 6, paneY + 10, 'MACD', {
    fill: String(theme.textColor),
    fontSize: 9,
    fontFamily: theme.fontFamily,
    fontWeight: '600',
    opacity: 0.6,
  });

  renderer.removeClipRect();
}

// ── Render statistics overlays ───────────────────────────────────────────────

export function renderStatistics(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config: StatisticsPluginConfig,
): void {
  // Reset clip counter for deterministic IDs across re-renders
  resetPaneClipCounter();

  // Regression lines
  for (const regCfg of config.regression ?? []) {
    const src = allSeries.find(s => s.id === regCfg.seriesId);
    if (!src) continue;

    const xScale = state.scales.get(src.xAxisId ?? 'x0');
    const yScale = state.scales.get(src.yAxisId ?? 'y0');
    if (!xScale || !yScale) continue;

    const data = (src.processedData ?? src.data) as ProcessedDataPoint[];
    // Filter xs and ys TOGETHER so their indices stay paired.
    // Filtering independently produces arrays of different lengths, making
    // every regression algorithm produce completely wrong results.
    const validPairs = data.filter(
      d => isFinite(Number(d.xNum ?? d.x)) && isFinite(Number(d.yNum ?? d.y)),
    );
    const xs = validPairs.map(d => Number(d.xNum ?? d.x));
    const ys = validPairs.map(d => Number(d.yNum ?? d.y));
    if (xs.length < 2) continue;

    const fn = getRegressionFn(regCfg.type, xs, ys, regCfg.degree ?? 2, regCfg.bandwidth ?? 0.25);
    let xMin = Infinity, xMax = -Infinity;
    for (let _k = 0; _k < xs.length; _k++) {
      if (xs[_k]! < xMin) xMin = xs[_k]!;
      if (xs[_k]! > xMax) xMax = xs[_k]!;
    }
    const steps = 100;
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const xv = xMin + (i / steps) * (xMax - xMin);
      const yv = fn(xv);
      if (!isFinite(yv)) continue;
      pts.push([xScale.convert(xv), yScale.convert(yv)]);
    }

    if (pts.length < 2) continue;
    const seriesColor = src.color as string ?? theme.palette[0] ?? '#6366f1';
    let d = `M${pts[0]![0]},${pts[0]![1]}`;
    for (let i = 1; i < pts.length; i++) d += `L${pts[i]![0]},${pts[i]![1]}`;

    renderer.drawPath(d, {
      stroke: regCfg.color ?? seriesColor,
      strokeWidth: regCfg.lineWidth ?? 1.5,
      fill: 'none',
      dashArray: regCfg.dashArray ?? [6, 3],
      opacity: 0.85,
    });

    if (regCfg.label) {
      const lp = pts[Math.floor(pts.length * 0.6)]!;
      renderer.drawText(lp[0] + 6, lp[1] - 6, regCfg.label, {
        fill: regCfg.color ?? seriesColor,
        fontSize: 10,
        fontFamily: theme.fontFamily,
      });
    }
  }

  // Moving averages
  for (const maCfg of config.movingAverages ?? []) {
    const src = allSeries.find(s => s.id === maCfg.seriesId);
    if (!src) continue;

    const xScale = state.scales.get(src.xAxisId ?? 'x0');
    const yScale = state.scales.get(src.yAxisId ?? 'y0');
    if (!xScale || !yScale) continue;

    const data = (src.processedData ?? src.data) as ProcessedDataPoint[];
    const ys = data.map(d => Number(d.yNum ?? d.y));
    const seriesColor = src.color as string ?? theme.palette[0] ?? '#6366f1';

    if (maCfg.type === 'bollinger') {
      const midValues = sma(ys, maCfg.period);
      const mult = maCfg.stdDevMultiplier ?? 2;

      const upperPts: [number, number][] = [];
      const midPts: [number, number][] = [];
      const lowerPts: [number, number][] = [];

      for (let i = 0; i < data.length; i++) {
        const mid = midValues[i];
        if (mid === null) continue;
        const slice = ys.slice(Math.max(0, i - maCfg.period + 1), i + 1);
        const sd = stdDev(slice.filter(v => isFinite(v)));
        const px = xScale.convert(Number(data[i]!.xNum ?? data[i]!.x));
        midPts.push([px, yScale.convert(mid)]);
        upperPts.push([px, yScale.convert(mid + mult * sd)]);
        lowerPts.push([px, yScale.convert(mid - mult * sd)]);
      }

      if (midPts.length < 2) continue;

      // Fill band
      const allBandPts = [...upperPts, ...[...lowerPts].reverse()];
      let bandPath = `M${allBandPts[0]![0]},${allBandPts[0]![1]}`;
      for (let i = 1; i < allBandPts.length; i++) bandPath += `L${allBandPts[i]![0]},${allBandPts[i]![1]}`;
      bandPath += 'Z';

      renderer.drawPath(bandPath, {
        fill: maCfg.color ?? seriesColor,
        fillOpacity: maCfg.fillOpacity ?? 0.08,
        stroke: 'none',
      });

      // Upper / lower borders
      const polyPath = (pts: [number, number][]) => {
        let d = `M${pts[0]![0]},${pts[0]![1]}`;
        for (let i = 1; i < pts.length; i++) d += `L${pts[i]![0]},${pts[i]![1]}`;
        return d;
      };

      for (const pts of [upperPts, midPts, lowerPts]) {
        renderer.drawPath(polyPath(pts), {
          stroke: maCfg.color ?? seriesColor,
          strokeWidth: pts === midPts ? (maCfg.lineWidth ?? 1.5) : 0.8,
          fill: 'none',
          dashArray: maCfg.dashArray,
          opacity: 0.7,
        });
      }
    } else if (maCfg.type === 'rsi') {
      const rsiValues = rsi(ys, maCfg.period);
      const paneH = (maCfg.paneHeight ?? 0.22) * state.chartArea.height;
      const paneY = state.chartArea.y + state.chartArea.height - paneH;
      const pxs = data.map((d: ProcessedDataPoint) => xScale.convert(Number(d.xNum ?? d.x)));
      renderRSIPane(
        renderer, pxs, rsiValues,
        state.chartArea.x, paneY, state.chartArea.width, paneH,
        maCfg.color ?? '#8b5cf6',
        maCfg.overbought ?? 70, maCfg.oversold ?? 30,
        theme,
      );
    } else if (maCfg.type === 'macd') {
      const fast = maCfg.fastPeriod ?? 12;
      const slow = maCfg.slowPeriod ?? 26;
      const sig = maCfg.signalPeriod ?? 9;
      const macdResult = macd(ys, fast, slow, sig);
      const paneH = (maCfg.paneHeight ?? 0.22) * state.chartArea.height;
      const paneY = state.chartArea.y + state.chartArea.height - paneH;
      const pxs = data.map((d: ProcessedDataPoint) => xScale.convert(Number(d.xNum ?? d.x)));
      renderMACDPane(
        renderer, pxs, macdResult,
        state.chartArea.x, paneY, state.chartArea.width, paneH,
        maCfg.color ?? '#6366f1',
        theme,
      );
    } else {
      const maValues = maCfg.type === 'ema'
        ? ema(ys, maCfg.period)
        : maCfg.type === 'wma'
          ? wma(ys, maCfg.period)
          : sma(ys, maCfg.period);

      const pts: [number, number][] = [];
      for (let i = 0; i < data.length; i++) {
        const v = maValues[i];
        if (v === null) continue;
        pts.push([xScale.convert(Number(data[i]!.xNum ?? data[i]!.x)), yScale.convert(v)]);
      }

      if (pts.length < 2) continue;
      let d = `M${pts[0]![0]},${pts[0]![1]}`;
      for (let i = 1; i < pts.length; i++) d += `L${pts[i]![0]},${pts[i]![1]}`;

      renderer.drawPath(d, {
        stroke: maCfg.color ?? seriesColor,
        strokeWidth: maCfg.lineWidth ?? 1.5,
        fill: 'none',
        dashArray: maCfg.dashArray,
        opacity: 0.9,
      });
    }
  }

  // Mean + stddev bands
  if (config.meanLines || config.stdDevBands) {
    for (const s of allSeries) {
      const xScale = state.scales.get(s.xAxisId ?? 'x0');
      const yScale = state.scales.get(s.yAxisId ?? 'y0');
      if (!xScale || !yScale) continue;

      const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
      const ys = data.map(d => Number(d.yNum ?? d.y)).filter(isFinite);
      if (ys.length === 0) continue;

      const m = mean(ys);
      const sd = stdDev(ys);
      const ca = state.chartArea;
      const seriesColor = s.color as string ?? theme.palette[0] ?? '#6366f1';
      const py = yScale.convert(m);

      if (config.meanLines) {
        renderer.drawLine(ca.x, py, ca.x + ca.width, py, {
          stroke: seriesColor,
          strokeWidth: 1,
          dashArray: [8, 4],
          opacity: 0.5,
        });
      }

      if (config.stdDevBands) {
        const upperY = yScale.convert(m + sd);
        const lowerY = yScale.convert(m - sd);
        renderer.drawRect(ca.x, upperY, ca.width, lowerY - upperY, {
          fill: config.stdDevColor ?? seriesColor,
          fillOpacity: 0.06,
          stroke: 'none',
        });
      }
    }
  }
}

// ── Plugin registration ───────────────────────────────────────────────────────

// ── Exported pure math API ────────────────────────────────────────────────────
// These are exported for direct use (testing, advanced integrations).

export {
  linearRegression,
  polynomialRegression,
  logarithmicRegression,
  exponentialRegression,
  powerRegression,
  loessRegression,
  sma,
  ema,
  wma,
  rsi,
  macd,
};
export type { MACDResult };

export const StatisticsPlugin = createPlugin('statistics')
  .version('1.0.0')
  .name('Statistics Plugin')
  .hook('draw', (rendererOrEngine: unknown) => {
    // Render hooks injected by Engine when config.statistics is present
    void rendererOrEngine;
  })
  .build();
