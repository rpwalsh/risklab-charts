import { describe, expect, it } from 'vitest';
import { fromLegacyChartOptions } from '../../src/adapters/legacy-config';

describe('legacy chart configuration adapter', () => {
  it('translates titles, categories, series, axes, tooltip, and interactions', () => {
    const config = fromLegacyChartOptions({
      chart: { type: 'column', zoomType: 'xy', panning: { enabled: true, type: 'x' } },
      title: { text: 'Readiness', align: 'left' },
      xAxis: { categories: ['Mon', 'Tue'], title: { text: 'Day' } },
      yAxis: { min: 0, max: 100, title: { text: 'Percent' } },
      tooltip: { shared: true },
      plotOptions: { series: { stacking: 'normal', allowPointSelect: true } },
      series: [{ id: 'ready', name: 'Ready', data: [72, 84], color: '#22c55e' }],
    });
    expect(config.title?.text).toBe('Readiness');
    expect(config.axes?.map((axis) => axis.id)).toEqual(['x0', 'y0']);
    expect(config.series[0]).toMatchObject({ id: 'ready', type: 'column', stackGroup: 'default', color: '#22c55e' });
    expect(config.series[0]?.data).toEqual([{ x: 'Mon', y: 72 }, { x: 'Tue', y: 84 }]);
    expect(config.tooltip?.shared).toBe(true);
    expect(config.interaction?.zoom).toMatchObject({ enabled: true, axis: 'both' });
    expect(config.interaction?.pan).toMatchObject({ enabled: true, axis: 'x' });
  });

  it('translates OHLC tuples and custom metadata without evaluating config', () => {
    const config = fromLegacyChartOptions({ series: [{ type: 'candlestick', data: [[1700000000000, 10, 14, 9, 13], { x: 2, y: 7, name: 'Observed', custom: { source: 'synthetic' } }] }] });
    expect(config.series[0]?.data[0]).toMatchObject({ x: 1700000000000, open: 10, high: 14, low: 9, close: 13, y: 13 });
    expect(config.series[0]?.data[1]).toMatchObject({ x: 2, y: 7, label: 'Observed', meta: { source: 'synthetic' } });
  });
});
