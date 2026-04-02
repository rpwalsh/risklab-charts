// ============================================================================
// RiskLab Charts — Gauge Chart Renderer
// Renders a semi-circular gauge with colored bands and a needle
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';

/**
 * Renders a semi-circular gauge with colored bands, a value arc, and a needle indicator.
 *
 * Draws a background arc, optional colored threshold bands, a filled value arc,
 * a triangular needle, and min/max/value labels. Gauge range, angles, and bands
 * are driven by the chart configuration.
 *
 * @param renderer - The active SVG or Canvas renderer
 * @param series - Pre-processed series data from the DataPipeline
 * @param state - Current chart state (scales, chartArea, etc.)
 * @param theme - Active theme for styling
 * @param config - Full chart configuration including gauge-specific options
 */
export function renderGaugeSeries(
  renderer: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  config: ChartConfig,
): void {
  const data = series.processedData ?? (series.data as ProcessedDataPoint[]);
  if (data.length === 0) return;

  const { chartArea } = state;
  const gauge = config.gauge ?? {};
  const minVal = gauge.min ?? 0;
  const maxVal = gauge.max ?? 100;
  const startAngle = gauge.startAngle ?? -135;
  const endAngle = gauge.endAngle ?? 135;
  const value = data[0]!.yNum ?? 0;

  const cx = chartArea.x + chartArea.width / 2;
  const cy = chartArea.y + chartArea.height * 0.65;
  const outerR = Math.min(chartArea.width / 2, chartArea.height * 0.55);
  const innerR = outerR * 0.75;

  // Background arc
  renderer.drawArc(cx, cy, innerR, outerR, startAngle, endAngle, {
    fill: theme.axis.gridColor as string,
  });

  // Colored bands
  if (gauge.bands) {
    for (const band of gauge.bands) {
      const bandStart = startAngle + ((band.from - minVal) / (maxVal - minVal)) * (endAngle - startAngle);
      const bandEnd = startAngle + ((band.to - minVal) / (maxVal - minVal)) * (endAngle - startAngle);
      renderer.drawArc(cx, cy, innerR, outerR, bandStart, bandEnd, {
        fill: band.color as string,
      });
    }
  }

  // Value arc (filled portion)
  const clampedValue = Math.max(minVal, Math.min(maxVal, value));
  const valueAngle = startAngle +
    ((clampedValue - minVal) / (maxVal - minVal)) * (endAngle - startAngle);
  renderer.drawArc(cx, cy, innerR + 2, outerR - 2, startAngle, valueAngle, {
    fill: getValueColor(clampedValue, minVal, maxVal, gauge.bands),
    opacity: 0.9,
  });

  // Needle
  const needleAngle = ((valueAngle - 90) * Math.PI) / 180;
  const needleLength = outerR * 0.9;
  const nx = cx + needleLength * Math.cos(needleAngle);
  const ny = cy + needleLength * Math.sin(needleAngle);

  // Needle triangle
  const baseAngle1 = needleAngle + Math.PI / 2;
  const baseAngle2 = needleAngle - Math.PI / 2;
  const baseWidth = 4;
  renderer.drawPolygon(
    [
      [nx, ny],
      [cx + baseWidth * Math.cos(baseAngle1), cy + baseWidth * Math.sin(baseAngle1)],
      [cx + baseWidth * Math.cos(baseAngle2), cy + baseWidth * Math.sin(baseAngle2)],
    ],
    { fill: theme.textColor as string },
  );

  // Center dot
  renderer.drawCircle(cx, cy, 6, {
    fill: theme.textColor as string,
  });

  // Value text
  if (gauge.showValue !== false) {
    const formatFn = typeof gauge.valueFormat === 'function'
      ? gauge.valueFormat
      : (v: number) => String(Math.round(v));
    const formatted = formatFn(value);

    renderer.drawText(cx, cy + outerR * 0.25, formatted, {
      fill: theme.textColor as string,
      fontSize: 28,
      fontFamily: theme.fontFamily,
      fontWeight: 'bold',
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
  }

  // Min/Max labels
  const minAngle = ((startAngle - 90) * Math.PI) / 180;
  const maxAngle = ((endAngle - 90) * Math.PI) / 180;
  const labelR = outerR + 14;

  const minLX = Math.max(chartArea.x + 4, Math.min(chartArea.x + chartArea.width - 4, cx + labelR * Math.cos(minAngle)));
  const minLY = Math.max(chartArea.y + 8, Math.min(chartArea.y + chartArea.height - 4, cy + labelR * Math.sin(minAngle)));
  renderer.drawText(minLX, minLY, String(minVal), {
    fill: theme.axis.labelColor as string,
    fontSize: 10,
    fontFamily: theme.fontFamily,
    textAnchor: 'middle',
  });
  const maxLX = Math.max(chartArea.x + 4, Math.min(chartArea.x + chartArea.width - 4, cx + labelR * Math.cos(maxAngle)));
  const maxLY = Math.max(chartArea.y + 8, Math.min(chartArea.y + chartArea.height - 4, cy + labelR * Math.sin(maxAngle)));
  renderer.drawText(maxLX, maxLY, String(maxVal), {
    fill: theme.axis.labelColor as string,
    fontSize: 10,
    fontFamily: theme.fontFamily,
    textAnchor: 'middle',
  });
}

function getValueColor(
  value: number,
  min: number,
  max: number,
  bands?: Array<{ from: number; to: number; color: unknown }>,
): string {
  if (bands) {
    for (const band of bands) {
      if (value >= band.from && value <= band.to) {
        return band.color as string;
      }
    }
  }
  // Default gradient green→yellow→red
  const t = (value - min) / (max - min || 1);
  if (t < 0.5) return '#10B981';
  if (t < 0.75) return '#F59E0B';
  return '#EF4444';
}
