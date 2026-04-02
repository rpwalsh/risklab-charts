// ============================================================================
// Vitest Global Setup
// Provides minimal DOM stubs for chart renderer tests
// ============================================================================

import { vi } from 'vitest';

// Let React know the test runtime supports act(...) so adapter tests stay quiet.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Stub ResizeObserver (not in jsdom)
globalThis.ResizeObserver = class ResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Stub matchMedia
globalThis.matchMedia = globalThis.matchMedia ?? vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// Stub requestAnimationFrame
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame ?? ((cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number);
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame ?? ((id: number) => clearTimeout(id));
