// tests/adapters/adapters.test.ts
// Tests for Angular, Svelte, Lit, and Vanilla adapters.
// These tests cover the imperative API — no DOM/framework required.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Engine ────────────────────────────────────────────────────────────────

const mockEngineInstance = {
  update: vi.fn(),
  destroy: vi.fn(),
  setData: vi.fn(),
  addSeries: vi.fn(),
  removeSeries: vi.fn(),
  toggleSeries: vi.fn(),
  setTheme: vi.fn(),
  addPoint: vi.fn(),
  resize: vi.fn(),
  export: vi.fn().mockResolvedValue(new Blob()),
  on: vi.fn(() => vi.fn()),
};

vi.mock('../../src/core/Engine', () => ({
  Engine: vi.fn(() => mockEngineInstance),
}));

// Mock ResizeObserver (not available in jsdom without extension)
(globalThis as Record<string, unknown>).ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

const mockEl = {
  nodeType: 1,
  style: {},
  getBoundingClientRect: () => ({ width: 800, height: 400 }),
  querySelector: vi.fn(() => null),
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  setAttribute: vi.fn(),
} as unknown as HTMLElement;

const baseConfig = {
  series: [{ id: 's1', name: 'Test', type: 'line' as const, data: [{ x: 1, y: 2 }] }],
};

// ── Angular Adapter ────────────────────────────────────────────────────────────

describe('Angular adapter', () => {
  let createAngularChart: typeof import('../../src/adapters/angular/index').createAngularChart;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ createAngularChart } = await import('../../src/adapters/angular/index'));
  });

  it('creates a chart ref', () => {
    const ref = createAngularChart(mockEl, baseConfig as any);
    expect(ref.engine).toBeDefined();
  });

  it('engine is the mock instance', () => {
    const ref = createAngularChart(mockEl, baseConfig as any);
    expect(ref.engine).toBe(mockEngineInstance);
  });

  it('update() calls engine.update', () => {
    const ref = createAngularChart(mockEl, baseConfig as any);
    ref.update({ title: { text: 'New' } });
    expect(mockEngineInstance.update).toHaveBeenCalledWith({ title: { text: 'New' } });
  });

  it('setTheme() calls engine.setTheme', () => {
    const ref = createAngularChart(mockEl, baseConfig as any);
    ref.setTheme('dark');
    expect(mockEngineInstance.setTheme).toHaveBeenCalledWith('dark');
  });

  it('addPoint() delegates to engine', () => {
    const ref = createAngularChart(mockEl, baseConfig as any);
    ref.addPoint('s1', { x: 5, y: 10 });
    expect(mockEngineInstance.addPoint).toHaveBeenCalledWith('s1', { x: 5, y: 10 }, undefined);
  });

  it('destroy() nulls engine', () => {
    const ref = createAngularChart(mockEl, baseConfig as any);
    ref.destroy();
    expect(ref.engine).toBeNull();
  });

  it('getAngularComponentSource returns non-empty string', async () => {
    const { getAngularComponentSource } = await import('../../src/adapters/angular/index');
    const src = getAngularComponentSource();
    expect(typeof src).toBe('string');
    expect(src.length).toBeGreaterThan(100);
    expect(src).toContain('RiskLabChartComponent');
    expect(src).toContain('@Component');
  });

  it('getAngularServiceSource returns service code', async () => {
    const { getAngularServiceSource } = await import('../../src/adapters/angular/index');
    const src = getAngularServiceSource();
    expect(src).toContain('RiskLabService');
    expect(src).toContain('@Injectable');
  });
});

// ── Svelte Adapter ─────────────────────────────────────────────────────────────

describe('Svelte adapter', () => {
  let createSvelteChart: typeof import('../../src/adapters/svelte/index').createSvelteChart;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ createSvelteChart } = await import('../../src/adapters/svelte/index'));
  });

  it('creates a chart ref with engine', () => {
    const ref = createSvelteChart(mockEl, baseConfig as any);
    expect(ref.engine).toBe(mockEngineInstance);
  });

  it('setData delegates to engine', () => {
    const ref = createSvelteChart(mockEl, baseConfig as any);
    ref.setData([]);
    expect(mockEngineInstance.setData).toHaveBeenCalledWith([]);
  });

  it('destroy sets engine to null', () => {
    const ref = createSvelteChart(mockEl, baseConfig as any);
    ref.destroy();
    expect(ref.engine).toBeNull();
  });

  it('exportChart resolves to a value', async () => {
    const ref = createSvelteChart(mockEl, baseConfig as any);
    const result = await ref.exportChart('png');
    expect(result).toBeDefined();
  });

  it('getSvelteComponentSource returns Svelte template', async () => {
    const { getSvelteComponentSource } = await import('../../src/adapters/svelte/index');
    const src = getSvelteComponentSource();
    expect(src).toContain('<script>');
    expect(src).toContain('createSvelteChart');
    expect(src).toContain('onMount');
    expect(src).toContain('onDestroy');
  });

  it('getSvelte5ComponentSource uses $effect runes', async () => {
    const { getSvelte5ComponentSource } = await import('../../src/adapters/svelte/index');
    const src = getSvelte5ComponentSource();
    expect(src).toContain('$effect');
    expect(src).toContain('$state');
  });

  it('getSvelteStoreSource returns store utilities', async () => {
    const { getSvelteStoreSource } = await import('../../src/adapters/svelte/index');
    const src = getSvelteStoreSource();
    expect(src).toContain('createChartStore');
    expect(src).toContain('writable');
  });
});

// ── Lit Adapter ────────────────────────────────────────────────────────────────

describe('Lit adapter', () => {
  let createLitChart: typeof import('../../src/adapters/lit/index').createLitChart;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ createLitChart } = await import('../../src/adapters/lit/index'));
  });

  it('creates a chart ref', () => {
    const ref = createLitChart(mockEl, baseConfig as any);
    expect(ref.engine).toBe(mockEngineInstance);
  });

  it('update delegates to engine', () => {
    const ref = createLitChart(mockEl, baseConfig as any);
    ref.update({ title: { text: 'Lit Chart' } });
    expect(mockEngineInstance.update).toHaveBeenCalled();
  });

  it('destroy clears engine ref', () => {
    const ref = createLitChart(mockEl, baseConfig as any);
    ref.destroy();
    expect(ref.engine).toBeNull();
  });

  it('getLitComponentSource returns Lit class source', async () => {
    const { getLitComponentSource } = await import('../../src/adapters/lit/index');
    const src = getLitComponentSource();
    expect(src).toContain('LitElement');
    expect(src).toContain('uc-chart');
    expect(src).toContain('@customElement');
    expect(src).toContain('connectedCallback');
  });
});

// ── Vanilla Adapter ────────────────────────────────────────────────────────────

describe('Vanilla adapter', () => {
  let mount: typeof import('../../src/adapters/vanilla/index').mount;
  let autoInit: typeof import('../../src/adapters/vanilla/index').autoInit;
  let getStimulusControllerSource: typeof import('../../src/adapters/vanilla/index').getStimulusControllerSource;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ mount, autoInit, getStimulusControllerSource } = await import('../../src/adapters/vanilla/index'));
  });

  it('mount() returns a VanillaChartInstance', () => {
    const instance = mount(mockEl, baseConfig as any);
    expect(instance.engine).toBe(mockEngineInstance);
    expect(instance.container).toBe(mockEl);
  });

  it('update() returns this (chainable)', () => {
    const instance = mount(mockEl, baseConfig as any);
    expect(instance.update({})).toBe(instance);
  });

  it('setData() is chainable', () => {
    const instance = mount(mockEl, baseConfig as any);
    expect(instance.setData([])).toBe(instance);
  });

  it('setTheme() calls engine.setTheme', () => {
    const instance = mount(mockEl, baseConfig as any);
    instance.setTheme('dark');
    expect(mockEngineInstance.setTheme).toHaveBeenCalledWith('dark');
  });

  it('addSeries() calls engine.addSeries', () => {
    const instance = mount(mockEl, baseConfig as any);
    const s = { id: 's2', name: 'B', type: 'bar' as const, data: [] };
    instance.addSeries(s);
    expect(mockEngineInstance.addSeries).toHaveBeenCalledWith(s);
  });

  it('removeSeries() calls engine.removeSeries', () => {
    const instance = mount(mockEl, baseConfig as any);
    instance.removeSeries('s1');
    expect(mockEngineInstance.removeSeries).toHaveBeenCalledWith('s1');
  });

  it('toggleSeries() calls engine.toggleSeries', () => {
    const instance = mount(mockEl, baseConfig as any);
    instance.toggleSeries('s1');
    expect(mockEngineInstance.toggleSeries).toHaveBeenCalledWith('s1');
  });

  it('addPoint() delegates to engine with options', () => {
    const instance = mount(mockEl, baseConfig as any);
    instance.addPoint('s1', { x: 10, y: 20 }, { shift: true, maxPoints: 100 });
    expect(mockEngineInstance.addPoint).toHaveBeenCalledWith(
      's1', { x: 10, y: 20 }, { shift: true, maxPoints: 100 }
    );
  });

  it('on() registers event listener', () => {
    const instance = mount(mockEl, baseConfig as any);
    const handler = vi.fn();
    instance.on('click', handler as any);
    expect(mockEngineInstance.on).toHaveBeenCalled();
  });

  it('resize() is chainable', () => {
    const instance = mount(mockEl, baseConfig as any);
    expect(instance.resize()).toBe(instance);
  });

  it('destroy() calls observer disconnect and engine destroy', () => {
    const instance = mount(mockEl, baseConfig as any);
    instance.destroy();
    expect(mockEngineInstance.destroy).toHaveBeenCalled();
  });

  it('getStimulusControllerSource returns controller code', () => {
    const src = getStimulusControllerSource();
    expect(src).toContain('RiskLabController');
    expect(src).toContain('connect()');
    expect(src).toContain('disconnect()');
    expect(src).toContain('mount');
  });

  it('mount with CSS selector throws if element not found', () => {
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(null);
    expect(() => mount('#nonexistent', baseConfig as any)).toThrow(/not found/);
  });

  it('autoInit scans DOM for data-chart elements', () => {
    const div = {
      ...mockEl,
      dataset: { chart: JSON.stringify(baseConfig) },
    } as unknown as HTMLElement;

    const root = {
      querySelectorAll: vi.fn(() => [div]),
    } as unknown as Document;

    autoInit(root);
    expect((div as any).__riskLabInstance).toBeDefined();
  });
});

describe('Solid adapter', () => {
  let createSolidChart: typeof import('../../src/adapters/solid/index').createSolidChart;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ createSolidChart } = await import('../../src/adapters/solid/index'));
  });

  it('creates a chart ref with engine', () => {
    const ref = createSolidChart(mockEl, baseConfig as any);
    expect(ref.engine).toBe(mockEngineInstance);
  });

  it('update delegates to engine', () => {
    const ref = createSolidChart(mockEl, baseConfig as any);
    ref.update({ title: { text: 'Solid' } });
    expect(mockEngineInstance.update).toHaveBeenCalledWith({ title: { text: 'Solid' } });
  });

  it('setData delegates to engine', () => {
    const ref = createSolidChart(mockEl, baseConfig as any);
    ref.setData([]);
    expect(mockEngineInstance.setData).toHaveBeenCalledWith([]);
  });

  it('destroy clears engine ref', () => {
    const ref = createSolidChart(mockEl, baseConfig as any);
    ref.destroy();
    expect(ref.engine).toBeNull();
  });
});
