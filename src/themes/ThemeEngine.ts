// ============================================================================
// RiskLab Charts — Theme Engine
// Manages theme resolution, merging, and integration with UI frameworks
// ============================================================================

import type { ThemeConfig } from '../core/types';
import { registry } from '../core/Registry';
import { defaultTheme } from './defaultTheme';
import { darkTheme } from './darkTheme';

/** Recursively makes all properties optional */
type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

/**
 * Resolve a theme from an id, partial config, or full config.
 * Merges with the default theme to fill gaps.
 */
export function resolveTheme(theme?: string | DeepPartial<ThemeConfig>): ThemeConfig {
  if (!theme) return defaultTheme;

  if (typeof theme === 'string') {
    const found = registry.getTheme(theme);
    if (!found) {
      console.warn(`[RiskLab] Unknown theme "${theme}" — falling back to default. Did you register it with createTheme()?`);
    }
    return found ?? defaultTheme;
  }

  // Merge partial with default
  return deepMerge(defaultTheme, theme as Partial<ThemeConfig>) as ThemeConfig;
}

/**
 * Create a custom theme by extending an existing one.
 */
export function createTheme(
  id: string,
  name: string,
  base: string | ThemeConfig,
  overrides: Partial<ThemeConfig>,
): ThemeConfig {
  const baseTheme = typeof base === 'string' ? resolveTheme(base) : base;
  const merged = deepMerge(baseTheme, { ...overrides, id, name } as Partial<ThemeConfig>) as ThemeConfig;
  registry.registerTheme(merged);
  return merged;
}

/**
 * Get a color from the palette for a given series index.
 * Cycles through the palette if more series than colors.
 */
export function getSeriesColor(theme: ThemeConfig, index: number): string {
  return theme.palette[index % theme.palette.length] ?? '#4F46E5';
}

/**
 * Generate a high-contrast version of a theme (for accessibility).
 */
export function createHighContrastTheme(base: ThemeConfig): ThemeConfig {
  return createTheme(`${base.id}-hc`, `${base.name} (High Contrast)`, base, {
    palette: [
      '#0000FF', '#FF0000', '#00AA00', '#FF8800', '#AA00AA',
      '#00AAAA', '#888800', '#FF00FF', '#008888', '#884400',
    ],
    axis: {
      lineColor: base.backgroundColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
      gridColor: base.backgroundColor === '#FFFFFF' ? '#CCCCCC' : '#444444',
      labelColor: base.backgroundColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
      titleColor: base.backgroundColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
    },
  });
}

// ---- Utility ----

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target } as Record<string, unknown>;
  const src = source as Record<string, unknown>;
  const tgt = target as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    if (
      src[key] &&
      typeof src[key] === 'object' &&
      !Array.isArray(src[key]) &&
      tgt[key] &&
      typeof tgt[key] === 'object'
    ) {
      output[key] = deepMerge(tgt[key] as Record<string, unknown>, src[key] as Record<string, unknown>);
    } else if (src[key] !== undefined) {
      output[key] = src[key];
    }
  }
  return output as T;
}

// ---- Pre-register built-in themes so resolveTheme('default') / resolveTheme('dark') work ----
registry.registerTheme(defaultTheme);
registry.registerTheme(darkTheme);

export { defaultTheme, darkTheme, deepMerge };
