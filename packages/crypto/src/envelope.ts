import {
  decrypt as ratchetDecrypt,
  encrypt as ratchetEncrypt,
  headerAad,
  type RatchetMessage,
  type RatchetState,
} from './ratchet.js';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from './encoding.js';

/**
 * Wire envelope helpers. Private/group message `content` on the wire is:
 *
 *   e2ee:v1.<b64 header json>.<b64 iv>.<b64 ciphertext>
 *
 * The inner plaintext (before ratchet encryption) is a UTF-8 JSON document:
 *
 *   { "t": "text" | "voice" | "sk",
 *     "body": string?,          // text body
 *     "url": string?,           // encrypted blob URL (voice)
 *     "dur": string|number?,    // voice duration
 *     "sk": SenderKeyDistribution? }
 */

export const ENVELOPE_PREFIX = 'e2ee:v1';

export type InnerPayloadKind = 'text' | 'voice' | 'sk';

export interface SenderKeyDistribution {
  groupId: number;
  /** Distributing user id. */
  from: number;
  seed: string; // base64
  baseCounter: number;
}

export interface InnerPayload {
  t: InnerPayloadKind;
  body?: string;
  url?: string;
  dur?: string | number;
  sk?: SenderKeyDistribution;
}

export function isEnvelope(content: string | null | undefined): boolean {
  return typeof content === 'string' && content.startsWith(`${ENVELOPE_PREFIX}.`);
}

/** Encrypts an inner payload JSON with the session's Double Ratchet into a wire string. */
export function sealWithRatchet(state: RatchetState, inner: InnerPayload): string {
  const msg = ratchetEncrypt(state, utf8Encode(JSON.stringify(inner)));
  return [
    ENVELOPE_PREFIX,
    toBase64(utf8Encode(JSON.stringify(msg.header))),
    toBase64(msg.iv),
    toBase64(msg.ciphertext),
  ].join('.');
}

/** Decrypts a wire string, advancing the ratchet (incl. out-of-order handling). */
export function openWithRatchet(state: RatchetState, envelope: string): InnerPayload {
  const msg = parseEnvelope(envelope);
  const plaintext = ratchetDecrypt(state, msg, headerAad(msg.header));
  return JSON.parse(utf8Decode(plaintext)) as InnerPayload;
}

export function parseEnvelope(envelope: string): RatchetMessage {
  if (!isEnvelope(envelope)) throw new Error('E2EE: not an envelope');
  const parts = envelope.split('.');
  if (parts.length !== 4) throw new Error('E2EE: malformed envelope');
  return {
    header: JSON.parse(utf8Decode(fromBase64(parts[1] as string))) as RatchetMessage['header'],
    iv: fromBase64(parts[2] as string),
    ciphertext: fromBase64(parts[3] as string),
  };
}
