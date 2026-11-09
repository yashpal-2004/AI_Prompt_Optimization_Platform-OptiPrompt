import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPromptType,
  getCached,
  runContextReducer,
  runOutputController,
  runRuleCleaner,
  runTemplateFormatter,
  setCached,
} from '../src/lib/OptimizationPipeline';

test('rule cleaner removes filler while preserving key technical terms', () => {
  const result = runRuleCleaner('Please kindly explain the JWT refresh flow for a REST API.');
  assert.match(result, /JWT/);
  assert.match(result, /REST API/);
  assert.doesNotMatch(result.toLowerCase(), /please|kindly/);
});

test('context reducer removes boilerplate without deleting context', () => {
  const result = runContextReducer('I need your help: The service uses JWT auth. How do I refresh tokens?');
  assert.match(result, /service uses JWT auth/i);
  assert.match(result, /refresh tokens/i);
});

test('prompt type detection identifies code requests', () => {
  assert.equal(detectPromptType('Build a TypeScript API component'), 'code');
});

test('cheap formatter does not duplicate an existing output constraint', () => {
  const formatted = runTemplateFormatter('Explain caching in 2 sentences.', 'cheap').formatted;
  const controlled = runOutputController(formatted, 'cheap', 'explanation');
  assert.match(controlled, /2 sentences/i);
  assert.doesNotMatch(controlled, /2-3 sentences/i);
});

test('cache is isolated by mode', () => {
  const prompt = `cache-isolation-${Date.now()}`;
  setCached('cheap', prompt, 'compressed');
  assert.equal(getCached('cheap', prompt), 'compressed');
  assert.equal(getCached('quality', prompt), undefined);
});
