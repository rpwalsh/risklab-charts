import { describe, expect, it } from 'vitest';
import { createTooltipHTML } from '../../src/components/Tooltip';
import { defaultTheme } from '../../src/themes/defaultTheme';
import type { SeriesConfig } from '../../src/core/types';

const series = {
  id: 'unsafe',
  name: '<img src=x onerror=alert(1)>',
  type: 'line',
  color: 'red;position:fixed',
  data: [],
} as SeriesConfig;

describe('HTML tooltip safety', () => {
  it('escapes data, format templates, and formatter output by default', () => {
    const html = createTooltipHTML([{
      x: 0,
      y: 0,
      series,
      point: { x: '<script>x</script>', y: '<svg onload=x>' },
      index: 0,
    }], {
      headerFormat: '<img src=x onerror=x>{point.x}',
      pointFormat: '<script>x</script>{series.name}: {point.y}',
      formatter: () => '<img src=x onerror=x>',
    }, defaultTheme);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img');
  });

  it('requires an explicit trusted-HTML opt in', () => {
    const html = createTooltipHTML([{
      x: 0, y: 0, series, point: { x: 1, y: 2 }, index: 0,
    }], { formatter: () => '<strong>trusted</strong>', allowHTML: true }, defaultTheme);
    expect(html).toBe('<strong>trusted</strong>');
  });
});
