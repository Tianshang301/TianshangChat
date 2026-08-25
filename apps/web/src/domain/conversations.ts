import type { MessageDTO } from '@tianshangchat/shared';
import { isEnvelope } from '@tianshangchat/crypto';
import type { ConversationScope } from '../core/messageStatus';
import { conversationKey } from '../core/messageStatus';
import { chatStoreApi as store } from '../state/chatStore';
import type { StoreMessage } from '../state/chatStore';
import { api } from '../data/apiClient';
import { listConversation, putMessages, getMessage } from '../data/messageCache';
import { acknowledgeVisible } from './messaging';
import { openGroupIncoming } from './groups-e2ee';
import { openPrivateIncoming } from './e2ee';

/**
 * Cache-first conversation loader: render from IndexedDB instantly, then
 * refresh from the server window and merge.
 */
export async function loadConversation(
  token: string,
  scope: ConversationScope,
  fetchWindow: () => Promise<MessageDTO[]>,
): Promise<void> {
  const key = conversationKey(scope);
  const s = store.getState();

  // 1. Cache-first paint.
  const cached = await listConversation(scope);
  s.setConversation(
    key,
    cached.map(cachedToStore),
  );

  // 2. Server window refresh + merge.
  const fresh = await fetchWindow();
  const selfId = store.getState().currentUser?.id;
  if (selfId === undefined) return;
  await putMessages(fresh.map((m) => ({ msg: m, scope })));

  const byId = new Map<number, StoreMessage>();
  for (const m of cached) byId.set(m.id, m);
  for (const m of fresh) byId.set(m.id, m);
  const merged = [...byId.values()].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id - b.id,
  );

  // 3. Decrypt E2EE envelopes in strict chronological order so the receiving
  //    ratchet chain advances exactly as the sender produced it.
  if (scope.kind !== 'public') {
    for (const row of merged) {
      if (!isEnvelope(row.content)) continue;
      try {
        const view =
          scope.kind === 'private'
            ? ((await openPrivateIncoming(token ?? '', scope.peerId, row.content as string)) as unknown as import('../state/chatStore').DecryptedView)
            : await openGroupIncoming(scope.groupId, row.senderId, row.content as string);
        if (!view) {
          row.secureFailed = true;
          continue;
        }
        row.decrypted = view;
      } catch {
        row.secureFailed = true;
      }
    }
    await putMessages(merged.map((m) => ({ msg: m, scope })));
  }

  store.getState().setConversation(key, merged);

  // 4. Receipts for incoming messages in this view.
  const incoming = merged
    .filter((m) => m.senderId !== selfId && !isReadLocally(m))
    .map((m) => m.id)
    .filter((id) => id > 0);
  if (incoming.length > 0) {
    acknowledgeVisible(incoming, scope);
  }
}

function isReadLocally(m: { status?: string }): boolean {
  return m.status === 'read';
}

function cachedToStore(m: Awaited<ReturnType<typeof listConversation>>[number]): StoreMessage {
  return { ...m };
}

export async function openPrivateConversation(token: string, peerId: number): Promise<void> {
  await loadConversation(token, { kind: 'private', peerId }, () =>
    api.privateHistory(token, peerId),
  );
}

export async function openGroupConversation(token: string, groupId: number): Promise<void> {
  await loadConversation(token, { kind: 'group', groupId }, () =>
    api.groupHistory(token, groupId),
  );
}

export async function openPublicConversation(token: string): Promise<void> {
  await loadConversation(token, { kind: 'public' }, () => api.history(token));
}

/** Used when a single message must be re-read (outbox flush edge cases). */
export async function readCachedMessage(id: number): Promise<unknown> {
  return getMessage(id);
}
