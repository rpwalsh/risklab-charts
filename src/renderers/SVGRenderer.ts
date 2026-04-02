// ============================================================================
// RiskLab Charts — SVG Renderer
// Full SVG rendering backend with DOM element creation and management
// ============================================================================

import { BaseRenderer, type DrawStyle } from './BaseRenderer';
import { sanitizeSVG } from '../utils/sanitize';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SVGRenderer extends BaseRenderer {
  private svg: SVGSVGElement;
  private defs: SVGDefsElement;
  private groupStack: SVGElement[] = [];
  private currentParent: SVGElement;

  constructor(container: HTMLElement, width: number, height: number) {
    super(container, width, height);

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('xmlns', SVG_NS);
    this.svg.setAttribute('width', String(width));
    this.svg.setAttribute('height', String(height));
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.style.overflow = 'visible';
    this.svg.style.userSelect = 'none';
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'RiskLab Chart');

    this.defs = document.createElementNS(SVG_NS, 'defs');
    this.svg.appendChild(this.defs);

    this.currentParent = this.svg;
    container.appendChild(this.svg);
  }

  clear(): void {
    // Remove all children except defs
    while (this.svg.lastChild && this.svg.lastChild !== this.defs) {
      this.svg.removeChild(this.svg.lastChild);
    }
    // Clear defs
    while (this.defs.lastChild) {
      this.defs.removeChild(this.defs.lastChild);
    }
    this.currentParent = this.svg;
    this.groupStack = [];
  }

  destroy(): void {
    this.svg.remove();
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.svg.setAttribute('width', String(width));
    this.svg.setAttribute('height', String(height));
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  // ---- Primitives ----

  drawRect(
    x: number, y: number, w: number, h: number,
    style?: DrawStyle, rx?: number, ry?: number,
  ): void {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(Math.max(0, w)));
    rect.setAttribute('height', String(Math.max(0, h)));
    if (rx) rect.setAttribute('rx', String(rx));
    if (ry) rect.setAttribute('ry', String(ry));
    this.applyStyle(rect, style);
    this.currentParent.appendChild(rect);
  }

  drawCircle(cx: number, cy: number, r: number, style?: DrawStyle): void {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(r));
    this.applyStyle(circle, style);
    this.currentParent.appendChild(circle);
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, style?: DrawStyle): void {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    this.applyStyle(line, {
      stroke: style?.stroke ?? style?.fill ?? '#333',
      strokeWidth: style?.strokeWidth ?? 1,
      ...style,
    });
    this.currentParent.appendChild(line);
  }

  drawPath(d: string, style?: DrawStyle): void {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    this.applyStyle(path, style);
    this.currentParent.appendChild(path);
  }

  drawText(x: number, y: number, text: string, style?: DrawStyle): void {
    const el = document.createElementNS(SVG_NS, 'text');
    el.setAttribute('x', String(x));
    el.setAttribute('y', String(y));
    el.textContent = text;
    this.applyStyle(el, style);
    this.currentParent.appendChild(el);
  }

  drawPolygon(points: Array<[number, number]>, style?: DrawStyle): void {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', points.map(([px, py]) => `${px},${py}`).join(' '));
    this.applyStyle(polygon, style);
    this.currentParent.appendChild(polygon);
  }

  drawArc(
    cx: number, cy: number, innerR: number, outerR: number,
    startAngle: number, endAngle: number, style?: DrawStyle,
  ): void {
    const d = this.buildArcPath(cx, cy, innerR, outerR, startAngle, endAngle);
    this.drawPath(d, style);
  }

  // ---- Grouping ----

  beginGroup(id?: string, className?: string, transform?: string): void {
    const g = document.createElementNS(SVG_NS, 'g');
    if (id) g.setAttribute('id', id);
    if (className) g.setAttribute('class', className);
    if (transform) g.setAttribute('transform', transform);
    this.currentParent.appendChild(g);
    this.groupStack.push(this.currentParent);
    this.currentParent = g;
  }

  endGroup(): void {
    const parent = this.groupStack.pop();
    if (parent) this.currentParent = parent;
  }

  // ---- Clip paths ----

  defineClipRect(id: string, x: number, y: number, w: number, h: number): void {
    const clipPath = document.createElementNS(SVG_NS, 'clipPath');
    clipPath.setAttribute('id', id);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    clipPath.appendChild(rect);
    this.defs.appendChild(clipPath);
  }

  // ---- Gradients ----

  defineLinearGradient(
    id: string, x1: number, y1: number, x2: number, y2: number,
    stops: Array<{ offset: number; color: string; opacity?: number }>,
  ): void {
    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', id);
    grad.setAttribute('x1', String(x1));
    grad.setAttribute('y1', String(y1));
    grad.setAttribute('x2', String(x2));
    grad.setAttribute('y2', String(y2));

    for (const s of stops) {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', `${s.offset * 100}%`);
      stop.setAttribute('stop-color', s.color);
      if (s.opacity !== undefined) stop.setAttribute('stop-opacity', String(s.opacity));
      grad.appendChild(stop);
    }

    this.defs.appendChild(grad);
  }

  // ---- Events ----

  attachEvent(elementId: string, event: string, handler: (e: Event) => void): void {
    const el = this.svg.querySelector(`#${elementId}`);
    el?.addEventListener(event, handler);
  }

  // ---- Export ----

  async export(format: 'png' | 'svg' | 'jpeg'): Promise<Blob | string> {
    if (format === 'svg') {
      const serializer = new XMLSerializer();
      return serializer.serializeToString(this.svg);
    }

    // Raster export via canvas
    const canvas = document.createElement('canvas');
    const scale = 2; // 2x resolution
    canvas.width = this.width * scale;
    canvas.height = this.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    const svgString = new XMLSerializer().serializeToString(this.svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    return new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
          format === 'jpeg' ? 'image/jpeg' : 'image/png',
          0.95,
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ---- Image & raw SVG ----

  drawImage(href: string, x: number, y: number, width: number, height: number): void {
    const img = document.createElementNS(SVG_NS, 'image');
    img.setAttribute('href', href);
    img.setAttribute('x', String(x));
    img.setAttribute('y', String(y));
    img.setAttribute('width', String(width));
    img.setAttribute('height', String(height));
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.currentParent.appendChild(img);
  }

  drawRawSVG(svgContent: string, x: number, y: number): void {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${x},${y})`);
    g.innerHTML = sanitizeSVG(svgContent);
    this.currentParent.appendChild(g);
  }

  // ---- Patterns ----

  /**
   * Define a named SVG <pattern> and return its id for use as fill: url(#id).
   * type: 'lines'|'dots'|'crosses'|'diagonal'|'grid'|'custom'
   */
  definePattern(
    id: string,
    type: 'lines' | 'dots' | 'crosses' | 'diagonal' | 'grid' | 'checker' | 'custom',
    color: string = '#333',
    bgColor: string = 'transparent',
    size: number = 8,
    customSVG?: string,
  ): string {
    const existing = this.defs.querySelector(`#${id}`);
    if (existing) return `url(#${id})`;

    const pat = document.createElementNS(SVG_NS, 'pattern');
    pat.setAttribute('id', id);
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('width', String(size));
    pat.setAttribute('height', String(size));

    // Background
    if (bgColor !== 'transparent') {
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('width', String(size));
      bg.setAttribute('height', String(size));
      bg.setAttribute('fill', bgColor);
      pat.appendChild(bg);
    }

    const half = size / 2;

    switch (type) {
      case 'lines': {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
        line.setAttribute('x2', '0'); line.setAttribute('y2', String(size));
        line.setAttribute('stroke', color); line.setAttribute('stroke-width', '1');
        pat.appendChild(line);
        break;
      }
      case 'diagonal': {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', `M-1,1 l2,-2 M0,${size} l${size},-${size} M${size - 1},${size + 1} l2,-2`);
        path.setAttribute('stroke', color); path.setAttribute('stroke-width', '1.5');
        path.setAttribute('fill', 'none');
        pat.appendChild(path);
        break;
      }
      case 'dots': {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(half)); circle.setAttribute('cy', String(half));
        circle.setAttribute('r', String(size / 6)); circle.setAttribute('fill', color);
        pat.appendChild(circle);
        break;
      }
      case 'crosses': {
        const path = document.createElementNS(SVG_NS, 'path');
        const s = size;
        path.setAttribute('d', `M${half},0 V${s} M0,${half} H${s}`);
        path.setAttribute('stroke', color); path.setAttribute('stroke-width', '1');
        pat.appendChild(path);
        break;
      }
      case 'grid': {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', `M0,0 H${size} V${size} H0 Z`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color); path.setAttribute('stroke-width', '0.5');
        pat.appendChild(path);
        break;
      }
      case 'checker': {
        const s2 = size / 2;
        for (const [rx, ry] of [[0, 0], [s2, s2]] as [number, number][]) {
          const rect = document.createElementNS(SVG_NS, 'rect');
          rect.setAttribute('x', String(rx)); rect.setAttribute('y', String(ry));
          rect.setAttribute('width', String(s2)); rect.setAttribute('height', String(s2));
          rect.setAttribute('fill', color);
          pat.appendChild(rect);
        }
        break;
      }
      case 'custom': {
        if (customSVG) {
          const g = document.createElementNS(SVG_NS, 'g');
          g.innerHTML = sanitizeSVG(customSVG);
          pat.appendChild(g);
        }
        break;
      }
    }

    this.defs.appendChild(pat);
    return `url(#${id})`;
  }

  // ---- Radial Gradient ----

  defineRadialGradient(
    id: string,
    cx: number, cy: number, r: number,
    stops: Array<{ offset: number; color: string; opacity?: number }>,
  ): string {
    const existing = this.defs.querySelector(`#${id}`);
    if (existing) return `url(#${id})`;

    const grad = document.createElementNS(SVG_NS, 'radialGradient');
    grad.setAttribute('id', id);
    grad.setAttribute('cx', String(cx));
    grad.setAttribute('cy', String(cy));
    grad.setAttribute('r', String(r));
    grad.setAttribute('gradientUnits', 'objectBoundingBox');

    for (const s of stops) {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', `${s.offset * 100}%`);
      stop.setAttribute('stop-color', s.color);
      if (s.opacity !== undefined) stop.setAttribute('stop-opacity', String(s.opacity));
      grad.appendChild(stop);
    }

    this.defs.appendChild(grad);
    return `url(#${id})`;
  }

  // ---- Internal ----

  private applyStyle(el: SVGElement, style?: DrawStyle): void {
    if (!style) return;
    if (style.fill) el.setAttribute('fill', style.fill);
    else if (el.tagName !== 'text') el.setAttribute('fill', 'none');
    if (style.stroke) el.setAttribute('stroke', style.stroke);
    if (style.strokeWidth) el.setAttribute('stroke-width', String(style.strokeWidth));
    if (style.opacity !== undefined) el.setAttribute('opacity', String(style.opacity));
    if (style.fillOpacity !== undefined) el.setAttribute('fill-opacity', String(style.fillOpacity));
    if (style.strokeOpacity !== undefined) el.setAttribute('stroke-opacity', String(style.strokeOpacity));
    if (style.dashArray) el.setAttribute('stroke-dasharray', style.dashArray.join(','));
    if (style.fontSize) el.setAttribute('font-size', String(style.fontSize));
    if (style.fontFamily) el.setAttribute('font-family', style.fontFamily);
    if (style.fontWeight) el.setAttribute('font-weight', String(style.fontWeight));
    if (style.textAnchor) el.setAttribute('text-anchor', style.textAnchor);
    if (style.dominantBaseline) el.setAttribute('dominant-baseline', style.dominantBaseline);
    if (style.cursor) el.style.cursor = style.cursor;
    if (style.className) el.setAttribute('class', style.className);
    if (style.id) el.setAttribute('id', style.id);
    if (style.clipPath) el.setAttribute('clip-path', `url(#${style.clipPath})`);
    if (style.transform) el.setAttribute('transform', style.transform);
    if (style.filter) el.setAttribute('filter', style.filter);
    if (style.pointerEvents) el.setAttribute('pointer-events', style.pointerEvents);
  }

  private buildArcPath(
    cx: number, cy: number, innerR: number, outerR: number,
    startAngle: number, endAngle: number,
  ): string {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const sa = toRad(startAngle - 90);
    const ea = toRad(endAngle - 90);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    const outerX1 = cx + outerR * Math.cos(sa);
    const outerY1 = cy + outerR * Math.sin(sa);
    const outerX2 = cx + outerR * Math.cos(ea);
    const outerY2 = cy + outerR * Math.sin(ea);

    const innerX1 = cx + innerR * Math.cos(ea);
    const innerY1 = cy + innerR * Math.sin(ea);
    const innerX2 = cx + innerR * Math.cos(sa);
    const innerY2 = cy + innerR * Math.sin(sa);

    if (innerR === 0) {
      return [
        `M${outerX1},${outerY1}`,
        `A${outerR},${outerR},0,${largeArc},1,${outerX2},${outerY2}`,
        `L${cx},${cy}`,
        'Z',
      ].join('');
    }

    return [
      `M${outerX1},${outerY1}`,
      `A${outerR},${outerR},0,${largeArc},1,${outerX2},${outerY2}`,
      `L${innerX1},${innerY1}`,
      `A${innerR},${innerR},0,${largeArc},0,${innerX2},${innerY2}`,
      'Z',
    ].join('');
  }
}
