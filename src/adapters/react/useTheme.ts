// ============================================================================
// RiskLab Charts — React: useTheme Hook
// Live theme switching with optional system dark-mode detection.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { registry } from '../../core/Registry';
import { defaultTheme } from '../../themes/defaultTheme';
import { darkTheme } from '../../themes/darkTheme';
import type { ThemeConfig } from '../../core/types';

export interface UseThemeOptions {
  /** Initial theme name or config (default: 'default') */
  initial?: string | ThemeConfig;
  /** Automatically switch between light/dark based on system preference */
  followSystem?: boolean;
}

export interface UseThemeReturn {
  /** Currently active theme config */
  theme: ThemeConfig;
  /** Switch to a named theme or custom config */
  setTheme: (theme: string | ThemeConfig) => void;
  /** Current theme name (if named) */
  themeName: string;
  /** Whether system prefers dark mode */
  systemDark: boolean;
  /** Toggle between the current theme and its dark counterpart */
  toggleDark: () => void;
}

function resolveTheme(t: string | ThemeConfig | undefined): ThemeConfig {
  if (!t) return defaultTheme;
  if (typeof t === 'string') return registry.getTheme(t) ?? defaultTheme;
  return t;
}

/**
 * React hook for live theme management with optional system dark-mode sync.
 *
 * @example
 * ```tsx
 * const { theme, setTheme, toggleDark } = useTheme({ followSystem: true });
 * return <Chart theme={theme} series={...} />;
 * ```
 */
export function useTheme(options: UseThemeOptions = {}): UseThemeReturn {
  const { initial = 'default', followSystem = false } = options;

  const [themeName, setThemeName] = useState<string>(
    typeof initial === 'string' ? initial : (initial as ThemeConfig).id ?? 'custom',
  );
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => resolveTheme(initial));
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  // Follow system dark mode
  useEffect(() => {
    if (!followSystem || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
      const resolved = registry.getTheme(e.matches ? 'dark' : 'default');
      if (resolved) {
        setThemeName(e.matches ? 'dark' : 'default');
        setThemeConfig(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [followSystem]);

  const setTheme = useCallback((t: string | ThemeConfig) => {
    const resolved = resolveTheme(t);
    setThemeConfig(resolved);
    setThemeName(typeof t === 'string' ? t : (resolved.id ?? 'custom'));
  }, []);

  const toggleDark = useCallback(() => {
    const isDark = themeName === 'dark' || themeConfig === darkTheme;
    setTheme(isDark ? 'default' : 'dark');
  }, [themeName, themeConfig, setTheme]);

  return { theme: themeConfig, setTheme, themeName, systemDark, toggleDark };
}
