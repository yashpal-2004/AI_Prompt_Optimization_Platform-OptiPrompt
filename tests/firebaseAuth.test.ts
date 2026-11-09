import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyFirebaseIdToken } from '../server/firebaseAuth';

function makeToken(projectId: string, kid: string, privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'], overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid, typ: 'JWT' });
  const claims = encode({
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: 'user-123',
    exp: now + 3600,
    iat: now,
    auth_time: now,
    ...overrides,
  });
  const message = `${header}.${claims}`;
  const signature = sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url');
  return `${message}.${signature}`;
}

test('valid Firebase ID token returns its UID after signature verification', async () => {
  const projectId = 'demo-project';
  const kid = `test-${Date.now()}`;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'max-age=0' },
  });
  const token = makeToken(projectId, kid, privateKey);
  assert.deepEqual(await verifyFirebaseIdToken(token, projectId, fetchImpl), { uid: 'user-123' });
});

test('Firebase token with the wrong audience is rejected', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const token = makeToken('wrong-project', 'kid', privateKey);
  await assert.rejects(() => verifyFirebaseIdToken(token, 'expected-project', async () => new Response('{}')));
});
