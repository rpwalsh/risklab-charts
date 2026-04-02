// ============================================================================
// RiskLab Charts — Responsive Plugin
// Intelligent breakpoint-based layout adaptation + user rule evaluation.
// Automatically adjusts padding, font sizes, legend placement, axis label
// density, and content visibility based on container dimensions.
// ============================================================================

import type { RiskLabPlugin, ChartConfig, ResponsiveRule } from '../core/types';
import { createPlugin } from './PluginSystem';

/**
 * Evaluate a responsive rule's condition against current dimensions.
 */
function matchesCondition(rule: ResponsiveRule, width: number, height: number): boolean {
  const c = rule.condition;
  if (c.maxWidth != null && width > c.maxWidth) return false;
  if (c.minWidth != null && width < c.minWidth) return false;
  if (c.maxHeight != null && height > c.maxHeight) return false;
  if (c.minHeight != null && height < c.minHeight) return false;
  return true;
}

/**
 * Deep-merge partial config overrides onto a target config.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[key];
    const tv = (target as Record<string, unknown>)[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      (result as Record<string, unknown>)[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else if (sv !== undefined) {
      (result as Record<string, unknown>)[key] = sv;
    }
  }
  return result;
}

/**
 * Per-instance base config storage, keyed by engine id.
 * Avoids module-level singleton that leaks between chart instances.
 */
const baseConfigs = new WeakMap<object, ChartConfig>();

/**
 * Per-engine re-entrancy guard — prevents the beforeRender hook from triggering
 * an infinite loop when engine.update() causes another render.
 * Using a WeakMap so cross-chart bleed is impossible.
 */
const applyingMap = new WeakMap<object, boolean>();

// ── Intelligent breakpoint system ───────────────────────────────────────

/** Breakpoint thresholds */
const BP_TINY = 300;
const BP_SMALL = 480;
const BP_MEDIUM = 768;

/**
 * Generate smart overrides based on current container width/height.
 * These are applied BEFORE the user's explicit responsive rules, so
 * user rules always take priority.
 */
function computeSmartOverrides(width: number, height: number): Partial<ChartConfig> {
  const overrides: Record<string, unknown> = {};

  // ── Tiny containers (≤300px): minimal chrome ──────────────────────
  if (width <= BP_TINY) {
    overrides.title = { fontSize: 14 };
    overrides.subtitle = { text: undefined };
    overrides.legend = { enabled: false };
    overrides.padding = { top: 10, right: 10, bottom: 10, left: 10 };
    return overrides as Partial<ChartConfig>;
  }

  // ── Small containers (≤480px): compact layout ─────────────────────
  if (width <= BP_SMALL) {
    overrides.title = { fontSize: 16 };
    overrides.subtitle = { fontSize: 11 };
    overrides.legend = {
      layout: 'horizontal',
      verticalAlign: 'bottom',
      itemStyle: { fontSize: 10 },
    };
    return overrides as Partial<ChartConfig>;
  }

  // ── Medium containers (≤768px): moderate adaptations ──────────────
  if (width <= BP_MEDIUM) {
    overrides.title = { fontSize: 18 };
    return overrides as Partial<ChartConfig>;
  }

  // ── Short containers: compress vertical space ─────────────────────
  if (height <= 250) {
    overrides.title = { fontSize: 14 };
    overrides.subtitle = { text: undefined };
    overrides.legend = { enabled: false };
  } else if (height <= 350) {
    overrides.title = { fontSize: 16 };
    overrides.subtitle = { fontSize: 11 };
  }

  return overrides as Partial<ChartConfig>;
}

export const ResponsivePlugin: RiskLabPlugin = createPlugin('responsive')
  .version('2.0.0')
  .name('Responsive Plugin')
  .hook('beforeInit', (config: ChartConfig) => {
    return config;
  })
  .hook('onResize', (width: unknown, height: unknown) => {
    void width;
    void height;
  })
  .hook('beforeRender', (chart: unknown) => {
    // Prevent infinite recursion: engine.update() → render() → beforeRender
    if (applyingMap.get(chart as object)) return;

    const engine = chart as import('../core/Engine').EngineInternalAPI;
    if (!engine?.getConfig || !engine?.getState) return;

    const config: ChartConfig = engine.getConfig();
    const state = engine.getState();

    // Snapshot the base config once per engine instance
    if (!baseConfigs.has(engine)) {
      baseConfigs.set(engine, { ...config });
    }
    const base = baseConfigs.get(engine)!;

    // ── Step 1: Apply intelligent smart overrides ────────────────────
    const smart = computeSmartOverrides(state.width, state.height);
    let merged = deepMerge({ ...base } as unknown as Record<string, unknown>, smart as unknown as Partial<Record<string, unknown>>) as unknown as ChartConfig;

    // ── Step 2: Apply user-defined responsive rules (override smart) ─
    const rules = config.responsive;
    if (rules?.length) {
      for (const rule of rules) {
        if (matchesCondition(rule, state.width, state.height)) {
          merged = deepMerge(merged as unknown as Record<string, unknown>, rule.chartOptions as unknown as Partial<Record<string, unknown>>) as unknown as ChartConfig;
        }
      }
    }

    // If nothing changed from base, skip the update
    const hasSmartChanges = Object.keys(smart).length > 0;
    const hasRuleChanges = rules?.some(r => matchesCondition(r, state.width, state.height)) ?? false;
    if (!hasSmartChanges && !hasRuleChanges) return;

    // Apply matched overrides (skip series/responsive to avoid data loss / infinite growth)
    const { series: _s, responsive: _r, ...overrides } = merged;

    applyingMap.set(engine as object, true);
    try {
      engine.update?.(overrides);
    } finally {
      applyingMap.delete(engine as object);
    }
  })
  .build();
