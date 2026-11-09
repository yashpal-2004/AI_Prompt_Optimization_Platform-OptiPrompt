import express, { NextFunction, Request, Response } from 'express';
import firebaseConfig from '../firebase-applet-config.json';
import { verifyFirebaseIdToken } from './firebaseAuth';
import { optimizeWithProviders, OptimizationMode } from './providers';

interface AuthenticatedRequest extends Request {
  authUid?: string;
}

interface AppDependencies {
  projectId?: string;
  verifyToken?: (token: string) => Promise<{ uid: string }>;
  optimize?: typeof optimizeWithProviders;
  now?: () => number;
  requestLimit?: number;
  rateWindowMs?: number;
}

const ALLOWED_MODES = new Set<OptimizationMode>(['cheap', 'quality', 'extreme']);
const MAX_PROMPT_CHARS = 10_000;

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  const projectId = dependencies.projectId ?? firebaseConfig.projectId;
  const verifyToken = dependencies.verifyToken ?? ((token: string) => verifyFirebaseIdToken(token, projectId));
  const optimize = dependencies.optimize ?? optimizeWithProviders;
  const now = dependencies.now ?? Date.now;
  const configuredLimit = Number(process.env.API_RATE_LIMIT_PER_MIN);
  const limit = dependencies.requestLimit ?? (Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 10);
  const windowMs = dependencies.rateWindowMs ?? 60_000;
  const requestBuckets = new Map<string, { count: number; resetAt: number }>();

  const requireFirebaseUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authorization = req.header('authorization') || '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in is required to optimize prompts.' });
    try {
      const user = await verifyToken(token);
      req.authUid = user.uid;
      return next();
    } catch {
      return res.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' });
    }
  };

  const rateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const timestamp = now();
    const key = req.authUid || req.ip;
    if (requestBuckets.size > 5_000) {
      for (const [bucketKey, bucketValue] of requestBuckets) {
        if (bucketValue.resetAt <= timestamp) requestBuckets.delete(bucketKey);
      }
    }
    let bucket = requestBuckets.get(key);
    if (!bucket || bucket.resetAt <= timestamp) {
      bucket = { count: 0, resetAt: timestamp + windowMs };
      requestBuckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - timestamp) / 1000)));
      return res.status(429).json({ error: 'Request limit reached. Try again shortly.' });
    }
    return next();
  };

  app.get('/api/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.post('/api/optimize', requireFirebaseUser, rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    const { prompt, mode } = req.body ?? {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return res.status(413).json({ error: `Prompt must be ${MAX_PROMPT_CHARS.toLocaleString()} characters or fewer.` });
    }
    if (!ALLOWED_MODES.has(mode)) {
      return res.status(400).json({ error: 'Choose a supported optimization mode.' });
    }

    try {
      const result = await optimize({
        prompt: prompt.trim(),
        mode,
        groqKeys: [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter((key): key is string => Boolean(key)),
        geminiKey: process.env.GEMINI_API_KEY,
      });
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'All AI providers failed.';
      return res.status(502).json({ error: message });
    }
  });

  return app;
}
