// ============================================================================
// RiskLab Charts — Horizon Chart
// Compact multi-band time-series — high density data comparison
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, DataValue } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderHorizonChart(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, theme: ThemeConfig, color: string, idx: number, total: number,
): void {
  const { chartArea: ca } = state;
  const data = series.data.filter(d => d.y != null);
  if (data.length < 2) return;

  const bands = 3; // number of folded bands
  const rowH = ca.height / Math.max(total, 1);
  const rowY = ca.y + idx * rowH;

  const values = data.map(d => Number(d.y));
  // Use the mean as baseline so values fold symmetrically around the center.
  // A zero baseline only works when data naturally oscillates around zero.
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const baseline = mean;
  const maxAbs = Math.max(...values.map(v => Math.abs(v - baseline))) || 1;
  const bandStep = maxAbs / bands;

  const positiveColors = [adjustLightness(color, 0.7), adjustLightness(color, 0.5), adjustLightness(color, 0.3)];
  const negativeColors = ['hsl(0,60%,70%)', 'hsl(0,60%,50%)', 'hsl(0,60%,35%)'];

  // Series label — clamp to stay within left edge
  const labelX = ca.x - 6;
  r.drawText(labelX, rowY + rowH / 2 + 4, series.name, {
    fill: theme.textColor as string, fontSize: 10, textAnchor: 'end',
  });

  // Separator line
  r.drawLine(ca.x, rowY + rowH, ca.x + ca.width, rowY + rowH, {
    stroke: theme.axis.gridColor as string, strokeWidth: 0.5,
  });

  // Draw each band layer
  for (let b = bands - 1; b >= 0; b--) {
    const posPath = buildBandPath(data, ca, rowY, rowH, baseline, bandStep, b, bands, true);
    const negPath = buildBandPath(data, ca, rowY, rowH, baseline, bandStep, b, bands, false);

    if (posPath) r.drawPath(posPath, { fill: positiveColors[b], fillOpacity: 0.9, stroke: 'none' });
    if (negPath) r.drawPath(negPath, { fill: negativeColors[b], fillOpacity: 0.9, stroke: 'none' });
  }
}

function buildBandPath(
  data: Array<{ y: DataValue }>, ca: { x: number; width: number }, rowY: number, rowH: number,
  baseline: number, bandStep: number, band: number, bands: number,
  positive: boolean,
): string {
  const n = data.length;
  const threshold = band * bandStep;
  let path = `M ${ca.x} ${rowY + rowH}`;
  let hasContent = false;

  for (let i = 0; i < n; i++) {
    const px = ca.x + (i / (n - 1)) * ca.width;
    const raw = Number(data[i].y) - baseline;
    const val = positive ? Math.max(0, raw) : Math.max(0, -raw);
    const clipped = Math.max(0, Math.min(bandStep, val - threshold));
    const normalized = clipped / bandStep;
    const py = rowY + rowH - normalized * rowH;

    if (normalized > 0) hasContent = true;
    path += ` L ${px} ${py}`;
  }

  path += ` L ${ca.x + ca.width} ${rowY + rowH} Z`;
  return hasContent ? path : '';
}

function adjustLightness(color: string, factor: number): string {
  // Handle hex (#rgb or #rrggbb)
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return color;
    const rr = Math.round(((num >> 16) & 255) * factor);
    const gg = Math.round(((num >> 8) & 255) * factor);
    const bb = Math.round((num & 255) * factor);
    return `rgb(${Math.min(255, rr)},${Math.min(255, gg)},${Math.min(255, bb)})`;
  }
  // Handle rgb()/rgba()
  const rgbMatch = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgbMatch) {
    const rr = Math.round(+rgbMatch[1] * factor);
    const gg = Math.round(+rgbMatch[2] * factor);
    const bb = Math.round(+rgbMatch[3] * factor);
    return `rgb(${Math.min(255, rr)},${Math.min(255, gg)},${Math.min(255, bb)})`;
  }
  // Handle hsl()/hsla() — adjust lightness directly
  const hslMatch = color.match(/hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/);
  if (hslMatch) {
    const h = +hslMatch[1];
    const s = +hslMatch[2];
    const l = Math.min(100, +hslMatch[3] * factor);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  // Fallback: return as-is (named colors etc.)
  return color;
}
