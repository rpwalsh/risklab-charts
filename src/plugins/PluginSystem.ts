// ============================================================================
// RiskLab Charts — Plugin System
// Helpers for creating, composing, and managing plugins
// ============================================================================

import type { RiskLabPlugin, PluginHooks } from '../core/types';
import { registry } from '../core/Registry';

/**
 * Create a plugin with the builder pattern.
 *
 * Usage:
 * ```ts
 * const myPlugin = createPlugin('my-plugin')
 *   .version('1.0.0')
 *   .hook('afterRender', (chart) => { ... })
 *   .build();
 * ```
 */
export function createPlugin(id: string): PluginBuilder {
  return new PluginBuilder(id);
}

class PluginBuilder {
  private plugin: RiskLabPlugin;

  constructor(id: string) {
    this.plugin = {
      id,
      hooks: {},
    };
  }

  version(v: string): this {
    this.plugin.version = v;
    return this;
  }

  name(n: string): this {
    this.plugin.name = n;
    return this;
  }

  hook<K extends keyof PluginHooks>(hookName: K, fn: NonNullable<PluginHooks[K]>): this {
    (this.plugin.hooks as Record<string, unknown>)[hookName] = fn;
    return this;
  }

  defaults(d: Record<string, unknown>): this {
    this.plugin.defaults = d;
    return this;
  }

  build(): RiskLabPlugin {
    return this.plugin;
  }

  /** Build and register globally */
  register(): RiskLabPlugin {
    const p = this.build();
    registry.registerPlugin(p);
    return p;
  }
}

/**
 * Compose multiple plugins into one.
 */
export function composePlugins(id: string, ...plugins: RiskLabPlugin[]): RiskLabPlugin {
  const combined: RiskLabPlugin = {
    id,
    hooks: {},
  };

  for (const plugin of plugins) {
    for (const [hookName, fn] of Object.entries(plugin.hooks)) {
      const hooksRecord = combined.hooks as Record<string, unknown>;
      const existing = hooksRecord[hookName] as ((...args: unknown[]) => unknown) | undefined;
      if (existing) {
        // Chain the hooks
        hooksRecord[hookName] = (...args: unknown[]) => {
          existing(...args);
          (fn as (...args: unknown[]) => unknown)(...args);
        };
      } else {
        hooksRecord[hookName] = fn;
      }
    }
  }

  return combined;
}

export { PluginBuilder };
