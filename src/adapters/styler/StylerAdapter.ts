// RiskLab Charts - RiskLab Styler token adapter.
// Converts build-time token contracts into chart themes without runtime CSS injection.

import type { ThemeConfig } from '../../core/types';

// ---------------------------------------------------------------------------
// 1. RiskLab Styler Token → ThemeConfig Converter
// ---------------------------------------------------------------------------

/**
 * Shape of design tokens typically exported from a RiskLab Styler theme.
 * Users pass their own token values from their RiskLab Styler theme definition.
 *
 * ```ts
 * // In your RiskLab Styler theme file:
 * export const tokens = styler.defineVars({
 *   primaryColor: '#6366f1',
 *   secondaryColor: '#ec4899',
 *   bgColor: '#0f172a',
 *   textColor: '#e2e8f0',
 *   fontFamily: '"Inter", sans-serif',
 *   fontSize: '14px',
 *   gridColor: 'rgba(255,255,255,0.06)',
 *   surfaceColor: '#1e293b',
 * });
 * ```
 */
export interface StylerTokens {
  /** Series palette colors (array of CSS color strings) */
  palette?: string[];
  /** Individual named colors (mapped into palette if palette not provided) */
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  accentColor?: string;
  errorColor?: string;
  warningColor?: string;
  successColor?: string;
  infoColor?: string;
  /** Background */
  bgColor?: string;
  surfaceColor?: string;
  /** Text */
  textColor?: string;
  textSecondaryColor?: string;
  /** Typography */
  fontFamily?: string;
  fontSize?: string | number;
  /** Grid / Axis */
  gridColor?: string;
  borderColor?: string;
  /** Tooltip */
  tooltipBgColor?: string;
  tooltipTextColor?: string;
  tooltipBorderColor?: string;
  /** Any extra tokens */
  [key: string]: unknown;
}

export interface StylerAdapterOptions {
  /** Theme id (default: 'styler') */
  id?: string;
  /** Theme display name */
  name?: string;
  /** Mode hint for smarter defaults */
  mode?: 'light' | 'dark';
  /** Override any ThemeConfig property after conversion */
  overrides?: Partial<ThemeConfig>;
}

/**
 * Convert RiskLab Styler design tokens into a RiskLab ThemeConfig.
 *
 * ```ts
 * import { tokens } from './myTheme';
 * import { stylerTokensToTheme } from '@risklab/charts/styler';
 *
 * const chartTheme = stylerTokensToTheme({
 *   primaryColor: tokens.primaryColor,
 *   bgColor: tokens.bgColor,
 *   textColor: tokens.textColor,
 *   fontFamily: tokens.fontFamily,
 * });
 * ```
 */
export function stylerTokensToTheme(
  tokens: StylerTokens,
  options: StylerAdapterOptions = {},
): ThemeConfig {
  const {
    id = 'styler',
    name = 'RiskLab Styler Theme',
    mode = 'dark',
    overrides = {},
  } = options;

  const isDark = mode === 'dark';

  // Build palette from explicit array or named colors
  const palette = tokens.palette ?? [
    tokens.primaryColor ?? '#6366f1',
    tokens.secondaryColor ?? '#ec4899',
    tokens.tertiaryColor ?? '#f59e0b',
    tokens.accentColor ?? '#10b981',
    tokens.errorColor ?? '#ef4444',
    tokens.warningColor ?? '#f97316',
    tokens.successColor ?? '#22c55e',
    tokens.infoColor ?? '#3b82f6',
  ].filter(Boolean) as string[];

  const bg = tokens.bgColor ?? (isDark ? '#0f172a' : '#ffffff');
  const text = tokens.textColor ?? (isDark ? '#e2e8f0' : '#1e293b');
  const textSecondary = tokens.textSecondaryColor ?? (isDark ? '#94a3b8' : '#64748b');
  const grid = tokens.gridColor ?? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)');
  const border = tokens.borderColor ?? grid;
  const surface = tokens.surfaceColor ?? (isDark ? '#1e293b' : '#f8fafc');

  const parseFontSize = (v?: string | number): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseInt(v, 10) || 14;
    return 14;
  };

  const theme: ThemeConfig = {
    id,
    name,
    palette,
    backgroundColor: bg,
    textColor: text,
    fontFamily: (tokens.fontFamily as string) ?? '"Inter", system-ui, sans-serif',
    fontSize: parseFontSize(tokens.fontSize),
    axis: {
      lineColor: border,
      gridColor: grid,
      labelColor: textSecondary,
      titleColor: text,
    },
    tooltip: {
      backgroundColor: tokens.tooltipBgColor ?? surface,
      borderColor: tokens.tooltipBorderColor ?? border,
      textColor: tokens.tooltipTextColor ?? text,
      shadow: {
        enabled: true,
        color: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)',
        offsetX: 0,
        offsetY: 2,
        blur: 8,
      },
    },
    legend: {
      textColor: text,
      hoverColor: palette[0] ?? '#6366f1',
      inactiveColor: textSecondary,
    },
    tokens: {
      stylerMode: mode,
      surface,
      ...tokens,
    },
    ...overrides,
  };

  return theme;
}

// ---------------------------------------------------------------------------
// 2. RiskLab Styler-Compatible Style Definitions
// ---------------------------------------------------------------------------

/**
 * Pre-built inline style objects for chart containers.
 * These are plain objects that work with RiskLab Styler's `props()` merge,
 * or can be spread directly in React `style` props.
 *
 * ```tsx
 * import { chartStyles } from '@risklab/charts/styler';
 * // Use directly:
 * <div style={chartStyles.responsive} />
 * // Or merge with RiskLab Styler props():
 * <div {...styler.props(myStyles.container)} style={chartStyles.responsive} />
 * ```
 */
export const chartStyles = {
  /** Responsive container that fills parent width, fixed height */
  responsive: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    minHeight: 200,
  },

  /** Fixed-aspect-ratio wrapper (16:9) using padding-top trick */
  aspectRatio16x9: {
    width: '100%',
    position: 'relative' as const,
    aspectRatio: '16 / 9',
    overflow: 'hidden' as const,
  },

  /** Square aspect ratio */
  aspectRatioSquare: {
    width: '100%',
    position: 'relative' as const,
    aspectRatio: '1 / 1',
    overflow: 'hidden' as const,
  },

  /** Dashboard panel style */
  dashboardPanel: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },

  /** Inline sparkline wrapper */
  sparklineInline: {
    display: 'inline-block' as const,
    width: 120,
    height: 32,
    verticalAlign: 'middle' as const,
  },

  /** Full-viewport chart */
  fullscreen: {
    position: 'fixed' as const,
    inset: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
  },
} as const;

// ---------------------------------------------------------------------------
// 3. CSS Custom Property Bridge
// ---------------------------------------------------------------------------

/**
 * Generate CSS custom properties (variables) from a RiskLab ThemeConfig.
 * Useful for bridging chart theme colors into RiskLab Styler / vanilla CSS.
 *
 * Returns an object like:
 * ```
 * {
 *   '--uc-bg': '#0f172a',
 *   '--uc-text': '#e2e8f0',
 *   '--uc-palette-0': '#6366f1',
 *   ...
 * }
 * ```
 *
 * Apply to a container element via `style` prop or `element.style.setProperty()`.
 */
export function themeToCSSVars(theme: ThemeConfig, prefix = '--uc'): Record<string, string> {
  const vars: Record<string, string> = {};

  vars[`${prefix}-bg`] = theme.backgroundColor as string;
  vars[`${prefix}-text`] = theme.textColor as string;
  vars[`${prefix}-font-family`] = theme.fontFamily;
  vars[`${prefix}-font-size`] = `${theme.fontSize}px`;
  vars[`${prefix}-axis-line`] = theme.axis.lineColor as string;
  vars[`${prefix}-axis-grid`] = theme.axis.gridColor as string;
  vars[`${prefix}-axis-label`] = theme.axis.labelColor as string;
  vars[`${prefix}-tooltip-bg`] = theme.tooltip.backgroundColor as string;
  vars[`${prefix}-tooltip-border`] = theme.tooltip.borderColor as string;
  vars[`${prefix}-tooltip-text`] = theme.tooltip.textColor as string;
  vars[`${prefix}-legend-text`] = theme.legend.textColor as string;
  vars[`${prefix}-legend-hover`] = theme.legend.hoverColor as string;

  theme.palette.forEach((color, i) => {
    vars[`${prefix}-palette-${i}`] = color;
  });

  return vars;
}

/**
 * Apply RiskLab theme as CSS custom properties on an HTML element.
 */
export function applyThemeCSSVars(
  element: HTMLElement,
  theme: ThemeConfig,
  prefix = '--uc',
): void {
  const vars = themeToCSSVars(theme, prefix);
  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }
}

// ---------------------------------------------------------------------------
// 4. className Composer (works with RiskLab Styler props output)
// ---------------------------------------------------------------------------

/**
 * Merge classNames from RiskLab Styler `props()` output with RiskLab's own classes.
 * RiskLab Styler's `props()` returns `{ className?: string, style?: object }`.
 *
 * ```tsx
 * const sx = styler.props(myStyles.chartWrapper);
 * <div {...sx} className={mergeClassNames(sx.className, 'risklab-chart')} />
 * ```
 */
export function mergeClassNames(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}
