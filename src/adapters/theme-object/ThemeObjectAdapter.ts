// ============================================================================
// RiskLab Charts — theme object Theme Adapter
// Converts component design system theme tokens into RiskLab ThemeConfig
// Supports portable palette, typography, spacing, and shape contracts
// ============================================================================

import type { ThemeConfig } from '../../core/types';

// ─── Minimal application theme shape (avoids hard dep on external-theme-package) ─────────────

interface ThemePaletteColor {
  main: string;
  light?: string;
  dark?: string;
  contrastText?: string;
}

interface ThemeObjectPalette {
  mode?: 'light' | 'dark';
  primary?: ThemePaletteColor;
  secondary?: ThemePaletteColor;
  error?: ThemePaletteColor;
  warning?: ThemePaletteColor;
  info?: ThemePaletteColor;
  success?: ThemePaletteColor;
  grey?: Record<string | number, string>;
  text?: {
    primary?: string;
    secondary?: string;
    disabled?: string;
  };
  background?: {
    default?: string;
    paper?: string;
  };
  divider?: string;
  action?: {
    hover?: string;
    selected?: string;
    disabled?: string;
  };
}

interface ThemeObjectTypography {
  fontFamily?: string;
  fontSize?: number;
  h1?: { fontFamily?: string; fontSize?: string | number; fontWeight?: number };
  h2?: { fontFamily?: string; fontSize?: string | number; fontWeight?: number };
  h3?: { fontFamily?: string; fontSize?: string | number; fontWeight?: number };
  h4?: { fontFamily?: string; fontSize?: string | number; fontWeight?: number };
  h5?: { fontFamily?: string; fontSize?: string | number; fontWeight?: number };
  h6?: { fontFamily?: string; fontSize?: string | number; fontWeight?: number };
  body1?: { fontFamily?: string; fontSize?: string | number };
  body2?: { fontFamily?: string; fontSize?: string | number };
  caption?: { fontFamily?: string; fontSize?: string | number };
}

interface ThemeObjectShape {
  borderRadius?: number;
}

export interface PortableThemeObject {
  palette?: ThemeObjectPalette;
  typography?: ThemeObjectTypography;
  shape?: ThemeObjectShape;
  spacing?: (...args: number[]) => string;
}

// ─── Adapter Options ────────────────────────────────────────────────────────

export interface ThemeObjectAdapterOptions {
  /** Map additional theme object palette colors to chart series palette */
  extraColors?: string[];
  /** Use surface background instead of default */
  usePaperBackground?: boolean;
  /** Override specific chart theme properties after conversion */
  overrides?: Partial<ThemeConfig>;
}

// ─── Conversion ─────────────────────────────────────────────────────────────

/**
 * Convert a component design system theme object to a RiskLab ThemeConfig.
 *
 * ```ts
 * import { useTheme } from 'application-theme';
 * import { themeObjectToRiskLabTheme } from '@risklab/charts/theme-object';
 *
 * const themeObject = useTheme();
 * const chartTheme = themeObjectToRiskLabTheme(themeObject);
 * ```
 */
export function themeObjectToRiskLabTheme(
  themeObject: PortableThemeObject,
  options: ThemeObjectAdapterOptions = {}
): ThemeConfig {
  const { palette = {}, typography = {}, shape = {} } = themeObject;
  const { extraColors = [], usePaperBackground = false, overrides = {} } = options;

  // Build series color palette from portable semantic colors
  const seriesColors: string[] = [
    palette.primary?.main ?? '#1976d2',
    palette.secondary?.main ?? '#9c27b0',
    palette.error?.main ?? '#d32f2f',
    palette.warning?.main ?? '#ed6c02',
    palette.info?.main ?? '#0288d1',
    palette.success?.main ?? '#2e7d32',
    // Add lighter variants for more series
    palette.primary?.light ?? '#42a5f5',
    palette.secondary?.light ?? '#ba68c8',
    palette.error?.light ?? '#ef5350',
    palette.warning?.light ?? '#ff9800',
    palette.info?.light ?? '#03a9f4',
    palette.success?.light ?? '#66bb6a',
    // Darker variants
    palette.primary?.dark ?? '#1565c0',
    palette.secondary?.dark ?? '#7b1fa2',
    palette.error?.dark ?? '#c62828',
    palette.success?.dark ?? '#1b5e20',
    // Any extra user-supplied colors
    ...extraColors,
  ];

  const isDark = palette.mode === 'dark';

  const background = usePaperBackground
    ? (palette.background?.paper ?? (isDark ? '#1e1e1e' : '#ffffff'))
    : (palette.background?.default ?? (isDark ? '#121212' : '#ffffff'));

  const textPrimary = palette.text?.primary ?? (isDark ? '#ffffff' : '#212121');
  const textSecondary = palette.text?.secondary ?? (isDark ? '#b0b0b0' : '#666666');

  const fontFamily =
    typography.fontFamily ?? '"Roboto", "Helvetica", "Arial", sans-serif';

  const baseFontSize =
    typeof typography.fontSize === 'number' ? typography.fontSize : 14;

  const borderRadius = shape.borderRadius ?? 4;

  const gridColor = palette.divider ?? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)');

  const theme: ThemeConfig = {
    id: `theme-object-${isDark ? 'dark' : 'light'}`,
    name: `theme object ${isDark ? 'Dark' : 'Light'}`,
    palette: seriesColors,
    backgroundColor: background,
    textColor: textPrimary,
    fontFamily,
    fontSize: baseFontSize,
    axis: {
      lineColor: textSecondary,
      gridColor,
      labelColor: textSecondary,
      titleColor: textPrimary,
    },
    tooltip: {
      backgroundColor: isDark ? '#424242' : '#ffffff',
      borderColor: gridColor,
      textColor: textPrimary,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.25)', offsetX: 0, offsetY: 2, blur: 8 },
    },
    legend: {
      textColor: textPrimary,
      hoverColor: palette.primary?.main ?? '#1976d2',
      inactiveColor: palette.action?.disabled ?? (isDark ? '#555' : '#bdbdbd'),
    },
    tokens: {
      borderRadius,
      sourceMode: isDark ? 'dark' : 'light',
    },
    // Deep merge overrides
    ...overrides,
  };

  return theme;
}

/**
 * Creates a React hook-style adapter that watches application theme changes.
 * Call this inside a component that has access to an application theme provider.
 *
 * ```tsx
 * import { useTheme } from 'application-theme';
 * import { createChartTheme } from '@risklab/charts/theme-object';
 *
 * function MyChart() {
 *   const themeObject = useTheme();
 *   const chartTheme = createChartTheme(themeObject);
 *   return <Chart theme={chartTheme} series={...} />;
 * }
 * ```
 *
 * NOTE: This is a plain function, not a real hook. It's meant to be called
 * inside a component where `useTheme()` has already been called. The actual
 * memoization should happen with useMemo in the consuming component.
 */
export function createChartTheme(
  themeObject: PortableThemeObject,
  options?: ThemeObjectAdapterOptions
): ThemeConfig {
  return themeObjectToRiskLabTheme(themeObject, options);
}

/**
 * Maps theme object spacing function to chart padding values.
 */
export function themeSpacingToChartPadding(
  themeObject: PortableThemeObject,
  top = 2,
  right = 2,
  bottom = 2,
  left = 2
): { top: number; right: number; bottom: number; left: number } {
  const spacing = themeObject.spacing;
  if (!spacing) {
    return { top: top * 8, right: right * 8, bottom: bottom * 8, left: left * 8 };
  }
  const parse = (val: string) => parseInt(val, 10) || 0;
  return {
    top: parse(spacing(top)),
    right: parse(spacing(right)),
    bottom: parse(spacing(bottom)),
    left: parse(spacing(left)),
  };
}
