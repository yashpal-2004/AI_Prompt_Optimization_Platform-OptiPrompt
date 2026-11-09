import type { Request, Response } from 'express';

export default function healthHandler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify({ status: 'ok' }));
}
