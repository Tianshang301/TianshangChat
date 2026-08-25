import { describe, expect, it } from 'vitest';
import {
  conversationKey,
  groupKey,
  isTempId,
  nextTempId,
  privateKey,
  scopeOf,
} from './messageStatus';

describe('conversation keys', () => {
  it('maps scopes to stable keys', () => {
    expect(conversationKey({ kind: 'public' })).toBe('public');
    expect(conversationKey({ kind: 'private', peerId: 3 })).toBe('p:3');
    expect(conversationKey({ kind: 'group', groupId: 7 })).toBe('g:7');
    expect(privateKey(3)).toBe('p:3');
    expect(groupKey(7)).toBe('g:7');
  });
});

describe('scopeOf', () => {
  const self = 1;
  it('routes group messages by groupId regardless of direction', () => {
    expect(scopeOf({ senderId: self, groupId: 5 }, self)).toEqual({ kind: 'group', groupId: 5 });
    expect(scopeOf({ senderId: 9, groupId: 5 }, self)).toEqual({ kind: 'group', groupId: 5 });
  });

  it('normalises private conversations to the peer', () => {
    // incoming from peer 4
    expect(scopeOf({ senderId: 4, recipientId: self }, self)).toEqual({
      kind: 'private',
      peerId: 4,
    });
    // outgoing to peer 4
    expect(scopeOf({ senderId: self, recipientId: 4 }, self)).toEqual({
      kind: 'private',
      peerId: 4,
    });
  });

  it('falls back to public when no recipient/group', () => {
    expect(scopeOf({ senderId: 2 }, self)).toEqual({ kind: 'public' });
  });
});

describe('temp ids', () => {
  it('are negative and monotonically unique', () => {
    const a = nextTempId();
    const b = nextTempId();
    expect(a).toBeLessThan(0);
    expect(b).toBeLessThan(a);
    expect(isTempId(a)).toBe(true);
    expect(isTempId(b)).toBe(true);
    expect(isTempId(42)).toBe(false);
  });
});
