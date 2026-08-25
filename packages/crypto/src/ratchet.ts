import { gcm } from '@noble/ciphers/aes';
import {
  type Bytes32,
  type DhKeyPair,
  concatBytes,
  dh,
  generateDhKeyPair,
  kdfMessageKey,
  kdfRootKey,
} from './dh.js';
import { bytesEq, fromBase64, toBase64, utf8Encode } from './encoding.js';

/**
 * Double Ratchet (simplified Signal): root/sending/receiving chains with a DH
 * ratchet step on new remote keys and a bounded skipped-key window.
 */

const MAX_SKIP = 64;

export interface PrekeyHeader {
  /** Initiator identity public key (base64). */
  ik: string;
  /** Initiator ephemeral public key (base64). */
  ek: string;
}

export interface RatchetHeaderJson {
  /** Sender's current ratchet public key (base64). */
  dh: string;
  /** Message counter in the current sending chain. */
  n: number;
  /** Length of the previous sending chain. */
  pn: number;
  /** Present ONLY on the first message of a session (X3DH bundle for Bob). */
  prekey?: PrekeyHeader;
}

export interface RatchetMessage {
  header: RatchetHeaderJson;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

interface SkippedEntry {
  messageKey: Uint8Array;
}

export interface RatchetState {
  rootKey: Bytes32;
  sendChainKey: Bytes32 | null;
  recvChainKey: Bytes32 | null;
  dhs: DhKeyPair;
  dhrPub: Uint8Array | null;
  sendCount: number;
  recvCount: number;
  prevSendCount: number;
  skipped: Record<string, SkippedEntry>;
}

function skippedKey(dhB64: string, n: number): string {
  return `${dhB64}|${n}`;
}

/** Alice side: session initialised against the peer's signed prekey. */
export function initAsInitiator(sk: Uint8Array, peerSpkPub: Uint8Array): RatchetState {
  const dhs = generateDhKeyPair();
  const { rootKey, chainKey } = kdfRootKey(
    sk as Bytes32,
    dh(dhs.priv, peerSpkPub),
  );
  return {
    rootKey,
    sendChainKey: chainKey,
    recvChainKey: null,
    dhs,
    dhrPub: peerSpkPub,
    sendCount: 0,
    recvCount: 0,
    prevSendCount: 0,
    skipped: {},
  };
}

/** Bob side: adopts his signed prekey pair as the first ratchet keypair. */
export function initAsResponder(
  sk: Uint8Array,
  ownSignedPreKeyPair: DhKeyPair,
): RatchetState {
  return {
    rootKey: sk as Bytes32,
    sendChainKey: null,
    recvChainKey: null,
    dhs: ownSignedPreKeyPair,
    dhrPub: null,
    sendCount: 0,
    recvCount: 0,
    prevSendCount: 0,
    skipped: {},
  };
}

export function encrypt(
  state: RatchetState,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): RatchetMessage {
  if (!state.sendChainKey) throw new Error('E2EE: no sending chain (await a reply first)');
  const { messageKey, nextChainKey } = kdfMessageKey(state.sendChainKey);
  state.sendChainKey = nextChainKey;
  const header: RatchetHeaderJson = {
    dh: toBase64(state.dhs.pub),
    n: state.sendCount,
    pn: state.prevSendCount,
  };
  state.sendCount += 1;
  const iv = randomIv();
  const aadBytes = aad ?? headerAad(header);
  const cipher = gcm(messageKey, iv);
  const ciphertext = cipher.encrypt(concatBytes(aadBytes, plaintext));
  // Bind AAD length implicitly by prefixing; decrypt strips it back.
  return { header, iv, ciphertext };
}

export function decrypt(
  state: RatchetState,
  msg: RatchetMessage,
  aad?: Uint8Array,
): Uint8Array {
  const aadBytes = aad ?? headerAad(msg.header);

  // 1. Skipped-message keys (out-of-order delivery).
  const skKey = skippedKey(msg.header.dh, msg.header.n);
  const skipped = state.skipped[skKey];
  if (skipped) {
    delete state.skipped[skKey];
    return openWithKey(skipped.messageKey, msg, aadBytes);
  }

  // 2. Chain advance within the current receiving chain.
  if (state.dhrPub && bytesEq(fromBase64(msg.header.dh), state.dhrPub)) {
    skipTo(state, msg.header.n);
    const { messageKey, nextChainKey } = kdfMessageKey(state.recvChainKey as Bytes32);
    state.recvChainKey = nextChainKey;
    state.recvCount += 1;
    return openWithKey(messageKey, msg, aadBytes);
  }

  // 3. Remote ratchet key changed → DH ratchet step.
  //    Covers the responder's first inbound message (dhrPub === null), the
  //    initiator receiving her first reply, and later key rotations alike.
  if (state.recvChainKey) {
    state.prevSendCount = state.sendCount;
  }
  dhrStep(state, fromBase64(msg.header.dh));

  skipTo(state, msg.header.n);
  const { messageKey, nextChainKey } = kdfMessageKey(state.recvChainKey as Bytes32);
  state.recvChainKey = nextChainKey;
  state.recvCount += 1;
  return openWithKey(messageKey, msg, aadBytes);
}

function dhrStep(state: RatchetState, remotePub: Uint8Array): void {
  const derived = kdfRootKey(state.rootKey, dh(state.dhs.priv, remotePub));
  state.rootKey = derived.rootKey;
  state.recvChainKey = derived.chainKey;
  state.recvCount = 0;
  state.dhrPub = remotePub;
  state.dhs = generateDhKeyPair();
  const nextDerived = kdfRootKey(state.rootKey, dh(state.dhs.priv, remotePub));
  state.rootKey = nextDerived.rootKey;
  state.sendChainKey = nextDerived.chainKey;
  state.sendCount = 0;
  state.prevSendCount = 0;
}

function skipTo(state: RatchetState, until: number): void {
  if (!state.recvChainKey) return;
  if (state.recvCount + MAX_SKIP < until) {
    throw new Error('E2EE: too many skipped messages');
  }
  while (state.recvCount < until) {
    const { messageKey, nextChainKey } = kdfMessageKey(state.recvChainKey as Bytes32);
    state.skipped[skippedKey(toBase64(state.dhrPub as Uint8Array), state.recvCount)] = {
      messageKey,
    };
    state.recvChainKey = nextChainKey;
    state.recvCount += 1;
  }
}

function openWithKey(key: Uint8Array, msg: RatchetMessage, aad: Uint8Array): Uint8Array {
  const full = gcm(key, msg.iv).decrypt(msg.ciphertext);
  // full = aad || plaintext
  if (full.length < aad.length) throw new Error('E2EE: malformed payload');
  for (let i = 0; i < aad.length; i++) {
    if ((full[i] as number) !== (aad[i] as number)) throw new Error('E2EE: AAD mismatch');
  }
  return full.slice(aad.length);
}

export function headerAad(header: RatchetHeaderJson): Uint8Array {
  return utf8Encode(`v1|${header.dh}|${header.n}|${header.pn}`);
}

function randomIv(): Uint8Array {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  return iv;
}

/* ------------------------------------------------------------------ */
/* Serialization (caller seals the result at rest)                     */
/* ------------------------------------------------------------------ */

export function serializeRatchet(state: RatchetState): string {
  return JSON.stringify({
    rk: toBase64(state.rootKey),
    sck: state.sendChainKey ? toBase64(state.sendChainKey) : null,
    rck: state.recvChainKey ? toBase64(state.recvChainKey) : null,
    sp: toBase64(state.dhs.priv),
    spub: toBase64(state.dhs.pub),
    rp: state.dhrPub ? toBase64(state.dhrPub) : null,
    sc: state.sendCount,
    rc: state.recvCount,
    psc: state.prevSendCount,
    skp: Object.fromEntries(
      Object.entries(state.skipped).map(([k, v]) => [k, toBase64(v.messageKey)]),
    ),
  });
}

export function deserializeRatchet(raw: string): RatchetState {
  const j = JSON.parse(raw) as Record<string, unknown>;
  return {
    rootKey: fromBase64(j['rk'] as string) as Bytes32,
    sendChainKey: j['sck'] ? (fromBase64(j['sck'] as string) as Bytes32) : null,
    recvChainKey: j['rck'] ? (fromBase64(j['rck'] as string) as Bytes32) : null,
    dhs: { priv: fromBase64(j['sp'] as string), pub: fromBase64(j['spub'] as string) },
    dhrPub: j['rp'] ? fromBase64(j['rp'] as string) : null,
    sendCount: j['sc'] as number,
    recvCount: j['rc'] as number,
    prevSendCount: j['psc'] as number,
    skipped: Object.fromEntries(
      Object.entries((j['skp'] as Record<string, string>) ?? {}).map(([k, v]) => [
        k,
        { messageKey: fromBase64(v) },
      ]),
    ),
  };
}
