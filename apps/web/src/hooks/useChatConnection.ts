import { useEffect } from 'react';
import type { MessageDTO, OnlineUser } from '@tianshangchat/shared';
import { bindServerHandlers, connect, disconnect } from '../data/socketAdapter';
import { chatStoreApi as store } from '../state/chatStore';
import { useUiStore } from '../state/uiStore';
import {
  acknowledgeVisible,
  flushOutbox,
  ingestIncoming,
  setFocusProbe,
} from '../domain/messaging';
import { runIncrementalSync } from '../domain/sync';
import { openPublicConversation } from '../domain/conversations';
import { api } from '../data/apiClient';
import { conversationKey } from '../core/messageStatus';
import { markStatus } from '../data/messageCache';

/**
 * Owns the socket lifecycle for the signed-in user.
 *
 * All handlers read fresh state via `store.getState()` — this fixes the
 * stale-closure bugs of the legacy single-useEffect wiring.
 */
export function useChatConnection(
  user: { id: number; username: string; avatar: string | null } | null,
  token: string | null,
): void {
  // Window focus tracking (drives notification suppression + auto receipts).
  useEffect(() => {
    const onFocus = () => {
      useUiStore.getState().setWindowFocused(true);
      setFocusProbe(true);
    };
    const onBlur = () => {
      useUiStore.getState().setWindowFocused(false);
      setFocusProbe(false);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Outbound queue flush on connectivity regain.
  useEffect(() => {
    const onOnline = () => void flushOutbox();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    if (!user || !token) return;

    store
      .getState()
      .setCurrentUser({ id: user.id, username: user.username, avatar: user.avatar ?? null });
    setFocusProbe(document.hasFocus());

    const socket = connect(token);

    socket.on('connect', () => {
      store.getState().setConnected(true);
      // Reconnect: catch up on anything missed, then flush queued sends.
      void runIncrementalSync(token)
        .catch((err) => console.error('[sync] catch-up failed:', err))
        .then(() => flushOutbox().catch(() => {}));
    });
    socket.on('disconnect', () => {
      store.getState().setConnected(false);
    });

    let hydrated = false;

    bindServerHandlers({
      authenticated: () => {
        if (hydrated) return;
        hydrated = true;
        store.getState().setConnected(true);
        void (async () => {
          await openPublicConversation(token);
          await runIncrementalSync(token).catch((err) =>
            console.error('[sync] initial catch-up failed:', err),
          );
          await flushOutbox().catch(() => {});
        })();
      },

      'user-list-update': (users: OnlineUser[]) => {
        store.getState().setUsers(users.filter((u) => u.id !== user.id));
      },

      'user-left': ({ userId }) => store.getState().removeUser(userId),

      'group-list-update': ({ groups }) => store.getState().setGroups(groups),

      'group-created': ({ group }) => store.getState().upsertGroup(group),

      'group-updated': ({ group }) => store.getState().upsertGroup(group),

      'member-joined': ({ group }) => store.getState().upsertGroup(group),

      'member-left': ({ groupId }) => {
        void api.groupDetail(token, groupId).then((detail) => {
          if (detail) store.getState().upsertGroup(detail);
        });
      },

      'receive-message': (message: MessageDTO) => ingestIncoming(message),

      'receive-private-message': ({ message }) => ingestIncoming(message),

      'receive-group-message': ({ message }) => ingestIncoming(message),

      'message-status': ({ statuses }) => {
        for (const status of ['delivered', 'read'] as const) {
          const subset = statuses.filter((s) => s.status === status).map((s) => s.id);
          if (subset.length > 0) {
            store.getState().setMessageStatuses(subset, status);
            void markStatus(subset, status);
          }
        }
      },

      'private-typing-start': ({ username }) => store.getState().setPrivateTyping(username),
      'private-typing-stop': () => store.getState().setPrivateTyping(null),

      'avatar-updated': () => {
        /* presence avatars refresh on next user-list-update; no-op keeps UI stable */
      },
    });

    // Auto-receipts when window regains focus with an open conversation.
    const unsubFocus = useUiStore.subscribe((state, prev) => {
      if (state.isWindowFocused && !prev.isWindowFocused) {
        const cs = store.getState();
        const selfId = cs.currentUser?.id;
        const scope = cs.privateChatUser
          ? ({ kind: 'private', peerId: cs.privateChatUser.id } as const)
          : cs.selectedGroup
            ? ({ kind: 'group', groupId: cs.selectedGroup.id } as const)
            : ({ kind: 'public' } as const);
        const key = conversationKey(scope);
        const unreadIncoming = (cs.messagesByConv[key] ?? [])
          .filter((m) => selfId !== undefined && m.senderId !== selfId && m.status !== 'read')
          .map((m) => m.id)
          .filter((id) => id > 0);
        if (unreadIncoming.length > 0) {
          acknowledgeVisible(unreadIncoming, scope);
        }
      }
    });

    return () => {
      unsubFocus();
      disconnect();
      store.getState().reset();
      useUiStore.getState().setMobileTab('public');
    };
  }, [user?.id, token]);
}
