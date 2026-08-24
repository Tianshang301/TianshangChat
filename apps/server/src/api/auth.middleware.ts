import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { findLiveSessionByToken } from '../data/session.repo.js';
import { config } from '../config.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: number; username: string };
      token?: string;
    }
  }
}

export interface JwtPayloadShape {
  id: number;
  username: string;
}

export function signSessionToken(payload: JwtPayloadShape, expiresIn: '24h' | '7d'): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

export function verifySessionToken(token: string): JwtPayloadShape | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string') return null;
    if (typeof decoded.id !== 'number' || typeof decoded.username !== 'string') return null;
    return { id: decoded.id, username: decoded.username };
  } catch {
    return null;
  }
}

/** Legacy triple-check kept verbatim: Bearer header → JWT verify → live sessions row. */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1] as string;

  const decoded = verifySessionToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const session = findLiveSessionByToken(token);
  if (!session) {
    res.status(401).json({ error: 'Token expired or invalid' });
    return;
  }

  req.user = { id: decoded.id, username: decoded.username };
  req.token = token;
  next();
}

export function requireUser(req: Request): { id: number; username: string } {
  if (!req.user) throw new HttpError(401, { error: 'Not authenticated' });
  return req.user;
}

/** Route-level error carrying a prebuilt JSON payload. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: Record<string, unknown>,
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}
