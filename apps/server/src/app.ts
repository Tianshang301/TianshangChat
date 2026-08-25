import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import os from 'node:os';

import { config } from './config.js';
import { createLogger } from './infra/logger.js';
import { authMiddleware } from './api/auth.middleware.js';
import { errorHandler, notFoundHandler } from './api/error.middleware.js';
import authRoutes from './api/routes/auth.routes.js';
import usersRoutes from './api/routes/users.routes.js';
import messagesRoutes from './api/routes/messages.routes.js';
import groupsRoutes from './api/routes/groups.routes.js';
import uploadRoutes from './api/routes/upload.routes.js';
import syncRoutes from './api/routes/sync.routes.js';
import e2eeRoutes from './api/routes/e2ee.routes.js';


const log = createLogger('server');

export function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

/** Private-LAN whitelist — preserved verbatim from legacy server.js (AGENTS.md §11.6 tier-1 asset). */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === 'null' || origin.startsWith('file://')) return false;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (hostname === getLocalIP()) return true;

    if (
      hostname.match(/^192\.168\.\d+\.\d+$/) ||
      hostname.match(/^10\.\d+\.\d+\.\d+$/) ||
      hostname.match(/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, ok?: boolean) => void,
): void {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
  } else {
    log.warn(`CORS blocked origin: ${String(origin)}`);
    callback(new Error('Not allowed by CORS'));
  }
}

export interface OnlineCountSource {
  (): number;
}

/**
 * Builds the Express app (no listener attached) so integration tests can drive
 * it via supertest while production wiring stays in index.ts.
 */
export function createApp(options?: { onlineUsers?: OnlineCountSource }): express.Express {
  const app = express();

  app.use(cors({ origin: corsOriginCallback, credentials: true }));
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10_000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10_000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login/register attempts, please try again later.' },
  });

  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(config.uploadDir));

  app.use((req, _res, next) => {
    log.debug(`${req.method} ${req.path}`);
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/groups', groupsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/e2ee', e2eeRoutes);

  app.get('/api/server-info', authMiddleware, (_req, res) => {
    res.json({
      success: true,
      port: config.port,
      onlineUsers: options?.onlineUsers?.() ?? 0,
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
