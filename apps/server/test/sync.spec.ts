import { beforeAll, describe, expect, it } from 'vitest';
import {
  authGet,
  authPost,
  buildTestApp,
  loginUser,
  registerUser,
  uniq,
  type Session,
  type TestEnv,
} from './helpers';

function seed(
  db: TestEnv['db'],
  o: { senderId: number; name: string; recipientId?: number | null; groupId?: number | null; content: string },
): number {
  const r = db
    .prepare(
      `INSERT INTO messages (sender_id, sender_name, recipient_id, group_id, content, type, timestamp)
       VALUES (?, ?, ?, ?, ?, 'text', datetime('now'))`,
    )
    .run(o.senderId, o.name, o.recipientId ?? null, o.groupId ?? null, o.content);
  return Number(r.lastInsertRowid);
}

describe('GET /api/sync', () => {
  let env: TestEnv;
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    env = await buildTestApp();
    const a = uniq('syal');
    const b = uniq('sbob');
    await registerUser(env.app, a);
    await registerUser(env.app, b);
    alice = await loginUser(env.app, a);
    bob = await loginUser(env.app, b);
  });

  it('scopes results to caller visibility and advances the cursor', async () => {
    // group visible to both
    const created = await authPost(
      env.app,
      '/api/groups',
      { name: 'SyncGroup', memberIds: [bob.userId] },
      alice.token,
    );
    const gid = created.body.group.id;

    seed(env.db, { senderId: alice.userId, name: 'a', content: 'pub' });
    seed(env.db, {
      senderId: alice.userId,
      name: 'a',
      recipientId: bob.userId,
      content: 'dm-to-bob',
    });
    seed(env.db, {
      senderId: bob.userId,
      name: 'b',
      recipientId: alice.userId,
      content: 'dm-from-bob',
    });
    seed(env.db, { senderId: alice.userId, name: 'a', groupId: gid, content: 'grp' });

    const full = await authGet(env.app, '/api/sync?cursor=0&limit=500', bob.token);
    expect(full.status).toBe(200);
    const contents = (full.body.messages as Array<{ content: string }>).map((m) => m.content);
    expect(contents).toContain('pub');
    expect(contents).toContain('dm-to-bob');
    expect(contents).toContain('grp');

    // incremental: after cursor at max id, nothing new
    const inc = await authGet(
      env.app,
      `/api/sync?cursor=${full.body.nextCursor}&limit=100`,
      bob.token,
    );
    expect(inc.body.messages).toHaveLength(0);

    // limit paging returns ascending order and a moving cursor
    const paged = await authGet(env.app, '/api/sync?cursor=0&limit=2', bob.token);
    const pageIds = (paged.body.messages as Array<{ id: number }>).map((m) => m.id);
    expect(pageIds).toHaveLength(2);
    expect(pageIds[0]).toBeLessThan(pageIds[1]!);
    expect(paged.body.nextCursor).toBe(pageIds[1]);
  });
});
