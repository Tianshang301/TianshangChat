import { and, asc, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../infra/db.js';
import { messages } from '../infra/schema.js';
import type { MessageKind } from '@tianshangchat/shared';

export interface MessageRecord {
  id: number;
  senderId: number;
  senderName: string;
  senderAvatar: string | null;
  recipientId: number | null;
  groupId: number | null;
  content: string | null;
  audioUrl: string | null;
  duration: string | null;
  type: MessageKind;
  timestamp: string;
  isRead: number;
}

export interface CreateMessageInput {
  senderId: number;
  senderName: string;
  senderAvatar?: string | null;
  recipientId?: number | null;
  groupId?: number | null;
  content?: string | null;
  audioUrl?: string | null;
  duration?: string | number | null;
  type: MessageKind;
}

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function createMessage(input: CreateMessageInput): { id: number } & CreateMessageInput {
  const result = db
    .insert(messages)
    .values({
      senderId: input.senderId,
      senderName: input.senderName,
      senderAvatar: input.senderAvatar ?? null,
      recipientId: input.recipientId ?? null,
      groupId: input.groupId ?? null,
      content: input.content ?? null,
      audioUrl: input.audioUrl ?? null,
      duration:
        input.duration === undefined || input.duration === null ? null : String(input.duration),
      type: input.type,
    })
    .run();
  return { id: Number(result.lastInsertRowid), ...input };
}

const publicScope = () => and(isNull(messages.recipientId), isNull(messages.groupId));

export function getHistory(days = 7, limit = 500): MessageRecord[] {
  return db
    .select()
    .from(messages)
    .where(and(publicScope(), gte(messages.timestamp, cutoffIso(days))))
    .orderBy(asc(messages.timestamp))
    .limit(limit)
    .all();
}

/** Descending fetch reversed to ascending — preserves legacy pagination semantics. */
export function getHistoryBefore(beforeTimestamp: string, limit = 100): MessageRecord[] {
  const rows = db
    .select()
    .from(messages)
    .where(and(publicScope(), lt(messages.timestamp, beforeTimestamp)))
    .orderBy(desc(messages.timestamp))
    .limit(limit)
    .all();
  rows.reverse();
  return rows;
}

export function getPrivateHistory(
  userId1: number,
  userId2: number,
  days = 30,
  limit = 100,
): MessageRecord[] {
  return db
    .select()
    .from(messages)
    .where(
      and(
        or(
          and(eq(messages.senderId, userId1), eq(messages.recipientId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.recipientId, userId1)),
        ),
        gte(messages.timestamp, cutoffIso(days)),
      ),
    )
    .orderBy(asc(messages.timestamp))
    .limit(limit)
    .all();
}

export function getGroupHistory(groupId: number, days = 30, limit = 500): MessageRecord[] {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.groupId, groupId), gte(messages.timestamp, cutoffIso(days))))
    .orderBy(asc(messages.timestamp))
    .limit(limit)
    .all();
}

export function getGroupHistoryBefore(
  groupId: number,
  beforeTimestamp: string,
  limit = 100,
): MessageRecord[] {
  const rows = db
    .select()
    .from(messages)
    .where(and(eq(messages.groupId, groupId), lt(messages.timestamp, beforeTimestamp)))
    .orderBy(desc(messages.timestamp))
    .limit(limit)
    .all();
  rows.reverse();
  return rows;
}

export interface ConversationRecord {
  otherUserId: number;
  otherUsername: string;
  otherAvatar: string | null;
  lastMessageTime: string | null;
  lastMessage: string | null;
  unreadCount: number;
}

/**
 * Verbatim port of `models/Message.getPrivateList` (legacy correlated-subquery form).
 * A clean rewrite is deliberately deferred to Phase 2 — behavior preservation first.
 */
export function getPrivateList(userId: number, limit = 50): ConversationRecord[] {
  const rows = db.all<{
    other_user_id: number;
    other_username: string;
    other_avatar: string | null;
    last_message_time: string | null;
    last_message: string | null;
    unread_count: number;
  }>(sql`
    SELECT
      CASE
        WHEN sender_id = ${userId} THEN recipient_id
        ELSE sender_id
      END as other_user_id,
      u.username as other_username,
      u.avatar as other_avatar,
      MAX(timestamp) as last_message_time,
      (SELECT content FROM messages m2
       WHERE (m2.sender_id = ${userId} AND m2.recipient_id = CASE WHEN sender_id = ${userId} THEN recipient_id ELSE sender_id END
              OR m2.sender_id = CASE WHEN sender_id = ${userId} THEN recipient_id ELSE sender_id END AND m2.recipient_id = ${userId})
       ORDER BY timestamp DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages
       WHERE sender_id != ${userId} AND recipient_id = ${userId} AND is_read = 0) as unread_count
    FROM messages
    JOIN users u ON u.id = CASE
        WHEN sender_id = ${userId} THEN recipient_id
        ELSE sender_id
      END
    WHERE (recipient_id = ${userId} OR sender_id = ${userId})
      AND group_id IS NULL
    GROUP BY other_user_id
    ORDER BY last_message_time DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    otherUserId: r.other_user_id,
    otherUsername: r.other_username,
    otherAvatar: r.other_avatar,
    lastMessageTime: r.last_message_time,
    lastMessage: r.last_message,
    unreadCount: r.unread_count,
  }));
}

export function markPrivateAsRead(recipientId: number, senderId: number): void {
  db.update(messages)
    .set({ isRead: 1 })
    .where(
      and(
        eq(messages.recipientId, recipientId),
        eq(messages.senderId, senderId),
        eq(messages.isRead, 0),
      ),
    )
    .run();
}

export function markGroupAsRead(groupId: number, userId: number): void {
  db.update(messages)
    .set({ isRead: 1 })
    .where(and(eq(messages.groupId, groupId), sql`sender_id != ${userId}`))
    .run();
}

export function getUnreadCount(userId: number): number {
  const row = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(messages)
    .where(and(eq(messages.recipientId, userId), eq(messages.isRead, 0)))
    .get();
  return row?.count ?? 0;
}
