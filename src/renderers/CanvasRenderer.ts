// ============================================================================
// RiskLab Charts — Canvas Renderer
// High-performance Canvas2D rendering backend
// ============================================================================

import { BaseRenderer, type DrawStyle } from './BaseRenderer';

export class CanvasRenderer extends BaseRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private stateStack: Array<{ transform?: string }> = [];
  /** Gradient and pattern cache — keyed by id, lives on the instance not on ctx */
  private gradientCache = new Map<string, CanvasGradient | CanvasPattern>();

  constructor(container: HTMLElement, width: number, height: number) {
    super(container, width, height);

    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'RiskLab Chart');

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(this.dpr, this.dpr);

    container.appendChild(this.canvas);
  }

  clear(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.stateStack = [];
  }

  destroy(): void {
    this.canvas.remove();
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(this.dpr, this.dpr);
    // Gradients/patterns are bound to the old context — clear the cache so they are recreated
    this.gradientCache.clear();
  }

  drawRect(
    x: number, y: number, w: number, h: number,
    style?: DrawStyle, rx?: number, _ry?: number,
  ): void {
    this.applyStyle(style);
    try {
      if (rx && rx > 0) {
        this.roundRect(x, y, w, h, rx, style);
      } else {
        if (style?.fill) {
          this.ctx.fillRect(x, y, w, h);
        }
        if (style?.stroke) {
          this.ctx.strokeRect(x, y, w, h);
        }
      }
    } finally {
      this.ctx.restore();
    }
  }

  drawCircle(cx: number, cy: number, r: number, style?: DrawStyle): void {
    this.applyStyle(style);
    try {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (style?.fill) this.ctx.fill();
      if (style?.stroke) this.ctx.stroke();
    } finally {
      this.ctx.restore();
    }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, style?: DrawStyle): void {
    this.applyStyle(style);
    try {
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    } finally {
      this.ctx.restore();
    }
  }

  drawPath(d: string, style?: DrawStyle): void {
    this.applyStyle(style);
    try {
      const path = new Path2D(d);
      if (style?.fill) this.ctx.fill(path);
      if (style?.stroke) this.ctx.stroke(path);
    } finally {
      this.ctx.restore();
    }
  }

  drawText(x: number, y: number, text: string, style?: DrawStyle): void {
    this.applyStyle(style);
    try {
      const size = style?.fontSize ?? 12;
      const family = style?.fontFamily ?? 'sans-serif';
      const weight = style?.fontWeight ?? 'normal';
      this.ctx.font = `${weight} ${size}px ${family}`;

      if (style?.textAnchor === 'middle') {
        this.ctx.textAlign = 'center';
      } else if (style?.textAnchor === 'end') {
        this.ctx.textAlign = 'right';
      } else {
        this.ctx.textAlign = 'left';
      }

      this.ctx.textBaseline = 'middle';

      // Always render text. applyStyle() already set fillStyle when style.fill
      // is provided (including url() gradient resolution). If no fill was given,
      // default to black — matches SVGRenderer's inherited fill behaviour.
      if (!style?.fill) {
        this.ctx.fillStyle = '#000';
      }
      this.ctx.fillText(text, x, y);
    } finally {
      this.ctx.restore();
    }
  }

  drawPolygon(points: Array<[number, number]>, style?: DrawStyle): void {
    if (points.length < 2) return;
    this.applyStyle(style);
    try {
      this.ctx.beginPath();
      this.ctx.moveTo(points[0]![0], points[0]![1]);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i]![0], points[i]![1]);
      }
      this.ctx.closePath();
      if (style?.fill) this.ctx.fill();
      if (style?.stroke) this.ctx.stroke();
    } finally {
      this.ctx.restore();
    }
  }

  drawArc(
    cx: number, cy: number, innerR: number, outerR: number,
    startAngle: number, endAngle: number, style?: DrawStyle,
  ): void {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const sa = toRad(startAngle - 90);
    const ea = toRad(endAngle - 90);

    this.applyStyle(style);
    try {
      this.ctx.beginPath();

      this.ctx.arc(cx, cy, outerR, sa, ea);
      if (innerR > 0) {
        this.ctx.arc(cx, cy, innerR, ea, sa, true);
      } else {
        this.ctx.lineTo(cx, cy);
      }
      this.ctx.closePath();

      if (style?.fill) this.ctx.fill();
      if (style?.stroke) this.ctx.stroke();
    } finally {
      this.ctx.restore();
    }
  }

  beginGroup(_id?: string, _className?: string, _transform?: string): void {
    this.ctx.save();
    this.stateStack.push({});
  }

  endGroup(): void {
    this.stateStack.pop();
    this.ctx.restore();
  }

  defineClipRect(_id: string, x: number, y: number, w: number, h: number): void {
    // In canvas, we apply clip paths immediately.
    // We save state so removeClipRect() can restore it.
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  removeClipRect(): void {
    // Restore state saved by defineClipRect
    this.ctx.restore();
  }

  defineLinearGradient(
    id: string, x1: number, y1: number, x2: number, y2: number,
    stops: Array<{ offset: number; color: string; opacity?: number }>,
  ): void {
    // Callers may pass coords in 0–1 fractional form (SVG objectBoundingBox convention).
    // Scale to actual canvas pixels so the gradient spans the visible chart area.
    const px1 = x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1
      ? x1 * this.width  : x1;
    const py1 = x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1
      ? y1 * this.height : y1;
    const px2 = x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1
      ? x2 * this.width  : x2;
    const py2 = x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1
      ? y2 * this.height : y2;

    const grad = this.ctx.createLinearGradient(px1, py1, px2, py2);
    for (const s of stops) {
      const color = s.opacity !== undefined
        ? s.color.startsWith('#')
          ? `${s.color}${Math.round(s.opacity * 255).toString(16).padStart(2, '0')}`
          : s.color
        : s.color;
      grad.addColorStop(s.offset, color);
    }
    this.gradientCache.set(id, grad);
  }

  attachEvent(_elementId: string, event: string, handler: (e: Event) => void): void {
    this.canvas.addEventListener(event, handler);
  }

  drawImage(href: string, x: number, y: number, w: number, h: number): void {
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, x, y, w, h);
    };
    img.src = href;
  }

  drawRawSVG(_svgContent: string, _x: number, _y: number): void {
    // Canvas does not support raw SVG injection; use SVGRenderer for this feature
  }

  /** Define a canvas fill pattern; returns 'url(#id)' for use in DrawStyle.fill */
  definePattern(
    id: string,
    type: 'lines' | 'dots' | 'crosses' | 'diagonal' | 'grid' | 'checker' | 'custom',
    color: string = '#333',
    bgColor: string = 'transparent',
    size: number = 8,
    _customSVG?: string,
  ): string {
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const ctx = offscreen.getContext('2d')!;

    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const half = size / 2;

    switch (type) {
      case 'lines':
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, size); ctx.stroke();
        break;
      case 'diagonal':
        ctx.beginPath();
        ctx.moveTo(-1, 1); ctx.lineTo(1, -1);
        ctx.moveTo(0, size); ctx.lineTo(size, 0);
        ctx.moveTo(size - 1, size + 1); ctx.lineTo(size + 1, size - 1);
        ctx.lineWidth = 1.5; ctx.stroke();
        break;
      case 'dots':
        ctx.beginPath(); ctx.arc(half, half, size / 6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'crosses':
        ctx.beginPath();
        ctx.moveTo(half, 0); ctx.lineTo(half, size);
        ctx.moveTo(0, half); ctx.lineTo(size, half);
        ctx.stroke();
        break;
      case 'grid':
        ctx.strokeStyle = color; ctx.lineWidth = 0.5;
        ctx.strokeRect(0, 0, size, size);
        break;
      case 'checker':
        ctx.fillRect(0, 0, half, half);
        ctx.fillRect(half, half, half, half);
        break;
    }

    const pattern = this.ctx.createPattern(offscreen, 'repeat');
    if (pattern) this.gradientCache.set(id, pattern);
    return `url(#${id})`;
  }

  /** Define a radial gradient and return its id reference */
  defineRadialGradient(
    id: string,
    cx: number, cy: number, r: number,
    stops: Array<{ offset: number; color: string; opacity?: number }>,
  ): string {
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const s of stops) {
      grad.addColorStop(s.offset, s.color);
    }
    this.gradientCache.set(id, grad);
    return `url(#${id})`;
  }

  async export(format: 'png' | 'svg' | 'jpeg'): Promise<Blob | string> {
    if (format === 'svg') {
      // Canvas can't natively export SVG, return a data URL instead
      return this.canvas.toDataURL('image/png');
    }

    return new Promise<Blob>((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
        format === 'jpeg' ? 'image/jpeg' : 'image/png',
        0.95,
      );
    });
  }

  // ---- Internal ----

  private applyStyle(style?: DrawStyle): void {
    this.ctx.save();
    if (style?.fill) {
      // Resolve SVG-style url(#id) gradient references from the instance cache
      if (style.fill.startsWith('url(#')) {
        const gradId = style.fill.slice(5, -1);
        const cached = this.gradientCache.get(gradId);
        this.ctx.fillStyle = cached ?? style.fill;
      } else {
        this.ctx.fillStyle = style.fill;
      }
      if (style.fillOpacity !== undefined) {
        // Apply fill opacity by converting fillStyle to rgba
        this.ctx.globalAlpha = (style.opacity ?? 1) * style.fillOpacity;
      }
    }
    if (style?.stroke) {
      this.ctx.strokeStyle = style.stroke;
      if (style.strokeOpacity !== undefined) {
        // Canvas doesn't have separate fill/stroke opacity.
        // We store strokeOpacity and apply it around stroke() calls if needed.
        // For simple cases, we use the lower of the two as globalAlpha.
        const baseAlpha = style.opacity ?? 1;
        if (style.fillOpacity === undefined) {
          this.ctx.globalAlpha = baseAlpha * style.strokeOpacity;
        }
      }
    }
    if (style?.strokeWidth) this.ctx.lineWidth = style.strokeWidth;
    if (style?.opacity !== undefined && style?.fillOpacity === undefined && style?.strokeOpacity === undefined) {
      this.ctx.globalAlpha = style.opacity;
    }
    if (style?.dashArray) this.ctx.setLineDash(style.dashArray);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number, style?: DrawStyle): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    if (style?.fill) this.ctx.fill();
    if (style?.stroke) this.ctx.stroke();
  }
}
