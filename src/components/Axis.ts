// ============================================================================
// RiskLab Charts — Axis Component
// Renders axes, grid lines, tick marks, labels, and titles
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { AxisConfig, ChartState, ThemeConfig, DataValue } from '../core/types';

/**
 * Render all configured axes into the chart area.
 */
export function renderAxes(
  renderer: BaseRenderer,
  axes: AxisConfig[],
  state: ChartState,
  theme: ThemeConfig,
): void {
  // If no axes defined, use default x/y
  const effectiveAxes =
    axes.length > 0
      ? axes
      : [
          { id: 'x0', type: 'linear' as const, position: 'bottom' as const },
          { id: 'y0', type: 'linear' as const, position: 'left' as const },
        ];

  for (const axis of effectiveAxes) {
    renderAxis(renderer, axis, state, theme);
  }
}

function renderAxis(
  renderer: BaseRenderer,
  axis: AxisConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  const scale = state.scales.get(axis.id);
  if (!scale) return;

  const { chartArea } = state;
  const isHorizontal = axis.position === 'bottom' || axis.position === 'top';
  const ticks = scale.ticks(axis.ticks?.count ?? (isHorizontal ? 8 : 6));

  renderer.beginGroup(`axis-${axis.id}`, 'uc-axis');

  // ---- Axis line ----
  if (axis.lineVisible !== false) {
    const lineColor = (axis.lineColor as string) ?? (theme.axis.lineColor as string);
    const lineWidth = axis.lineWidth ?? 1;

    if (axis.position === 'bottom') {
      renderer.drawLine(
        chartArea.x, chartArea.y + chartArea.height,
        chartArea.x + chartArea.width, chartArea.y + chartArea.height,
        { stroke: lineColor, strokeWidth: lineWidth },
      );
    } else if (axis.position === 'top') {
      renderer.drawLine(
        chartArea.x, chartArea.y,
        chartArea.x + chartArea.width, chartArea.y,
        { stroke: lineColor, strokeWidth: lineWidth },
      );
    } else if (axis.position === 'left') {
      renderer.drawLine(
        chartArea.x, chartArea.y,
        chartArea.x, chartArea.y + chartArea.height,
        { stroke: lineColor, strokeWidth: lineWidth },
      );
    } else if (axis.position === 'right') {
      renderer.drawLine(
        chartArea.x + chartArea.width, chartArea.y,
        chartArea.x + chartArea.width, chartArea.y + chartArea.height,
        { stroke: lineColor, strokeWidth: lineWidth },
      );
    }
  }

  // ---- Grid lines & ticks ----
  const gridEnabled = axis.gridLines?.enabled !== false;
  const tickEnabled = axis.ticks?.enabled !== false;
  const gridColor = (axis.gridLines?.color as string) ?? (theme.axis.gridColor as string);
  const gridWidth = axis.gridLines?.width ?? 1;
  const gridDash = axis.gridLines?.dashArray ?? [4, 4];
  const tickColor = (axis.ticks?.color as string) ?? (theme.axis.lineColor as string);
  const tickLength = axis.ticks?.length ?? 5;

  for (const tickVal of ticks) {
    const pos = scale.convert(tickVal);

    if (isHorizontal) {
      // Grid line (vertical)
      if (gridEnabled) {
        renderer.drawLine(pos, chartArea.y, pos, chartArea.y + chartArea.height, {
          stroke: gridColor,
          strokeWidth: gridWidth,
          dashArray: gridDash,
        });
      }
      // Tick mark
      if (tickEnabled) {
        const tickY = axis.position === 'bottom'
          ? chartArea.y + chartArea.height
          : chartArea.y;
        const dir = axis.position === 'bottom' ? 1 : -1;
        renderer.drawLine(pos, tickY, pos, tickY + tickLength * dir, {
          stroke: tickColor,
          strokeWidth: 1,
        });
      }
    } else {
      // Grid line (horizontal)
      if (gridEnabled) {
        renderer.drawLine(chartArea.x, pos, chartArea.x + chartArea.width, pos, {
          stroke: gridColor,
          strokeWidth: gridWidth,
          dashArray: gridDash,
        });
      }
      // Tick mark
      if (tickEnabled) {
        const tickX = axis.position === 'left' ? chartArea.x : chartArea.x + chartArea.width;
        const dir = axis.position === 'left' ? -1 : 1;
        renderer.drawLine(tickX, pos, tickX + tickLength * dir, pos, {
          stroke: tickColor,
          strokeWidth: 1,
        });
      }
    }
  }

  // ---- Labels ----
  if (axis.labels?.enabled !== false) {
    const labelColor = (axis.labels?.color as string) ?? (theme.axis.labelColor as string);
    const labelSize = axis.labels?.fontSize ?? theme.fontSize;
    const labelFont = axis.labels?.fontFamily ?? theme.fontFamily;
    const maxLabelLen = axis.labels?.maxLength ?? 0; // 0 = no truncation
    const userStep = axis.labels?.step ?? 1;

    // Format all labels first so we can measure for collision detection
    const allLabels: { tickVal: DataValue; pos: number; label: string }[] = [];
    for (let i = 0; i < ticks.length; i += userStep) {
      const tickVal = ticks[i]!;
      const pos = scale.convert(tickVal);
      let label = formatTickLabel(tickVal, axis, i, ticks);
      if (maxLabelLen > 0 && label.length > maxLabelLen) {
        label = label.slice(0, maxLabelLen - 1) + '…';
      }
      allLabels.push({ tickVal, pos, label });
    }

    // Estimate character width (approx 0.6 × font size for most fonts)
    const charWidth = labelSize * 0.6;

    // Determine rotation: use explicit config, or auto-detect overlap on horizontal axes
    let rotation = axis.labels?.rotation ?? 0;
    const useStagger = axis.labels?.stagger === true;

    if (isHorizontal && rotation === 0 && allLabels.length > 1) {
      // Check if labels would overlap at 0° rotation
      // Use the longest label (not average) for a more conservative check
      const maxLabelWidth = Math.max(...allLabels.map(l => l.label.length)) * charWidth;
      const avgLabelWidth = allLabels.reduce((s, l) => s + l.label.length, 0) / allLabels.length * charWidth;
      const availablePerTick = allLabels.length > 1
        ? Math.abs(allLabels[allLabels.length - 1]!.pos - allLabels[0]!.pos) / (allLabels.length - 1)
        : chartArea.width;

      // Trigger rotation if either the average label or the longest label exceeds threshold
      if (avgLabelWidth > availablePerTick * 0.85 || maxLabelWidth > availablePerTick * 1.1) {
        // Labels would collide — auto-rotate -45° unless stagger is preferred
        if (!useStagger) {
          rotation = -45;
        }
      }
    }

    // Auto-skip: if even after rotation labels still collide, skip every Nth
    let effectiveStep = 1;
    if (isHorizontal && allLabels.length > 1) {
      const effectiveLabelWidth = rotation !== 0
        ? labelSize * 1.4 // rotated labels need more breathing room
        : Math.max(...allLabels.map(l => l.label.length)) * charWidth;
      const spacing = allLabels.length > 1
        ? Math.abs(allLabels[allLabels.length - 1]!.pos - allLabels[0]!.pos) / (allLabels.length - 1)
        : chartArea.width;

      if (effectiveLabelWidth > spacing * 0.9) {
        effectiveStep = Math.ceil(effectiveLabelWidth / Math.max(spacing, 1));
      }
    }

    for (let i = 0; i < allLabels.length; i += effectiveStep) {
      const { pos, label } = allLabels[i]!;

      if (isHorizontal) {
        // Base Y position: tick(5) + gap(3) + half label height
        const tickLen = axis.ticks?.length ?? 5;
        const baseY = axis.position === 'bottom'
          ? chartArea.y + chartArea.height + tickLen + 3 + labelSize * 0.5
          : chartArea.y - tickLen - 3 - labelSize * 0.5;

        // Stagger: alternate labels get pushed further from the axis
        const staggerOffset = (useStagger && i % 2 === 1) ? 16 : 0;
        const y = baseY + (axis.position === 'bottom' ? staggerOffset : -staggerOffset);

        if (rotation !== 0) {
          // Rotated labels: adjust anchor and apply transform
          renderer.drawText(pos, y, label, {
            fill: labelColor,
            fontSize: labelSize,
            fontFamily: labelFont,
            textAnchor: rotation < 0 ? 'end' : 'start',
            dominantBaseline: 'middle',
            transform: `rotate(${rotation}, ${pos}, ${y})`,
          });
        } else {
          renderer.drawText(pos, y, label, {
            fill: labelColor,
            fontSize: labelSize,
            fontFamily: labelFont,
            textAnchor: 'middle',
            dominantBaseline: 'middle',
          });
        }
      } else {
        // Vertical axis labels
        const tickLen = axis.ticks?.length ?? 5;
        const x = axis.position === 'left'
          ? chartArea.x - tickLen - 6
          : chartArea.x + chartArea.width + tickLen + 6;
        renderer.drawText(x, pos, label, {
          fill: labelColor,
          fontSize: labelSize,
          fontFamily: labelFont,
          textAnchor: axis.position === 'left' ? 'end' : 'start',
          dominantBaseline: 'middle',
        });
      }
    }
  }

  // ---- Title ----
  if (axis.title?.text) {
    const titleColor = (axis.title.color as string) ?? (theme.axis.titleColor as string);
    const titleSize = axis.title.fontSize ?? 13;
    const titleFont = axis.title.fontFamily ?? theme.fontFamily;
    const labelSize = axis.labels?.fontSize ?? theme.fontSize;

    // Dynamically compute title offset based on actual label space consumed
    const labelRotation = axis.labels?.rotation ?? 0;
    const hasLabels = axis.labels?.enabled !== false;

    if (isHorizontal) {
      // Bottom/top: title goes below/above the labels
      let labelZone = hasLabels ? labelSize + 24 : 8; // tick(5) + gap(7) + label height + clearance
      if (labelRotation !== 0 && hasLabels) {
        // Rotated labels extend further — estimate effective height
        const avgLabelLen = ticks.length > 0 ? 5 : 3; // chars
        const rotRad = Math.abs(labelRotation) * Math.PI / 180;
        labelZone = 8 + Math.sin(rotRad) * avgLabelLen * (labelSize * 0.6) + labelSize * 0.5;
        labelZone = Math.max(labelZone, labelSize + 24);
      }
      const titleY = axis.position === 'bottom'
        ? chartArea.y + chartArea.height + labelZone + titleSize * 0.8
        : chartArea.y - labelZone - titleSize * 0.3;

      renderer.drawText(
        chartArea.x + chartArea.width / 2,
        titleY,
        axis.title.text,
        {
          fill: titleColor,
          fontSize: titleSize,
          fontFamily: titleFont,
          fontWeight: '600',
          textAnchor: 'middle',
        },
      );
    } else {
      // Left/right: title goes to the left/right of labels, rotated -90°
      const labelZone = hasLabels ? labelSize * 3.5 + 16 : 8;
      const x = axis.position === 'left'
        ? chartArea.x - labelZone - titleSize * 0.3
        : chartArea.x + chartArea.width + labelZone + titleSize * 0.3;
      renderer.drawText(x, chartArea.y + chartArea.height / 2, axis.title.text, {
        fill: titleColor,
        fontSize: titleSize,
        fontFamily: titleFont,
        fontWeight: '600',
        textAnchor: 'middle',
        transform: `rotate(-90, ${x}, ${chartArea.y + chartArea.height / 2})`,
      });
    }
  }

  // ---- Plot bands ----
  if (axis.plotBands) {
    for (const band of axis.plotBands) {
      const from = scale.convert(band.from);
      const to = scale.convert(band.to);
      if (isHorizontal) {
        renderer.drawRect(
          Math.min(from, to), chartArea.y,
          Math.abs(to - from), chartArea.height,
          { fill: band.color as string, opacity: 0.15 },
        );
      } else {
        renderer.drawRect(
          chartArea.x, Math.min(from, to),
          chartArea.width, Math.abs(to - from),
          { fill: band.color as string, opacity: 0.15 },
        );
      }
    }
  }

  // ---- Plot lines ----
  if (axis.plotLines) {
    for (const line of axis.plotLines) {
      const pos = scale.convert(line.value);
      const color = (line.color as string) ?? '#EF4444';
      if (isHorizontal) {
        renderer.drawLine(pos, chartArea.y, pos, chartArea.y + chartArea.height, {
          stroke: color,
          strokeWidth: line.width ?? 2,
          dashArray: line.dashArray,
        });
      } else {
        renderer.drawLine(chartArea.x, pos, chartArea.x + chartArea.width, pos, {
          stroke: color,
          strokeWidth: line.width ?? 2,
          dashArray: line.dashArray,
        });
      }
      if (line.label) {
        const lx = isHorizontal ? pos + 4 : chartArea.x + 4;
        const ly = isHorizontal ? chartArea.y + 12 : pos - 4;
        renderer.drawText(lx, ly, line.label, {
          fill: color,
          fontSize: 10,
          fontFamily: theme.fontFamily,
        });
      }
    }
  }

  renderer.endGroup();
}

/** Short month names for compact date labels */
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Adaptive date formatting:  pick the shortest unambiguous format based on
 * context (the list of all tick dates) so labels stay compact.
 *
 *   > 2 years span   → "Jan '23"
 *   30 d – 2 years   → "Mar 7"
 *   1 d – 30 d       → "Mar 7"
 *   < 1 day          → "14:30"
 */
function formatDate(d: Date, allTicks: DataValue[]): string {
  // Determine span from first/last tick so format is uniform for the axis
  let span = Infinity;
  if (allTicks.length >= 2) {
    const first = allTicks[0];
    const last = allTicks[allTicks.length - 1];
    const t0 = first instanceof Date ? first.getTime() : Number(first);
    const t1 = last instanceof Date ? last.getTime() : Number(last);
    span = Math.abs(t1 - t0);
  }
  const DAY = 86_400_000;

  if (span < DAY) {
    // Sub-day: show hours:minutes
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (span <= 30 * DAY) {
    // Up to ~1 month: "Mar 7"
    return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  if (span <= 730 * DAY) {
    // Up to ~2 years: "Mar 7"  (day + month keeps it unambiguous)
    return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  // > 2 years: "Jan '23"
  return `${SHORT_MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function formatTickLabel(value: DataValue, axis: AxisConfig, index: number, allTicks?: DataValue[]): string {
  if (axis.labels?.format) {
    if (typeof axis.labels.format === 'function') {
      return axis.labels.format(value, index);
    }
    // Simple format string — handle common patterns
    return String(value);
  }

  if (value instanceof Date) {
    return formatDate(value, allTicks ?? []);
  }

  if (typeof value === 'number') {
    // Smart formatting: abbreviate large numbers, but preserve year-like
    // values (1900-2099) as plain integers so "2024" doesn't become "2.0k".
    const isYear = Number.isInteger(value) && value >= 1900 && value <= 2099;
    if (isYear) return String(value);
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1);
  }

  return String(value ?? '');
}

export { renderAxis, formatTickLabel };
