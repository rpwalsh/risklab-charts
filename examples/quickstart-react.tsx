import { Chart } from '@risklab/charts-react';

const series = [
  {
    id: 'throughput',
    name: 'Throughput',
    type: 'area',
    data: [
      { x: '09:00', y: 120 },
      { x: '10:00', y: 148 },
      { x: '11:00', y: 133 },
    ],
  },
];

export function QuickstartReactExample() {
  return (
    <Chart
      title="Requests per minute"
      height={320}
      series={series}
      yAxis={{ title: { text: 'RPM' } }}
    />
  );
}
