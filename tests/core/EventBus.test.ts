// ============================================================================
// EventBus — Unit Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/EventBus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // ─── Basic pub/sub ──────────────────────────────────────────────────
  describe('on / emit', () => {
    it('should call handler when event is emitted', () => {
      const handler = vi.fn();
      bus.on('dataUpdate', handler);
      bus.emit('dataUpdate', {});
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should pass event object to handler', () => {
      const handler = vi.fn();
      bus.on('dataUpdate', handler);
      bus.emit('dataUpdate', {});

      const event = handler.mock.calls[0]![0];
      expect(event.type).toBe('dataUpdate');
      expect(event.defaultPrevented).toBe(false);
    });

    it('should not call handler for different event type', () => {
      const handler = vi.fn();
      bus.on('dataUpdate', handler);
      bus.emit('resize', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple handlers on same event', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('dataUpdate', h1);
      bus.on('dataUpdate', h2);
      bus.emit('dataUpdate', {});
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  // ─── Unsubscribe ────────────────────────────────────────────────────
  describe('unsubscribe', () => {
    it('should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = bus.on('dataUpdate', handler);
      unsub();
      bus.emit('dataUpdate', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should only remove the specific handler', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      const unsub1 = bus.on('dataUpdate', h1);
      bus.on('dataUpdate', h2);
      unsub1();
      bus.emit('dataUpdate', {});
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  // ─── Priority ordering ─────────────────────────────────────────────
  describe('priority', () => {
    it('should call higher-priority handlers first', () => {
      const order: number[] = [];
      bus.on('dataUpdate', () => order.push(1), { priority: 1 });
      bus.on('dataUpdate', () => order.push(10), { priority: 10 });
      bus.on('dataUpdate', () => order.push(5), { priority: 5 });

      bus.emit('dataUpdate', {});
      expect(order).toEqual([10, 5, 1]);
    });
  });

  // ─── once() ─────────────────────────────────────────────────────────
  describe('once', () => {
    it('should fire handler only once', () => {
      const handler = vi.fn();
      bus.once('dataUpdate', handler);

      bus.emit('dataUpdate', {});
      bus.emit('dataUpdate', {});

      expect(handler).toHaveBeenCalledOnce();
    });

    it('once() should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = bus.once('dataUpdate', handler);
      unsub();
      bus.emit('dataUpdate', {});
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── Wildcard listeners ─────────────────────────────────────────────
  describe('wildcard (*)', () => {
    it('should receive all event types', () => {
      const handler = vi.fn();
      bus.on('*', handler);

      bus.emit('dataUpdate', {});
      bus.emit('resize', {});
      bus.emit('themeChange', {});

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should unsubscribe wildcard handler', () => {
      const handler = vi.fn();
      const unsub = bus.on('*', handler);
      unsub();
      bus.emit('dataUpdate', {});
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── preventDefault ─────────────────────────────────────────────────
  describe('preventDefault', () => {
    it('should stop subsequent handlers when preventDefault is called', () => {
      const h1 = vi.fn((e: any) => e.preventDefault());
      const h2 = vi.fn();
      bus.on('dataUpdate', h1, { priority: 10 });
      bus.on('dataUpdate', h2, { priority: 1 });

      const event = bus.emit('dataUpdate', {});
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });
  });

  // ─── off() ──────────────────────────────────────────────────────────
  describe('off', () => {
    it('should remove all listeners for a type', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('dataUpdate', h1);
      bus.on('dataUpdate', h2);
      bus.off('dataUpdate');
      bus.emit('dataUpdate', {});
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it('should remove ALL listeners when called without type', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('dataUpdate', h1);
      bus.on('*', h2);
      bus.off();
      bus.emit('dataUpdate', {});
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });
  });

  // ─── listenerCount ──────────────────────────────────────────────────
  describe('listenerCount', () => {
    it('should count type-specific + wildcard listeners', () => {
      bus.on('dataUpdate', vi.fn());
      bus.on('dataUpdate', vi.fn());
      bus.on('*', vi.fn());

      expect(bus.listenerCount('dataUpdate')).toBe(3);
    });

    it('should return wildcard count for unsubscribed type', () => {
      bus.on('*', vi.fn());
      expect(bus.listenerCount('resize')).toBe(1);
    });
  });

  // ─── destroy ────────────────────────────────────────────────────────
  describe('destroy', () => {
    it('should remove all listeners', () => {
      bus.on('dataUpdate', vi.fn());
      bus.on('*', vi.fn());
      bus.destroy();
      expect(bus.listenerCount('dataUpdate')).toBe(0);
    });
  });
});
