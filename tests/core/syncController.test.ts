import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncController, syncCharts } from '../../src/core/SyncController';
import type { Engine } from '../../src/core/Engine';

// ── Minimal Engine mock ────────────────────────────────────────────────────────

function makeEngine(id: string) {
  const listeners: Record<string, Array<(ev: unknown) => void>> = {};
  const calls = {
    zoomToRange: [] as Array<[number, number, string]>,
    renderCrosshairAt: [] as Array<[number, number]>,
    clearCrosshair: [] as Array<[]>,
    _drawSyncCrosshair: [] as Array<[number, number]>,
    _clearSyncCrosshair: [] as Array<[]>,
  };

  const engine = {
    id,
    state: {
      chartArea: { x: 0, y: 0, width: 800, height: 400 },
      scales: new Map([
        ['x0', { convert: (v: number) => v }],
        ['y0', { convert: (v: number) => v }],
      ]),
    },
    on: vi.fn((event: string, handler: (ev: unknown) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return () => {
        listeners[event] = listeners[event].filter(h => h !== handler);
      };
    }),
    emit: (event: string, data?: unknown) => {
      listeners[event]?.forEach(h => h(data));
    },
    zoomToRange: vi.fn((...args: [number, number, string]) => { calls.zoomToRange.push(args); }),
    renderCrosshairAt: vi.fn((...args: [number, number]) => { calls.renderCrosshairAt.push(args); }),
    clearCrosshair: vi.fn(() => { calls.clearCrosshair.push([]); }),
    _drawSyncCrosshair: vi.fn((...args: [number, number]) => { calls._drawSyncCrosshair.push(args); }),
    _clearSyncCrosshair: vi.fn(() => { calls._clearSyncCrosshair.push([]); }),
    __calls: calls,
  };

  return engine as unknown as Engine & {
    id: string;
    emit: (e: string, d?: unknown) => void;
    __calls: typeof calls;
    _drawSyncCrosshair: ReturnType<typeof vi.fn>;
    renderCrosshairAt: ReturnType<typeof vi.fn>;
    clearCrosshair: ReturnType<typeof vi.fn>;
    _clearSyncCrosshair: ReturnType<typeof vi.fn>;
  };
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('SyncController — construction', () => {
  it('creates with default options', () => {
    const sync = new SyncController();
    expect(sync).toBeInstanceOf(SyncController);
  });

  it('creates with custom options', () => {
    const sync = new SyncController({ zoom: false, crosshair: true });
    expect(sync).toBeInstanceOf(SyncController);
  });
});

// ── add / remove ──────────────────────────────────────────────────────────────

describe('SyncController — add / remove', () => {
  it('add() binds engine event listeners', () => {
    const e1 = makeEngine('e1');
    const sync = new SyncController();
    sync.add(e1);
    // on() was called for zoom, pan, hover, leave
    expect((e1.on as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('add() is idempotent — double-add has no effect', () => {
    const e1 = makeEngine('e1');
    const sync = new SyncController();
    sync.add(e1);
    const callsBefore = (e1.on as ReturnType<typeof vi.fn>).mock.calls.length;
    sync.add(e1); // second add
    expect((e1.on as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
  });

  it('remove() unregisters listeners', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController();
    sync.add(e1).add(e2);
    sync.remove(e1);

    // e1 emitting zoom should not call zoomToRange on e2 anymore
    e1.emit('zoom', { payload: { xMin: 0, xMax: 100 } });
    // e2 should not receive it since e1 was removed
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('remove() on unknown engine is a no-op', () => {
    const sync = new SyncController();
    expect(() => sync.remove(makeEngine('ghost'))).not.toThrow();
  });

  it('chaining: add().add().add()', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const e3 = makeEngine('e3');
    const sync = new SyncController();
    const result = sync.add(e1).add(e2).add(e3);
    expect(result).toBe(sync);
  });
});

// ── Zoom sync ─────────────────────────────────────────────────────────────────

describe('SyncController — zoom sync', () => {
  it('zooming engine 1 calls zoomToRange on engine 2', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController({ zoom: true });
    sync.add(e1).add(e2);

    e1.emit('zoom', { payload: { xMin: 10, xMax: 90 } });
    // zoomToRange is called as (axisId, min, max), so 'x0' is at [0], min at [1], max at [2]
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toBe(10);
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toBe(90);
  });

  it('does NOT sync to source engine (no self-loop)', () => {
    const e1 = makeEngine('e1');
    const sync = new SyncController({ zoom: true });
    sync.add(e1);

    e1.emit('zoom', { payload: { xMin: 0, xMax: 100 } });
    expect((e1.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('syncs pan as zoom', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController({ zoom: true });
    sync.add(e1).add(e2);

    e1.emit('pan', { payload: { xMin: 5, xMax: 50 } });
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('zoom=false disables zoom sync', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController({ zoom: false });
    sync.add(e1).add(e2);

    e1.emit('zoom', { payload: { xMin: 0, xMax: 100 } });
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('syncs to multiple engines simultaneously', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const e3 = makeEngine('e3');
    const sync = new SyncController({ zoom: true });
    sync.add(e1).add(e2).add(e3);

    e1.emit('zoom', { payload: { xMin: 0, xMax: 100 } });
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect((e3.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });
});

// ── Re-entrancy guard ─────────────────────────────────────────────────────────

describe('SyncController — re-entrancy guard', () => {
  it('prevents echo loops when two synced engines both listen', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController({ zoom: true });
    sync.add(e1).add(e2);

    // both engines emit zoom in a re-entrant scenario
    const zoomHandler = (e2.on as ReturnType<typeof vi.fn>).mock.calls.find(([evt]) => evt === 'zoom');
    // simulate: when e2 receives zoom broadcast, it tries to emit zoom back
    // the broadcasting flag should prevent it from looping
    let recursionDetected = false;
    if (zoomHandler) {
      (e2.zoomToRange as ReturnType<typeof vi.fn>).mockImplementation(() => {
        // Try to trigger e2 zoom while broadcasting is still active
        e2.emit('zoom', { payload: { xMin: 99, xMax: 100 } });
        recursionDetected = true;
      });
    }

    e1.emit('zoom', { payload: { xMin: 0, xMax: 100 } });
    // e1's zoomToRange should never be called (re-entrancy guard blocked the echo)
    expect((e1.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('SyncController — destroy', () => {
  it('removes all engines', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController();
    sync.add(e1).add(e2);
    sync.destroy();

    // After destroy, zoom events should not propagate
    e1.emit('zoom', { payload: { xMin: 0, xMax: 100 } });
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('destroy is idempotent (can call twice)', () => {
    const sync = new SyncController();
    sync.add(makeEngine('e1'));
    expect(() => { sync.destroy(); sync.destroy(); }).not.toThrow();
  });
});

// ── syncCharts factory ────────────────────────────────────────────────────────

describe('SyncController — crosshair sync', () => {
  it('hover event on engine 1 triggers crosshair on engine 2', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController({ crosshair: true, zoom: false });
    sync.add(e1).add(e2);

    // Emit a hover event the same way Engine does — chartX/chartY at the top level
    e1.emit('hover', { chartX: 400, chartY: 200, seriesId: 's1', pointIndex: 0 });

    // e2 should receive a crosshair draw call
    const drawCalls = (e2._drawSyncCrosshair as ReturnType<typeof vi.fn>).mock.calls;
    const renderCalls = (e2.renderCrosshairAt as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.length + renderCalls.length).toBeGreaterThan(0);
  });

  it('leave event clears crosshair on peers', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController({ crosshair: true, zoom: false });
    sync.add(e1).add(e2);

    e1.emit('leave', {});

    const clearCalls = (e2._clearSyncCrosshair as ReturnType<typeof vi.fn>).mock.calls;
    const clearPubCalls = (e2.clearCrosshair as ReturnType<typeof vi.fn>).mock.calls;
    expect(clearCalls.length + clearPubCalls.length).toBeGreaterThan(0);
  });

  it('crosshair=false disables hover sync', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = new SyncController({ crosshair: false, tooltip: false, zoom: false });
    sync.add(e1).add(e2);

    e1.emit('hover', { chartX: 400, chartY: 200 });

    const drawCalls = (e2._drawSyncCrosshair as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.length).toBe(0);
  });
});

describe('syncCharts', () => {
  it('returns a SyncController', () => {
    const ctrl = syncCharts([]);
    expect(ctrl).toBeInstanceOf(SyncController);
  });

  it('immediately adds all provided engines', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    syncCharts([e1, e2], { zoom: true });
    expect((e1.on as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect((e2.on as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('passes options to controller', () => {
    const e1 = makeEngine('e1');
    const e2 = makeEngine('e2');
    const sync = syncCharts([e1, e2], { zoom: false });

    e1.emit('zoom', { payload: { xMin: 0, xMax: 100 } });
    expect((e2.zoomToRange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
