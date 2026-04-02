// ============================================================================
// RiskLab Charts — Annotations Component
// Renders overlaid annotations: labels, lines, rects, circles, arrows,
// callouts, images, and fully custom elements onto the chart surface.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type {
  AnnotationConfig,
  ChartState,
  ThemeConfig,
} from '../core/types';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface AnnotationRenderOptions {
  renderer: BaseRenderer;
  annotations: AnnotationConfig[];
  state: ChartState;
  theme: ThemeConfig;
}

/**
 * Render all annotations on top of the chart.
 * Called from Engine.render() after all chart series have been drawn.
 */
export function renderAnnotations(
  renderer: BaseRenderer,
  annotations: AnnotationConfig[],
  state: ChartState,
  theme: ThemeConfig,
): void {
  if (!annotations || annotations.length === 0) return;

  // Sort by optional zIndex so higher values render on top
  const sorted = [...annotations].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  renderer.beginGroup('annotations', 'uc-annotations');

  for (const ann of sorted) {
    if (ann.visible === false) continue;

    try {
      drawAnnotation(renderer, ann, state, theme);
    } catch {
      // Never let a bad annotation break the whole chart
    }
  }

  renderer.endGroup();
}

// ---------------------------------------------------------------------------
// Coordinate resolution helpers
// ---------------------------------------------------------------------------

function resolveX(ann: AnnotationConfig, state: ChartState): number {
  if (ann.pixelX !== undefined) return ann.pixelX;

  const scale = state.scales.get(ann.xAxisId ?? 'x0');
  if (scale && ann.x !== undefined) return scale.convert(ann.x);

  return state.chartArea.x;
}

function resolveY(ann: AnnotationConfig, state: ChartState): number {
  if (ann.pixelY !== undefined) return ann.pixelY;

  const scale = state.scales.get(ann.yAxisId ?? 'y0');
  if (scale && ann.y !== undefined) return scale.convert(ann.y);

  return state.chartArea.y;
}

function resolveX2(ann: AnnotationConfig, state: ChartState): number {
  const scale = state.scales.get(ann.xAxisId ?? 'x0');
  if (scale && ann.x2 !== undefined) return scale.convert(ann.x2);
  return state.chartArea.x + state.chartArea.width;
}

function resolveY2(ann: AnnotationConfig, state: ChartState): number {
  const scale = state.scales.get(ann.yAxisId ?? 'y0');
  if (scale && ann.y2 !== undefined) return scale.convert(ann.y2);
  return state.chartArea.y + state.chartArea.height;
}

function colorStr(v: string | object | undefined, fallback: string): string {
  if (!v) return fallback;
  if (typeof v === 'string') return v;
  return fallback;
}

// ---------------------------------------------------------------------------
// Per-type drawing
// ---------------------------------------------------------------------------

function drawAnnotation(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  switch (ann.type) {
    case 'label': return drawLabel(renderer, ann, state, theme);
    case 'line': return drawLine(renderer, ann, state, theme);
    case 'rect': return drawRect(renderer, ann, state, theme);
    case 'circle': return drawCircle(renderer, ann, state, theme);
    case 'arrow': return drawArrow(renderer, ann, state, theme);
    case 'callout': return drawCallout(renderer, ann, state, theme);
    case 'image': return drawImage(renderer, ann, state, theme);
    case 'custom': return drawCustom(renderer, ann, state, theme);
  }
}

// ── Label ─────────────────────────────────────────────────────────────────

function drawLabel(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  if (!ann.text) return;

  const x = resolveX(ann, state);
  const y = resolveY(ann, state);
  const fontSize = ann.fontSize ?? 12;
  const fontFamily = ann.fontFamily ?? theme.fontFamily;
  const color = colorStr(ann.color as string | object, theme.textColor as string ?? '#374151');
  const bg = colorStr(ann.backgroundColor as string | object, '');

  const PAD = 6;
  const textWidth = ann.text.length * (fontSize * 0.6); // rough estimate
  const textHeight = fontSize + 2;

  if (bg) {
    renderer.drawRect(
      x - PAD,
      y - textHeight - PAD / 2,
      textWidth + PAD * 2,
      textHeight + PAD,
      {
        fill: bg,
        stroke: colorStr(ann.borderColor as string | object, 'transparent'),
        strokeWidth: ann.borderWidth ?? 0,
      },
      ann.borderRadius ?? 4,
    );
  }

  renderer.drawText(x, y, ann.text, {
    fontSize,
    fontFamily,
    fill: color,
    textAnchor: 'start',
  });
}

// ── Line ──────────────────────────────────────────────────────────────────

function drawLine(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  const x1 = resolveX(ann, state);
  const y1 = resolveY(ann, state);
  const x2 = resolveX2(ann, state);
  const y2 = resolveY2(ann, state);
  const color = colorStr(ann.color as string | object, theme.axis.gridColor as string ?? '#9ca3af');

  renderer.drawLine(x1, y1, x2, y2, {
    stroke: color,
    strokeWidth: ann.borderWidth ?? 1,
    dashArray: [4, 3],
  });

  // Optional label at midpoint
  if (ann.text) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    renderer.drawText(mx, my - 6, ann.text, {
      fontSize: ann.fontSize ?? 11,
      fontFamily: ann.fontFamily ?? theme.fontFamily,
      fill: color,
      textAnchor: 'middle',
    });
  }
}

// ── Rect ──────────────────────────────────────────────────────────────────

function drawRect(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  const x1 = resolveX(ann, state);
  const y1 = resolveY(ann, state);
  const x2 = resolveX2(ann, state);
  const y2 = resolveY2(ann, state);

  const rx = Math.min(x1, x2);
  const ry = Math.min(y1, y2);
  const rw = Math.abs(x2 - x1);
  const rh = Math.abs(y2 - y1);

  const fill = colorStr(ann.backgroundColor as string | object, 'rgba(99,102,241,0.1)');
  const stroke = colorStr(ann.borderColor as string | object, colorStr(ann.color as string | object, 'rgba(99,102,241,0.6)'));

  renderer.drawRect(rx, ry, rw, rh, {
    fill,
    stroke,
    strokeWidth: ann.borderWidth ?? 1,
    opacity: 0.7,
  }, ann.borderRadius ?? 0);

  if (ann.text) {
    renderer.drawText(rx + 6, ry + (ann.fontSize ?? 12) + 4, ann.text, {
      fontSize: ann.fontSize ?? 12,
      fontFamily: ann.fontFamily ?? theme.fontFamily,
      fill: stroke,
      textAnchor: 'start',
    });
  }
}

// ── Circle ────────────────────────────────────────────────────────────────

function drawCircle(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  const cx = resolveX(ann, state);
  const cy = resolveY(ann, state);
  // Infer radius from x2/y2 distance or fallback
  const rx2 = resolveX2(ann, state);
  const ry2 = resolveY2(ann, state);
  const r = Math.hypot(rx2 - cx, ry2 - cy) || 20;

  const fill = colorStr(ann.backgroundColor as string | object, 'rgba(99,102,241,0.08)');
  const stroke = colorStr(ann.borderColor as string | object, colorStr(ann.color as string | object, 'rgba(99,102,241,0.7)'));

  renderer.drawCircle(cx, cy, r, {
    fill,
    stroke,
    strokeWidth: ann.borderWidth ?? 1.5,
  });

  if (ann.text) {
    renderer.drawText(cx, cy + (ann.fontSize ?? 12) / 3, ann.text, {
      fontSize: ann.fontSize ?? 12,
      fontFamily: ann.fontFamily ?? theme.fontFamily,
      fill: stroke,
      textAnchor: 'middle',
    });
  }
}

// ── Arrow ─────────────────────────────────────────────────────────────────

function drawArrow(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  const x1 = resolveX(ann, state);
  const y1 = resolveY(ann, state);
  const x2 = resolveX2(ann, state);
  const y2 = resolveY2(ann, state);
  const color = colorStr(ann.color as string | object, theme.textColor as string ?? '#374151');
  const sw = ann.borderWidth ?? 1.5;

  // Shaft
  renderer.drawLine(x1, y1, x2, y2, {
    stroke: color,
    strokeWidth: sw,
  });

  // Arrowhead — draw as a small filled polygon at (x2, y2)
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const AH = 10; // arrowhead length
  const ax1 = x2 - AH * Math.cos(angle - 0.4);
  const ay1 = y2 - AH * Math.sin(angle - 0.4);
  const ax2 = x2 - AH * Math.cos(angle + 0.4);
  const ay2 = y2 - AH * Math.sin(angle + 0.4);

  renderer.drawPath(
    `M${x2},${y2} L${ax1},${ay1} L${ax2},${ay2} Z`,
    { fill: color, stroke: 'none' },
  );

  if (ann.text) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    renderer.drawText(mx, my - 8, ann.text, {
      fontSize: ann.fontSize ?? 11,
      fontFamily: ann.fontFamily ?? theme.fontFamily,
      fill: color,
      textAnchor: 'middle',
    });
  }
}

// ── Callout ───────────────────────────────────────────────────────────────

function drawCallout(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  theme: ThemeConfig,
): void {
  if (!ann.text) return;

  const tx = resolveX(ann, state);
  const ty = resolveY(ann, state);

  const fontSize = ann.fontSize ?? 12;
  const PAD = 8;
  const txtW = ann.text.length * (fontSize * 0.6);
  const txtH = fontSize + 4;
  const boxW = txtW + PAD * 2;
  const boxH = txtH + PAD * 2;

  // Bubble above the pointer point
  const bx = tx - boxW / 2;
  const by = ty - boxH - 16;

  const fill = colorStr(ann.backgroundColor as string | object, theme.tooltip.backgroundColor as string ?? '#fff');
  const border = colorStr(ann.borderColor as string | object, theme.tooltip.borderColor as string ?? '#e5e7eb');
  const textColor = colorStr(ann.color as string | object, theme.textColor as string ?? '#374151');

  // Box
  renderer.drawRect(bx, by, boxW, boxH, {
    fill,
    stroke: border,
    strokeWidth: 1,
  }, 4);

  // Stem
  renderer.drawLine(tx, by + boxH, tx, ty, {
    stroke: border,
    strokeWidth: 1,
  });

  // Text
  renderer.drawText(bx + PAD, by + PAD + fontSize, ann.text, {
    fontSize,
    fontFamily: ann.fontFamily ?? theme.fontFamily,
    fill: textColor,
    textAnchor: 'start',
  });
}

// ── Image ─────────────────────────────────────────────────────────────────

function drawImage(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  _theme: ThemeConfig,
): void {
  if (!ann.imageUrl) return;

  const x = resolveX(ann, state);
  const y = resolveY(ann, state);
  const w = ann.imageWidth ?? 64;
  const h = ann.imageHeight ?? 64;

  if ('drawImage' in renderer && typeof (renderer as Record<string, unknown>).drawImage === 'function') {
    (renderer as unknown as { drawImage: (url: string, x: number, y: number, w: number, h: number) => void }).drawImage(ann.imageUrl, x - w / 2, y - h / 2, w, h);
  }
}

// ── Custom ────────────────────────────────────────────────────────────────

function drawCustom(
  renderer: BaseRenderer,
  ann: AnnotationConfig,
  state: ChartState,
  _theme: ThemeConfig,
): void {
  if (typeof ann.render !== 'function') return;

  const x = resolveX(ann, state);
  const y = resolveY(ann, state);

  const svgString = ann.render({
    x,
    y,
    chart: null, // filled in by caller if required
    svg: null,
  });

  if ('drawRawSVG' in renderer && typeof (renderer as Record<string, unknown>).drawRawSVG === 'function') {
    (renderer as unknown as { drawRawSVG: (svg: string, x: number, y: number) => void }).drawRawSVG(svgString, x, y);
  }
}
