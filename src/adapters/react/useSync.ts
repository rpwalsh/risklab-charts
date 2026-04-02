// ============================================================================
// RiskLab Charts — React: useSync Hook
// Synchronize pan, zoom, and crosshair across multiple chart instances.
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { Engine } from '../../core/Engine';
import { SyncController, type SyncOptions } from '../../core/SyncController';

export interface UseSyncReturn {
  /** Call this with each chart's engine to add it to the sync group */
  syncEngine: (engine: Engine | null) => void;
  /** Remove an engine from sync */
  unsyncEngine: (engine: Engine) => void;
  /** The underlying SyncController instance */
  controller: SyncController | null;
}

/**
 * React hook that creates a SyncController and returns helpers to add/remove
 * Engine instances. Cleans up automatically on unmount.
 *
 * @example
 * ```tsx
 * const { syncEngine } = useSync({ zoom: true, crosshair: true });
 *
 * // In each chart's onReady callback:
 * <Chart onReady={syncEngine} ... />
 * <Chart onReady={syncEngine} ... />
 * ```
 */
export function useSync(options?: SyncOptions): UseSyncReturn {
  const controllerRef = useRef<SyncController | null>(null);

  useEffect(() => {
    controllerRef.current = new SyncController(options ?? {});
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncEngine = useCallback((engine: Engine | null) => {
    if (!engine) return;
    controllerRef.current?.add(engine);
  }, []);

  const unsyncEngine = useCallback((engine: Engine) => {
    controllerRef.current?.remove(engine);
  }, []);

  return {
    syncEngine,
    unsyncEngine,
    controller: controllerRef.current,
  };
}
