// ============================================================================
// RiskLab Charts — Venn Diagram Renderer
// Renders proportional Euler / Venn diagrams with overlapping circles.
// commercial charting charges for this as "venn" series — free in RiskLab Charts.
//
// Algorithm: Iterative force-based layout to minimise intersection-area error,
// then renders circles with semi-transparent overlap fills.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

// ---- Public config ----------------------------------------------------------

export interface VennSet {
  /** Unique id — referenced in `sets` field of VennIntersection. */
  id: string;
  /** Display name. */
  name?: string;
  /** Set size (drives circle area). */
  value: number;
  /** Override fill. */
  color?: string;
}

export interface VennIntersection {
  /** Array of set ids that form this intersection (length ≥ 2). */
  sets: string[];
  /** Size of the intersection (drives overlap area). */
  value: number;
  /** Display label for intersection region. */
  label?: string;
}

export interface VennConfig {
  sets: VennSet[];
  intersections?: VennIntersection[];
  /** Opacity of circle fills (default 0.25). */
  fillOpacity?: number;
  /** Show set labels (default true). */
  showLabels?: boolean;
  /** Show intersection labels (default true). */
  showIntersectionLabels?: boolean;
  /** Number of layout iterations (default 200). */
  iterations?: number;
}

// ---- Layout -----------------------------------------------------------------

interface Circle {
  id: string;
  name: string;
  r: number;
  x: number;
  y: number;
  color: string;
  value: number;
}

/** Area of circular intersection of two circles with radii r1, r2 and centre distance d. */
function circleIntersectionArea(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a = r1 * r1;
  const b = r2 * r2;
  const x = (a - b + d * d) / (2 * d);
  const z = x * x;
  const y = Math.sqrt(Math.max(0, a - z));
  return a * Math.acos(Math.max(-1, Math.min(1, x / r1))) +
         b * Math.acos(Math.max(-1, Math.min(1, (d - x) / r2))) -
         y * d;
}

function layoutCircles(
  sets: VennSet[],
  intersections: VennIntersection[],
  cx: number,
  cy: number,
  maxR: number,
  iterations: number,
): Circle[] {
  const totalArea = sets.reduce((s, v) => s + v.value, 0) || 1;
  const areaToR = (area: number) => Math.sqrt((area / totalArea) * maxR * maxR);

  const circles: Circle[] = sets.map((s, i) => ({
    id: s.id,
    name: s.name ?? s.id,
    r: areaToR(s.value),
    value: s.value,
    x: cx + (Math.cos((i / sets.length) * 2 * Math.PI) * maxR * 0.4),
    y: cy + (Math.sin((i / sets.length) * 2 * Math.PI) * maxR * 0.4),
    color: (s.color as string | undefined) ?? '',  // filled below
  }));

  if (sets.length <= 1) return circles;

  // Build index
  const byId = new Map<string, Circle>(circles.map(c => [c.id, c]));

  // Force-based optimisation
  const lr = 0.12;
  for (let iter = 0; iter < iterations; iter++) {
    for (const ix of intersections) {
      if (ix.sets.length !== 2) continue;
      const ca = byId.get(ix.sets[0]);
      const cb = byId.get(ix.sets[1]);
      if (!ca || !cb) continue;

      const dx = cb.x - ca.x;
      const dy = cb.y - ca.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const actual = circleIntersectionArea(ca.r, cb.r, dist);
      // Target: map intersection value to pixel area the same way set values map to circle areas
      const target = Math.PI * maxR * maxR * ix.value / totalArea;

      // Move circles closer/apart based on error
      const error = actual - target;
      const grad = error * lr * 0.001;
      const nx = dx / dist;
      const ny = dy / dist;
      ca.x += nx * grad;
      ca.y += ny * grad;
      cb.x -= nx * grad;
      cb.y -= ny * grad;
    }

    // Keep circles within bounds
    for (const c of circles) {
      const margin = c.r * 0.5;
      const dx = c.x - cx;
      const dy = c.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d + margin > maxR) {
        const pull = (d + margin - maxR) * 0.1;
        c.x -= (dx / d) * pull;
        c.y -= (dy / d) * pull;
      }
    }
  }

  return circles;
}

// ---- Main render ------------------------------------------------------------

export function renderVennDiagram(
  renderer: BaseRenderer,
  _allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const vCfg = (config as ChartConfig & { venn?: VennConfig })?.venn;
  if (!vCfg || !vCfg.sets.length) return;

  const { chartArea } = state;
  const cx = chartArea.x + chartArea.width / 2;
  const cy = chartArea.y + chartArea.height / 2;
  const maxR = Math.min(chartArea.width, chartArea.height) / 2 - 8;

  const fillOpacity  = vCfg.fillOpacity ?? 0.25;
  const showLabels   = vCfg.showLabels !== false;
  const showIxLabels = vCfg.showIntersectionLabels !== false;
  const iterations   = vCfg.iterations ?? 200;
  const intersections = vCfg.intersections ?? [];

  // Assign colors
  const colored = vCfg.sets.map((s, i) => ({
    ...s,
    color: (s.color as string | undefined) ?? getSeriesColor(theme, i),
  }));

  const circles = layoutCircles(colored, intersections, cx, cy, maxR, iterations);

  // Apply colors from colored sets
  for (let i = 0; i < circles.length; i++) {
    circles[i].color = colored[i].color;
  }

  renderer.beginGroup('venn-circles', 'uc-venn-circles');

  // Draw circles (semi-transparent fills)
  for (const c of circles) {
    renderer.drawCircle(c.x, c.y, c.r, {
      fill: c.color,
      fillOpacity,
      stroke: c.color,
      strokeWidth: 1.5,
    });
  }

  renderer.endGroup();

  // Draw set labels
  if (showLabels) {
    renderer.beginGroup('venn-labels', 'uc-venn-labels');
    for (const c of circles) {
      renderer.drawText(c.x, c.y - c.r * 0.3, c.name, {
        fontSize: 13,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: (theme.textColor as string) ?? '#333',
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
    renderer.endGroup();
  }

  // Draw intersection labels (placed at geometric midpoint)
  if (showIxLabels && intersections.length) {
    renderer.beginGroup('venn-ix-labels', 'uc-venn-ix-labels');
    const byId = new Map<string, Circle>(circles.map(c => [c.id, c]));
    for (const ix of intersections) {
      if (!ix.label) continue;
      const pts = ix.sets.map(id => byId.get(id)).filter(Boolean) as Circle[];
      if (!pts.length) continue;
      const lx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const ly = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      renderer.drawText(lx, ly, ix.label, {
        fontSize: 10,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: (theme.textColor as string) ?? '#555',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
    renderer.endGroup();
  }
}
