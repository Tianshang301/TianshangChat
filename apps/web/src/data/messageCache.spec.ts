import { beforeEach, describe, expect, it } from 'vitest';
import type { MessageDTO } from '@tianshangchat/shared';
import {
  backoffMs,
  dueOutboxItems,
  enqueueOutbox,
  getSyncCursor,
  listConversation,
  markStatus,
  promoteTempMessage,
  putMessages,
  recordAttempt,
  setSyncCursor,
} from './messageCache';
import { chatDb } from './db';

function msg(id: number, _convKey: string, timestamp: string): MessageDTO {
  return {
    id,
    senderId: 1,
    senderName: 'alice',
    content: `m${id}`,
    type: 'text',
    timestamp,
  };
}

beforeEach(async () => {
  await chatDb.messages.clear();
  await chatDb.outbox.clear();
  await chatDb.meta.clear();
});

describe('message cache', () => {
  it('stores and lists by conversation in chronological order', async () => {
    await putMessages([
      { msg: msg(2, 'p:3', '2026-01-01T00:02:00Z'), scope: { kind: 'private', peerId: 3 } },
      { msg: msg(1, 'p:3', '2026-01-01T00:01:00Z'), scope: { kind: 'private', peerId: 3 } },
      { msg: msg(9, 'public', '2026-01-01T00:03:00Z'), scope: { kind: 'public' } },
    ]);

    const conv = await listConversation({ kind: 'private', peerId: 3 });
    expect(conv.map((m) => m.id)).toEqual([1, 2]);
    expect(conv[0]?.convKey).toBe('p:3');

    const pub = await listConversation({ kind: 'public' });
    expect(pub.map((m) => m.id)).toEqual([9]);
  });

  it('promotes temp ids to real server ids', async () => {
    const scope = { kind: 'private' as const, peerId: 5 };
    await putMessages([{ msg: msg(-100, 'p:5', 't0'), scope }]);
    await promoteTempMessage(
      -100,
      { ...msg(77, '', 't0'), recipientId: 5 },
      'p:5',
    );

    expect(await chatDb.messages.get(-100)).toBeUndefined();
    const promoted = await chatDb.messages.get(77);
    expect(promoted?.convKey).toBe('p:5');
  });

  it('applies delivery/read status transitions', async () => {
    const scope = { kind: 'group' as const, groupId: 2 };
    await putMessages([{ msg: msg(11, 'g:2', 't'), scope }]);
    await markStatus([11], 'delivered');
    expect((await listConversation(scope))[0]?.status).toBe('delivered');
    await markStatus([11], 'read');
    expect((await listConversation(scope))[0]?.status).toBe('read');
  });

  it('persists and returns the sync cursor', async () => {
    expect(await getSyncCursor()).toBe(0);
    await setSyncCursor(1234);
    expect(await getSyncCursor()).toBe(1234);
  });
});

describe('outbox', () => {
  it('queues items due immediately and applies exponential backoff on retry', async () => {
    await enqueueOutbox('private-text', -1, 'p:3', { recipientId: 3, content: 'hi' });
    let due = await dueOutboxItems();
    expect(due).toHaveLength(1);

    // attempt fails -> next attempt pushed into the future
    await recordAttempt(due[0]!);
    due = await dueOutboxItems(Date.now());
    expect(due).toHaveLength(0);

    // but becomes due again after its backoff window
    const later = Date.now() + backoffMs(1) + 1000;
    due = await dueOutboxItems(later);
    expect(due).toHaveLength(1);
    expect(due[0]?.attempts).toBe(1);
  });

  it('caps backoff growth', () => {
    expect(backoffMs(0)).toBe(2000);
    expect(backoffMs(1)).toBe(4000);
    expect(backoffMs(20)).toBeLessThanOrEqual(5 * 60_000);
  });
});
