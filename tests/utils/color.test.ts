import { describe, it, expect } from 'vitest';
import {
  hexToRGB,
  rgbToHex,
  interpolateColor,
  withAlpha,
  lighten,
  darken,
  luminance,
  contrastRatio,
  textColorForBg,
  generatePalette,
} from '../../src/utils/color';

// ── hexToRGB ──────────────────────────────────────────────────────────────────

describe('hexToRGB', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRGB('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRGB('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRGB('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRGB('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRGB('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses without leading #', () => {
    expect(hexToRGB('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses 3-digit shorthand', () => {
    expect(hexToRGB('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRGB('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRGB('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('is case-insensitive', () => {
    expect(hexToRGB('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRGB('#ABC')).toEqual(hexToRGB('#abc'));
  });
});

// ── rgbToHex ──────────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts primary colors', () => {
    expect(rgbToHex(255, 0, 0).toLowerCase()).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0).toLowerCase()).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255).toLowerCase()).toBe('#0000ff');
  });

  it('converts white and black', () => {
    expect(rgbToHex(255, 255, 255).toLowerCase()).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0).toLowerCase()).toBe('#000000');
  });

  it('round-trips with hexToRGB', () => {
    const hex = '#4a90e2';
    const { r, g, b } = hexToRGB(hex);
    expect(rgbToHex(r, g, b).toLowerCase()).toBe(hex);
  });

  it('pads single-digit hex components', () => {
    expect(rgbToHex(1, 1, 1).toLowerCase()).toBe('#010101');
  });
});

// ── withAlpha ─────────────────────────────────────────────────────────────────

describe('withAlpha', () => {
  it('returns rgba string', () => {
    const result = withAlpha('#ff0000', 0.5);
    expect(result).toContain('rgba');
    expect(result).toContain('255');
    expect(result).toContain('0.5');
  });

  it('alpha 1 produces opaque color', () => {
    const result = withAlpha('#ff0000', 1);
    expect(result).toContain('1)');
  });

  it('alpha 0 produces fully transparent', () => {
    const result = withAlpha('#ffffff', 0);
    // withAlpha produces rgba(r,g,b,a) with no spaces — match ,0) or , 0)
    expect(result).toMatch(/,\s*0\)$/);
  });
});

// ── interpolateColor ──────────────────────────────────────────────────────────

describe('interpolateColor', () => {
  it('t=0 returns start color', () => {
    const start = '#ff0000';
    const end = '#0000ff';
    const result = interpolateColor(start, end, 0).toLowerCase();
    expect(result).toBe('#ff0000');
  });

  it('t=1 returns end color', () => {
    const start = '#ff0000';
    const end = '#0000ff';
    const result = interpolateColor(start, end, 1).toLowerCase();
    expect(result).toBe('#0000ff');
  });

  it('t=0.5 returns midpoint', () => {
    const result = hexToRGB(interpolateColor('#000000', '#ffffff', 0.5));
    expect(result.r).toBeCloseTo(128, -1);
    expect(result.g).toBeCloseTo(128, -1);
    expect(result.b).toBeCloseTo(128, -1);
  });

  it('interpolates between two distinct colors', () => {
    const mid = interpolateColor('#ff0000', '#00ff00', 0.5);
    const { r, g, b } = hexToRGB(mid);
    expect(r).toBeGreaterThan(0);
    expect(g).toBeGreaterThan(0);
    expect(b).toBe(0);
  });
});

// ── lighten / darken ──────────────────────────────────────────────────────────

describe('lighten', () => {
  it('lightened color has higher average channel value', () => {
    const original = hexToRGB('#336699');
    const lightened = hexToRGB(lighten('#336699', 0.2));
    const origAvg = (original.r + original.g + original.b) / 3;
    const lightAvg = (lightened.r + lightened.g + lightened.b) / 3;
    expect(lightAvg).toBeGreaterThan(origAvg);
  });

  it('amount=0 returns approximately same color', () => {
    const result = lighten('#336699', 0);
    const orig = hexToRGB('#336699');
    const res = hexToRGB(result);
    expect(Math.abs(res.r - orig.r)).toBeLessThanOrEqual(1);
  });

  it('does not exceed #ffffff', () => {
    const result = hexToRGB(lighten('#dddddd', 1));
    expect(result.r).toBeLessThanOrEqual(255);
    expect(result.g).toBeLessThanOrEqual(255);
    expect(result.b).toBeLessThanOrEqual(255);
  });
});

describe('darken', () => {
  it('darkened color has lower average channel value', () => {
    const original = hexToRGB('#aabbcc');
    const darkened = hexToRGB(darken('#aabbcc', 0.2));
    const origAvg = (original.r + original.g + original.b) / 3;
    const darkAvg = (darkened.r + darkened.g + darkened.b) / 3;
    expect(darkAvg).toBeLessThan(origAvg);
  });

  it('does not go below #000000', () => {
    const result = hexToRGB(darken('#111111', 1));
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.g).toBeGreaterThanOrEqual(0);
    expect(result.b).toBeGreaterThanOrEqual(0);
  });
});

// ── luminance ─────────────────────────────────────────────────────────────────

describe('luminance', () => {
  it('white has luminance 1', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 2);
  });

  it('black has luminance 0', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 2);
  });

  it('mid-grey has luminance around 0.2', () => {
    // #808080 ≈ 0.216
    expect(luminance('#808080')).toBeGreaterThan(0.1);
    expect(luminance('#808080')).toBeLessThan(0.4);
  });

  it('luminance is always in [0, 1]', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#ffff00', '#00ffff'];
    for (const c of colors) {
      const l = luminance(c);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });
});

// ── contrastRatio ─────────────────────────────────────────────────────────────

describe('contrastRatio', () => {
  it('white on black has maximum contrast ratio (21:1)', () => {
    const ratio = contrastRatio('#ffffff', '#000000');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('same color has ratio 1', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 1);
  });

  it('WCAG AA requires ratio >= 4.5 for normal text', () => {
    // Black text on white background
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('is symmetric', () => {
    const a = contrastRatio('#ff6600', '#ffffff');
    const b = contrastRatio('#ffffff', '#ff6600');
    expect(a).toBeCloseTo(b, 5);
  });
});

// ── textColorForBg ────────────────────────────────────────────────────────────

describe('textColorForBg', () => {
  it('dark background returns white text', () => {
    expect(textColorForBg('#000000')).toBe('#FFFFFF');
    expect(textColorForBg('#1a1a2e')).toBe('#FFFFFF');
  });

  it('light background returns black text', () => {
    expect(textColorForBg('#ffffff')).toBe('#000000');
    expect(textColorForBg('#f5f5f5')).toBe('#000000');
  });
});

// ── generatePalette ───────────────────────────────────────────────────────────

describe('generatePalette', () => {
  it('returns N colors', () => {
    expect(generatePalette(5)).toHaveLength(5);
    expect(generatePalette(10)).toHaveLength(10);
  });

  it('all colors are valid hex strings', () => {
    const palette = generatePalette(8);
    for (const c of palette) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('colors are evenly distributed (no duplicates)', () => {
    const palette = generatePalette(12);
    const unique = new Set(palette.map(c => c.toLowerCase()));
    expect(unique.size).toBe(12);
  });

  it('custom saturation/lightness are applied', () => {
    const p1 = generatePalette(1, 70, 55);
    const p2 = generatePalette(1, 40, 30);
    // Different parameters → different colors
    expect(p1[0]!.toLowerCase()).not.toBe(p2[0]!.toLowerCase());
  });
});
