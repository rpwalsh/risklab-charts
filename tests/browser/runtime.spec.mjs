import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

let server; let origin;
test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    if (request.url === '/') {
      response.setHeader('content-type', 'text/html');
      response.end('<style>#chart{width:640px;height:360px}</style><div id="chart"></div>'); return;
    }
    try {
      const path = join(process.cwd(), 'dist', 'esm', request.url.slice(1));
      response.setHeader('content-type', extname(path) === '.js' ? 'text/javascript' : 'application/octet-stream');
      response.end(await readFile(path));
    } catch { response.statusCode = 404; response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => new Promise((resolve) => server.close(resolve)));

test('renders, resizes, exports, interacts with, and destroys a chart', async ({ page }) => {
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const { mount } = await import('/index.js');
    const chart = mount('#chart', { title: { text: 'Telemetry' }, series: [{ id: 's1', name: 'Signal', type: 'line', data: [{ x: 0, y: 2 }, { x: 1, y: 5 }, { x: 2, y: 3 }] }] });
    chart.resize(720, 400);
    document.querySelector('#chart').dispatchEvent(new PointerEvent('pointermove', { clientX: 180, clientY: 120, bubbles: true }));
    const exported = await chart.exportChart('svg');
    const rendered = document.querySelectorAll('#chart svg, #chart canvas').length;
    chart.destroy();
    return { rendered, exported: typeof exported === 'string' && exported.includes('<svg'), remaining: document.querySelector('#chart').childElementCount };
  });
  expect(result.rendered).toBeGreaterThan(0);
  expect(result.exported).toBe(true);
  expect(result.remaining).toBe(0);
});
