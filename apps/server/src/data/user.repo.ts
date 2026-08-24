import { eq, sql } from 'drizzle-orm';
import { db } from '../infra/db.js';
import { users } from '../infra/schema.js';

export interface UserRecord {
  id: number;
  username: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: string;
}

export interface UserPublicRecord {
  id: number;
  username: string;
  avatar: string | null;
  createdAt: string;
}

export class UsernameTakenError extends Error {
  constructor() {
    super('Username already exists');
    this.name = 'UsernameTakenError';
  }
}

export function createUser(username: string, passwordHash: string): { id: number; username: string } {
  try {
    const result = db.insert(users).values({ username, passwordHash }).run();
    return { id: Number(result.lastInsertRowid), username };
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
      throw new UsernameTakenError();
    }
    throw err;
  }
}

/** Full record including password hash — never let this cross the API boundary. */
export function findUserWithSecretByUsername(username: string): UserRecord | undefined {
  const row = db.select().from(users).where(eq(users.username, username)).get();
  return row ?? undefined;
}

export function findUserById(id: number): UserPublicRecord | undefined {
  const row = db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .get();
  return row ?? undefined;
}

/** Semantics identical to legacy SQL: `username LIKE %q% AND id != caller`, capped at 20. */
export function searchUsers(query: string, excludeUserId: number, limit = 20): UserPublicRecord[] {
  return db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(sql`username LIKE ${'%' + query + '%'} AND id != ${excludeUserId}`)
    .limit(limit)
    .all();
}

export function updateUserAvatar(userId: number, avatarUrl: string | null): void {
  db.update(users).set({ avatar: avatarUrl }).where(eq(users.id, userId)).run();
}
