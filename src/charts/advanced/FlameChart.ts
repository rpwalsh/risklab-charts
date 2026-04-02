// ============================================================================
// RiskLab Charts — Flame Chart
// CPU profiling / performance flame graph — hierarchical call stacks
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderFlameChart(
  r: BaseRenderer, series: ProcessedSeries, state: ChartState, _theme: ThemeConfig,
): void {
  const { chartArea: ca } = state;
  // Data format: each data point = { x: start, y: end (time), meta: { depth, label } }
  const data = series.data.filter(d => d.x != null && d.y != null);
  if (!data.length) return;

  const timeMin = Math.min(...data.map(d => Number(d.x)));
  const timeMax = Math.max(...data.map(d => Number(d.y)));
  const timeRange = timeMax - timeMin || 1;
  const maxDepth = Math.max(...data.map(d => Number(d.meta?.depth ?? 0))) + 1;
  const rowH = Math.min(22, (ca.height - 10) / maxDepth);

  for (const d of data) {
    const start = Number(d.x);
    const end = Number(d.y);
    const depth = Number(d.meta?.depth ?? 0);
    const label = String(d.meta?.label ?? d.label ?? '');

    const bx = ca.x + ((start - timeMin) / timeRange) * ca.width;
    const bw = ((end - start) / timeRange) * ca.width;
    const by = ca.y + ca.height - (depth + 1) * rowH;

    // Color by hash of label name
    const hue = hashHue(label);
    const fill = `hsl(${hue}, 70%, 55%)`;

    r.drawRect(bx, by, Math.max(bw, 1), rowH - 1, {
      fill, fillOpacity: 0.9, stroke: 'rgba(0,0,0,0.2)', strokeWidth: 0.5,
    });

    // Label if wide enough
    if (bw > 30) {
      const truncated = label.length * 7 > bw ? label.slice(0, Math.floor(bw / 7)) + '…' : label;
      r.drawText(bx + 4, by + rowH / 2 + 4, truncated, {
        fill: '#fff', fontSize: 10, textAnchor: 'start',
      });
    }
  }
}

function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return ((h % 360) + 360) % 360;
}
