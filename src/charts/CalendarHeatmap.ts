// ============================================================================
// RiskLab Charts — Calendar Heatmap Chart
// GitHub-style contribution graph with weekly columns × daily rows
// Supports multi-year, custom color scales, month/weekday labels,
// week-start configuration, and legend rendering.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { interpolateColor } from '../utils/color';

// ---------------------------------------------------------------------------
// Public Config
// ---------------------------------------------------------------------------

export interface CalendarHeatmapConfig {
  /** Color for zero / empty cells (default: '#ebedf0') */
  emptyColor?: string;
  /** Lowest color in scale (default: '#9be9a8') */
  colorLow?: string;
  /** Highest color in scale (default: '#196127') */
  colorHigh?: string;
  /** Custom color thresholds — overrides colorLow/colorHigh if provided */
  colorStops?: Array<{ at: number; color: string }>;
  /** Cell size in px (default: 11) */
  cellSize?: number;
  /** Gap between cells in px (default: 2) */
  gap?: number;
  /** Border radius for cells (default: 2) */
  borderRadius?: number;
  /** Show month labels above the chart (default: true) */
  showMonthLabels?: boolean;
  /** Show weekday labels on the left (default: true) */
  showWeekdayLabels?: boolean;
  /** Which day starts the week: 0=Sun, 1=Mon (default: 0) */
  weekStart?: 0 | 1;
  /** Highlight today's cell with a distinct border */
  highlightToday?: boolean;
  /** Force a specific year range [startYear, endYear] — auto-detected from data otherwise */
  yearRange?: [number, number];
  /** Show year labels when multiple years are rendered (default: true) */
  showYearLabels?: boolean;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Returns YYYY-MM-DD string for a Date */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse DataPoint.x into a Date (supports Date, number timestamp, or 'YYYY-MM-DD' string) */
function parseDate(x: unknown): Date | null {
  if (x instanceof Date) return x;
  if (typeof x === 'number') return new Date(x);
  if (typeof x === 'string') {
    const d = new Date(x);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Given a value [0–1] and optional stops, returns an interpolated color */
function colorFromStops(t: number, stops: Array<{ at: number; color: string }>): string {
  if (stops.length === 0) return '#ebedf0';
  if (stops.length === 1) return stops[0]!.color;
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  if (t <= sorted[0]!.at) return sorted[0]!.color;
  if (t >= sorted[sorted.length - 1]!.at) return sorted[sorted.length - 1]!.color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]!;
    const hi = sorted[i + 1]!;
    if (t >= lo.at && t <= hi.at) {
      const local = (t - lo.at) / (hi.at - lo.at);
      return interpolateColor(lo.color, hi.color, local);
    }
  }
  return sorted[sorted.length - 1]!.color;
}

/** Returns the week column index within the year [0..52] for a given date */
function weekOfYear(date: Date, weekStart: 0 | 1): number {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const jan1DayOfWeek = (jan1.getDay() - weekStart + 7) % 7;
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  return Math.floor((dayOfYear + jan1DayOfWeek) / 7);
}

/** Returns the row index [0..6] for a date within a week */
function dayOfWeekRow(date: Date, weekStart: 0 | 1): number {
  return (date.getDay() - weekStart + 7) % 7;
}

// ---------------------------------------------------------------------------
// Main Renderer
// ---------------------------------------------------------------------------

export function renderCalendarHeatmap(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config: ChartConfig,
): void {
  const calConfig: CalendarHeatmapConfig = 
    config.calendarHeatmap ?? {};

  const gap               = calConfig.gap           ?? 2;
  const borderRadius      = calConfig.borderRadius  ?? 2;
  const weekStart         = calConfig.weekStart     ?? 0;
  const emptyColor        = calConfig.emptyColor    ?? '#ebedf0';
  const colorLow          = calConfig.colorLow      ?? '#9be9a8';
  const colorHigh         = calConfig.colorHigh     ?? '#196127';
  const showMonthLabels   = calConfig.showMonthLabels   !== false;
  const showWeekdayLabels = calConfig.showWeekdayLabels !== false;
  const highlightToday    = calConfig.highlightToday    ?? true;
  const showYearLabels    = calConfig.showYearLabels    !== false;

  const textColor  = String(theme.textColor      ?? '#333');
  const mutedColor = String(theme.axis.lineColor ?? '#aaa');
  const todayKey   = toDateKey(new Date());

  // ── 1. Collect all data points across series ──────────────────────────────
  const allPoints: Array<{ date: Date; value: number }> = [];
  for (const series of allSeries) {
    const pts = (series.processedData ?? series.data) as ProcessedDataPoint[];
    for (const pt of pts) {
      const date = parseDate(pt.x ?? pt.xNum);
      if (!date) continue;
      const value = (typeof pt.y === 'number' ? pt.y : pt.yNum) ?? 0;
      allPoints.push({ date, value });
    }
  }

  if (allPoints.length === 0) return;

  // ── 2. Build date → value map & determine year range ─────────────────────
  const dateMap = new Map<string, number>();
  let minYear = Infinity, maxYear = -Infinity;

  for (const { date, value } of allPoints) {
    const key = toDateKey(date);
    dateMap.set(key, (dateMap.get(key) ?? 0) + value);
    const yr = date.getFullYear();
    if (yr < minYear) minYear = yr;
    if (yr > maxYear) maxYear = yr;
  }

  if (calConfig.yearRange) {
    minYear = calConfig.yearRange[0];
    maxYear = calConfig.yearRange[1];
  }

  // ── 3. Determine global value range ──────────────────────────────────────
  const allValues = [...dateMap.values()];
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(0, Math.min(...allValues));
  const valRange = maxVal - minVal || 1;

  // ── 4. Layout constants ───────────────────────────────────────────────────
  const yearLabelHeight   = showYearLabels && maxYear > minYear ? 16 : 0;
  const monthLabelHeight  = showMonthLabels ? 14 : 0;
  const weekdayLabelWidth = showWeekdayLabels ? 28 : 0;

  const { chartArea } = state;

  // Auto-fit cell size to fill available width (53 week columns, 7 day rows)
  const yearsCount = maxYear - minYear + 1;
  const availW = chartArea.width - weekdayLabelWidth;
  const availH = chartArea.height - yearsCount * (yearLabelHeight + monthLabelHeight + 8) - 24; // legend space
  const autoCell = Math.min(
    Math.floor(availW / 53) - gap,
    Math.floor((availH / yearsCount) / 7) - gap,
  );
  const cellSize = calConfig.cellSize ?? Math.max(4, Math.min(autoCell, 16));
  const step              = cellSize + gap;

  let cursorY = chartArea.y;

  // ── 5. Render each year ───────────────────────────────────────────────────
  for (let year = minYear; year <= maxYear; year++) {

    // Year label
    if (showYearLabels && maxYear > minYear) {
      renderer.drawText(
        chartArea.x + weekdayLabelWidth,
        cursorY + 10,
        String(year),
        { fontSize: 12, fontWeight: 'bold', fill: textColor, textAnchor: 'start' },
      );
      cursorY += yearLabelHeight + 2;
    }

    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const totalWeeks = weekOfYear(dec31, weekStart) + 1;

    // Month label row ─────────────────────────────────────────────────────
    if (showMonthLabels) {
      let lastLabelMonth = -1;
      const jan1DayOfWeek = (jan1.getDay() - weekStart + 7) % 7;
      for (let w = 0; w < totalWeeks; w++) {
        const dayIndex = w * 7 - jan1DayOfWeek;
        const weekDate = new Date(year, 0, 1 + Math.max(0, dayIndex));
        if (weekDate.getFullYear() !== year) continue;
        const mo = weekDate.getMonth();
        if (mo !== lastLabelMonth) {
          lastLabelMonth = mo;
          const lx = chartArea.x + weekdayLabelWidth + w * step;
          renderer.drawText(
            lx + 2,
            cursorY + 10,
            MONTH_SHORT[mo]!,
            { fontSize: 10, fill: mutedColor, textAnchor: 'start' },
          );
        }
      }
      cursorY += monthLabelHeight;
    }

    // Weekday labels (Mon/Wed/Fri) — row indices depend on which day the week starts
    if (showWeekdayLabels) {
      // When weekStart=0 (Sun): Sun=0,Mon=1,Wed=3,Fri=5
      // When weekStart=1 (Mon): Mon=0,Wed=2,Fri=4
      const labelRows: Array<[number, string]> = weekStart === 1
        ? [[0, 'Mon'], [2, 'Wed'], [4, 'Fri']]
        : [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']];
      for (const [row, label] of labelRows) {
        renderer.drawText(
          chartArea.x + weekdayLabelWidth - 4,
          cursorY + row * step + cellSize - 1,
          label,
          { fontSize: 9, fill: mutedColor, textAnchor: 'end' },
        );
      }
    }

    // Day cells ───────────────────────────────────────────────────────────
    for (
      let dayMs = jan1.getTime();
      dayMs <= dec31.getTime();
      dayMs += 86400000
    ) {
      const date = new Date(dayMs);
      if (date.getFullYear() !== year) break;

      const key  = toDateKey(date);
      const val  = dateMap.get(key) ?? null;
      const wk   = weekOfYear(date, weekStart);
      const drow = dayOfWeekRow(date, weekStart);

      const cx = chartArea.x + weekdayLabelWidth + wk * step;
      const cy = cursorY + drow * step;

      // Skip cells outside the visible area (with a little padding)
      if (cx + cellSize > chartArea.x + chartArea.width + 24) continue;
      if (cy + cellSize > chartArea.y + chartArea.height + 24) continue;

      // Fill color
      let fillColor: string;
      if (val === null || val === 0) {
        fillColor = emptyColor;
      } else if (calConfig.colorStops && calConfig.colorStops.length > 0) {
        const t = Math.max(0, Math.min(1, (val - minVal) / valRange));
        fillColor = colorFromStops(t, calConfig.colorStops);
      } else {
        const t = Math.max(0, Math.min(1, (val - minVal) / valRange));
        fillColor = interpolateColor(colorLow, colorHigh, t);
      }

      const isToday     = key === todayKey;
      const borderColor = isToday && highlightToday ? '#0366d6' : 'none';
      const borderWidth = isToday && highlightToday ? 1.5 : 0;

      // drawRect(x, y, w, h, style?, rx?, ry?)
      renderer.drawRect(
        cx, cy, cellSize, cellSize,
        { fill: fillColor, stroke: borderColor, strokeWidth: borderWidth },
        borderRadius,
      );
    }

    cursorY += 7 * step + 8; // 7 rows + vertical gap between years
  }

  // ── 6. Color scale legend ─────────────────────────────────────────────────
  const legendY = cursorY + 4;
  const legendX = chartArea.x + weekdayLabelWidth;
  const boxSize = 10;
  const steps   = 5;

  renderer.drawText(legendX, legendY + boxSize, 'Less', { fontSize: 9, fill: mutedColor, textAnchor: 'start' });

  for (let i = 0; i < steps; i++) {
    const t      = i / (steps - 1);
    const lColor = calConfig.colorStops
      ? colorFromStops(t, calConfig.colorStops)
      : t === 0 ? emptyColor : interpolateColor(colorLow, colorHigh, t);
    renderer.drawRect(
      legendX + 30 + i * (boxSize + 2),
      legendY,
      boxSize, boxSize,
      { fill: lColor },
      2,
    );
  }

  renderer.drawText(
    legendX + 30 + steps * (boxSize + 2) + 4,
    legendY + boxSize,
    'More',
    { fontSize: 9, fill: mutedColor, textAnchor: 'start' },
  );
}
