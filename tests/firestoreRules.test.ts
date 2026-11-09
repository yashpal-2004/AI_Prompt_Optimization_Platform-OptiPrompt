import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';

let testEnv: RulesTestEnvironment;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-optiprompt-rules',
    firestore: { rules },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

function validUsageLog(uid: string) {
  return {
    uid,
    originalPrompt: 'Explain JWT rotation.',
    optimizedPrompt: 'Explain safe JWT rotation.',
    originalTokens: 6,
    optimizedTokens: 6,
    tokensSaved: 0,
    mode: 'quality',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    latencyMs: 120,
    apiInputTokens: 32,
    apiOutputTokens: 8,
    estimatedApiCostUsd: 0.0000096,
    timestamp: Timestamp.now(),
  };
}

test('owner can create and read a valid usage record', async () => {
  const alice = testEnv.authenticatedContext('alice');
  const reference = doc(alice.firestore(), 'usageLogs', 'valid');
  await assertSucceeds(setDoc(reference, validUsageLog('alice')));
  await assertSucceeds(getDoc(reference));
});

test('another user cannot read the owner’s usage record', async () => {
  const bob = testEnv.authenticatedContext('bob');
  await assertFails(getDoc(doc(bob.firestore(), 'usageLogs', 'valid')));
});

test('anonymous users cannot write usage records', async () => {
  const anonymous = testEnv.unauthenticatedContext();
  await assertFails(setDoc(doc(anonymous.firestore(), 'usageLogs', 'anonymous'), validUsageLog('alice')));
});

test('owner cannot write an oversized prompt or unexpected secret field', async () => {
  const alice = testEnv.authenticatedContext('alice');
  const oversized = { ...validUsageLog('alice'), originalPrompt: 'x'.repeat(10001) };
  await assertFails(setDoc(doc(alice.firestore(), 'usageLogs', 'oversized'), oversized));
  const withUnexpectedField = { ...validUsageLog('alice'), apiKey: 'should-not-be-stored' };
  await assertFails(setDoc(doc(alice.firestore(), 'usageLogs', 'unexpected'), withUnexpectedField));
});
