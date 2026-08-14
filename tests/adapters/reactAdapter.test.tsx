import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockEngine = {
  update: vi.fn(),
  destroy: vi.fn(),
  setData: vi.fn(),
  addSeries: vi.fn(),
  removeSeries: vi.fn(),
  toggleSeries: vi.fn(),
  setTheme: vi.fn(),
  addPoint: vi.fn(),
  addPoints: vi.fn(),
  updatePoint: vi.fn(),
  resize: vi.fn(),
  export: vi.fn().mockResolvedValue(new Blob()),
  on: vi.fn(() => vi.fn()),
};

vi.mock('../../src/core/Engine', () => ({
  Engine: vi.fn(() => mockEngine),
}));

import { Chart, RiskLabProvider, useChart, useRiskLabOptional } from '../../src/adapters/react';
import type { SeriesConfig } from '../../src/core/types';

function ChartHarness({ series }: { series: SeriesConfig[] }) {
  const { chartRef } = useChart({
    series,
    title: { text: 'Harness' },
  });

  return <div ref={chartRef} />;
}

function ThemeReader() {
  const ctx = useRiskLabOptional();
  return <div data-theme={String(ctx?.theme ?? '')} />;
}

describe('React adapter surfaces', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('useChart updates when point values change without a series length change', async () => {
    const seriesA: SeriesConfig[] = [
      { id: 's1', name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ];
    const seriesB: SeriesConfig[] = [
      { id: 's1', name: 'Series 1', type: 'line', data: [{ x: 1, y: 99 }] },
    ];

    await act(async () => {
      root.render(<ChartHarness series={seriesA} />);
    });

    mockEngine.update.mockClear();

    await act(async () => {
      root.render(<ChartHarness series={seriesB} />);
    });

    expect(mockEngine.update).toHaveBeenCalledTimes(1);
    expect(mockEngine.update.mock.calls[0]?.[0]?.series?.[0]?.data?.[0]?.y).toBe(99);
  });

  it('RiskLabProvider reflects theme prop changes to consumers', async () => {
    await act(async () => {
      root.render(
        <RiskLabProvider theme="midnight-pro">
          <ThemeReader />
        </RiskLabProvider>,
      );
    });

    expect(container.querySelector('[data-theme]')?.getAttribute('data-theme')).toBe('midnight-pro');

    await act(async () => {
      root.render(
        <RiskLabProvider theme="default">
          <ThemeReader />
        </RiskLabProvider>,
      );
    });

    expect(container.querySelector('[data-theme]')?.getAttribute('data-theme')).toBe('default');
  });

  it('resets removed declarative options instead of retaining stale engine state', async () => {
    const series: SeriesConfig[] = [
      { id: 's1', name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ];
    await act(async () => {
      root.render(<Chart series={series} legend={{ enabled: true }} />);
    });
    mockEngine.update.mockClear();
    await act(async () => {
      root.render(<Chart series={series} />);
    });
    expect(mockEngine.update).toHaveBeenCalled();
    expect(mockEngine.update.mock.calls.at(-1)?.[0]).toHaveProperty('legend', undefined);
  });

  it('registers a default y-axis when only xAxis is provided', async () => {
    const series: SeriesConfig[] = [
      { id: 's1', name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ];
    await act(async () => {
      root.render(<Chart series={series} xAxis={{ type: 'time' }} />);
    });

    const axes = mockEngine.update.mock.calls.at(-1)?.[0]?.axes;
    expect(axes).toHaveLength(2);
    expect(axes?.[0]).toMatchObject({ id: 'x0', type: 'time' });
    expect(axes?.[1]).toMatchObject({ id: 'y0', position: 'left' });
  });
});
