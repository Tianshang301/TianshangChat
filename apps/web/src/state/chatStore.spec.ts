import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupSummary } from '@tianshangchat/shared';
import { useChatStore } from './chatStore';

const group = (id: number, memberCount: number): GroupSummary => ({
  id,
  name: `g${id}`,
  creatorId: 1,
  createdAt: '2026-01-01T00:00:00Z',
  creatorName: 'alice',
  role: 'member',
  memberCount,
});

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('chat store', () => {
  it('appends messages per conversation key', () => {
    const s = useChatStore.getState();
    s.appendMessage('public', { id: 1, senderId: 1, senderName: 'a', content: 'x', type: 'text', timestamp: 't' });
    s.appendMessage('public', { id: 2, senderId: 2, senderName: 'b', content: 'y', type: 'text', timestamp: 't' });
    s.appendMessage('p:3', { id: 3, senderId: 3, senderName: 'c', content: 'z', type: 'text', timestamp: 't' });

    const state = useChatStore.getState();
    expect(state.messagesByConv['public']).toHaveLength(2);
    expect(state.messagesByConv['p:3']).toHaveLength(1);
  });

  it('replaces temp message ids in place and marks sent', () => {
    const s = useChatStore.getState();
    s.appendMessage('p:4', { id: -50, senderId: 1, senderName: 'a', content: 'q', type: 'text', timestamp: 't' });
    s.replaceTempMessage('p:4', -50, 500);

    const list = useChatStore.getState().messagesByConv['p:4'] ?? [];
    expect(list.map((m) => m.id)).toEqual([500]);
    expect(list[0]?.status).toBe('sent');
  });

  it('tracks unread counters independently per channel', () => {
    const s = useChatStore.getState();
    s.bumpUnreadPrivate(7);
    s.bumpUnreadPrivate(7);
    s.bumpUnreadGroup(8);
    expect(useChatStore.getState().unreadPrivate).toEqual({ 7: 2 });
    expect(useChatStore.getState().unreadGroup).toEqual({ 8: 1 });

    s.clearUnreadPrivate(7);
    expect(useChatStore.getState().unreadPrivate[7]).toBe(0);
    expect(useChatStore.getState().unreadGroup[8]).toBe(1);
  });

  it('upserts groups without duplicating ids', () => {
    const s = useChatStore.getState();
    s.setGroups([group(1, 2)]);
    s.upsertGroup(group(2, 5));
    expect(useChatStore.getState().groups.map((g) => g.id)).toEqual([1, 2]);

    // detail-shaped upsert refreshes the existing summary
    s.upsertGroup({
      id: 1,
      name: 'renamed',
      creatorId: 1,
      maxMembers: 1000,
      createdAt: '2026-01-01T00:00:00Z',
      creatorName: 'alice',
      members: [
        { id: 1, groupId: 1, userId: 1, role: 'creator', joinedAt: 't', username: 'alice', avatar: null },
        { id: 2, groupId: 1, userId: 9, role: 'member', joinedAt: 't', username: 'bob', avatar: null },
      ],
    });
    const after = useChatStore.getState().groups;
    expect(after).toHaveLength(2);
    expect(after.find((g) => g.id === 1)?.name).toBe('renamed');
    expect(after.find((g) => g.id === 1)?.memberCount).toBe(2);
  });
});
