// ============================================================================
// RiskLab Charts — Event Bus
// Decoupled pub/sub with type-safe events, wildcard support, and priority
// ============================================================================

import type { ChartEventType, ChartEvent, ChartEventHandler } from './types';

interface Subscription {
  handler: ChartEventHandler;
  priority: number;
  once: boolean;
}

/**
 * High-performance event bus with wildcard subscriptions and priority ordering.
 * All chart components communicate through this — zero coupling.
 */
export class EventBus {
  private listeners = new Map<string, Subscription[]>();
  private wildcardListeners: Subscription[] = [];

  /**
   * Subscribe to an event type.
   * @param type - Event type or '*' for all events
   * @param handler - Event handler
   * @param options - Subscription options
   * @returns Unsubscribe function
   */
  on<T extends ChartEventType>(
    type: T | '*',
    handler: ChartEventHandler<T>,
    options: { priority?: number; once?: boolean } = {},
  ): () => void {
    const sub: Subscription = {
      handler: handler as ChartEventHandler,
      priority: options.priority ?? 0,
      once: options.once ?? false,
    };

    if (type === '*') {
      this.wildcardListeners.push(sub);
      this.wildcardListeners.sort((a, b) => b.priority - a.priority);
      return () => {
        this.wildcardListeners = this.wildcardListeners.filter((s) => s !== sub);
      };
    }

    const list = this.listeners.get(type) ?? [];
    list.push(sub);
    list.sort((a, b) => b.priority - a.priority);
    this.listeners.set(type, list);

    return () => {
      const current = this.listeners.get(type);
      if (current) {
        this.listeners.set(
          type,
          current.filter((s) => s !== sub),
        );
      }
    };
  }

  /**
   * Subscribe to an event type, auto-remove after first fire.
   */
  once<T extends ChartEventType>(
    type: T,
    handler: ChartEventHandler<T>,
    priority?: number,
  ): () => void {
    return this.on(type, handler, { once: true, priority });
  }

  /**
   * Emit an event. Handlers are called in priority order.
   * If any handler calls preventDefault(), event.defaultPrevented is set.
   */
  emit<T extends ChartEventType>(type: T, partialEvent: Omit<ChartEvent<T>, 'type' | 'preventDefault' | 'defaultPrevented'>): ChartEvent<T> {
    let prevented = false;
    const event: ChartEvent<T> = {
      ...partialEvent,
      type,
      defaultPrevented: false,
      preventDefault() {
        prevented = true;
        this.defaultPrevented = true;
      },
    };

    // Type-specific listeners
    const list = this.listeners.get(type) ?? [];
    const toRemove: Subscription[] = [];

    for (const sub of list) {
      sub.handler(event);
      if (sub.once) toRemove.push(sub);
      if (prevented) break;
    }

    // Wildcard listeners — only run if no handler called preventDefault()
    if (!prevented) {
      for (const sub of this.wildcardListeners) {
        sub.handler(event);
        if (sub.once) toRemove.push(sub);
        if (prevented) break;
      }
    }

    // Clean up once-listeners
    if (toRemove.length > 0) {
      for (const sub of toRemove) {
        const typeList = this.listeners.get(type);
        if (typeList) {
          this.listeners.set(
            type,
            typeList.filter((s) => s !== sub),
          );
        }
        this.wildcardListeners = this.wildcardListeners.filter((s) => s !== sub);
      }
    }

    return event;
  }

  /**
   * Remove all listeners for a type, or all listeners if no type given.
   */
  off(type?: ChartEventType): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
      this.wildcardListeners = [];
    }
  }

  /**
   * Number of listeners for a type (including wildcards).
   */
  listenerCount(type: ChartEventType): number {
    return (this.listeners.get(type)?.length ?? 0) + this.wildcardListeners.length;
  }

  /**
   * Destroy the bus, remove all references.
   */
  destroy(): void {
    this.off();
  }
}
