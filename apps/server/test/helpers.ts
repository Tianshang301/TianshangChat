/**
 * Integration test bootstrap.
 *
 * Env MUST be configured before any server module import (config.ts caches at
 * import time). Call `buildTestApp()` — it installs the env, then dynamically
 * imports the app + db so every call site gets an isolated, migrated database.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import supertest from 'supertest';

export interface TestEnv {
  app: import('express').Express;
  /** Raw sqlite handle for assertions/cleanup. */
  db: import('better-sqlite3').Database;
}

let cached: Promise<TestEnv> | null = null;

export function buildTestApp(): Promise<TestEnv> {
  if (!cached) {
    cached = (async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsc-server-test-'));
      process.env.JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_PATH = path.join(tmp, 'chat.db');
      process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
      // Keep the real secret guard happy while remaining deterministic.

      const { createApp } = await import('../src/app.js');
      const { runMigrations, sqlite } = await import('../src/infra/db.js');
      runMigrations();

      return { app: createApp(), db: sqlite };
    })();
  }
  return cached;
}

/* ------------------------------------------------------------------ */
/* REST helpers                                                        */
/* ------------------------------------------------------------------ */

export async function registerUser(app: TestEnv['app'], username: string): Promise<void> {
  await supertestPost(app, '/api/auth/register', { username, password: 'secret123' });
}

export interface Session {
  token: string;
  userId: number;
  username: string;
}

export async function loginUser(app: TestEnv['app'], username: string): Promise<Session> {
  const res = await supertestPost(app, '/api/auth/login', {
    username,
    password: 'secret123',
    remember: true,
  });
  return { token: res.body.token, userId: res.body.user.id, username };
}

export function authGet(app: TestEnv['app'], url: string, token: string) {
  return supertestRaw(app).get(url).set('Authorization', `Bearer ${token}`);
}

export function authPost(app: TestEnv['app'], url: string, body: unknown, token: string) {
  return supertestRaw(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
}

export function authPut(app: TestEnv['app'], url: string, body: unknown, token: string) {
  return supertestRaw(app).put(url).set('Authorization', `Bearer ${token}`).send(body);
}

export function authDelete(app: TestEnv['app'], url: string, token: string) {
  return supertestRaw(app).delete(url).set('Authorization', `Bearer ${token}`);
}

function supertestRaw(app: TestEnv['app']) {
  return supertest(app);
}

function supertestPost(app: TestEnv['app'], url: string, body: unknown) {
  return supertestRaw(app).post(url).send(body);
}

/** Deterministic unique usernames across workers. */
export function uniq(prefix: string): string {
  return `${prefix}${crypto.randomBytes(4).toString('hex')}`;
}
