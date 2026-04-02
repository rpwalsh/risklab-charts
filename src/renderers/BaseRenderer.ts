// ============================================================================
// RiskLab Charts — Base Renderer (Abstract)
// Defines the drawing API that SVG and Canvas renderers implement
// ============================================================================

export interface DrawStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  dashArray?: number[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
  textAlign?: 'left' | 'center' | 'right';
  dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'alphabetic';
  cursor?: string;
  className?: string;
  id?: string;
  clipPath?: string;
  transform?: string;
  filter?: string;
  pointerEvents?: string;
  /** Corner radius (for rects) */
  rx?: number;
  ry?: number;
}

export interface PathCommand {
  type: 'M' | 'L' | 'C' | 'Q' | 'A' | 'Z';
  values: number[];
}

/**
 * Abstract base renderer — both SVG and Canvas renderers conform to this API.
 * This allows chart types to be renderer-agnostic.
 */
export abstract class BaseRenderer {
  protected width: number;
  protected height: number;
  protected container: HTMLElement;

  constructor(container: HTMLElement, width: number, height: number) {
    this.container = container;
    this.width = width;
    this.height = height;
  }

  abstract clear(): void;
  abstract destroy(): void;
  abstract setSize(width: number, height: number): void;

  // ---- Primitives ----
  abstract drawRect(
    x: number, y: number, width: number, height: number,
    style?: DrawStyle, rx?: number, ry?: number,
  ): void;

  abstract drawCircle(
    cx: number, cy: number, r: number, style?: DrawStyle,
  ): void;

  abstract drawLine(
    x1: number, y1: number, x2: number, y2: number, style?: DrawStyle,
  ): void;

  abstract drawPath(d: string, style?: DrawStyle): void;

  abstract drawText(
    x: number, y: number, text: string, style?: DrawStyle,
  ): void;

  abstract drawPolygon(points: Array<[number, number]>, style?: DrawStyle): void;

  abstract drawArc(
    cx: number, cy: number, innerR: number, outerR: number,
    startAngle: number, endAngle: number, style?: DrawStyle,
  ): void;

  // ---- Grouping ----
  abstract beginGroup(id?: string, className?: string, transform?: string): void;
  abstract endGroup(): void;

  // ---- Clip paths ----
  abstract defineClipRect(id: string, x: number, y: number, w: number, h: number): void;
  /** Remove the most recently applied clip rect (Canvas backend) */
  removeClipRect(): void { /* SVG uses clip-path attributes, only Canvas needs restore */ }

  // ---- Gradients & Patterns ----
  abstract defineLinearGradient(
    id: string, x1: number, y1: number, x2: number, y2: number,
    stops: Array<{ offset: number; color: string; opacity?: number }>,
  ): void;

  /**
   * Define a repeating fill pattern. Returns a `url(#id)` reference string
   * that can be used as the `fill` property in a DrawStyle.
   */
  definePattern(
    _id: string,
    _type: 'lines' | 'dots' | 'crosses' | 'diagonal' | 'grid' | 'checker' | 'custom',
    _color?: string,
    _bgColor?: string,
    _size?: number,
    _customSVG?: string,
  ): string { return ''; }

  /**
   * Define a radial gradient. Returns a `url(#id)` reference string.
   */
  defineRadialGradient(
    _id: string,
    _cx: number, _cy: number, _r: number,
    _stops: Array<{ offset: number; color: string; opacity?: number }>,
  ): string { return ''; }

  // ---- Events ----
  abstract attachEvent(
    elementId: string,
    event: string,
    handler: (e: Event) => void,
  ): void;

  // ---- Export ----
  abstract export(format: 'png' | 'svg' | 'jpeg'): Promise<Blob | string>;

  // ---- Utility ----

  /**
   * Build an SVG path string for a polyline through points.
   */
  buildLinePath(
    points: Array<{ x: number; y: number }>,
    smooth: boolean = false,
  ): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;

    let d = `M${points[0]!.x},${points[0]!.y}`;

    if (!smooth) {
      for (let i = 1; i < points.length; i++) {
        d += `L${points[i]!.x},${points[i]!.y}`;
      }
    } else {
      // Catmull-Rom to Bezier conversion for smooth curves
      for (let i = 1; i < points.length; i++) {
        const p0 = points[Math.max(0, i - 2)]!;
        const p1 = points[i - 1]!;
        const p2 = points[i]!;
        const p3 = points[Math.min(points.length - 1, i + 1)]!;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
      }
    }

    return d;
  }

  /**
   * Build an area path (closed region between two lines).
   */
  buildAreaPath(
    topPoints: Array<{ x: number; y: number }>,
    bottomPoints: Array<{ x: number; y: number }>,
    smooth: boolean = false,
  ): string {
    const topPath = this.buildLinePath(topPoints, smooth);
    const reversed = [...bottomPoints].reverse();
    let d = topPath;
    if (reversed.length > 0) {
      d += `L${reversed[0]!.x},${reversed[0]!.y}`;
      for (let i = 1; i < reversed.length; i++) {
        d += `L${reversed[i]!.x},${reversed[i]!.y}`;
      }
    }
    d += 'Z';
    return d;
  }
}
