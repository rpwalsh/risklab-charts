import { describe, expect, it } from 'vitest';

import { normalizeGraph3DSeries } from '../../src/scenes';

describe('normalizeGraph3DSeries', () => {
  it('builds a graph from node metadata edges and explicit links', () => {
    const graph = normalizeGraph3DSeries(
      [
        {
          id: 'graph',
          color: '#4f46e5',
          data: [
            {
              id: 'alpha',
              label: 'Alpha',
              x: -3,
              y: 1,
              z: 2,
              meta: { color: '#60a5fa', size: 1.3, edges: ['beta'] },
            },
            {
              id: 'beta',
              label: 'Beta',
              x: 2,
              y: -1,
              z: -2,
              meta: { color: '#22c55e', edges: [{ target: 'gamma', weight: 2 }] },
            },
            {
              id: 'gamma',
              label: 'Gamma',
              x: 4,
              y: 2,
              z: 0,
              meta: { color: '#f97316' },
            },
          ],
        },
      ],
      {
        links: [{ source: 'alpha', target: 'gamma', kind: 'witness' }],
      },
      ['#6366f1'],
    );

    expect(graph.nodes).toHaveLength(3);
    expect(graph.links).toHaveLength(3);
    expect(graph.nodes[0]?.label).toBe('Alpha');
    expect(graph.nodes[0]?.degree).toBe(2);
    expect(graph.links.some((link) => link.source === 'alpha' && link.target === 'gamma')).toBe(true);
    expect(graph.radius).toBeGreaterThan(0);
  });

  it('falls back to a force layout when xyz coordinates are missing', () => {
    const graph = normalizeGraph3DSeries(
      [
        {
          id: 'graph',
          data: [
            { id: 'n0', label: 'N0', meta: { edges: ['n1', 'n2'] } },
            { id: 'n1', label: 'N1', meta: { edges: ['n2'] } },
            { id: 'n2', label: 'N2' },
          ],
        },
      ],
      { layout: 'force' },
      ['#38bdf8'],
    );

    for (const node of graph.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(Number.isFinite(node.z)).toBe(true);
    }
  });
});
