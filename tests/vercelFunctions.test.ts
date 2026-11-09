import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type RequestListener } from 'node:http';
import type { Request, Response } from 'express';
import optimizeHandler from '../api/optimize';
import healthHandler from '../api/healthz';

async function withHandler(handler: RequestListener, run: (baseUrl: string) => Promise<void>) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('Vercel health function responds successfully', async () => {
  await withHandler((req, res) => healthHandler(req as Request, res as Response), async base => {
    const response = await fetch(`${base}/api/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('Vercel optimizer function reaches auth middleware instead of returning 404', async () => {
  await withHandler((req, res) => optimizeHandler(req as Request, res as Response), async base => {
    const response = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello', mode: 'quality' }),
    });
    assert.equal(response.status, 401);
    assert.match((await response.json()).error, /Sign in is required/);
  });
});
