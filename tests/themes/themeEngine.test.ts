import { describe, it, expect } from 'vitest';
import { resolveTheme, createTheme, getSeriesColor, createHighContrastTheme } from '../../src/themes/ThemeEngine';
import { defaultTheme } from '../../src/themes/defaultTheme';
import { darkTheme } from '../../src/themes/darkTheme';

// NOTE: Theme structure is FLAT — no nested `colors`/`typography`.
//   Use: theme.backgroundColor, theme.textColor, theme.palette, theme.fontFamily, theme.fontSize

// ── resolveTheme ──────────────────────────────────────────────────────────────

describe('resolveTheme', () => {
  it('returns a defined theme when called with no arguments', () => {
    const theme = resolveTheme();
    expect(theme).toBeDefined();
    expect(theme.palette).toBeDefined();
    expect(theme.backgroundColor).toBeDefined();
  });

  it('returns full default theme when passed "default" id', () => {
    const theme = resolveTheme('default');
    expect(theme.backgroundColor).toBe(defaultTheme.backgroundColor);
  });

  it('returns dark theme for "dark" id', () => {
    const theme = resolveTheme('dark');
    expect(theme.backgroundColor).toBe(darkTheme.backgroundColor);
  });

  it('merges partial override (backgroundColor) with default', () => {
    const theme = resolveTheme({ backgroundColor: '#123456' });
    expect(theme.backgroundColor).toBe('#123456');
    expect(theme.textColor).toBe(defaultTheme.textColor);
  });

  it('partial fontFamily override preserves fontSize from default', () => {
    const theme = resolveTheme({ fontFamily: 'Courier New' });
    expect(theme.fontFamily).toBe('Courier New');
    expect(theme.fontSize).toBe(defaultTheme.fontSize);
  });

  it('deep merge preserves sibling keys', () => {
    const theme = resolveTheme({ backgroundColor: '#aabbcc' });
    expect(theme.textColor).toBeDefined();
    expect(theme.backgroundColor).toBe('#aabbcc');
  });
});

// ── createTheme ───────────────────────────────────────────────────────────────

describe('createTheme', () => {
  it('creates a theme with given id and name', () => {
    const theme = createTheme('ocean', 'Ocean', 'default', {
      backgroundColor: '#001e3c',
    });
    expect(theme.id).toBe('ocean');
    expect(theme.name).toBe('Ocean');
  });

  it('flat overrides are applied on top of base', () => {
    const theme = createTheme('ocean-dark', 'Ocean Dark', 'default', {
      backgroundColor: '#001e3c',
    });
    expect(theme.backgroundColor).toBe('#001e3c');
  });

  it('inherits everything not overridden from default base', () => {
    const theme = createTheme('inherit-test', 'Inherit', 'default', {});
    expect(theme.fontSize).toBe(defaultTheme.fontSize);
    expect(theme.palette).toEqual(defaultTheme.palette);
  });

  it('can base on dark theme and keep its background', () => {
    const theme = createTheme('midnight', 'Midnight', 'dark', {
      textColor: '#FF00FF',
    });
    expect(theme.backgroundColor).toBe(darkTheme.backgroundColor);
    expect(theme.textColor).toBe('#FF00FF');
  });

  it('registers and is retrievable via resolveTheme', () => {
    createTheme('test-reg-unique', 'Registered', 'default', {});
    const resolved = resolveTheme('test-reg-unique');
    expect(resolved).toBeDefined();
    expect(resolved.id).toBe('test-reg-unique');
  });

  it('returns a valid ThemeConfig shape', () => {
    const theme = createTheme('shape-test', 'Shape', 'default', {});
    expect(Array.isArray(theme.palette)).toBe(true);
    expect(typeof theme.backgroundColor).toBe('string');
    expect(typeof theme.textColor).toBe('string');
  });
});

// ── getSeriesColor ────────────────────────────────────────────────────────────

describe('getSeriesColor', () => {
  it('returns a string color', () => {
    const color = getSeriesColor(defaultTheme, 0);
    expect(typeof color).toBe('string');
    expect(color.length).toBeGreaterThan(0);
  });

  it('returns different colors for consecutive indices', () => {
    const c0 = getSeriesColor(defaultTheme, 0);
    const c1 = getSeriesColor(defaultTheme, 1);
    expect(c0).not.toBe(c1);
  });

  it('cycles back after palette length', () => {
    const paletteLen = defaultTheme.palette.length;
    const c0 = getSeriesColor(defaultTheme, 0);
    const cN = getSeriesColor(defaultTheme, paletteLen);
    expect(c0).toBe(cN);
  });

  it('works with dark theme', () => {
    const color = getSeriesColor(darkTheme, 0);
    expect(typeof color).toBe('string');
    expect(color.length).toBeGreaterThan(0);
  });

  it('index 0 returns first palette color', () => {
    const c0 = getSeriesColor(defaultTheme, 0);
    expect(c0).toBe(defaultTheme.palette[0]);
  });

  it('large index wraps around correctly', () => {
    const len = defaultTheme.palette.length;
    const cWrapped = getSeriesColor(defaultTheme, len * 3 + 2);
    const cDirect = getSeriesColor(defaultTheme, 2);
    expect(cWrapped).toBe(cDirect);
  });
});

// ── createHighContrastTheme ───────────────────────────────────────────────────

describe('createHighContrastTheme', () => {
  it('returns a defined theme', () => {
    const theme = createHighContrastTheme(defaultTheme);
    expect(theme).toBeDefined();
    expect(theme.palette).toBeDefined();
  });

  it('palette differs from base palette (high contrast colors)', () => {
    const theme = createHighContrastTheme(defaultTheme);
    expect(theme.palette.length).toBeGreaterThan(0);
    expect(theme.palette[0]).not.toBe(defaultTheme.palette[0]);
  });

  it('can be created from dark theme', () => {
    const hcTheme = createHighContrastTheme(darkTheme);
    expect(Array.isArray(hcTheme.palette)).toBe(true);
    expect(hcTheme.palette.length).toBeGreaterThan(0);
  });

  it('id is derived from base theme id', () => {
    const hcTheme = createHighContrastTheme(defaultTheme);
    expect(hcTheme.id).toContain(defaultTheme.id);
  });
});

// ── deepMerge behaviour (via resolveTheme) ────────────────────────────────────

describe('deep merge semantics', () => {
  it('does not mutate original defaults', () => {
    const origBg = defaultTheme.backgroundColor;
    resolveTheme({ backgroundColor: '#mutated' });
    expect(defaultTheme.backgroundColor).toBe(origBg);
  });

  it('replaces array values outright (does not concat palette)', () => {
    const theme = resolveTheme({ palette: ['#aabbcc'] });
    expect(theme.palette).toEqual(['#aabbcc']);
  });

  it('handles flat fontFamily override while preserving fontSize', () => {
    const theme = resolveTheme({ fontFamily: 'Courier New' });
    expect(theme.fontFamily).toBe('Courier New');
    expect(theme.fontSize).toBe(defaultTheme.fontSize);
  });

  it('handles axis nested key override', () => {
    const theme = resolveTheme({ axis: { lineColor: '#ff0000' } });
    expect((theme.axis as any).lineColor).toBe('#ff0000');
    expect((theme.axis as any).gridColor).toBeDefined();
  });
});
