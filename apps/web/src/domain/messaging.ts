import type { MessageDTO } from '@tianshangchat/shared';
import { chatStoreApi as store } from '../state/chatStore';
import type { StoreMessage } from '../state/chatStore';
import {
  enqueueOutbox,
  getMessage,
  promoteTempMessage,
  putMessages,
  removeOutbox,
  dueOutboxItems,
  recordAttempt,
  type OutboxKind,
} from '../data/messageCache';
import { emitWithAck, getSocket } from '../data/socketAdapter';
import {
  conversationKey,
  nextTempId,
  scopeOf,
  type ConversationScope,
} from '../core/messageStatus';
import { showNotification } from '../utils/notifications';

type SendEvent = Parameters<typeof emitWithAck>[0];
type SendOutcome = 'acked' | 'queued';

/* ------------------------------------------------------------------ */
/* Optimistic send pipeline                                            */
/* ------------------------------------------------------------------ */

interface SendPlan {
  kind: OutboxKind;
  event: SendEvent;
  scope: ConversationScope;
  /** Full wire DTO minus id — the acked server id replaces the local temp id. */
  dto: Omit<MessageDTO, 'id'>;
  payload: Record<string, unknown>;
}

function textPlan(scope: ConversationScope, content: string): SendPlan {
  const me = requireSelf();
  const timestamp = new Date().toISOString();
  switch (scope.kind) {
    case 'public':
      return {
        kind: 'public-text',
        event: 'send-message',
        scope,
        dto: { senderId: me.id, senderName: me.username, senderAvatar: me.avatar, content, type: 'text', timestamp },
        payload: { content },
      };
    case 'private':
      return {
        kind: 'private-text',
        event: 'send-private-message',
        scope,
        dto: {
          senderId: me.id,
          senderName: me.username,
          senderAvatar: me.avatar,
          recipientId: scope.peerId,
          content,
          type: 'text',
          timestamp,
        },
        payload: { recipientId: scope.peerId, content },
      };
    case 'group':
      return {
        kind: 'group-text',
        event: 'send-group-message',
        scope,
        dto: {
          senderId: me.id,
          senderName: me.username,
          senderAvatar: me.avatar,
          groupId: scope.groupId,
          content,
          type: 'text',
          timestamp,
        },
        payload: { groupId: scope.groupId, content },
      };
  }
}

function voicePlan(
  scope: ConversationScope,
  audioUrl: string,
  duration?: string | number,
): SendPlan {
  const me = requireSelf();
  const timestamp = new Date().toISOString();
  switch (scope.kind) {
    case 'public':
      return {
        kind: 'public-voice',
        event: 'send-voice',
        scope,
        dto: { senderId: me.id, senderName: me.username, senderAvatar: me.avatar, audioUrl, duration, type: 'voice', timestamp },
        payload: { audioUrl, duration },
      };
    case 'private':
      return {
        kind: 'private-voice',
        event: 'send-private-voice',
        scope,
        dto: {
          senderId: me.id,
          senderName: me.username,
          senderAvatar: me.avatar,
          recipientId: scope.peerId,
          audioUrl,
          duration,
          type: 'voice',
          timestamp,
        },
        payload: { recipientId: scope.peerId, audioUrl, duration },
      };
    case 'group':
      return {
        kind: 'group-voice',
        event: 'send-group-voice',
        scope,
        dto: {
          senderId: me.id,
          senderName: me.username,
          senderAvatar: me.avatar,
          groupId: scope.groupId,
          audioUrl,
          duration,
          type: 'voice',
          timestamp,
        },
        payload: { groupId: scope.groupId, audioUrl, duration },
      };
  }
}

async function execute(plan: SendPlan): Promise<SendOutcome> {
  const key = conversationKey(plan.scope);
  const tempId = nextTempId();
  const temp: StoreMessage = { ...plan.dto, id: tempId, status: 'sending' };

  // 1. Persist + render immediately.
  await putMessages([{ msg: temp, scope: plan.scope, status: 'sending' }]);
  store.getState().appendMessage(key, temp);

  try {
    const realId = await emitWithAck(plan.event, plan.payload);
    await finalizeSent(key, tempId, realId);
    return 'acked';
  } catch {
    // Offline / ack timeout — message stays visible as `sending`; queue retry.
    await enqueueOutbox(plan.kind, tempId, key, plan.payload);
    return 'queued';
  }
}

async function finalizeSent(key: string, tempId: number, realId: number): Promise<void> {
  const cached = await getMessage(tempId);
  if (!cached) return;
  const real: MessageDTO = {
    id: realId,
    senderId: cached.senderId,
    senderName: cached.senderName,
    senderAvatar: cached.senderAvatar ?? null,
    recipientId: cached.recipientId,
    groupId: cached.groupId,
    content: cached.content,
    audioUrl: cached.audioUrl,
    duration: cached.duration,
    type: cached.type,
    timestamp: cached.timestamp,
  };
  await promoteTempMessage(tempId, real, key);
  store.getState().replaceTempMessage(key, tempId, realId);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function sendText(scope: ConversationScope, content: string): Promise<SendOutcome> {
  return execute(textPlan(scope, content));
}

export function sendVoice(
  scope: ConversationScope,
  audioUrl: string,
  duration?: string | number,
): Promise<SendOutcome> {
  return execute(voicePlan(scope, audioUrl, duration));
}

function requireSelf() {
  const me = store.getState().currentUser;
  if (!me) throw new Error('cannot send before authentication');
  return me;
}

/* ------------------------------------------------------------------ */
/* Incoming messages                                                   */
/* ------------------------------------------------------------------ */

let focusProbe = true;

/** Injected by useChatConnection so domain code stays framework-free. */
export function setFocusProbe(focused: boolean): void {
  focusProbe = focused;
}

export function ingestIncoming(msg: MessageDTO): void {
  const s = store.getState();
  const self = s.currentUser;
  if (!self) return;

  const scope = scopeOf(msg, self.id);
  const key = conversationKey(scope);
  void putMessages([{ msg, scope }]);

  const isOpen =
    key === 'public' ||
    (scope.kind === 'private' && s.privateChatUser?.id === scope.peerId) ||
    (scope.kind === 'group' && s.selectedGroup?.id === scope.groupId);

  s.appendMessage(key, msg);

  if (msg.senderId === self.id) return;

  if (!isOpen || !focusProbe) {
    if (scope.kind === 'private') {
      s.bumpUnreadPrivate(scope.peerId);
      void showNotification('私聊消息', `${msg.senderName}: ${msg.content ?? '[语音消息]'}`);
    } else if (scope.kind === 'group') {
      s.bumpUnreadGroup(scope.groupId);
      void showNotification('群聊', `${msg.senderName}: ${msg.content ?? '[语音消息]'}`);
    }
    return;
  }

  acknowledgeVisible([msg.id], scope);
}

/** Best-effort delivered+read receipt for messages shown to the local user. */
export function acknowledgeVisible(ids: number[], scope: ConversationScope): void {
  const socket = getSocket();
  if (!socket || ids.length === 0) return;
  socket.emit('mark-delivered', { messageIds: ids });
  if (scope.kind === 'private') {
    socket.emit('mark-read', { kind: 'private', peerId: scope.peerId, messageIds: ids });
  } else if (scope.kind === 'group') {
    socket.emit('mark-read', { kind: 'group', groupId: scope.groupId, messageIds: ids });
  }
}

/* ------------------------------------------------------------------ */
/* Outbox flush                                                        */
/* ------------------------------------------------------------------ */

const OUTBOX_EVENT: Record<OutboxKind, SendEvent> = {
  'public-text': 'send-message',
  'public-voice': 'send-voice',
  'private-text': 'send-private-message',
  'private-voice': 'send-private-voice',
  'group-text': 'send-group-message',
  'group-voice': 'send-group-voice',
};

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const item = (await dueOutboxItems())[0];
      if (!item) break;
      try {
        const cached = await getMessage(item.tempId);
        if (!cached) {
          await removeOutbox(item.id);
          continue;
        }
        const realId = await emitWithAck(OUTBOX_EVENT[item.kind]!, item.payload);
        await finalizeSent(item.convKey, item.tempId, realId);
        await removeOutbox(item.id);
      } catch {
        await recordAttempt(item);
        break; // backoff scheduled; stop this pass
      }
    }
  } finally {
    flushing = false;
  }
}
