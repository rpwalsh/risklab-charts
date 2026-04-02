// ============================================================================
// RiskLab Charts — Gantt Chart
// Horizontal task bars with date ranges, milestones, dependencies, and swimlanes
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig, DataPoint } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';

export interface GanttDataPoint extends DataPoint {
  /** Task start date/value */
  start?: number | string | Date;
  /** Task end date/value */
  end?: number | string | Date;
  /** Progress 0–1 */
  progress?: number;
  /** Dependency task IDs */
  dependencies?: string[];
  /** Milestone (renders as diamond) */
  milestone?: boolean;
  /** Task category / swim-lane label */
  category?: string;
}

function toNum(v: number | string | Date | undefined | null): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? Number(v) || 0 : d.getTime();
}

export function renderGanttChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  config: ChartConfig,
  theme: ThemeConfig,
): void {
  const { chartArea: ca } = state;
  const xScale = state.scales.get('x0');

  // Gantt uses x0 for time axis, y0 for category/band axis
  // Collect all tasks across all series
  const tasks: Array<GanttDataPoint & { seriesColor: string; seriesId: string }> = [];

  for (const s of series) {
    if (s.visible === false) continue;
    const color = (s.color as string) ?? theme.palette[tasks.length % theme.palette.length] ?? '#4f46e5';
    for (const d of s.data as GanttDataPoint[]) {
      tasks.push({ ...d, seriesColor: color, seriesId: s.id });
    }
  }

  if (tasks.length === 0) return;

  // Decide row height
  const rowH = Math.max(16, Math.min(40, (ca.height / Math.max(tasks.length, 1)) - 4));
  const BAR_H = rowH * 0.55;
  const fontFamily = theme.fontFamily;
  const fontSize = Math.max(9, Math.min(12, BAR_H * 0.7));

  // Clip to chart area
  renderer.defineClipRect('gantt-clip', ca.x, ca.y, ca.width, ca.height);

  renderer.beginGroup('gantt', 'uc-gantt');

  // Draw vertical grid lines (date markers)
  if (xScale) {
    const ticks = xScale.ticks(8);
    for (const tick of ticks) {
      const px = xScale.convert(tick);
      renderer.drawLine(px, ca.y, px, ca.y + ca.height, {
        stroke: (theme.axis.gridColor as string) ?? '#f3f4f6',
        strokeWidth: 1,
      });
    }
  }

  // Draw task bars
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    const y = ca.y + i * (BAR_H + rowH * 0.45);

    const startVal = task.start ?? task.x;
    const endVal = task.end ?? task.x2 ?? task.y;

    const startNum = toNum(startVal as number | string | Date);
    const endNum = toNum(endVal as number | string | Date);

    const x1 = xScale ? xScale.convert(startNum) : ca.x;
    const x2 = xScale ? xScale.convert(endNum) : ca.x + ca.width;
    const barW = Math.max(4, x2 - x1);

    const color = task.seriesColor;

    // Is hovering?
    const isHovered = state.hoveredPoint?.seriesId === task.seriesId && state.hoveredPoint.index === i;
    const isSelected = state.selectedPoints.some(p => p.seriesId === task.seriesId && p.index === i);

    if (task.milestone) {
      // Render as diamond
      const mx = (x1 + x2) / 2;
      const my = y + BAR_H / 2;
      const half = BAR_H * 0.6;
      renderer.drawPath(
        `M${mx},${my - half} L${mx + half},${my} L${mx},${my + half} L${mx - half},${my} Z`,
        { fill: color, stroke: isSelected ? '#fff' : 'none', strokeWidth: 2 },
      );
    } else {
      // Track background
      renderer.drawRect(x1, y, barW, BAR_H, {
        fill: `${color}28`,
        stroke: 'none',
      }, 3);

      // Main bar — only when no progress overlay (avoids double-compositing on the tail)
      if (task.progress === undefined || task.progress < 0) {
        renderer.drawRect(x1, y, barW, BAR_H, {
          fill: color,
          opacity: isHovered ? 1 : 0.85,
          stroke: isSelected ? '#fff' : 'none',
          strokeWidth: isSelected ? 2 : 0,
        }, 3);
      }

      // Progress overlay
      if (task.progress !== undefined && task.progress >= 0) {
        const prog = Math.min(1, task.progress);
        renderer.drawRect(x1, y, barW * prog, BAR_H, {
          fill: `${color}`,
          opacity: 1,
          stroke: 'none',
        }, 3);
        // Dimmed tail
        renderer.drawRect(x1 + barW * prog, y, barW * (1 - prog), BAR_H, {
          fill: color,
          opacity: 0.35,
          stroke: 'none',
        }, 3);
      }

      // Task label
      const label = (task.label as string) ?? (task.category as string) ?? String(task.x ?? '');
      if (barW > 40) {
        renderer.drawText(x1 + 6, y + BAR_H / 2 + fontSize * 0.35, label, {
          fontSize,
          fontFamily,
          fill: '#fff',
          textAnchor: 'start',
          dominantBaseline: 'middle',
        });
      } else {
        // Draw label outside bar (clamp to chartArea right edge)
        const extLabelX = Math.min(x2 + 4, ca.x + ca.width - 4);
        renderer.drawText(extLabelX, y + BAR_H / 2 + fontSize * 0.35, label, {
          fontSize,
          fontFamily,
          fill: (theme.textColor as string) ?? '#374151',
          textAnchor: 'start',
          dominantBaseline: 'middle',
          clipPath: 'gantt-clip',
        });
      }
    }
  }

  // Draw dependency arrows
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    if (!task.dependencies?.length) continue;

    const startVal = task.start ?? task.x;
    const x1 = xScale ? xScale.convert(toNum(startVal as number | string | Date)) : ca.x;
    const y1 = ca.y + i * (BAR_H + (rowH * 0.45)) + BAR_H / 2;

    for (const depId of task.dependencies) {
      const depIdx = tasks.findIndex(t => String(t.id ?? t.x) === depId);
      if (depIdx < 0) continue;

      const dep = tasks[depIdx]!;
      const depEnd = dep.end ?? dep.x2 ?? dep.y;
      const x2 = xScale ? xScale.convert(toNum(depEnd as number | string | Date)) : ca.x;
      const y2 = ca.y + depIdx * (BAR_H + rowH * 0.45) + BAR_H / 2;

      // Draw arrow from dep end to task start
      renderer.drawPath(
        `M${x2},${y2} C${x2 + 16},${y2} ${x1 - 16},${y1} ${x1},${y1}`,
        { fill: 'none', stroke: 'rgba(107,114,128,0.5)', strokeWidth: 1 },
      );
      // Arrowhead
      renderer.drawPath(
        `M${x1},${y1} L${x1 - 6},${y1 - 4} L${x1 - 6},${y1 + 4} Z`,
        { fill: 'rgba(107,114,128,0.5)', stroke: 'none' },
      );
    }
  }

  renderer.endGroup();
}
