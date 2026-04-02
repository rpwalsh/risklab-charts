// ============================================================================
// Palettes — Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  palettes,
  getPalette,
  paletteToTheme,
  listPalettesByCategory,
  getAllThemes,
  type PalettePair,
} from '../../src/themes/palettes';

describe('Palettes', () => {
  it('should define at least 50 palettes', () => {
    expect(palettes.length).toBeGreaterThanOrEqual(50);
  });

  it('every palette should have unique id', () => {
    const ids = palettes.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every palette should have 12 colors in light and dark', () => {
    for (const p of palettes) {
      expect(p.light.palette).toHaveLength(12);
      expect(p.dark.palette).toHaveLength(12);
    }
  });

  it('every color should be a valid hex string', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const p of palettes) {
      for (const color of [...p.light.palette, ...p.dark.palette]) {
        expect(color).toMatch(hexRegex);
      }
    }
  });

  it('every palette should have all required PaletteDef fields', () => {
    const requiredFields = [
      'palette', 'background', 'surface', 'text',
      'textSecondary', 'grid', 'axis', 'tooltipBg',
      'tooltipText', 'tooltipBorder',
    ];
    for (const p of palettes) {
      for (const field of requiredFields) {
        expect(p.light).toHaveProperty(field);
        expect(p.dark).toHaveProperty(field);
      }
    }
  });
});

describe('getPalette', () => {
  it('should find palette by id', () => {
    const p = getPalette('midnight-pro');
    expect(p).toBeDefined();
    expect(p!.name).toBe('Midnight Pro');
  });

  it('should return undefined for non-existent id', () => {
    expect(getPalette('does-not-exist')).toBeUndefined();
  });
});

describe('paletteToTheme', () => {
  it('should produce a valid ThemeConfig for light mode', () => {
    const pair = getPalette('dracula')!;
    const theme = paletteToTheme(pair, 'light');

    expect(theme.id).toBe('dracula-light');
    expect(theme.name).toContain('Light');
    expect(theme.palette).toHaveLength(12);
    expect(theme.backgroundColor).toBeDefined();
    expect(theme.axis).toBeDefined();
    expect(theme.tooltip).toBeDefined();
    expect(theme.legend).toBeDefined();
  });

  it('should produce a valid ThemeConfig for dark mode', () => {
    const pair = getPalette('dracula')!;
    const theme = paletteToTheme(pair, 'dark');

    expect(theme.id).toBe('dracula-dark');
    expect(theme.name).toContain('Dark');
    expect(theme.palette).toBe(pair.dark.palette);
  });

  it('should set fontFamily', () => {
    const pair = getPalette('nord')!;
    const theme = paletteToTheme(pair, 'light');
    expect(theme.fontFamily).toBeDefined();
    expect(typeof theme.fontFamily).toBe('string');
  });
});

describe('listPalettesByCategory', () => {
  it('should filter by corporate category', () => {
    const corp = listPalettesByCategory('corporate');
    expect(corp.length).toBeGreaterThan(0);
    for (const p of corp) {
      expect(p.category).toBe('corporate');
    }
  });

  it('should filter by neon category', () => {
    const neons = listPalettesByCategory('neon');
    expect(neons.length).toBeGreaterThan(0);
    for (const p of neons) {
      expect(p.category).toBe('neon');
    }
  });

  it('should return empty for invalid category', () => {
    const empty = listPalettesByCategory('nonexistent' as any);
    expect(empty).toHaveLength(0);
  });
});

describe('getAllThemes', () => {
  it('should return N × 2 themes (light + dark per palette)', () => {
    const themes = getAllThemes();
    expect(themes).toHaveLength(palettes.length * 2);
  });

  it('every theme should have an id and a palette', () => {
    for (const t of getAllThemes()) {
      expect(t.id).toBeDefined();
      expect(t.palette.length).toBeGreaterThan(0);
    }
  });
});
