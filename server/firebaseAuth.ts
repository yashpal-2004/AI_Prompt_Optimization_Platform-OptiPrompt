import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { JsonWebKey as NodeJsonWebKey } from 'node:crypto';

interface FirebaseClaims {
  aud: string;
  iss: string;
  sub: string;
  exp: number;
  iat: number;
  auth_time: number;
}

interface FirebaseJwk extends NodeJsonWebKey {
  kid: string;
  alg?: string;
  use?: string;
}

interface JwksCache {
  keys: FirebaseJwk[];
  expiresAt: number;
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache: JwksCache | undefined;

function decodeJsonPart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

async function getFirebaseKeys(fetchImpl: typeof fetch): Promise<FirebaseJwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetchImpl(JWKS_URL, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('Unable to retrieve Firebase signing keys');
  const body = await response.json() as { keys?: FirebaseJwk[] };
  if (!Array.isArray(body.keys)) throw new Error('Firebase signing keys response was invalid');
  const maxAge = response.headers.get('cache-control')?.match(/max-age=(\d+)/i)?.[1];
  const ttlMs = Math.min(Number(maxAge || 3600), 86400) * 1000;
  jwksCache = { keys: body.keys, expiresAt: Date.now() + ttlMs };
  return body.keys;
}

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  fetchImpl: typeof fetch = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ uid: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed Firebase ID token');
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodeJsonPart<{ alg?: string; kid?: string }>(encodedHeader);
  const claims = decodeJsonPart<FirebaseClaims>(encodedClaims);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Firebase token signature');
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Firebase token issuer or audience is invalid');
  }
  if (!claims.sub || claims.sub.length > 128 || !Number.isFinite(claims.exp) || !Number.isFinite(claims.iat) || !Number.isFinite(claims.auth_time)) {
    throw new Error('Firebase token claims are invalid');
  }
  if (claims.exp <= nowSeconds || claims.iat > nowSeconds + 60 || claims.auth_time > nowSeconds + 60) {
    throw new Error('Firebase token is expired or not yet valid');
  }

  const signingKey = (await getFirebaseKeys(fetchImpl)).find(key => key.kid === header.kid && key.alg === 'RS256');
  if (!signingKey) throw new Error('Firebase token signing key is unknown');
  const publicKey = createPublicKey({ key: signingKey, format: 'jwk' });
  const signatureValid = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    publicKey,
    Buffer.from(encodedSignature, 'base64url'),
  );
  if (!signatureValid) throw new Error('Firebase token signature is invalid');
  return { uid: claims.sub };
}
