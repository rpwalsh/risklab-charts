import { afterEach, describe, expect, it } from 'vitest';
import { Engine } from '../../src/core/Engine';
import type { ChartConfig, SeriesConfig } from '../../src/core/types';

describe('Engine ownership boundaries', () => {
  const engines: Engine[] = [];
  afterEach(() => engines.splice(0).forEach((engine) => engine.destroy()));

  it('does not mutate caller-owned series, points, axes, or annotations', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const series: SeriesConfig[] = [{
      id: 's1', name: 'Observed', type: 'line', data: [{ x: 1, y: 10 }],
    }];
    const axes: NonNullable<ChartConfig['axes']> = [
      { id: 'x0', type: 'linear', position: 'bottom' },
      { id: 'y0', type: 'linear', position: 'left' },
    ];
    const annotations: NonNullable<ChartConfig['annotations']> = [
      { id: 'a1', type: 'line', axisId: 'x0', value: 1 },
    ];
    const engine = new Engine({ container: host, series, axes, annotations, animation: { enabled: false } });
    engines.push(engine);

    engine.addPoint('s1', { x: 2, y: 20 });
    engine.updatePoint('s1', 0, { y: 99 });
    engine.toggleSeries('s1');
    engine.zoomToRange('x0', 0, 4);
    engine.setAnnotation({ id: 'a2', type: 'line', axisId: 'x0', value: 2 });

    expect(series[0]!.data).toEqual([{ x: 1, y: 10 }]);
    expect(series[0]!.visible).toBeUndefined();
    expect(axes[0]).not.toHaveProperty('min');
    expect(annotations).toHaveLength(1);
    expect(engine.getConfig().series[0]!.data).toEqual([{ x: 1, y: 99 }, { x: 2, y: 20 }]);
    host.remove();
  });

  it('returns a defensive series snapshot from getConfig', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const engine = new Engine({
      container: host,
      series: [{ id: 's1', name: 'Observed', type: 'line', data: [{ x: 1, y: 10 }] }],
      animation: { enabled: false },
    });
    engines.push(engine);
    const snapshot = engine.getConfig();
    (snapshot.series[0]!.data as Array<{ x: number; y: number }>).push({ x: 2, y: 20 });
    expect(engine.getConfig().series[0]!.data).toHaveLength(1);
    host.remove();
  });
});
