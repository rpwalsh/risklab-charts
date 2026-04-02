// ============================================================================
// RiskLab Charts — Solid Gauge Chart
// A donut-like gauge where the arc is fully filled to the value rather than
// using a needle. Supports multiple concentric bands (one per series).
// Equivalent to Highcharts premium "solidgauge" — free in RiskLab Charts.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries, ProcessedDataPoint } from '../core/DataPipeline';
import { getSeriesColor } from '../themes/ThemeEngine';

export interface SolidGaugeConfig {
  /** Minimum value (default 0). */
  min?: number;
  /** Maximum value (default 100). */
  max?: number;
  /** Arc start angle in degrees — 0 = 12-o'clock, clockwise (default -135). */
  startAngleDeg?: number;
  /** Arc end angle in degrees (default 135). */
  endAngleDeg?: number;
  /** Inner radius fraction of outer radius (default 0.6). */
  innerRadiusFraction?: number;
  /** Track fill color (default semi-transparent theme bg). */
  trackColor?: string;
  /** Show value label in center (default true). */
  showValue?: boolean;
  /** Value formatter (default toFixed(1)). */
  valueFormat?: (v: number) => string;
  /** Show the series name label (default true). */
  showName?: boolean;
  /** Rounded ends on filled arc (default true). */
  roundedEnds?: boolean;
}

export function renderSolidGauge(
  renderer: BaseRenderer,
  allSeries: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config?: Partial<ChartConfig>,
): void {
  const sgCfg = resolveSolidGaugeConfig(allSeries, config);

  const { chartArea } = state;
  const min        = sgCfg.min          ?? 0;
  const max        = sgCfg.max          ?? 100;
  const startDeg   = sgCfg.startAngleDeg ?? -135;
  const endDeg     = sgCfg.endAngleDeg   ?? 135;
  const innerFrac  = sgCfg.innerRadiusFraction ?? 0.6;
  const roundEnds  = sgCfg.roundedEnds   !== false;
  const showValue  = sgCfg.showValue     !== false;
  const showName   = sgCfg.showName      !== false;
  const fmt        = sgCfg.valueFormat   ?? ((v: number) => v.toFixed(1));

  const toRad = (d: number) => (d - 90) * (Math.PI / 180);
  const startRad = toRad(startDeg);
  const normalizedArcDeg = ((endDeg - startDeg) % 360 + 360) % 360;
  const totalArcDeg = normalizedArcDeg === 0 && endDeg !== startDeg ? 360 : normalizedArcDeg;
  const totalArc = totalArcDeg * (Math.PI / 180);

  const cx     = chartArea.x + chartArea.width / 2;
  const cy     = chartArea.y + chartArea.height / 2;
  const outerR = Math.min(chartArea.width, chartArea.height) / 2 - 4;

  const n      = Math.max(1, allSeries.length);
  const radStep = (outerR * (1 - innerFrac)) / n;

  renderer.beginGroup('sg-bands', 'uc-sg-bands');

  for (let si = 0; si < allSeries.length; si++) {
    const s = allSeries[si];
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
    const value = data[0]?.yNum ?? 0;
    const clamped = Math.max(min, Math.min(max, value));

    const bandOuterR = outerR - si * radStep;
    const bandInnerR = bandOuterR - radStep * 0.8;
    const color = getSeriesColor(theme, si);

    // Track arc (full range, dimmed)
    const trackColor = sgCfg.trackColor ?? 'rgba(128,128,128,0.15)';
    drawArcPath(renderer, cx, cy, bandInnerR, bandOuterR, startRad, startRad + totalArc, trackColor, 1.0, false);

    // Filled arc
    const fraction = (clamped - min) / (max - min);
    const fillEnd  = startRad + fraction * totalArc;
    drawArcPath(renderer, cx, cy, bandInnerR, bandOuterR, startRad, fillEnd, color, 1.0, roundEnds && fraction > 0.01);

    // Series name label
    if (showName && s.name) {
      renderer.drawText(cx, cy - 10 + si * 20, s.name, {
        fontSize: 11,
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: (theme.textColor as string) ?? '#666',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }

    // Value label (only for first/single series, centred)
    if (showValue && si === 0) {
      renderer.drawText(cx, cy + (showName && s.name ? 14 : 4), fmt(value), {
        fontSize: Math.max(14, outerR * 0.22),
        fontWeight: 'bold',
        fontFamily: theme.fontFamily ?? 'sans-serif',
        fill: color,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
  }

  renderer.endGroup();
}

function resolveSolidGaugeConfig(
  allSeries: ProcessedSeries[],
  config?: Partial<ChartConfig>,
): SolidGaugeConfig {
  const solidGauge = config?.solidGauge ?? {};
  const useProgressRing = allSeries.every((series) => series.type === 'progressRing');
  const useRadialBar = allSeries.every((series) => series.type === 'radialBar');

  if (useProgressRing) {
    return {
      startAngleDeg: 0,
      endAngleDeg: 360,
      innerRadiusFraction: 0.72,
      showName: false,
      showValue: true,
      roundedEnds: true,
      ...solidGauge,
      ...(config?.progressRing ?? {}),
    };
  }

  if (useRadialBar) {
    return {
      startAngleDeg: -90,
      endAngleDeg: 270,
      innerRadiusFraction: 0.35,
      showName: true,
      showValue: false,
      roundedEnds: true,
      ...solidGauge,
      ...(config?.radialBar ?? {}),
    };
  }

  return solidGauge;
}

function drawArcPath(
  renderer: BaseRenderer,
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number,
  fill: string,
  opacity: number,
  rounded: boolean,
): void {
  if (endAngle <= startAngle) return;
  const span = endAngle - startAngle;
  const largeArc = span > Math.PI ? 1 : 0;

  const cos0 = Math.cos(startAngle), sin0 = Math.sin(startAngle);
  const cos1 = Math.cos(endAngle),   sin1 = Math.sin(endAngle);

  const ox1 = cx + outerR * cos0, oy1 = cy + outerR * sin0;
  const ox2 = cx + outerR * cos1, oy2 = cy + outerR * sin1;
  const ix2 = cx + innerR * cos1, iy2 = cy + innerR * sin1;
  const ix1 = cx + innerR * cos0, iy1 = cy + innerR * sin0;

  let path: string;
  if (rounded) {
    const capR = (outerR - innerR) / 2;
    path = [
      `M ${ox1} ${oy1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
      `A ${capR} ${capR} 0 0 1 ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      `A ${capR} ${capR} 0 0 1 ${ox1} ${oy1}`,
      'Z',
    ].join(' ');
  } else {
    path = [
      `M ${ox1} ${oy1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ');
  }

  renderer.drawPath(path, { fill, opacity });
}
