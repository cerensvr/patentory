import assert from 'node:assert/strict';
import test from 'node:test';

import { createBridgeServer } from '../src/server.mjs';

const allowedOrigin = 'https://patentory.vercel.app';

test('bridge health and analyze routes work only for allowed origins', async (context) => {
  const server = createBridgeServer({
    analyzer: async (body) => ({ received: body.pdfName }),
    environment: { PATENTORY_ALLOWED_ORIGINS: allowedOrigin },
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${baseUrl}/health`, { headers: { Origin: allowedOrigin } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal((await health.json()).service, 'patentory-chatgpt-bridge');

  const denied = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(denied.status, 403);

  const analyzed = await fetch(`${baseUrl}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: allowedOrigin },
    body: JSON.stringify({ pdfName: 'patent.pdf' }),
  });
  assert.equal(analyzed.status, 200);
  assert.deepEqual(await analyzed.json(), { analysis: { received: 'patent.pdf' } });
});
