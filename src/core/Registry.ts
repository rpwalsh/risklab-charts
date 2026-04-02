// ============================================================================
// RiskLab Charts — Plugin & Chart Type Registry
// Central registry for all pluggable components: chart types, plugins, themes
// ============================================================================

import type {
  ChartTypeDefinition,
  RiskLabPlugin,
  ThemeConfig,
  ChartType,
} from './types';

/**
 * Global registry — singleton pattern.
 * Chart types, themes, and plugins are registered here and are available
 * to any RiskLab Charts instance in the application.
 */
export class Registry {
  private static instance: Registry;

  private chartTypes = new Map<string, ChartTypeDefinition>();
  private plugins = new Map<string, RiskLabPlugin>();
  private themes = new Map<string, ThemeConfig>();

  private constructor() {}

  static getInstance(): Registry {
    if (!Registry.instance) {
      Registry.instance = new Registry();
    }
    return Registry.instance;
  }

  // ---- Chart Types ----

  registerChartType(def: ChartTypeDefinition): void {
    if (this.chartTypes.has(def.type)) {
      console.warn(`[RiskLab] Chart type "${def.type}" is already registered. Overwriting.`);
    }
    this.chartTypes.set(def.type, def);
  }

  getChartType(type: ChartType | string): ChartTypeDefinition | undefined {
    return this.chartTypes.get(type);
  }

  getAllChartTypes(): ChartTypeDefinition[] {
    return Array.from(this.chartTypes.values());
  }

  hasChartType(type: string): boolean {
    return this.chartTypes.has(type);
  }

  // ---- Plugins ----

  registerPlugin(plugin: RiskLabPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[RiskLab] Plugin "${plugin.id}" is already registered. Overwriting.`);
    }
    this.plugins.set(plugin.id, plugin);

    // If the plugin ships custom chart types, register them too
    if (plugin.chartTypes) {
      for (const [, def] of Object.entries(plugin.chartTypes)) {
        this.registerChartType(def);
      }
    }
  }

  getPlugin(id: string): RiskLabPlugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): RiskLabPlugin[] {
    return Array.from(this.plugins.values());
  }

  // ---- Themes ----

  registerTheme(theme: ThemeConfig): void {
    this.themes.set(theme.id, theme);
  }

  getTheme(id: string): ThemeConfig | undefined {
    return this.themes.get(id);
  }

  getAllThemes(): ThemeConfig[] {
    return Array.from(this.themes.values());
  }

  // ---- Reset (mostly for testing) ----

  reset(): void {
    this.chartTypes.clear();
    this.plugins.clear();
    this.themes.clear();
  }
}

/** Convenience accessor */
export const registry = Registry.getInstance();
