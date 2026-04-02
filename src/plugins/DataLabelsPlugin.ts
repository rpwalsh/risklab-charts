// ============================================================================
// RiskLab Charts — Data Labels Plugin
// Renders value labels directly on chart elements: bars, lines, points, pies
// ============================================================================

import type {
  RiskLabPlugin,
  Rect,
  ChartConfig,
  ThemeConfig,
  ResolvedScale,
} from '../core/types';
import type { ProcessedDataPoint, ProcessedSeries } from '../core/DataPipeline';
import type { BaseRenderer } from '../renderers/BaseRenderer';
import { createPlugin } from './PluginSystem';

// ---------------------------------------------------------------------------
// Accurate text-width measurement via a lazily-created off-screen <canvas>
// Falls back to a character-count heuristic in SSR / non-DOM environments.
// ---------------------------------------------------------------------------

let _measureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.55;
  if (!_measureCtx) {
    try {
      _measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      /* SSR — context unavailable */
    }
  }
  if (!_measureCtx) return text.length * fontSize * 0.55;
  _measureCtx.font = `${fontSize}px ${fontFamily}`;
  return _measureCtx.measureText(text).width;
}

export interface DataLabelsConfig {
  enabled?: boolean;
  color?: string;
  fontSize?: number;
  /** 'value' | 'percent' | 'label' | custom fn */
  format?: 'value' | 'percent' | 'label' | ((value: unknown, point: unknown) => string);
  position?: 'top' | 'center' | 'bottom' | 'outside' | 'inside';
  offset?: number;
  rotation?: number;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
}

export const DataLabelsPlugin: RiskLabPlugin = createPlugin('data-labels')
  .version('1.0.0')
  .name('Data Labels Plugin')
  .defaults({
    dataLabels: {
      enabled: false,
      color: '#374151',
      fontSize: 10,
      format: 'value',
      position: 'top',
      offset: 4,
      rotation: 0,
      backgroundColor: 'transparent',
      borderRadius: 2,
      padding: 2,
    } satisfies DataLabelsConfig,
  })
  .hook('draw', (_renderer: unknown, _chartArea: Rect) => {
    // Rendering is handled via renderDataLabels() called from Engine
  })
  .build();

// ---------------------------------------------------------------------------
// Standalone rendering function — called from Engine after chart body is drawn
// ---------------------------------------------------------------------------

export function renderDataLabels(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  scales: Map<string, ResolvedScale>,
  config: ChartConfig,
  theme: ThemeConfig,
): void {
  const dlConfig = config.dataLabels as DataLabelsConfig | undefined;
  if (!dlConfig?.enabled) return;

  const fontSize = dlConfig.fontSize ?? 10;
  const offset = dlConfig.offset ?? 4;
  const color = dlConfig.color ?? (theme.textColor as string) ?? '#374151';
  const fontFamily = theme.fontFamily;
  const bg = dlConfig.backgroundColor && dlConfig.backgroundColor !== 'transparent'
    ? dlConfig.backgroundColor : undefined;
  const pad = dlConfig.padding ?? 2;
  const position = dlConfig.position ?? 'top';

  renderer.beginGroup('data-labels', 'uc-data-labels');

  for (const s of series) {
    if (s.visible === false) continue;
    const xScale = scales.get(s.xAxisId ?? 'x0');
    const yScale = scales.get(s.yAxisId ?? 'y0');
    if (!xScale || !yScale) continue;

    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
    if (!data || data.length === 0) continue;

    // Compute total for percent mode (pie/donut)
    const total = (s.type === 'pie' || s.type === 'donut')
      ? data.reduce((sum: number, d: ProcessedDataPoint) => sum + Math.abs(Number(d.y) || 0), 0)
      : 0;

    for (const d of data) {
      const rawY = d.y1 ?? d.yNum ?? d.y;
      const fx = xScale.convert(d.x);
      const fy = yScale.convert(rawY);

      // Format the label text
      let text: string;
      if (typeof dlConfig.format === 'function') {
        text = dlConfig.format(d.y, d);
      } else if (dlConfig.format === 'percent' && total > 0) {
        text = `${((Math.abs(Number(d.y) || 0) / total) * 100).toFixed(1)}%`;
      } else if (dlConfig.format === 'label') {
        text = String(d.label ?? d.x ?? '');
      } else {
        // 'value' (default)
        const v = d.y;
        text = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v ?? '');
      }

      if (!text) continue;

      // Determine y position
      let labelY: number;

      const isBar = s.type === 'bar' || s.type === 'stackedBar' || s.type === 'column';
      if (isBar) {
        const barBase = yScale.convert(d.y0 ?? 0);
        const barTop = fy;
        if (position === 'center') {
          labelY = (barBase + barTop) / 2;
        } else if (position === 'bottom' || position === 'inside') {
          labelY = Math.max(barTop, barBase) - offset;
        } else {
          // top / outside (default for bars)
          labelY = Math.min(barTop, barBase) - offset;
        }
      } else {
        labelY = fy - offset;
      }

      // Draw background if specified
      if (bg) {
        const textWidth = measureTextWidth(text, fontSize, fontFamily ?? 'sans-serif');
        renderer.drawRect(
          fx - textWidth / 2 - pad,
          labelY - fontSize - pad,
          textWidth + pad * 2,
          fontSize + pad * 2,
          { fill: bg },
          dlConfig.borderRadius ?? 2,
        );
      }

      renderer.drawText(fx, labelY, text, {
        fontSize,
        fontFamily,
        fill: color,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      });
    }
  }

  renderer.endGroup();
}
