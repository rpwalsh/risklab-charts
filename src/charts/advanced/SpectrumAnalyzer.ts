// ============================================================================
// RiskLab Charts — Spectrum Analyzer
// FFT-style frequency spectrum — radio, audio, signal processing
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderSpectrumAnalyzer(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
): void {
  const { chartArea: ca } = state;
  const data = series.data.filter(d => d.y != null);
  if (!data.length) return;

  const n = data.length;
  const barW = ca.width / n;
  const maxVal = Math.max(...data.map(d => Math.abs(Number(d.y))));

  // Background grid (dB lines)
  const gridLevels = [-80, -60, -40, -20, 0];
  for (const dB of gridLevels) {
    const ny = ca.y + ca.height - ((dB + 80) / 80) * ca.height;
    r.drawLine(ca.x, ny, ca.x + ca.width, ny, {
      stroke: theme.axis.gridColor as string, strokeWidth: 0.5,
    });
    r.drawText(ca.x - 6, ny + 4, `${dB} dB`, {
      fill: theme.axis.labelColor as string, fontSize: 9, textAnchor: 'end',
    });
  }

  // Define gradient for bars
  const gradId = 'spectrum-grad';
  r.defineLinearGradient(gradId, 0, 1, 0, 0, [
    { offset: 0, color: '#22c55e' },   // green at bottom
    { offset: 0.5, color: '#f59e0b' }, // yellow mid
    { offset: 0.8, color: '#ef4444' }, // red high
    { offset: 1, color: '#ff0000' },   // bright red peak
  ]);

  // Bars — convert linear magnitude to dB for consistent Y-axis
  for (let i = 0; i < n; i++) {
    const val = Math.abs(Number(data[i].y));
    // Convert to dB: 20*log10(val/maxVal), clamp to -80 dB floor
    const dB = maxVal > 0 && val > 0 ? 20 * Math.log10(val / maxVal) : -80;
    const clampedDB = Math.max(-80, dB);
    const norm = (clampedDB + 80) / 80; // 0..1 where 0 = -80 dB, 1 = 0 dB
    const barH = norm * ca.height;
    const bx = ca.x + i * barW;
    const by = ca.y + ca.height - barH;

    r.drawRect(bx + 0.5, by, Math.max(barW - 1, 1), barH, {
      fill: `url(#${gradId})`,
      fillOpacity: 0.9,
    });

    // Peak hold line
    r.drawLine(bx, by, bx + barW - 1, by, {
      stroke: color, strokeWidth: 1, strokeOpacity: 0.8,
    });
  }

  // Smoothed envelope line on top
  if (data.length > 2) {
    let path = '';
    for (let i = 0; i < n; i++) {
      const val = Math.abs(Number(data[i].y));
      const dB = maxVal > 0 && val > 0 ? 20 * Math.log10(val / maxVal) : -80;
      const norm = (Math.max(-80, dB) + 80) / 80;
      const px = ca.x + (i + 0.5) * barW;
      const py = ca.y + ca.height - norm * ca.height;
      path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    r.drawPath(path, {
      fill: 'none', stroke: '#fff', strokeWidth: 1.2, strokeOpacity: 0.6,
    });
  }

  // Frequency labels along bottom
  const labelStep = Math.max(1, Math.floor(n / 10));
  for (let i = 0; i < n; i += labelStep) {
    const label = data[i].label ?? String(data[i].x ?? i);
    const freqLabelY = ca.y + ca.height + 14;
    r.drawText(ca.x + (i + 0.5) * barW, freqLabelY, label, {
      fill: theme.axis.labelColor as string, fontSize: 9, textAnchor: 'middle',
      clipPath: 'chart-clip',
    });
  }
}
