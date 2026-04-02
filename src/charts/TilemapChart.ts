// ============================================================================
// RiskLab Charts — Tilemap Chart
// Grid of tiles (hexagons, circles, or squares) colored by value.
// Highcharts charges for this as "tilemap" series — free in RiskLab Charts.
// Use cases: geographic data grids, calendar tiles, election maps.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';

export type TileShape = 'hexagon' | 'square' | 'circle' | 'diamond';

export interface TilemapDataPoint {
  /** Column index (x position). */
  x: number;
  /** Row index (y position). */
  y: number;
  /** Value driving the color scale. */
  value: number;
  /** Optional text label. */
  label?: string;
  /** Override tile color. */
  color?: string;
}

export interface TilemapConfig {
  data: TilemapDataPoint[];
  /** Tile shape (default 'hexagon'). */
  shape?: TileShape;
  /** Color scale: [low, mid?, high] hex strings. */
  colorScale?: string[];
  /** Tile size in px (default: auto-fit). */
  tileSize?: number;
  /** Gap between tiles in px (default 2). */
  gap?: number;
  /** Show value labels inside tiles (default false). */
  showLabels?: boolean;
  /** Minimum data value (default: auto). */
  dataMin?: number;
  /** Maximum data value (default: auto). */
  dataMax?: number;
  /** Null/missing tile color (default 'transparent'). */
  nullColor?: string;
}

// ---- Color interpolation ----------------------------------------------------

function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (h: string) => {
    const c = h.replace('#', '');
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = Math.round((ar ?? 0) + ((br ?? 0) - (ar ?? 0)) * t);
  const g = Math.round((ag ?? 0) + ((bg ?? 0) - (ag ?? 0)) * t);
  const bv = Math.round((ab ?? 0) + ((bb ?? 0) - (ab ?? 0)) * t);
  return `rgb(${r},${g},${bv})`;
}

function valueToColor(v: number, min: number, max: number, scale: string[]): string {
  if (max === min) return scale[Math.floor(scale.length / 2)] ?? '#888';
  const t = (v - min) / (max - min);
  if (scale.length === 2) return lerpColor(scale[0]!, scale[1]!, t);
  // 3-stop: low → mid → high
  if (t <= 0.5) return lerpColor(scale[0]!, scale[1]!, t * 2);
  return lerpColor(scale[1]!, scale[2]!, (t - 0.5) * 2);
}

// ---- Tile path builders -----------------------------------------------------

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

function diamondPath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
}

// ---- Main render ------------------------------------------------------------

export function renderTilemap(
  renderer: BaseRenderer,
  _allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const tmCfg = (config as ChartConfig & { tilemap?: TilemapConfig })?.tilemap;
  if (!tmCfg || !tmCfg.data.length) return;

  const { chartArea } = state;
  const shape      = tmCfg.shape      ?? 'hexagon';
  const gap        = tmCfg.gap        ?? 2;
  const showLbls   = tmCfg.showLabels ?? false;
  const colorScale = tmCfg.colorScale ?? ['#4575b4', '#ffffbf', '#d73027'];

  const data   = tmCfg.data;
  const xCols  = [...new Set(data.map(d => d.x))].sort((a, b) => a - b);
  const yRows  = [...new Set(data.map(d => d.y))].sort((a, b) => a - b);
  const cols   = xCols.length;
  const rows   = yRows.length;

  const values = data.map(d => d.value).filter(v => v !== null && v !== undefined);
  const dataMin = tmCfg.dataMin ?? Math.min(...values);
  const dataMax = tmCfg.dataMax ?? Math.max(...values);

  const autoSize = tmCfg.tileSize ?? Math.min(
    (chartArea.width  / cols),
    (chartArea.height / rows),
  ) - gap;
  const tileSize = Math.max(4, autoSize);

  // Offsets for hexagonal layout
  const hexW = tileSize * Math.sqrt(3);
  const hexH = tileSize * 2;
  const hexRowStep = hexH * 0.75;
  const hexColStep = hexW;

  const squareStep = tileSize + gap;

  // Centre the grid
  const gridW = shape === 'hexagon' ? hexColStep * cols + hexW * 0.5 : squareStep * cols;
  const gridH = shape === 'hexagon' ? hexRowStep * rows + hexH * 0.25 : squareStep * rows;
  const offsetX = chartArea.x + (chartArea.width  - gridW) / 2 + tileSize;
  const offsetY = chartArea.y + (chartArea.height - gridH) / 2 + tileSize;

  const xIdxMap = new Map(xCols.map((x, i) => [x, i]));
  const yIdxMap = new Map(yRows.map((y, i) => [y, i]));

  renderer.beginGroup('tilemap-tiles', 'uc-tilemap-tiles');

  for (const pt of data) {
    const xi = xIdxMap.get(pt.x) ?? 0;
    const yi = yIdxMap.get(pt.y) ?? 0;
    const color = pt.color ?? valueToColor(pt.value, dataMin, dataMax, colorScale);

    let cx: number, cy: number;
    switch (shape) {
      case 'hexagon': {
        cx = offsetX + xi * hexColStep + (yi % 2 === 1 ? hexColStep / 2 : 0);
        cy = offsetY + yi * hexRowStep;
        renderer.drawPath(hexPath(cx, cy, tileSize), { fill: color });
        break;
      }
      case 'circle': {
        cx = offsetX + xi * squareStep;
        cy = offsetY + yi * squareStep;
        renderer.drawCircle(cx, cy, tileSize / 2, { fill: color });
        break;
      }
      case 'diamond': {
        cx = offsetX + xi * squareStep;
        cy = offsetY + yi * squareStep;
        renderer.drawPath(diamondPath(cx, cy, tileSize / 2), { fill: color });
        break;
      }
      case 'square':
      default: {
        cx = offsetX + xi * squareStep - tileSize / 2;
        cy = offsetY + yi * squareStep - tileSize / 2;
        renderer.drawRect(cx, cy, tileSize, tileSize, { fill: color }, 2, 2);
        cx += tileSize / 2;
        cy += tileSize / 2;
        break;
      }
    }

    if (showLbls && tileSize >= 16) {
      const lbl = pt.label ?? String(Math.round(pt.value));
      renderer.drawText(cx, cy, lbl, {
        fontSize: Math.min(10, tileSize * 0.4),
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: '#fff',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
  }

  renderer.endGroup();

  // ── Color scale legend (only when labels are enabled) ────────────────────
  if (showLbls) {
  const legendSteps = 5;
  const legendBoxSize = 12;
  const legendGap = 2;
  const legendTotalW = legendSteps * (legendBoxSize + legendGap) + 60;
  const legendX = chartArea.x + (chartArea.width - legendTotalW) / 2;
  const legendY = chartArea.y + chartArea.height - legendBoxSize - 4;

  renderer.drawText(legendX, legendY + legendBoxSize, String(Math.round(dataMin)), {
    fontSize: 9, fill: (theme.textColor as string) ?? '#666', textAnchor: 'end',
    fontFamily: theme.fontFamily ?? 'sans-serif',
  });

  for (let i = 0; i < legendSteps; i++) {
    const t = i / (legendSteps - 1);
    const lColor = valueToColor(dataMin + t * (dataMax - dataMin), dataMin, dataMax, colorScale);
    renderer.drawRect(legendX + 4 + i * (legendBoxSize + legendGap), legendY, legendBoxSize, legendBoxSize, { fill: lColor }, 2, 2);
  }

  renderer.drawText(legendX + 4 + legendSteps * (legendBoxSize + legendGap) + 4, legendY + legendBoxSize, String(Math.round(dataMax)), {
    fontSize: 9, fill: (theme.textColor as string) ?? '#666', textAnchor: 'start',
    fontFamily: theme.fontFamily ?? 'sans-serif',
  });
  }
}
