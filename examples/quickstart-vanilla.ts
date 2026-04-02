import { mount } from '@risklab/charts-vanilla';

const host = document.getElementById('chart-root');

if (host) {
  mount(host, {
    title: 'CPU saturation',
    series: [
      {
        id: 'cpu',
        name: 'CPU %',
        type: 'area',
        data: [
          { x: '09:00', y: 42 },
          { x: '10:00', y: 55 },
          { x: '11:00', y: 61 },
        ],
      },
    ],
    yAxis: { title: { text: 'Percent' } },
  });
}
