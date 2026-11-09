import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';

async function withServer(run: (baseUrl: string) => Promise<void>, requestLimit = 10) {
  const app = createApp({
    projectId: 'test-project',
    requestLimit,
    verifyToken: async token => {
      if (token !== 'valid-token') throw new Error('invalid');
      return { uid: 'test-user' };
    },
    optimize: async ({ prompt, mode }) => ({
      optimizedPrompt: `Optimized: ${prompt}`,
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.0000045 },
      latencyMs: 12,
    }),
  });
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('optimizer requires a valid Firebase bearer token', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/optimize`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello', mode: 'quality' }),
    });
    assert.equal(response.status, 401);
  });
});

test('authenticated optimizer returns provider metadata', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/optimize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer valid-token' },
      body: JSON.stringify({ prompt: 'hello', mode: 'quality' }),
    });
    const body = await response.json() as { optimizedPrompt: string; usage: { totalTokens: number } };
    assert.equal(response.status, 200);
    assert.equal(body.optimizedPrompt, 'Optimized: hello');
    assert.equal(body.usage.totalTokens, 15);
  });
});

test('optimizer rejects invalid modes and oversized prompts', async () => {
  await withServer(async base => {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer valid-token' };
    const invalidMode = await fetch(`${base}/api/optimize`, {
      method: 'POST', headers, body: JSON.stringify({ prompt: 'hello', mode: 'other' }),
    });
    assert.equal(invalidMode.status, 400);
    const tooLong = await fetch(`${base}/api/optimize`, {
      method: 'POST', headers, body: JSON.stringify({ prompt: 'x'.repeat(10001), mode: 'quality' }),
    });
    assert.equal(tooLong.status, 413);
  });
});

test('optimizer rate limits each authenticated user', async () => {
  await withServer(async base => {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer valid-token' };
    const send = () => fetch(`${base}/api/optimize`, {
      method: 'POST', headers, body: JSON.stringify({ prompt: 'hello', mode: 'quality' }),
    });
    assert.equal((await send()).status, 200);
    const limited = await send();
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
  }, 1);
});
