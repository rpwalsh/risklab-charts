// ============================================================================
// RiskLab Charts — Contour / Topographic Chart
// 2D field visualization with iso-lines — terrain, signal strength, density
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderContourChart(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const { chartArea: ca } = state;
  const data = series.data.filter(d => d.x != null && d.y != null && d.z != null);
  if (data.length < 3) return;

  // Build raw grid from data.z (the value dimension)
  const xs = [...new Set(data.map(d => Number(d.x)))].sort((a, b) => a - b);
  const ys = [...new Set(data.map(d => Number(d.y)))].sort((a, b) => a - b);
  const grid = new Map<string, number>();
  let minVal = Infinity, maxVal = -Infinity;

  for (const d of data) {
    const v = Number(d.z);
    grid.set(`${d.x},${d.y}`, v);
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  const levels = 10;
  const step = (maxVal - minVal) / levels;
  const palette = generateContourPalette(color, levels, theme);

  // Rasterize filled contour regions as rects
  for (let xi = 0; xi < xs.length - 1; xi++) {
    for (let yi = 0; yi < ys.length - 1; yi++) {
      const v00 = grid.get(`${xs[xi]},${ys[yi]}`) ?? minVal;
      const v10 = grid.get(`${xs[xi + 1]},${ys[yi]}`) ?? minVal;
      const v01 = grid.get(`${xs[xi]},${ys[yi + 1]}`) ?? minVal;
      const v11 = grid.get(`${xs[xi + 1]},${ys[yi + 1]}`) ?? minVal;
      const avg = (v00 + v10 + v01 + v11) / 4;
      const levelIdx = Math.min(Math.floor((avg - minVal) / step), levels - 1);

      const xRange = xs[xs.length - 1] - xs[0] || 1;
      const yRange = ys[ys.length - 1] - ys[0] || 1;
      const px = ca.x + ((xs[xi] - xs[0]) / xRange) * ca.width;
      const py = ca.y + ca.height - ((ys[yi] - ys[0]) / yRange) * ca.height;
      const pw = ((xs[xi + 1] - xs[xi]) / xRange) * ca.width;
      const ph = ((ys[yi + 1] - ys[yi]) / yRange) * ca.height;

      r.drawRect(px, py - ph, pw + 0.5, ph + 0.5, {
        fill: palette[levelIdx],
        fillOpacity: 0.85,
        stroke: 'none',
      });
    }
  }

  // Draw iso-lines via marching squares (simplified)
  for (let lvl = 1; lvl < levels; lvl++) {
    const threshold = minVal + lvl * step;
    const isoPath = marchingSquares(xs, ys, grid, threshold, ca, minVal);
    if (isoPath) {
      r.drawPath(isoPath, {
        fill: 'none',
        stroke: theme.textColor as string,
        strokeWidth: 0.6,
        strokeOpacity: 0.4,
      });
    }
  }
}

function marchingSquares(
  xs: number[], ys: number[],
  grid: Map<string, number>,
  threshold: number,
  ca: { x: number; y: number; width: number; height: number },
  _minVal: number,
): string {
  const segments: string[] = [];
  const xRange = xs[xs.length - 1] - xs[0] || 1;
  const yRange = ys[ys.length - 1] - ys[0] || 1;

  const toPixel = (x: number, y: number): [number, number] => [
    ca.x + ((x - xs[0]) / xRange) * ca.width,
    ca.y + ca.height - ((y - ys[0]) / yRange) * ca.height,
  ];

  for (let xi = 0; xi < xs.length - 1; xi++) {
    for (let yi = 0; yi < ys.length - 1; yi++) {
      const v00 = grid.get(`${xs[xi]},${ys[yi]}`) ?? 0;
      const v10 = grid.get(`${xs[xi + 1]},${ys[yi]}`) ?? 0;
      const v01 = grid.get(`${xs[xi]},${ys[yi + 1]}`) ?? 0;
      const v11 = grid.get(`${xs[xi + 1]},${ys[yi + 1]}`) ?? 0;

      const idx = (v00 >= threshold ? 8 : 0)
        | (v10 >= threshold ? 4 : 0)
        | (v11 >= threshold ? 2 : 0)
        | (v01 >= threshold ? 1 : 0);

      if (idx === 0 || idx === 15) continue;

      // Interpolate edge crossings
      const x0 = xs[xi], x1 = xs[xi + 1];
      const y0 = ys[yi], y1 = ys[yi + 1];
      const interp = (a: number, b: number, va: number, vb: number) => {
        const denom = vb - va;
        return denom === 0 ? (a + b) / 2 : a + (threshold - va) / denom * (b - a);
      };

      const edges: Record<string, [number, number]> = {
        t: toPixel(interp(x0, x1, v00, v10), y0),   // top
        r: toPixel(x1, interp(y0, y1, v10, v11)),    // right
        b: toPixel(interp(x0, x1, v01, v11), y1),    // bottom
        l: toPixel(x0, interp(y0, y1, v00, v01)),    // left
      };

      const addSeg = (e1: string, e2: string) => {
        const [ax, ay] = edges[e1];
        const [bx, by] = edges[e2];
        segments.push(`M ${ax} ${ay} L ${bx} ${by}`);
      };

      // Lookup table (simplified — single-segment cases)
      if (idx === 1 || idx === 14) addSeg('l', 'b');
      else if (idx === 2 || idx === 13) addSeg('b', 'r');
      else if (idx === 4 || idx === 11) addSeg('t', 'r');
      else if (idx === 8 || idx === 7) addSeg('t', 'l');
      else if (idx === 3 || idx === 12) addSeg('l', 'r');
      else if (idx === 6 || idx === 9) addSeg('t', 'b');
      else if (idx === 5) {
        // Saddle: disambiguate by cell-centre average
        const avg5 = (v00 + v10 + v01 + v11) / 4;
        if (avg5 >= threshold) { addSeg('t', 'r'); addSeg('b', 'l'); }
        else { addSeg('t', 'l'); addSeg('b', 'r'); }
      } else if (idx === 10) {
        const avg10 = (v00 + v10 + v01 + v11) / 4;
        if (avg10 >= threshold) { addSeg('t', 'l'); addSeg('b', 'r'); }
        else { addSeg('t', 'r'); addSeg('b', 'l'); }
      }
    }
  }

  return segments.join(' ');
}

function generateContourPalette(baseColor: string, levels: number, theme?: ThemeConfig): string[] {
  // Prefer a palette built from the theme's series colors for visual consistency
  const themeColors = theme?.colors as string[] | undefined;
  if (themeColors && themeColors.length >= 2) {
    return buildInterpolatedPalette(themeColors, levels);
  }
  const palette: string[] = [];
  // Parse the base color to extract a hue offset
  const baseHue = parseColorToHue(baseColor);
  for (let i = 0; i < levels; i++) {
    const t = i / Math.max(levels - 1, 1);
    const h = baseHue + t * 140; // sweep 140° from the base hue
    const s = 70 + t * 20;
    const l = 30 + t * 40;
    palette.push(`hsl(${h % 360}, ${s}%, ${l}%)`);
  }
  return palette;
}

function buildInterpolatedPalette(colors: string[], levels: number): string[] {
  const palette: string[] = [];
  for (let i = 0; i < levels; i++) {
    const t = i / Math.max(levels - 1, 1);
    // Pick two adjacent stops from the theme colors to interpolate between
    const segment = t * (colors.length - 1);
    const lo = Math.floor(segment);
    const hi = Math.min(lo + 1, colors.length - 1);
    const frac = segment - lo;
    palette.push(blendHex(colors[lo]!, colors[hi]!, frac));
  }
  return palette;
}

function blendHex(a: string, b: string, t: number): string {
  const pa = parseHexRGB(a), pb = parseHexRGB(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bv = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bv})`;
}

function parseHexRGB(hex: string): [number, number, number] {
  if (hex.startsWith('#')) {
    const c = hex.slice(1);
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const m = hex.match(/(\d+)/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return [128, 128, 128];
}

function parseColorToHue(color: string): number {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const num = parseInt(hex.length === 3
      ? hex.split('').map(c => c + c).join('')
      : hex, 16);
    if (isNaN(num)) return 220;
    const rr = (num >> 16) & 255, gg = (num >> 8) & 255, bb = num & 255;
    return rgbToHue(rr, gg, bb);
  }
  // Handle rgb()/rgba()
  const rgbMatch = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgbMatch) return rgbToHue(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  // Handle hsl()/hsla()
  const hslMatch = color.match(/hsla?\(\s*(\d+)/);
  if (hslMatch) return +hslMatch[1];
  return 220; // default blue
}

function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 220;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}
