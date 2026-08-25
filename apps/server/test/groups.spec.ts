import { beforeAll, describe, expect, it } from 'vitest';
import {
  authDelete,
  authGet,
  authPost,
  authPut,
  buildTestApp,
  loginUser,
  registerUser,
  uniq,
  type Session,
  type TestEnv,
} from './helpers';

describe('groups REST', () => {
  let env: TestEnv;
  let owner: Session;
  let member: Session;
  let outsider: Session;

  beforeAll(async () => {
    env = await buildTestApp();
    const o = uniq('gowner');
    const m = uniq('gmember');
    const x = uniq('gout');
    await registerUser(env.app, o);
    await registerUser(env.app, m);
    await registerUser(env.app, x);
    owner = await loginUser(env.app, o);
    member = await loginUser(env.app, m);
    outsider = await loginUser(env.app, x);
  });

  let groupId = 0;

  it('creates a group with initial members (Zod validated)', async () => {
    const bad = await authPost(env.app, '/api/groups', { name: '', memberIds: [] }, owner.token);
    expect(bad.status).toBe(400);

    const res = await authPost(
      env.app,
      '/api/groups',
      { name: 'Test Group', memberIds: [member.userId] },
      owner.token,
    );
    expect(res.status).toBe(201);
    expect(res.body.group.name).toBe('Test Group');
    expect(res.body.group.creatorId).toBe(owner.userId);
    expect(res.body.group.members).toHaveLength(2);
    groupId = res.body.group.id;
  });

  it('hides group detail from non-members', async () => {
    const res = await authGet(env.app, `/api/groups/${groupId}`, outsider.token);
    expect(res.status).toBe(403);
  });

  it('blocks non-admin members from adding users but allows admins/creator', async () => {
    const asMember = await authPost(
      env.app,
      `/api/groups/${groupId}/members`,
      { userId: outsider.userId },
      member.token,
    );
    expect(asMember.status).toBe(403);

    const asOwner = await authPost(
      env.app,
      `/api/groups/${groupId}/members`,
      { userId: outsider.userId },
      owner.token,
    );
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.group.members).toHaveLength(3);
  });

  it('promotes/demotes admins (creator only)', async () => {
    const promote = await authPut(
      env.app,
      `/api/groups/${groupId}/admin/${member.userId}`,
      { isAdmin: true },
      owner.token,
    );
    expect(promote.status).toBe(200);

    const selfDemote = await authPut(
      env.app,
      `/api/groups/${groupId}/admin/${owner.userId}`,
      { isAdmin: false },
      owner.token,
    );
    // creator cannot change own role
    expect(selfDemote.status).toBe(400);
  });

  it('transfers ownership and keeps roles consistent', async () => {
    const res = await authPost(
      env.app,
      `/api/groups/${groupId}/transfer`,
      { newOwnerId: member.userId },
      owner.token,
    );
    expect(res.status).toBe(200);
    const detail = await authGet(env.app, `/api/groups/${groupId}`, owner.token);
    const creatorRow = detail.body.group.members.find((m: { role: string }) => m.role === 'creator');
    expect(creatorRow.userId).toBe(member.userId);
    void authDelete;
  });

  it("blocks the creator from leaving", async () => {
    // ownership moved to member; original owner is now admin/member — leave ok
    const leave = await authPost(env.app, `/api/groups/${groupId}/leave`, {}, owner.token);
    expect(leave.status).toBe(200);

    // current creator must be blocked
    const blocked = await authPost(env.app, `/api/groups/${groupId}/leave`, {}, member.token);
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe('CREATOR_CANNOT_LEAVE');
  });
});
