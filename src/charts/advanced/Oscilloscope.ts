// ============================================================================
// RiskLab Charts — Oscilloscope Chart
// Waveform display — signal analysis, time-domain visualization
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedSeries } from '../../core/DataPipeline';

export function renderOscilloscope(
  r: BaseRenderer,
  series: ProcessedSeries,
  state: ChartState,
  theme: ThemeConfig,
  color: string,
  idx: number,
): void {
  const { chartArea: ca } = state;

  // CRT-style background
  r.drawRect(ca.x, ca.y, ca.width, ca.height, { fill: '#0a1a0a' });

  // Grid lines (oscilloscope divisions — 10x8 standard)
  const divX = 10, divY = 8;
  for (let i = 0; i <= divX; i++) {
    const x = ca.x + (i / divX) * ca.width;
    r.drawLine(x, ca.y, x, ca.y + ca.height, {
      stroke: '#1a3a1a', strokeWidth: i === divX / 2 ? 1.2 : 0.5,
    });
  }
  for (let i = 0; i <= divY; i++) {
    const y = ca.y + (i / divY) * ca.height;
    r.drawLine(ca.x, y, ca.x + ca.width, y, {
      stroke: '#1a3a1a', strokeWidth: i === divY / 2 ? 1.2 : 0.5,
    });
  }

  // Minor tick marks on center cross
  const centerX = ca.x + ca.width / 2;
  const centerY = ca.y + ca.height / 2;
  for (let i = 0; i < divX * 5; i++) {
    const x = ca.x + (i / (divX * 5)) * ca.width;
    r.drawLine(x, centerY - 2, x, centerY + 2, { stroke: '#2a5a2a', strokeWidth: 0.5 });
  }
  for (let i = 0; i < divY * 5; i++) {
    const y = ca.y + (i / (divY * 5)) * ca.height;
    r.drawLine(centerX - 2, y, centerX + 2, y, { stroke: '#2a5a2a', strokeWidth: 0.5 });
  }

  // Waveform
  const data = series.data.filter(d => d.y != null);
  if (!data.length) return;

  // Use provided color with CRT-green fallback; idx selects default palette when color is default
  const crtDefaults = ['#00ff41', '#00d4ff', '#ffee00', '#ff5577'];
  const traceColor = color || crtDefaults[idx % crtDefaults.length];
  const yValues = data.map(d => Number(d.y));
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const rangeY = maxY - minY || 1;

  let path = '';
  const xDivisor = Math.max(data.length - 1, 1);
  for (let i = 0; i < data.length; i++) {
    const px = ca.x + (i / xDivisor) * ca.width;
    const py = ca.y + ca.height - ((Number(data[i].y) - minY) / rangeY) * ca.height;
    path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
  }

  // Phosphor glow (wider, faint)
  r.drawPath(path, { fill: 'none', stroke: traceColor, strokeWidth: 4, strokeOpacity: 0.15 });
  r.drawPath(path, { fill: 'none', stroke: traceColor, strokeWidth: 2, strokeOpacity: 0.35 });
  // Main trace
  r.drawPath(path, { fill: 'none', stroke: traceColor, strokeWidth: 1.2, strokeOpacity: 0.95 });

  // Channel label
  r.drawText(
    ca.x + 8, ca.y + 16 + idx * 18,
    `CH${idx + 1}`,
    { fill: traceColor, fontSize: 11, fontWeight: 'bold', textAnchor: 'start', fontFamily: 'monospace' },
  );

  // Trigger marker (keep inside chartArea)
  const trigX = ca.x + ca.width - 6;
  r.drawPath(
    `M ${trigX} ${centerY - 4} L ${trigX + 6} ${centerY} L ${trigX} ${centerY + 4} Z`,
    { fill: '#f59e0b' },
  );
}
