// ============================================================================
// RiskLab Charts — Timeline / Swimlane Chart
// Horizontal event swimlanes — each series is a lane, data points are events
// with a start and optional end value. Similar to Gantt but without dependencies.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const n = new Date(v as string);
  return isNaN(n.getTime()) ? Number(v) || 0 : n.getTime();
}

export function renderTimelineChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  config: ChartConfig,
  theme: ThemeConfig,
): void {
  const { chartArea: ca } = state;
  const xScale = state.scales.get('x0');
  if (!xScale) return;

  const visible = series.filter(s => s.visible !== false);
  if (visible.length === 0) return;

  const laneH = ca.height / visible.length;
  const eventH = Math.max(12, laneH * 0.5);
  const fontFamily = theme.fontFamily;
  const fontSize = Math.min(12, eventH * 0.65);

  renderer.defineClipRect('timeline-clip', ca.x, ca.y, ca.width, ca.height);
  renderer.beginGroup('timeline', 'uc-timeline');

  // Lane backgrounds (alternating)
  for (let li = 0; li < visible.length; li++) {
    const ly = ca.y + li * laneH;
    renderer.drawRect(ca.x, ly, ca.width, laneH, {
      fill: li % 2 === 0 ? 'rgba(0,0,0,0.018)' : 'transparent',
      stroke: 'none',
    });

    // Lane label in the left margin — placed just outside the chart area so it never
    // overlaps event bars.  The chart needs adequate left padding for this to be visible.
    const s = visible[li]!;
    const laneLabelX = ca.x - 6;
    renderer.drawText(laneLabelX, ly + laneH / 2, s.name ?? s.id, {
      fontSize: Math.min(11, laneH * 0.35),
      fontFamily,
      fill: (theme.textColor as string) ?? '#6b7280',
      textAnchor: 'end',
      dominantBaseline: 'middle',
    });

    // Draw axis separator
    renderer.drawLine(ca.x, ly + laneH, ca.x + ca.width, ly + laneH, {
      stroke: (theme.axis.gridColor as string) ?? '#e5e7eb',
      strokeWidth: 0.5,
    });
  }

  // Draw events
  for (let li = 0; li < visible.length; li++) {
    const s = visible[li]!;
    const color = (s.color as string) ?? theme.palette[li % theme.palette.length] ?? '#4f46e5';
    const laneMidY = ca.y + li * laneH + laneH / 2;
    const eventY = laneMidY - eventH / 2;

    for (let i = 0; i < s.data.length; i++) {
      const d = s.data[i]!;
      const isHovered = state.hoveredPoint?.seriesId === s.id && state.hoveredPoint.index === i;
      const isSelected = state.selectedPoints.some(p => p.seriesId === s.id && p.index === i);

      const startX = xScale.convert(d.start ?? d.x);
      const endRaw = d.end ?? d.x2 ?? d.y;
      const hasEnd = endRaw !== undefined;
      const endX = hasEnd ? xScale.convert(toNum(endRaw)) : startX;
      const eventW = Math.max(4, endX - startX);

      if (hasEnd && eventW > 4) {
        // Duration event: pill shape
        renderer.drawRect(startX, eventY, eventW, eventH, {
          fill: color,
          opacity: isHovered ? 1 : 0.82,
          stroke: isSelected ? '#fff' : `${color}80`,
          strokeWidth: isSelected ? 2 : 1,
        }, eventH / 2);

        // Label inside pill if wide enough
        const label = String(d.label ?? d.x ?? '');
        if (eventW > 30) {
          renderer.drawText(startX + eventW / 2, laneMidY, label, {
            fontSize,
            fontFamily,
            fill: '#fff',
            textAnchor: 'middle',
            dominantBaseline: 'middle',
          });
        }
      } else {
        // Point event: circle milestone
        const r = Math.max(4, eventH * 0.4);
        renderer.drawCircle(startX, laneMidY, isHovered ? r + 2 : r, {
          fill: color,
          stroke: isSelected ? '#fff' : 'none',
          strokeWidth: 2,
        });

        // Label above marker
        const label = String(d.label ?? d.x ?? '');
        if (label) {
          renderer.drawText(startX, eventY - 4, label, {
            fontSize: fontSize - 1,
            fontFamily,
            fill: (theme.textColor as string) ?? '#374151',
            textAnchor: 'middle',
          });
        }
      }
    }
  }

  renderer.endGroup();
}
