// ============================================================================
// RiskLab Charts — Color Utilities
// Color parsing, interpolation, contrast, and palette generation
// ============================================================================

/**
 * Parse a hex color into RGB components.
 */
export function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Convert RGB to hex string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Interpolate between two hex colors.
 * @param t - 0 to 1
 */
export function interpolateColor(from: string, to: string, t: number): string {
  const f = hexToRGB(from);
  const tColor = hexToRGB(to);
  return rgbToHex(
    f.r + (tColor.r - f.r) * t,
    f.g + (tColor.g - f.g) * t,
    f.b + (tColor.b - f.b) * t,
  );
}

/**
 * Add alpha to a hex color, returning rgba() string.
 */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRGB(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Lighten a color by a percentage.
 */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRGB(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

/**
 * Darken a color by a percentage.
 */
export function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRGB(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * Get the relative luminance of a color (for contrast calculations).
 */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRGB(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

/**
 * Get contrast ratio between two colors.
 */
export function contrastRatio(color1: string, color2: string): number {
  const l1 = luminance(color1);
  const l2 = luminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if text should be white or black given a background color.
 */
export function textColorForBg(bgHex: string): string {
  return luminance(bgHex) > 0.179 ? '#000000' : '#FFFFFF';
}

/**
 * Generate a palette of N evenly-spaced colors around the hue wheel.
 */
export function generatePalette(count: number, saturation = 70, lightness = 55): string[] {
  const palette: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count;
    palette.push(hslToHex(hue, saturation, lightness));
  }
  return palette;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
