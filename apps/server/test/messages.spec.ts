import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import {
  authGet,
  buildTestApp,
  loginUser,
  registerUser,
  uniq,
  type Session,
  type TestEnv,
} from './helpers';

/**
 * Seeds messages directly through the raw sqlite handle so REST mapping and
 * read-marking side effects can be asserted without a socket layer.
 */
function seedMessage(
  db: TestEnv['db'],
  o: {
    senderId: number;
    senderName: string;
    recipientId?: number | null;
    groupId?: number | null;
    content: string;
    isRead?: number;
  },
): number {
  const result = db
    .prepare(
      `INSERT INTO messages (sender_id, sender_name, recipient_id, group_id, content, type, timestamp, is_read)
       VALUES (?, ?, ?, ?, ?, 'text', datetime('now'), ?)`,
    )
    .run(o.senderId, o.senderName, o.recipientId ?? null, o.groupId ?? null, o.content, o.isRead ?? 0);
  return Number(result.lastInsertRowid);
}

describe('messages REST', () => {
  let env: TestEnv;
  let alice: Session;
  let bob: Session;

  const aliceName = uniq('malice');
  const bobName = uniq('mbob');

  beforeAll(async () => {
    env = await buildTestApp();
    await registerUser(env.app, aliceName);
    await registerUser(env.app, bobName);
    alice = await loginUser(env.app, aliceName);
    bob = await loginUser(env.app, bobName);

    seedMessage(env.db, { senderId: alice.userId, senderName: aliceName, content: 'public-1' });
    seedMessage(env.db, { senderId: bob.userId, senderName: bobName, content: 'public-2' });
    seedMessage(env.db, {
      senderId: bob.userId,
      senderName: bobName,
      recipientId: alice.userId,
      content: 'private-unread',
    });
  });

  it('returns camelCase public history', async () => {
    const res = await authGet(env.app, '/api/messages/history?days=7&limit=100', alice.token);
    expect(res.status).toBe(200);
    const msgs = res.body.messages as Array<Record<string, unknown>>;
    expect(msgs.some((m) => m.content === 'public-1')).toBe(true);
    expect(msgs[0]).toHaveProperty('senderId');
    expect(msgs[0]).toHaveProperty('audioUrl');
  });

  it('paginates backwards with the before cursor', async () => {
    const all = await authGet(env.app, '/api/messages/history?days=7&limit=100', alice.token);
    const last = (all.body.messages as Array<{ id: number }>).at(-1) as { id: number };

    const res = await authGet(
      env.app,
      `/api/messages/before?before=${encodeURIComponent('2100-01-01T00:00:00Z')}&limit=1`,
      alice.token,
    );
    // before-cursor with far-future date returns newest-first limited to 1
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    void last;
  });

  it('lists private conversations with unread counts and marks them read on fetch', async () => {
    const unread = await authGet(env.app, '/api/messages/unread', alice.token);
    expect(unread.body.count).toBe(1);

    const list = await authGet(env.app, '/api/messages/private-list?limit=50', alice.token);
    expect(list.status).toBe(200);
    const conv = list.body.conversations.find((c: { username: string }) => c.username === bobName);
    expect(conv).toBeTruthy();
    expect(conv.unreadCount).toBe(1);

    // Fetching the private thread marks it read (legacy side effect).
    await authGet(env.app, `/api/messages/private/${bob.userId}?days=30`, alice.token);
    const unreadAfter = await authGet(env.app, '/api/messages/unread', alice.token);
    expect(unreadAfter.body.count).toBe(0);
  });

  it('404s unknown routes through the central handler', async () => {
    const res = await supertest(env.app).get('/api/nope').set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(404);
    void bobName;
  });
});
