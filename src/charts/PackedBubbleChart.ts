// ============================================================================
// RiskLab Charts — Packed Bubble Chart
// Circles sized by value, packed together using a force-directed simulation.
// Equivalent to Highcharts premium "packedbubble" series — free in RiskLab Charts.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

// ---- Public config ----------------------------------------------------------

export interface PackedBubbleConfig {
  /** Minimum circle radius in px (default 8). */
  minRadius?: number;
  /** Maximum circle radius in px (default 80). */
  maxRadius?: number;
  /** Number of force-simulation iterations (default 120). */
  iterations?: number;
  /** Show value labels inside bubbles (default true). */
  showLabels?: boolean;
  /** Show series-name label inside bubbles (default false). */
  showSeriesName?: boolean;
  /** Padding between circles (default 2). */
  padding?: number;
  /** 'none' disables grouping rings (default 'none'). */
  parentNode?: { enabled: boolean; lineWidth?: number; fill?: string };
}

// ---- Layout -----------------------------------------------------------------

interface Bubble {
  id: string;
  label: string;
  value: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  groupIdx: number;
}

function _mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function packBubbles(
  bubbles: Bubble[],
  cx: number,
  cy: number,
  areaW: number,
  areaH: number,
  padding: number,
  iterations: number,
): void {
  const n = bubbles.length;
  if (!n) return;

  // Initialise positions in a circle
  const initR = Math.min(areaW, areaH) * 0.35;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * 2 * Math.PI;
    bubbles[i].x = cx + initR * Math.cos(angle);
    bubbles[i].y = cy + initR * Math.sin(angle);
    bubbles[i].vx = 0;
    bubbles[i].vy = 0;
  }

  const damping = 0.85;
  const gravity = 0.02;

  for (let iter = 0; iter < iterations; iter++) {
    // Gravity toward center
    for (const b of bubbles) {
      b.vx += (cx - b.x) * gravity;
      b.vy += (cy - b.y) * gravity;
    }

    // Collision resolution
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const bi = bubbles[i];
        const bj = bubbles[j];
        const dx = bj.x - bi.x;
        const dy = bj.y - bi.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDist = bi.r + bj.r + padding;
        if (dist < minDist) {
          const overlap = (minDist - dist) / dist * 0.5;
          const fx = dx * overlap;
          const fy = dy * overlap;
          bi.vx -= fx; bi.vy -= fy;
          bj.vx += fx; bj.vy += fy;
        }
      }
    }

    // Integrate
    for (const b of bubbles) {
      b.vx *= damping;
      b.vy *= damping;
      b.x += b.vx;
      b.y += b.vy;
    }
  }
}

// ---- Main render ------------------------------------------------------------

export function renderPackedBubble(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
  pbConfig?: PackedBubbleConfig,
): void {
  const cfg: PackedBubbleConfig = pbConfig ?? {};
  const minR   = cfg.minRadius   ?? 8;
  const maxR   = cfg.maxRadius   ?? 80;
  const iters  = cfg.iterations  ?? 120;
  const pad    = cfg.padding     ?? 2;
  const doLabels = cfg.showLabels !== false;

  const { chartArea } = state;
  const cx = chartArea.x + chartArea.width / 2;
  const cy = chartArea.y + chartArea.height / 2;

  // Build bubble list from all packedBubble series
  const bubbles: Bubble[] = [];
  let globalMin = Infinity, globalMax = -Infinity;
  for (const s of allSeries) {
    for (const pt of s.data) {
      const v = Number(pt.y ?? 0);
      if (v > globalMax) globalMax = v;
      if (v < globalMin) globalMin = v;
    }
  }

  for (let si = 0; si < allSeries.length; si++) {
    const s = allSeries[si];
    const baseColor = getSeriesColor(theme, si);
    for (let pi = 0; pi < s.data.length; pi++) {
      const pt = s.data[pi];
      const v = Number(pt.y ?? 0);
      // sqrt mapping so bubble AREA (not radius) is proportional to value
      const tLinear = globalMax === globalMin ? 0.5 : (v - globalMin) / (globalMax - globalMin);
      const r = minR + Math.sqrt(Math.max(0, tLinear)) * (maxR - minR);
      bubbles.push({
        id: `${si}-${pi}`,
        label: (pt.label as string | undefined) ?? String(v),
        value: v,
        r,
        x: 0, y: 0, vx: 0, vy: 0,
        color: (pt.color as string | undefined) ?? baseColor,
        groupIdx: si,
      });
    }
  }

  if (!bubbles.length) return;

  // Sort largest first for better packing
  bubbles.sort((a, b) => b.r - a.r);

  packBubbles(bubbles, cx, cy, chartArea.width, chartArea.height, pad, iters);

  // Clamp bubbles to stay within chartArea bounds
  for (const b of bubbles) {
    b.x = Math.max(chartArea.x + b.r, Math.min(chartArea.x + chartArea.width - b.r, b.x));
    b.y = Math.max(chartArea.y + b.r, Math.min(chartArea.y + chartArea.height - b.r, b.y));
  }

  renderer.beginGroup('pb-circles', 'uc-pb-circles');

  const showOutlines = cfg.parentNode?.enabled ?? false;

  for (const b of bubbles) {
    // Drop shadow / depth ring (only when explicitly enabled)
    if (showOutlines) {
      renderer.drawCircle(b.x, b.y, b.r + 1, {
        fill: 'none',
        stroke: 'rgba(0,0,0,0.12)',
        strokeWidth: 2,
      });
    }
    renderer.drawCircle(b.x, b.y, b.r, {
      fill: b.color,
      stroke: 'rgba(255,255,255,0.6)',
      strokeWidth: 1.5,
    });

    if (doLabels && b.r >= 12) {
      // Primary label (value or custom label)
      const fontSize = Math.max(9, Math.min(b.r * 0.35, 16));
      renderer.drawText(b.x, b.y - (b.r >= 30 ? fontSize * 0.4 : 0), b.label, {
        fontSize,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: '#fff',
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
      // Series name label for larger bubbles (opt-in via showSeriesName)
      if (cfg.showSeriesName && b.r >= 30) {
        const sName = allSeries[b.groupIdx]?.name ?? '';
        if (sName) {
          renderer.drawText(b.x, b.y + fontSize * 0.6, sName, {
            fontSize: Math.max(8, fontSize * 0.7),
            fontFamily: theme.fontFamily ?? 'sans-serif',
            fill: 'rgba(255,255,255,0.7)',
            textAnchor: 'middle',
            dominantBaseline: 'middle',
          });
        }
      }
    }
  }

  renderer.endGroup();

  // Optional parent node rings (one per series)
  if (cfg.parentNode?.enabled) {
    renderer.beginGroup('pb-groups', 'uc-pb-groups');
    const seriesCount = allSeries.length;
    for (let si = 0; si < seriesCount; si++) {
      const groupBubbles = bubbles.filter(b => b.groupIdx === si);
      if (!groupBubbles.length) continue;
      // Bounding circle
      const avgX = groupBubbles.reduce((s, b) => s + b.x, 0) / groupBubbles.length;
      const avgY = groupBubbles.reduce((s, b) => s + b.y, 0) / groupBubbles.length;
      const maxDist = Math.max(...groupBubbles.map(b => {
        const dx = b.x - avgX, dy = b.y - avgY;
        return Math.sqrt(dx * dx + dy * dy) + b.r + 4;
      }));
      renderer.drawCircle(avgX, avgY, maxDist, {
        fill: cfg.parentNode.fill ?? 'none',
        stroke: getSeriesColor(theme, si),
        strokeWidth: cfg.parentNode.lineWidth ?? 1.5,
        opacity: 0.5,
      });
    }
    renderer.endGroup();
  }
}
