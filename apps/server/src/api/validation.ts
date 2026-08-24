import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { HttpError } from './auth.middleware.js';

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(400, {
      error: 'Validation failed',
      details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  return parseBody(schema, query);
}

export function parseIntParam(raw: string | undefined, name: string): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value)) {
    throw new HttpError(400, { error: `Invalid ${name} parameter` });
  }
  return value;
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps async route handlers so rejections reach the central error middleware. */
export function handler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
