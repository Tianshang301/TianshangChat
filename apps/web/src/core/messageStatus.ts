/** Delivery lifecycle for messages authored by this client. */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export type ConversationScope =
  | { kind: 'public' }
  | { kind: 'private'; peerId: number }
  | { kind: 'group'; groupId: number };

/** Stable conversation key used across Dexie + store: `public` / `p:3` / `g:5`. */
export function conversationKey(scope: ConversationScope): string {
  switch (scope.kind) {
    case 'public':
      return 'public';
    case 'private':
      return `p:${scope.peerId}`;
    case 'group':
      return `g:${scope.groupId}`;
  }
}

export function privateKey(peerId: number): string {
  return `p:${peerId}`;
}

export function groupKey(groupId: number): string {
  return `g:${groupId}`;
}

/** Derive the conversation a wire message belongs to. */
export function scopeOf(
  msg: { senderId: number; recipientId?: number | null; groupId?: number | null },
  selfId: number,
): ConversationScope {
  if (msg.groupId != null) return { kind: 'group', groupId: msg.groupId };
  if (msg.recipientId != null) {
    const peer = msg.recipientId === selfId ? msg.senderId : msg.recipientId;
    return { kind: 'private', peerId: peer };
  }
  return { kind: 'public' };
}

let tempCounter = 0;

/** Monotonic negative ids for optimistic local messages (never collide with server ids). */
export function nextTempId(): number {
  tempCounter -= 1;
  return tempCounter - Date.now();
}

export function isTempId(id: number): boolean {
  return id < 0;
}
