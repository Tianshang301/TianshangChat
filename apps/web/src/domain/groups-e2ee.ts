import { fromBase64, senderKeyDecrypt, toBase64 } from '@tianshangchat/crypto';
import type { InnerPayload } from '@tianshangchat/crypto';
import { chatStoreApi as store } from '../state/chatStore';
import { getSocket } from '../data/socketAdapter';
import {
  getOwnSenderKey,
  getPeerSenderKey,
  rotateOwnSenderKey,
  sealPrivateOutgoing,
} from './e2ee';
import type { DecryptedView } from '../state/chatStore';

const GSK_PREFIX = 'gsk:v1.';
const SKREQ_PREFIX = 'skreq:v1.';

export interface GskHeader {
  from: number;
  counter: number;
}

export function isGskEnvelope(content: unknown): boolean {
  return typeof content === 'string' && content.startsWith(GSK_PREFIX);
}

function parseGsk(content: string): { header: GskHeader; iv: Uint8Array; ct: Uint8Array; innerSeedB64?: never } {
  const [, hdrB64, ivB64, ctB64] = content.split('.');
  return {
    header: JSON.parse(new TextDecoder().decode(fromBase64(hdrB64 as string))) as GskHeader,
    iv: fromBase64(ivB64 as string),
    ct: fromBase64(ctB64 as string),
  };
}

/**
 * Opens a group message encrypted under the sender's distributed key.
 * Returns null when the sender key is unavailable (caller should show 🔒).
 */
export async function openGroupIncoming(
  groupId: number,
  senderId: number,
  content: string,
): Promise<DecryptedView | null> {
  const { header, iv, ct } = parseGsk(content);
  const holder = await getPeerSenderKey(groupId, senderId);
  if (!holder) return null;
  const plain = senderKeyDecrypt(holder.seed, header.counter, iv, ct);
  const inner = JSON.parse(new TextDecoder().decode(plain)) as InnerPayload;
  if (inner.t === 'voice' && inner.url && inner.k && inner.iv) {
    // Voice decryption mirrors the private flow (messaging.decryptVoiceToUrl).
    const { decryptVoiceToUrl } = await import('./messaging');
    try {
      const objectUrl = await decryptVoiceToUrl(inner.url, inner.k, inner.iv);
      return { kind: 'voice', url: objectUrl, dur: inner.dur };
    } catch {
      return null;
    }
  }
  return { kind: 'text', body: String(inner.body ?? '') };
}

/** Encrypts an inner payload with MY sender key and returns the wire string. */
export async function sealGroupOutgoing(
  groupId: number,
  inner: InnerPayload,
): Promise<string> {
  const own = await getOwnSenderKey(groupId);
  const counter = own.counter;
  const plaintext = new TextEncoder().encode(JSON.stringify(inner));
  const { senderKeyEncrypt } = await import('@tianshangchat/crypto');
  const sealed = senderKeyEncrypt({ seed: own.seed, counter: own.counter }, plaintext);
  own.counter += 1;
  void counter;
  return `${GSK_PREFIX}${toBase64(
    new TextEncoder().encode(JSON.stringify({ from: store.getState().currentUser?.id ?? 0, counter: sealed.counter })),
  )}.${toBase64(sealed.iv)}.${toBase64(sealed.ciphertext)}`;
}

/**
 * Distributes my current sender key to the given members over their private
 * ratchets (fire-and-forget control DMs).
 */
export async function distributeSenderKeys(
  token: string,
  groupId: number,
  memberIds: number[],
): Promise<void> {
  const selfId = store.getState().currentUser?.id;
  if (!selfId) return;
  const own = await getOwnSenderKey(groupId);
  for (const uid of memberIds) {
    if (uid === selfId) continue;
    try {
      const content = await sealPrivateOutgoing(token, uid, {
        t: 'sk',
        sk: { groupId, from: selfId, seed: toBase64(own.seed), baseCounter: own.counter },
      });
      getSocket()?.emit('send-private-message', { recipientId: uid, content });
    } catch (err) {
      console.warn('[e2ee] sender-key distribution failed for member', uid, err);
    }
  }
}

/** Rotates my key for a group and redistributes to the current members. */
export async function rotateAndRedistribute(
  token: string,
  groupId: number,
  memberIds: number[],
  onlyTo?: number[],
): Promise<void> {
  await rotateOwnSenderKey(groupId);
  const targets = onlyTo ?? memberIds;
  await distributeSenderKeys(token, groupId, targets);
}

/** Handles a redistribution request control DM ('skreq'). Returns true if handled. */
export async function maybeHandleSkreq(
  token: string,
  senderId: number,
  content: string,
): Promise<boolean> {
  if (!content.startsWith(SKREQ_PREFIX)) return false;
  try {
    const json = new TextDecoder().decode(fromBase64(content.slice(SKREQ_PREFIX.length)));
    const { groupId } = JSON.parse(json) as { groupId: number };
    const members = store.getState().groups.find((g) => g.id === groupId)?.memberCount;
    void members;
    await distributeSenderKeys(token, groupId, [senderId]);
    return true;
  } catch (err) {
    console.warn('[e2ee] skreq handling failed:', err);
    return false;
  }
}

/** Builds the wire string requesting redistribution of a group's key. */
export function buildSkreq(groupId: number): string {
  return `${SKREQ_PREFIX}${toBase64(new TextEncoder().encode(JSON.stringify({ groupId })))}`;
}
