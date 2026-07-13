// ============================================================================
// RiskLab Charts — OHLC Chart
// Classic tick-mark OHLC bars (distinct from filled candlestick)
// Each bar: vertical high-low line + left tick (open) + right tick (close)
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';

export function renderOHLCChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  config: ChartConfig,
  _theme: ThemeConfig,
): void {
  const { chartArea: _ca } = state;
  const xScale = state.scales.get('x0');
  const yScale = state.scales.get('y0');
  if (!xScale || !yScale) return;

  const colorUp = config.ohlc?.colorUp ?? '#16a34a';
  const colorDown = config.ohlc?.colorDown ?? '#dc2626';
  const tickW = config.ohlc?.tickWidth ?? 6;

  renderer.beginGroup('ohlc', 'uc-ohlc');

  for (const s of series) {
    if (s.visible === false) continue;

    const data = s.data;
    const n = data.length;

    // Compute tick half-width based on data density
    let halfW: number;
    if (n > 1) {
      const pixSpan = Math.abs(xScale.convert(data[1]!.x) - xScale.convert(data[0]!.x));
      halfW = Math.max(2, Math.min(tickW, pixSpan * 0.3));
    } else {
      halfW = tickW;
    }

    for (let i = 0; i < n; i++) {
      const d = data[i]!;
      const open = typeof d.open === 'number' ? d.open : Number(d.y ?? 0);
      const close = typeof d.close === 'number' ? d.close : Number(d.y2 ?? d.y ?? 0);
      const high = typeof d.high === 'number' ? d.high : Math.max(open, close);
      const low = typeof d.low === 'number' ? d.low : Math.min(open, close);

      const cx = xScale.convert(d.x);
      const pyHigh = yScale.convert(high);
      const pyLow = yScale.convert(low);
      const pyOpen = yScale.convert(open);
      const pyClose = yScale.convert(close);

      const isBullish = close >= open;
      const color = isBullish ? colorUp : colorDown;

      const isHovered = state.hoveredPoint?.seriesId === s.id && state.hoveredPoint.index === i;
      const isSelected = state.selectedPoints.some(p => p.seriesId === s.id && p.index === i);
      const sw = isHovered || isSelected ? 2.5 : 1.5;

      // High–Low vertical line
      renderer.drawLine(cx, pyHigh, cx, pyLow, {
        stroke: color,
        strokeWidth: sw,
        clipPath: 'chart-clip',
      });

      // Open tick (left side)
      renderer.drawLine(cx - halfW, pyOpen, cx, pyOpen, {
        stroke: color,
        strokeWidth: sw,
        clipPath: 'chart-clip',
      });

      // Close tick (right side)
      renderer.drawLine(cx, pyClose, cx + halfW, pyClose, {
        stroke: color,
        strokeWidth: sw,
        clipPath: 'chart-clip',
      });
    }
  }

  renderer.endGroup();
}
