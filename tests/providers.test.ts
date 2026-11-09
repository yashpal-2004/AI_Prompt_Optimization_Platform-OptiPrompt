import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateProviderCostUsd, optimizeWithProviders } from '../server/providers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('Groq response reports provider tokens, latency, and estimated cost', async () => {
  const result = await optimizeWithProviders({
    prompt: 'Explain JWT rotation.', mode: 'quality', groqKeys: ['groq-secret'],
    fetchImpl: async () => json({
      choices: [{ message: { content: 'Explain safe JWT rotation.' } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    }),
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.usage.inputTokens, 100);
  assert.equal(result.usage.outputTokens, 20);
  assert.equal(result.usage.estimatedCostUsd, 0.000027);
  assert.ok(result.latencyMs >= 0);
});

test('Groq tries its secondary key before Gemini', async () => {
  const authHeaders: string[] = [];
  const result = await optimizeWithProviders({
    prompt: 'Summarize a log.', mode: 'cheap', groqKeys: ['bad', 'good'], geminiKey: 'gemini',
    fetchImpl: async (_input, init) => {
      authHeaders.push(new Headers(init?.headers).get('authorization') || '');
      if (authHeaders.length === 1) return json({ error: { message: 'unauthorized' } }, 401);
      return json({ choices: [{ message: { content: 'Summarize the log.' } }], usage: { prompt_tokens: 30, completion_tokens: 8 } });
    },
  });
  assert.equal(result.provider, 'groq');
  assert.deepEqual(authHeaders, ['Bearer bad', 'Bearer good']);
});

test('Gemini is used when all Groq keys fail', async () => {
  let calls = 0;
  const result = await optimizeWithProviders({
    prompt: 'Explain retries.', mode: 'quality', groqKeys: ['bad'], geminiKey: 'gemini-secret',
    fetchImpl: async (input, init) => {
      calls += 1;
      if (String(input).includes('groq.com')) return json({ error: { message: 'unavailable' } }, 503);
      assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'gemini-secret');
      return json({
        candidates: [{ content: { parts: [{ text: 'Explain bounded retries.' }] } }],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 12, totalTokenCount: 62 },
      });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.provider, 'gemini');
  assert.equal(result.usage.totalTokens, 62);
});

test('provider cost is unavailable when the provider omits usage metadata', () => {
  assert.equal(estimateProviderCostUsd('groq', null, 12), null);
});

test('failure errors do not include secret keys', async () => {
  await assert.rejects(() => optimizeWithProviders({
    prompt: 'Test.', mode: 'quality', groqKeys: ['groq-super-secret'], geminiKey: 'gemini-super-secret',
    fetchImpl: async () => json({}, 500),
  }), (error: Error) => {
    assert.doesNotMatch(error.message, /super-secret/);
    return true;
  });
});

test('unsupported model response includes provider guidance without exposing credentials', async () => {
  await assert.rejects(() => optimizeWithProviders({
    prompt: 'Test.', mode: 'quality', groqKeys: ['groq-super-secret'],
    fetchImpl: async () => json({ error: { message: 'Unsupported model for this account' } }, 400),
  }), (error: Error) => {
    assert.match(error.message, /Groq \(openai\/gpt-oss-120b\): Unsupported model/);
    assert.doesNotMatch(error.message, /super-secret/);
    return true;
  });
});
