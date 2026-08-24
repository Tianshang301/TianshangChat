import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../infra/db.js';
import { sessions } from '../infra/schema.js';

export interface SessionRecord {
  id: number;
  userId: number;
  token: string;
  expiresAt: string;
  rememberMe: number;
  createdAt: string;
}

/**
 * Legacy semantics preserved intentionally (Phase 1):
 * login wipes all prior sessions of the user — one live session per account.
 * Phase 3 revisits this for multi-device E2EE.
 */
export function replaceUserSession(session: {
  userId: number;
  token: string;
  expiresAt: string;
  rememberMe: boolean;
}): void {
  db.delete(sessions).where(eq(sessions.userId, session.userId)).run();
  db.insert(sessions)
    .values({
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
      rememberMe: session.rememberMe ? 1 : 0,
    })
    .run();
}

export function findLiveSessionByToken(token: string): SessionRecord | undefined {
  const row = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, sql`(datetime('now'))`)))
    .get();
  return row ?? undefined;
}

export function deleteSessionByToken(token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}
