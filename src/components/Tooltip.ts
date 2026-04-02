// ============================================================================
// RiskLab Charts — Tooltip Component
// Shared, pinnable, custom-formatted tooltips
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { TooltipConfig, ChartState, ThemeConfig, DataPoint, SeriesConfig } from '../core/types';

export interface TooltipData {
  x: number;
  y: number;
  series: SeriesConfig;
  point: DataPoint;
  index: number;
}

/**
 * Render a tooltip at the specified position.
 * (In a full implementation this would use a separate DOM overlay for HTML tooltips.)
 */
export function renderTooltip(
  renderer: BaseRenderer,
  tooltipData: TooltipData[],
  _config: TooltipConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  if (tooltipData.length === 0) return;

  const first = tooltipData[0]!;

  renderer.beginGroup('tooltip', 'uc-tooltip');

  // Background
  const bgColor = (theme.tooltip.backgroundColor as string) ?? '#fff';
  const borderColor = (theme.tooltip.borderColor as string) ?? '#e5e7eb';
  const lineHeight = 20;
  const height = 28 + tooltipData.length * lineHeight;
  const width = 180;
  const TIP_OFFSET = 12;

  // Position tooltip so it stays within chart bounds
  let px = first.x + TIP_OFFSET;
  let py = first.y - height - TIP_OFFSET;
  if (px + width > state.width) px = first.x - width - TIP_OFFSET;
  if (px < 0) px = TIP_OFFSET;
  if (py < 0) py = first.y + TIP_OFFSET;
  if (py + height > state.height) py = Math.max(TIP_OFFSET, state.height - height - TIP_OFFSET);

  // Shadow
  renderer.drawRect(px + 2, py + 2, width, height, {
    fill: 'rgba(0,0,0,0.06)',
  }, 6);

  renderer.drawRect(px, py, width, height, {
    fill: bgColor,
    stroke: borderColor,
    strokeWidth: 1,
  }, 6);

  // Header (x value)
  renderer.drawText(px + 10, py + 16, String(first.point.x ?? ''), {
    fill: theme.tooltip.textColor as string,
    fontSize: 11,
    fontFamily: theme.fontFamily,
    fontWeight: '600',
  });

  // Points
  let itemY = py + 36;
  for (const td of tooltipData) {
    // Color dot
    renderer.drawCircle(px + 14, itemY, 4, {
      fill: (td.series.color as string) ?? '#4F46E5',
    });

    // Series name
    renderer.drawText(px + 24, itemY, td.series.name, {
      fill: theme.tooltip.textColor as string,
      fontSize: 11,
      fontFamily: theme.fontFamily,
      dominantBaseline: 'middle',
    });

    // Value
    renderer.drawText(px + width - 12, itemY, String(td.point.y ?? ''), {
      fill: theme.tooltip.textColor as string,
      fontSize: 11,
      fontFamily: theme.fontFamily,
      fontWeight: '600',
      textAnchor: 'end',
      dominantBaseline: 'middle',
    });

    itemY += lineHeight;
  }

  renderer.endGroup();
}

/**
 * Create an HTML tooltip element (for DOM overlay mode).
 */
export function createTooltipHTML(
  tooltipData: TooltipData[],
  config: TooltipConfig,
  theme: ThemeConfig,
): string {
  if (tooltipData.length === 0) return '';

  if (config.formatter) {
    const context = {
      points: tooltipData.map((td) => ({
        series: td.series,
        point: td.point,
        index: td.index,
        color: (td.series.color as string) ?? '#4F46E5',
        formattedX: formatValue(td.point.x),
        formattedY: formatValue(td.point.y),
      })),
      x: tooltipData[0]?.point.x,
      chart: null,
    };
    return config.formatter(context);
  }

  const bg = (config.backgroundColor as string) ?? (theme.tooltip.backgroundColor as string) ?? '#fff';
  const border = (config.borderColor as string) ?? (theme.tooltip.borderColor as string) ?? '#e5e7eb';
  const textColor = (config.style?.color as string) ?? (theme.tooltip.textColor as string) ?? '#1f2937';
  const fontFamily = config.style?.fontFamily ?? theme.fontFamily;
  const fontSize = config.style?.fontSize ?? 12;
  const radius = config.borderRadius ?? 6;
  const borderWidth = config.borderWidth ?? 1;

  // Sort items
  const items = [...tooltipData];
  if (config.sortItems === 'ascending') items.sort((a, b) => Number(a.point.y ?? 0) - Number(b.point.y ?? 0));
  else if (config.sortItems === 'descending') items.sort((a, b) => Number(b.point.y ?? 0) - Number(a.point.y ?? 0));

  const first = items[0]!;
  const isOHLC = first.point.open !== undefined || first.point.high !== undefined;

  // Header
  const xFormatted = applyFormat(config.headerFormat, {
    'point.key': escapeHtml(formatValue(first.point.x)),
    'point.x': escapeHtml(formatValue(first.point.x)),
  }) ?? `<span style="font-weight:600">${escapeHtml(formatValue(first.point.x))}</span>`;

  let rows = '';
  for (const td of items) {
    const color = (td.series.color as string) ?? '#4F46E5';
    const yFmt = formatValue(td.point.y);

    if (isOHLC) {
      // OHLC detail table
      rows += `<tr>
        <td colspan="3" style="padding:3px 0 1px;font-weight:600;color:${textColor}">${escapeHtml(td.series.name)}</td>
      </tr>
      <tr style="font-size:${fontSize - 1}px">
        <td style="color:#9ca3af;padding-right:6px">O</td><td style="font-weight:500">${escapeHtml(formatValue(td.point.open))}</td>
        <td style="color:#9ca3af;padding:0 6px">H</td><td style="font-weight:500">${escapeHtml(formatValue(td.point.high))}</td>
      </tr>
      <tr style="font-size:${fontSize - 1}px">
        <td style="color:#9ca3af;padding-right:6px">L</td><td style="font-weight:500">${escapeHtml(formatValue(td.point.low))}</td>
        <td style="color:#9ca3af;padding:0 6px">C</td><td style="font-weight:500;color:${Number(td.point.close ?? 0) >= Number(td.point.open ?? 0) ? '#22c55e' : '#ef4444'}">${escapeHtml(formatValue(td.point.close))}</td>
      </tr>`;
    } else {
      const pointRow = applyFormat(config.pointFormat, {
        'series.name': escapeHtml(td.series.name),
        'series.color': color,
        'point.y': escapeHtml(yFmt),
        'point.x': escapeHtml(formatValue(td.point.x)),
      });

      if (pointRow) {
        rows += `<tr><td colspan="3">${pointRow}</td></tr>`;
      } else {
        rows += `<tr style="line-height:1.6">
          <td style="padding-right:8px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};vertical-align:middle"></span>
          </td>
          <td style="color:${textColor};padding-right:16px;white-space:nowrap">${escapeHtml(td.series.name)}</td>
          <td style="color:${textColor};font-weight:600;text-align:right;white-space:nowrap">${escapeHtml(yFmt)}</td>
        </tr>`;
      }
    }
  }

  // Footer
  const footer = config.footerFormat
    ? `<tr><td colspan="3" style="padding-top:4px;color:#9ca3af;font-size:${fontSize - 1}px">${escapeHtml(config.footerFormat)}</td></tr>`
    : '';

  return `<div style="
    background:${bg};
    border:${borderWidth}px solid ${border};
    border-radius:${radius}px;
    padding:10px 14px;
    font-family:${fontFamily};
    font-size:${fontSize}px;
    color:${textColor};
    box-shadow:0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
    backdrop-filter:blur(4px);
    min-width:140px;
    max-width:320px;
    line-height:1.5;
  ">
    <div style="margin-bottom:5px;border-bottom:1px solid ${border};padding-bottom:4px">${xFormatted}</div>
    <table style="border-collapse:collapse;width:100%">
      <tbody>
        ${rows}
        ${footer}
      </tbody>
    </table>
  </div>`;
}

/** Escape a string for safe interpolation into HTML content or attribute values. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a raw value for display — numbers get locale formatting */
function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    if (!isFinite(v)) return String(v);
    // Show up to 4 significant digits, strip trailing zeros
    const abs = Math.abs(v);
    if (abs >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (abs >= 100) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(v);
}

/** Apply a format template like "{series.name}: {point.y}" */
function applyFormat(template: string | undefined, vars: Record<string, string>): string | undefined {
  if (!template) return undefined;
  return template.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? '');
}

