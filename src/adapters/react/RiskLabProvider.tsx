// ============================================================================
// RiskLab — React: RiskLabProvider & Context
// Provides theme, default config, and shared event bus to descendant charts
// ============================================================================

import React, { createContext, useContext, useMemo, useRef, useCallback, type ReactNode } from 'react';
import type { ThemeConfig, ChartConfig, RiskLabPlugin } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { registry } from '../../core/Registry';

// ─── Context Shape ──────────────────────────────────────────────────────────

export interface RiskLabContextValue {
  /** Active theme config or name */
  theme: string | ThemeConfig;
  /** Default chart options applied to every child chart */
  defaults: Partial<ChartConfig>;
  /** Shared event bus for cross-chart communication */
  events: EventBus;
  /** Global plugin list applied to all charts */
  plugins: RiskLabPlugin[];
  /** Register a global plugin */
  registerPlugin: (plugin: RiskLabPlugin) => void;
  /** Set the global theme */
  setTheme: (theme: string | ThemeConfig) => void;
}

const RiskLabContext = createContext<RiskLabContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Access the nearest RiskLab provider context.
 * Use this inside chart components to inherit global config.
 */
export function useRiskLab(): RiskLabContextValue {
  const ctx = useContext(RiskLabContext);
  if (!ctx) {
    throw new Error(
      '[RiskLab] useRiskLab() must be used within a <RiskLabProvider>. ' +
      'Wrap your chart components in <RiskLabProvider> to provide global config.'
    );
  }
  return ctx;
}

/**
 * Access the nearest RiskLab provider context, or null if not wrapped.
 * Useful for optional integration.
 */
export function useRiskLabOptional(): RiskLabContextValue | null {
  return useContext(RiskLabContext);
}

// ─── Provider Props ─────────────────────────────────────────────────────────

export interface RiskLabProviderProps {
  children: ReactNode;
  /** Global theme (name or config object) */
  theme?: string | ThemeConfig;
  /** Default options merged into every chart */
  defaults?: Partial<ChartConfig>;
  /** Global plugins applied to every chart */
  plugins?: RiskLabPlugin[];
  /** Register custom chart types at provider level */
  registerTypes?: Array<{
    type: string;
    render: (...args: unknown[]) => void;
  }>;
}

// ─── Provider Component ─────────────────────────────────────────────────────

/**
 * Top-level provider for RiskLab chart configuration.
 *
 * Usage:
 * ```tsx
 * <RiskLabProvider theme="dark" defaults={{ animation: { enabled: true } }}>
 *   <MyLineChart />
 *   <MyBarChart />
 * </RiskLabProvider>
 * ```
 */
export function RiskLabProvider({
  children,
  theme: initialTheme = 'default',
  defaults = {},
  plugins: initialPlugins = [],
  registerTypes = [],
}: RiskLabProviderProps) {
  const eventsRef = useRef(new EventBus());
  const [theme, setThemeState] = React.useState<string | ThemeConfig>(initialTheme);
  const [registeredPlugins, setRegisteredPlugins] = React.useState<RiskLabPlugin[]>([]);

  React.useEffect(() => {
    setThemeState(initialTheme);
    eventsRef.current.emit('themeChange', {});
  }, [initialTheme]);

  // Register custom types once
  React.useEffect(() => {
    for (const reg of registerTypes) {
      try {
        registry.registerChartType({
          type: reg.type,
          name: reg.type,
          render: reg.render,
        });
      } catch {
        // Already registered, skip
      }
    }
  }, [registerTypes]);

  const registerPlugin = useCallback((plugin: RiskLabPlugin) => {
    setRegisteredPlugins(prev => {
      if (prev.some(p => p.id === plugin.id)) return prev;
      return [...prev, plugin];
    });
  }, []);

  const setTheme = useCallback((t: string | ThemeConfig) => {
    setThemeState(t);
    eventsRef.current.emit('themeChange', {});
  }, []);

  const plugins = useMemo<RiskLabPlugin[]>(() => {
    if (registeredPlugins.length === 0) return initialPlugins;
    const merged = [...initialPlugins];
    for (const plugin of registeredPlugins) {
      if (!merged.some(existing => existing.id === plugin.id)) {
        merged.push(plugin);
      }
    }
    return merged;
  }, [initialPlugins, registeredPlugins]);

  const value = useMemo<RiskLabContextValue>(() => ({
    theme,
    defaults,
    events: eventsRef.current,
    plugins,
    registerPlugin,
    setTheme,
  }), [theme, defaults, plugins, registerPlugin, setTheme]);

  return React.createElement(
    RiskLabContext.Provider,
    { value },
    children
  );
}
