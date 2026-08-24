import type { MessageDTO } from '@tianshangchat/shared';
import { chatStoreApi as store } from '../state/chatStore';
import { api } from '../data/apiClient';
import {
  clearCache,
  getSyncCursor,
  putMessages,
  setSyncCursor,
} from '../data/messageCache';
import { conversationKey, scopeOf, privateKey, groupKey } from '../core/messageStatus';

/**
 * Incremental catch-up: pulls every caller-visible message after the persisted
 * cursor into the Dexie cache and refreshes any conversation that is already
 * materialised in the store.
 */
export async function runIncrementalSync(token: string): Promise<void> {
  const s = store.getState();
  const self = s.currentUser;
  if (!self) return;

  let cursor = await getSyncCursor();
  // Guard against cursor drift (e.g. cache cleared but meta kept).
  for (let page = 0; page < 20; page++) {
    const res = await api.sync(token, cursor);
    if (!res.success || res.messages.length === 0) break;

    await putMessages(
      res.messages.map((m) => ({ msg: m, scope: scopeOf(m, self.id) })),
    );
    cursor = res.nextCursor;
    await setSyncCursor(cursor);

    applyToOpenConversations(res.messages, self.id);
  }
}

function applyToOpenConversations(msgs: MessageDTO[], selfId: number): void {
  const s = store.getState();
  for (const key of Object.keys(s.messagesByConv)) {
    const inConv = msgs.filter((m) => conversationKey(scopeOf(m, selfId)) === key);
    if (inConv.length === 0) continue;

    const existing = s.messagesByConv[key] ?? [];
    const byId = new Map(existing.map((m) => [m.id, m]));
    for (const m of inConv) byId.set(m.id, m);

    const merged = [...byId.values()].sort(
      (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id - b.id,
    );
    s.setConversation(key, merged);
  }

  // Unread bumps for messages that arrived while detached from a live socket.
  for (const m of msgs) {
    if (m.senderId === selfId) continue;
    const scope = scopeOf(m, selfId);
    if (scope.kind === 'private') {
      const open = s.privateChatUser?.id === scope.peerId;
      if (!open && !existingHasUnread(s.unreadPrivate, scope.peerId, m.id)) {
        s.bumpUnreadPrivate(scope.peerId);
      }
    } else if (scope.kind === 'group') {
      const open = s.selectedGroup?.id === scope.groupId;
      if (!open && !existingHasUnread(s.unreadGroup, scope.groupId, m.id)) {
        s.bumpUnreadGroup(scope.groupId);
      }
    }
  }
}

/** Simple dedupe guard: only bump once per sync batch per conversation. */
const bumpedPerBatch = new Set<string>();

function existingHasUnread(map: Record<number, number>, id: number, messageId: number): boolean {
  const k = `${id}:${messageId}`;
  if ((map[id] ?? 0) > 0 || bumpedPerBatch.has(k)) {
    return true;
  }
  bumpedPerBatch.add(k);
  return false;
}

export function resetSyncState(): void {
  bumpedPerBatch.clear();
}

export async function wipeLocalData(): Promise<void> {
  resetSyncState();
  await clearCache();
}

export { privateKey, groupKey };
