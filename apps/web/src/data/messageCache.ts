import Dexie from 'dexie';
import type { MessageDTO } from '@tianshangchat/shared';
import { chatDb, type OutboxItem, type OutboxKind, type StoredMessage } from './db';
import {
  conversationKey,
  isTempId,
  nextTempId,
  type ConversationScope,
  type MessageStatus,
} from '../core/messageStatus';

/* ------------------------------------------------------------------ */
/* Message cache                                                       */
/* ------------------------------------------------------------------ */

function toStored(msg: MessageDTO, scope: ConversationScope, status: MessageStatus): StoredMessage {
  return { ...msg, convKey: conversationKey(scope), status };
}

export async function putMessages(
  msgs: Array<{ msg: MessageDTO; scope: ConversationScope; status?: MessageStatus }>,
): Promise<void> {
  const rows = msgs.map(({ msg, scope, status }) => toStored(msg, scope, status ?? 'sent'));
  await chatDb.messages.bulkPut(rows);
}

export async function listConversation(
  scope: ConversationScope,
  limit = 200,
): Promise<StoredMessage[]> {
  const key = conversationKey(scope);
  const rows = await chatDb.messages
    .where('[convKey+timestamp]')
    .between([key, Dexie.minKey], [key, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
  rows.reverse();
  return rows;
}

export async function getMessage(id: number): Promise<StoredMessage | undefined> {
  return chatDb.messages.get(id);
}

/** Replaces a temp message with its acknowledged server id. */
export async function promoteTempMessage(tempId: number, real: MessageDTO, convKey: string): Promise<void> {
  await chatDb.transaction('rw', chatDb.messages, async () => {
    await chatDb.messages.delete(tempId);
    await chatDb.messages.put({ ...real, convKey, status: 'sent' });
  });
}

export async function markStatus(ids: number[], status: MessageStatus): Promise<void> {
  await chatDb.messages.bulkPut(
    (await chatDb.messages.bulkGet(ids)).map((row) =>
      row ? { ...row, status } : null,
    ).filter((r): r is StoredMessage => r !== null),
  );
}

export async function maxMessageId(): Promise<number> {
  const last = await chatDb.messages.orderBy('id').last();
  return last ? Math.abs(last.id) : 0;
}

export async function clearCache(): Promise<void> {
  await chatDb.messages.clear();
  await chatDb.meta.clear();
}

/* ------------------------------------------------------------------ */
/* Sync cursor                                                         */
/* ------------------------------------------------------------------ */

const CURSOR_KEY = 'syncCursor';

export async function getSyncCursor(): Promise<number> {
  const row = await chatDb.meta.get(CURSOR_KEY);
  if (row) return Number(row.value);
  return maxMessageId();
}

export async function setSyncCursor(cursor: number): Promise<void> {
  await chatDb.meta.put({ key: CURSOR_KEY, value: String(cursor) });
}

/* ------------------------------------------------------------------ */
/* Outbox                                                              */
/* ------------------------------------------------------------------ */

const BASE_RETRY_MS = 2000;
const MAX_RETRY_MS = 5 * 60_000;

export function backoffMs(attempts: number): number {
  return Math.min(BASE_RETRY_MS * 2 ** attempts, MAX_RETRY_MS);
}

export async function enqueueOutbox(
  kind: OutboxKind,
  tempId: number,
  convKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  await chatDb.outbox.add({
    kind,
    tempId,
    convKey,
    payload,
    attempts: 0,
    createdAt: now,
    nextAttemptAt: now,
  });
}

export async function dueOutboxItems(now = Date.now()): Promise<OutboxItem[]> {
  const all = await chatDb.outbox.toArray();
  return all
    .filter((i) => new Date(i.nextAttemptAt).getTime() <= now)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function recordAttempt(item: OutboxItem): Promise<void> {
  await chatDb.outbox.update(item.id as number, {
    attempts: item.attempts + 1,
    nextAttemptAt: new Date(Date.now() + backoffMs(item.attempts + 1)).toISOString(),
  });
}

export async function removeOutbox(id: number | undefined): Promise<void> {
  if (id === undefined) return;
  await chatDb.outbox.delete(id);
}

/** Re-exported so domain code never imports dexie tables directly. */
export { isTempId, nextTempId };
export type { OutboxKind };
