import { gcm } from '@noble/ciphers/aes';
import { fromBase64, toBase64 } from '@tianshangchat/crypto';
import type { MessageDTO } from '@tianshangchat/shared';
import { chatStoreApi as store } from '../state/chatStore';
import type { DecryptedView, StoreMessage } from '../state/chatStore';
import {
  enqueueOutbox,
  getMessage,
  promoteTempMessage,
  putMessages,
  removeOutbox,
  dueOutboxItems,
  recordAttempt,
} from '../data/messageCache';
import { emitWithAck, getSocket } from '../data/socketAdapter';
import {
  conversationKey,
  nextTempId,
  scopeOf,
  type ConversationScope,
} from '../core/messageStatus';
import { showNotification } from '../utils/notifications';
import { isEnvelope, openPrivateIncoming, sealPrivateOutgoing, storePeerSenderKey } from './e2ee';
import { buildSkreq, maybeHandleSkreq, openGroupIncoming } from './groups-e2ee';

type SendEvent = Parameters<typeof emitWithAck>[0];
type SendOutcome = 'acked' | 'queued';

/* ------------------------------------------------------------------ */
/* Session context (injected by useChatConnection)                     */
/* ------------------------------------------------------------------ */

let authToken: string | null = null;

export function setE2eeSessionContext(token: string | null): void {
  authToken = token;
}

function requireToken(): string {
  if (!authToken) throw new Error('E2EE: session token missing');
  return authToken;
}

function serverBase(): string {
  return (globalThis as { __TSC_SERVER_URL__?: string }).__TSC_SERVER_URL__ ?? '';
}

/* ------------------------------------------------------------------ */
/* Voice blob encryption                                               */
/* ------------------------------------------------------------------ */

/** Random file key; the ciphertext goes to the server, key rides in the envelope. */
export function encryptVoiceBlob(
  bytes: Uint8Array,
): { cipher: Uint8Array; keyB64: string; ivB64: string } {
  const key = new Uint8Array(32);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(key);
  globalThis.crypto.getRandomValues(iv);
  const ct = gcm(key, iv).encrypt(bytes);
  return { cipher: ct, keyB64: toBase64(key), ivB64: toBase64(iv) };
}

/** Fetches an encrypted voice blob and returns a playable object-URL. */
export async function decryptVoiceToUrl(
  url: string,
  keyB64: string,
  ivB64: string,
): Promise<string> {
  const absolute = url.startsWith('http') ? url : `${serverBase()}${url}`;
  const res = await fetch(absolute);
  const cipher = new Uint8Array(await res.arrayBuffer());
  const plain = gcm(fromBase64(keyB64), fromBase64(ivB64)).decrypt(cipher);
  return URL.createObjectURL(new Blob([plain as unknown as BlobPart], { type: 'audio/webm' }));
}

/* ------------------------------------------------------------------ */
/* Optimistic send pipeline                                            */
/* ------------------------------------------------------------------ */

interface SendPlan {
  kind: 'public-text' | 'public-voice' | 'private-text' | 'private-voice' | 'group-text' | 'group-voice';
  event: SendEvent;
  scope: ConversationScope;
  dto: Omit<MessageDTO, 'id'>;
  payload: Record<string, unknown>;
  /** Plaintext view kept locally so the sender sees their own message. */
  localView?: DecryptedView;
}

async function wireTextContent(scope: ConversationScope, plaintext: string): Promise<string> {
  if (scope.kind === 'private') {
    return sealPrivateOutgoing(requireToken(), scope.peerId, { t: 'text', body: plaintext });
  }
  return plaintext;
}

async function wireVoiceEnvelope(
  scope: ConversationScope,
  uploadedUrl: string,
  duration: string | number | undefined,
  fileKey: { keyB64: string; ivB64: string },
): Promise<string> {
  if (scope.kind === 'private') {
    return sealPrivateOutgoing(requireToken(), scope.peerId, {
      t: 'voice',
      url: uploadedUrl,
      dur: duration,
      k: fileKey.keyB64,
      iv: fileKey.ivB64,
    });
  }
  return '';
}

function baseDto(
  me: { id: number; username: string; avatar: string | null },
  timestamp: string,
  rest: Partial<MessageDTO>,
): Omit<MessageDTO, 'id'> {
  return {
    senderId: me.id,
    senderName: me.username,
    senderAvatar: me.avatar,
    ...rest,
    timestamp,
  } as Omit<MessageDTO, 'id'>;
}

function buildPlans(
  scope: ConversationScope,
  kind: 'text' | 'voice',
  wireContent: string,
  audioUrl?: string,
  duration?: string | number,
): SendPlan[] {
  const me = requireSelf();
  const ts = new Date().toISOString();
  if (kind === 'text') {
    switch (scope.kind) {
      case 'public':
        return [
          {
            kind: 'public-text',
            event: 'send-message',
            scope,
            dto: baseDto(me, ts, { content: wireContent, type: 'text' }),
            payload: { content: wireContent },
            localView: { kind: 'text', body: wireContent },
          },
        ];
      case 'private':
        return [
          {
            kind: 'private-text',
            event: 'send-private-message',
            scope,
            dto: baseDto(me, ts, { recipientId: scope.peerId, content: wireContent, type: 'text' }),
            payload: { recipientId: scope.peerId, content: wireContent },
            localView: { kind: 'text', body: extractLocalText(wireContent, wireContent) },
          },
        ];
      case 'group':
        return [
          {
            kind: 'group-text',
            event: 'send-group-message',
            scope,
            dto: baseDto(me, ts, { groupId: scope.groupId, content: wireContent, type: 'text' }),
            payload: { groupId: scope.groupId, content: wireContent },
            localView: { kind: 'text', body: extractLocalText(wireContent, wireContent) },
          },
        ];
    }
  }
  switch (scope.kind) {
    case 'public':
      return [
        {
          kind: 'public-voice',
          event: 'send-voice',
          scope,
          dto: baseDto(me, ts, { audioUrl, duration, type: 'voice' }),
          payload: { audioUrl, duration },
          localView: { kind: 'voice', url: audioUrl, dur: duration },
        },
      ];
    case 'private':
      return [
        {
          kind: 'private-voice',
          event: 'send-private-voice',
          scope,
          dto: baseDto(me, ts, {
            recipientId: scope.peerId,
            audioUrl,
            duration,
            content: wireContent || null,
            type: 'voice',
          }),
          payload: { recipientId: scope.peerId, audioUrl, duration },
          localView: { kind: 'voice', url: audioUrl, dur: duration },
        },
      ];
    case 'group':
      return [
        {
          kind: 'group-voice',
          event: 'send-group-voice',
          scope,
          dto: baseDto(me, ts, {
            groupId: scope.groupId,
            audioUrl,
            duration,
            content: wireContent || null,
            type: 'voice',
          }),
          payload: { groupId: scope.groupId, audioUrl, duration },
          localView: { kind: 'voice', url: audioUrl, dur: duration },
        },
      ];
  }
}

/** For private texts the wire holds ciphertext; keep plaintext only locally. */
function extractLocalText(_wire: string, fallback: string): string {
  return fallback;
}

async function finalizeSent(key: string, tempId: number, realId: number, localView?: DecryptedView): Promise<void> {
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
  if (localView) {
    const list = store.getState().messagesByConv[key] ?? [];
    const target = list.find((m) => m.id === realId);
    if (target) target.decrypted = localView;
  }
}

async function execute(plan: SendPlan): Promise<SendOutcome> {
  const key = conversationKey(plan.scope);
  const tempId = nextTempId();
  const temp: StoreMessage = {
    ...plan.dto,
    id: tempId,
    status: 'sending',
    decrypted: plan.localView,
  };

  await putMessages([{ msg: temp, scope: plan.scope, status: 'sending' }]);
  store.getState().appendMessage(key, temp);

  try {
    const realId = await emitWithAck(plan.event, plan.payload);
    await finalizeSent(key, tempId, realId, plan.localView);
    return 'acked';
  } catch {
    await enqueueOutbox(plan.kind, tempId, key, plan.payload);
    return 'queued';
  }
}

/* ------------------------------------------------------------------ */
/* Public send API                                                     */
/* ------------------------------------------------------------------ */

export function sendText(scope: ConversationScope, content: string): Promise<SendOutcome> {
  return (async () => {
    const wire = await wireTextContent(scope, content);
    const plan = buildPlans(scope, 'text', wire)[0]!;
    // For private sends the local view must hold PLAINTEXT.
    if (plan.scope.kind === 'private') plan.localView = { kind: 'text', body: content };
    return execute(plan);
  })();
}

/**
 * Voice flow: caller passes a LOCAL object URL of the raw recording; we encrypt
 * it, upload ciphertext, then reference that URL in the envelope.
 */
export async function sendVoice(
  scope: ConversationScope,
  localObjectUrl: string,
  duration?: string | number,
): Promise<SendOutcome> {
  let uploadUrl = localObjectUrl;
  let fileKey: { keyB64: string; ivB64: string } | null = null;

  if (scope.kind === 'private') {
    const raw = await fetch(localObjectUrl).then((r) => r.arrayBuffer());
    const enc = encryptVoiceBlob(new Uint8Array(raw));
    fileKey = { keyB64: enc.keyB64, ivB64: enc.ivB64 };
    const form = new FormData();
    form.append('voice', new Blob([enc.cipher as unknown as BlobPart], { type: 'audio/webm' }), 'voice.webm');
    const up = await fetch(`${serverBase()}/api/upload/voice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${requireToken()}` },
      body: form,
    });
    const data = (await up.json()) as { success: boolean; url?: string };
    if (!data.success || !data.url) throw new Error('voice upload failed');
    uploadUrl = data.url;
  }

  const wire = await wireVoiceEnvelope(scope, uploadUrl, duration, fileKey ?? { keyB64: '', ivB64: '' });
  const plan = buildPlans(scope, 'voice', wire, uploadUrl, duration)[0]!;
  if (plan.scope.kind === 'private') {
    plan.localView = { kind: 'voice', url: localObjectUrl, dur: duration };
  }
  return execute(plan);
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

export function setFocusProbe(focused: boolean): void {
  focusProbe = focused;
}

export async function ingestIncoming(msg: MessageDTO): Promise<'shown' | 'hidden'> {
  const s = store.getState();
  const self = s.currentUser;
  if (!self) return 'hidden';

  const scope = scopeOf(msg, self.id);
  const key = conversationKey(scope);
  const storeMsg: StoreMessage = { ...msg };

  // Sender-key redistribution request (control DM).
  if (scope.kind === 'private' && typeof msg.content === 'string' && msg.content.startsWith('skreq:v1.')) {
    await maybeHandleSkreq(requireToken(), msg.senderId, msg.content);
    return 'hidden';
  }

  if (isEnvelope(msg.content)) {
    try {
      if (scope.kind === 'private') {
        const inner = await openPrivateIncoming(authToken ?? '', scope.peerId, msg.content as string);
        if (inner.t === 'sk' && inner.sk) {
          await storePeerSenderKey(inner.sk.groupId, inner.sk.from, inner.sk.seed, inner.sk.baseCounter);
          await putMessages([{ msg, scope }]);
          return 'hidden'; // sender-key control plane — never rendered
        }
        await applyDecrypted(storeMsg, inner);
      } else if (scope.kind === 'group') {
        const view = await openGroupIncoming(scope.groupId, msg.senderId, msg.content as string);
        if (view) {
          storeMsg.decrypted = view;
          // Voice object URLs were produced by the group module already.
        } else {
          storeMsg.secureFailed = true;
          // Ask the sender to redistribute their key.
          getSocket()?.emit('send-private-message', {
            recipientId: msg.senderId,
            content: buildSkreq(scope.groupId),
          });
        }
      } else {
        storeMsg.secureFailed = true;
      }
    } catch (err) {
      console.warn('[e2ee] open failed:', err instanceof Error ? err.message : err);
      storeMsg.secureFailed = true;
    }
  }

  await putMessages([{ msg: { ...storeMsg }, scope }]);
  s.appendMessage(key, storeMsg);

  if (msg.senderId === self.id) return 'shown';

  const isOpen =
    key === 'public' ||
    (scope.kind === 'private' && s.privateChatUser?.id === scope.peerId) ||
    (scope.kind === 'group' && s.selectedGroup?.id === scope.groupId);

  if (!isOpen || !focusProbe) {
    const preview =
      storeMsg.decrypted?.body ??
      (storeMsg.decrypted?.url ? '[语音消息]' : storeMsg.secureFailed ? '[加密消息]' : (msg.content ?? '[语音消息]'));
    if (scope.kind === 'private') {
      s.bumpUnreadPrivate(scope.peerId);
      void showNotification('私聊消息', `${msg.senderName}: ${preview}`);
    } else if (scope.kind === 'group') {
      s.bumpUnreadGroup(scope.groupId);
      void showNotification('群聊', `${msg.senderName}: ${preview}`);
    }
    return 'shown';
  }

  acknowledgeVisible([msg.id], scope);
  return 'shown';
}

export async function applyDecrypted(target: StoreMessage, inner: import('@tianshangchat/crypto').InnerPayload): Promise<void> {
  if (inner.t === 'voice' && inner.url && inner.k && inner.iv) {
    target.decrypted = { kind: 'voice', dur: inner.dur };
    try {
      const objectUrl = await decryptVoiceToUrl(inner.url, inner.k, inner.iv);
      target.decrypted = { kind: 'voice', url: objectUrl, dur: inner.dur };
    } catch {
      target.secureFailed = true;
    }
  } else {
    target.decrypted = { kind: 'text', body: String(inner.body ?? '') };
  }
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

const OUTBOX_EVENT: Record<string, SendEvent> = {
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
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
