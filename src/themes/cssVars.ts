import type { ThemeConfig } from '../core/types';
import {
  applyThemeCSSVars as applyThemeCSSVarsFromAdapter,
  themeToCSSVars as themeToCSSVarsFromAdapter,
} from '../adapters/stylex/StyleXAdapter';

/**
 * Generate CSS custom properties from a RiskLab chart theme.
 *
 * This surface is framework-agnostic and intended for design-system
 * integrations that want chart tokens available in plain CSS, Tailwind,
 * CSS Modules, or other styling layers.
 */
export function themeToCSSVars(theme: ThemeConfig, prefix = '--uc'): Record<string, string> {
  return themeToCSSVarsFromAdapter(theme, prefix);
}

/**
 * Apply a RiskLab chart theme directly to a DOM element as CSS variables.
 */
export function applyThemeCSSVars(
  element: HTMLElement,
  theme: ThemeConfig,
  prefix = '--uc',
): void {
  applyThemeCSSVarsFromAdapter(element, theme, prefix);
}
