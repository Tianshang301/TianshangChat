/**
 * One-time importer: copies every row from the legacy better-sqlite3 database
 * (schema.sql layout) into the new Drizzle-managed database, preserving IDs and
 * timestamps exactly.
 *
 * Usage:
 *   pnpm --filter @tianshangchat/server migrate:legacy [-- <legacy-db-path>]
 *
 * Default legacy path: ./database/chat.db (the pre-refactor location).
 */
import 'dotenv/config';

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { db, runMigrations, sqlite } from '../src/infra/db.js';
import { DbGroupRole, DbMessageKind, groupMembers,
  groups,
  messages,
  sessions,
  users,
} from '../src/infra/schema.js';
import { createLogger } from '../src/infra/logger.js';

const log = createLogger('migrate-legacy');

interface CliOptions {
  legacyPath: string;
}

function parseArgs(): CliOptions {
  const idx = process.argv.indexOf('--');
  const rest = idx === -1 ? [] : process.argv.slice(idx + 1);
  return { legacyPath: rest[0] ?? './database/chat.db' };
}

interface LegacyUserRow {
  id: number;
  username: string;
  password_hash: string;
  avatar: string | null;
  created_at: string | null;
}
interface LegacySessionRow {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  remember_me: number | null;
  created_at: string | null;
}
interface LegacyMessageRow {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar: string | null;
  recipient_id: number | null;
  group_id: number | null;
  content: string | null;
  audio_url: string | null;
  duration: string | null;
  type: string | null;
  timestamp: string | null;
  is_read: number | null;
}
interface LegacyGroupRow {
  id: number;
  name: string;
  creator_id: number;
  max_members: number | null;
  created_at: string | null;
}
interface LegacyGroupMemberRow {
  id: number;
  group_id: number;
  user_id: number;
  role: string | null;
  joined_at: string | null;
}

function main(): void {
  const { legacyPath } = parseArgs();
  const resolved = path.isAbsolute(legacyPath) ? legacyPath : path.resolve(process.cwd(), legacyPath);

  if (!fs.existsSync(resolved)) {
    log.error(`Legacy database not found at ${resolved}`);
    process.exit(1);
  }

  // Ensure the target schema exists before importing.
  runMigrations();

  const existing = db.select({ id: users.id }).from(users).limit(1).all();
  if (existing.length > 0) {
    log.error('Target database is not empty. Aborting to prevent duplicate imports.');
    process.exit(1);
  }

  const legacy = new Database(resolved, { readonly: true });
  legacy.pragma('journal_mode = WAL');

  const importAll = sqlite.transaction(() => {
    const userRows = legacy.prepare<unknown[], LegacyUserRow>('SELECT * FROM users ORDER BY id').all();
    for (const r of userRows) {
      db.insert(users)
        .values({
          id: r.id,
          username: r.username,
          passwordHash: r.password_hash,
          avatar: r.avatar,
          createdAt: r.created_at ?? new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    }
    log.info(`users: ${userRows.length}`);

    const sessionRows = legacy
      .prepare<unknown[], LegacySessionRow>('SELECT * FROM sessions ORDER BY id')
      .all();
    for (const r of sessionRows) {
      db.insert(sessions)
        .values({
          id: r.id,
          userId: r.user_id,
          token: r.token,
          expiresAt: r.expires_at,
          rememberMe: r.remember_me ?? 0,
          createdAt: r.created_at ?? new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    }
    log.info(`sessions: ${sessionRows.length}`);

    const messageRows = legacy
      .prepare<unknown[], LegacyMessageRow>('SELECT * FROM messages ORDER BY id')
      .all();
    for (const r of messageRows) {
      db.insert(messages)
        .values({
          id: r.id,
          senderId: r.sender_id,
          senderName: r.sender_name,
          senderAvatar: r.sender_avatar,
          recipientId: r.recipient_id,
          groupId: r.group_id,
          content: r.content,
          audioUrl: r.audio_url,
          duration: r.duration,
          type: (r.type ?? 'text') as DbMessageKind,
          timestamp: r.timestamp ?? new Date().toISOString(),
          isRead: r.is_read ?? 0,
        })
        .onConflictDoNothing()
        .run();
    }
    log.info(`messages: ${messageRows.length}`);

    const groupRows = legacy
      .prepare<unknown[], LegacyGroupRow>('SELECT * FROM `groups` ORDER BY id')
      .all();
    for (const r of groupRows) {
      db.insert(groups)
        .values({
          id: r.id,
          name: r.name,
          creatorId: r.creator_id,
          maxMembers: r.max_members ?? 1000,
          createdAt: r.created_at ?? new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    }
    log.info(`groups: ${groupRows.length}`);

    const memberRows = legacy
      .prepare<unknown[], LegacyGroupMemberRow>('SELECT * FROM group_members ORDER BY id')
      .all();
    for (const r of memberRows) {
      db.insert(groupMembers)
        .values({
          id: r.id,
          groupId: r.group_id,
          userId: r.user_id,
          role: (r.role ?? 'member') as DbGroupRole,
          joinedAt: r.joined_at ?? new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    }
    log.info(`group_members: ${memberRows.length}`);
  });

  importAll();

  // Re-sync AUTOINCREMENT counters so future inserts don't collide with imported ids.
  for (const table of ['users', 'sessions', 'messages', 'groups', 'group_members']) {
    sqlite
      .prepare(
        `INSERT INTO sqlite_sequence(name, seq)
         SELECT '${table}', COALESCE((SELECT MAX(id) FROM ${table}), 0)
         WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = '${table}')`,
      )
      .run();
    sqlite
      .prepare(
        `UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM ${table})
         WHERE name = '${table}' AND seq < (SELECT MAX(id) FROM ${table})`,
      )
      .run();
  }

  legacy.close();
  log.info(`Legacy import complete 鈫?${config.databasePath}`);
}

main();
