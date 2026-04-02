// ============================================================================
// RiskLab Charts — Range Selector
// Date/time range buttons (1D, 1W, 1M, 3M, 6M, YTD, 1Y, All) and an
// optional date-picker input pair. Mirrors Highcharts Stock's rangeSelector.
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../../core/types';

export interface RangeSelectorButton {
  /** Label shown on button */
  label: string;
  /** Amount to subtract from 'now' */
  count?: number;
  /** Unit for count */
  unit?: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  /** Custom active callback */
  onClick?: (from: number, to: number) => void;
}

export interface RangeSelectorConfig {
  enabled?: boolean;
  /** Preset buttons shown */
  buttons?: RangeSelectorButton[];
  /** Show date input boxes */
  inputEnabled?: boolean;
  /** Currently selected button index (-1 = none) */
  selected?: number;
  /** Vertical offset from top of chart (default: top of chart) */
  verticalAlign?: 'top' | 'bottom';
  buttonTheme?: {
    fill?: string;
    stroke?: string;
    textColor?: string;
    activeFill?: string;
    activeTextColor?: string;
    borderRadius?: number;
  };
}

export const DEFAULT_RANGE_BUTTONS: RangeSelectorButton[] = [
  { label: '1D',  count: 1,   unit: 'day'   },
  { label: '1W',  count: 1,   unit: 'week'  },
  { label: '1M',  count: 1,   unit: 'month' },
  { label: '3M',  count: 3,   unit: 'month' },
  { label: '6M',  count: 6,   unit: 'month' },
  { label: 'YTD', count: 0,   unit: 'year'  },
  { label: '1Y',  count: 1,   unit: 'year'  },
  { label: 'All', count: 0,   unit: 'all'   },
];

/** Convert count+unit to milliseconds range delta */
export function rangeToMs(count: number, unit: RangeSelectorButton['unit'], now: number): number {
  const d = new Date(now);
  switch (unit) {
    case 'millisecond': return count;
    case 'second':      return count * 1000;
    case 'minute':      return count * 60_000;
    case 'hour':        return count * 3_600_000;
    case 'day':         return count * 86_400_000;
    case 'week':        return count * 7 * 86_400_000;
    case 'month':
      d.setMonth(d.getMonth() - count);
      return now - d.getTime();
    case 'year':
      if (count === 0) {
        // YTD: compute delta from start of current year
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        return now - startOfYear.getTime();
      }
      d.setFullYear(d.getFullYear() - count);
      return now - d.getTime();
    case 'all':
      return Infinity;
    default:
      return 0;
  }
}

/** Compute {from, to} timestamp pair for a given button */
export function computeRangeForButton(
  btn: RangeSelectorButton,
  allData: { x: number }[],
): { from: number; to: number } {
  if (!allData || allData.length === 0) return { from: 0, to: Date.now() };

  const xs = allData.map(d => d.x);
  const dataMax = Math.max(...xs);
  const dataMin = Math.min(...xs);
  const to = dataMax;

  if (btn.unit === 'all' || btn.count === undefined) return { from: dataMin, to };

  const now = to;
  const delta = rangeToMs(btn.count, btn.unit, now);
  const from = delta === Infinity ? dataMin : now - delta;
  return { from: Math.max(from, dataMin), to };
}

/** Render range selector buttons above or below the chart */
export function renderRangeSelector(
  renderer: BaseRenderer,
  state: ChartState,
  config: ChartConfig,
  theme: ThemeConfig,
  rsConfig: RangeSelectorConfig = {},
  selectedIdx: number = -1,
): void {
  if (rsConfig.enabled === false) return;

  const buttons = rsConfig.buttons ?? DEFAULT_RANGE_BUTTONS;
  const bt = rsConfig.buttonTheme ?? {};

  const btnFill = bt.fill ?? (theme.tooltip.backgroundColor as string ?? '#f3f4f6');
  const btnStroke = bt.stroke ?? (theme.axis.gridColor as string ?? '#e5e7eb');
  const btnText = bt.textColor ?? (theme.textColor as string ?? '#374151');
  const activeFill = bt.activeFill ?? '#4f46e5';
  const activeText = bt.activeTextColor ?? '#fff';
  const btnR = bt.borderRadius ?? 4;

  const fontFamily = theme.fontFamily;
  const fontSize = 11;
  const BTN_H = 22;
  const BTN_PAD = 10;
  const BTN_GAP = 4;

  // Measure button widths
  const widths = buttons.map(b => b.label.length * (fontSize * 0.62) + BTN_PAD * 2);
  const totalW = widths.reduce((s, w) => s + w + BTN_GAP, -BTN_GAP);

  const isBottom = rsConfig.verticalAlign === 'bottom';
  const btnY = isBottom
    ? state.chartArea.y + state.chartArea.height + 8
    : Math.max(4, state.chartArea.y - BTN_H - 8);

  let btnX = state.chartArea.x + state.chartArea.width - totalW;

  renderer.beginGroup('range-selector', 'uc-range-selector');

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i]!;
    const bw = widths[i]!;
    const isActive = i === selectedIdx;

    renderer.drawRect(btnX, btnY, bw, BTN_H, {
      fill: isActive ? activeFill : btnFill,
      stroke: isActive ? 'none' : btnStroke,
      strokeWidth: 1,
    }, btnR);

    renderer.drawText(btnX + bw / 2, btnY + BTN_H / 2 + fontSize * 0.35, btn.label, {
      fontSize,
      fontFamily,
      fill: isActive ? activeText : btnText,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });

    btnX += bw + BTN_GAP;
  }

  renderer.endGroup();
}
