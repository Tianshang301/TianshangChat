import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';

/** Wire message discriminator — kept aligned with the shared protocol. */
export type DbMessageKind = 'text' | 'voice';
export type DbGroupRole = 'creator' | 'admin' | 'member';

/**
 * Schema mirrors the legacy `database/schema.sql` layout 1:1
 * so the one-time legacy importer can copy rows without transformation.
 */

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatar: text('avatar'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull(),
    expiresAt: text('expires_at').notNull(),
    rememberMe: integer('remember_me').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index('idx_sessions_token').on(t.token),
    index('idx_sessions_user').on(t.userId),
  ],
);

export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    senderId: integer('sender_id')
      .notNull()
      .references(() => users.id),
    senderName: text('sender_name').notNull(),
    senderAvatar: text('sender_avatar'),
    recipientId: integer('recipient_id').references(() => users.id),
    groupId: integer('group_id'),
    content: text('content'),
    audioUrl: text('audio_url'),
    duration: text('duration'),
    type: text('type').$type<DbMessageKind>().notNull().default('text'),
    timestamp: text('timestamp')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    /** ISO timestamp when the server pushed this message to its recipient(s). */
    deliveredAt: text('delivered_at'),
    isRead: integer('is_read').notNull().default(0),
  },
  (t) => [
    index('idx_messages_timestamp').on(t.timestamp),
    index('idx_messages_recipient').on(t.recipientId),
    index('idx_messages_group').on(t.groupId),
    index('idx_messages_sender').on(t.senderId),
  ],
);

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => users.id),
  maxMembers: integer('max_members').notNull().default(1000),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const groupMembers = sqliteTable(
  'group_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').$type<DbGroupRole>().notNull().default('member'),
    joinedAt: text('joined_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex('uq_group_members_group_user').on(t.groupId, t.userId),
    index('idx_group_members_group').on(t.groupId),
    index('idx_group_members_user').on(t.userId),
  ],
);

/**
 * E2EE prekey bundles (Phase 3). One active bundle per user (single-device
 * model for now); contents are public keys only — never private material.
 */
export const e2eeBundles = sqliteTable('e2ee_bundles', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id),
  /** X25519 identity public key. */
  ikPub: text('ik_pub').notNull(),
  /** Ed25519 signing public key (verifies spk_sig). */
  edPub: text('ed_pub').notNull(),
  /** Signed prekey X25519 public key. */
  spkPub: text('spk_pub').notNull(),
  /** Ed25519 signature over the signed-prekey context||spkPub. */
  spkSig: text('spk_sig').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Web Push subscriptions (Phase 5). One row per browser/endpoint; payloads are
 * encrypted per-subscription by the web-push library using these keys.
 */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex('uq_push_endpoint').on(t.endpoint),
    index('idx_push_user').on(t.userId),
  ],
);
