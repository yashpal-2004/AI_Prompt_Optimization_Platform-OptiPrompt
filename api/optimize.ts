import type { Request, Response } from 'express';
import { createApp } from '../server/app.js';

const app = createApp();

/** Vercel serverless entry point for POST /api/optimize. */
export default function optimizeHandler(req: Request, res: Response) {
  // Vercel may pass the function-relative path; restore the Express route in that case.
  if (req.url === '/' || req.url?.startsWith('/?')) {
    req.url = `/api/optimize${req.url.slice(1)}`;
  }
  return app(req, res);
}
