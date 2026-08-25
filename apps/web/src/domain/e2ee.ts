import {
  finalizeIdentity,
  fromBase64,
  generateIdentity,
  generateSenderKey,
  generateSignedPreKey,
  initAsInitiator,
  initAsResponder,
  openWithRatchet,
  parseEnvelope,
  x3dhInitiate,
  sealWithRatchet,
  toBase64,
  type InnerPayload,
  type RatchetState,
} from '@tianshangchat/crypto';
import { api } from '../data/apiClient';
import {
  loadIdentity,
  loadSenderKey,
  loadSession,
  saveIdentity,
  saveSenderKey,
  saveSession,
} from '../data/e2eeStore';

/**
 * E2EE orchestration.
 *
 * Private chats : X3DH (IK + signed SPK) → Double Ratchet per peer.
 * Group chats   : Sender Keys distributed pairwise over private ratchets.
 *
 * Documented simplifications vs full Signal:
 * - No one-time prekeys; X3DH uses IK + signed SPK only.
 * - One active bundle per account (single-device model).
 * - Sender-key redistribution is triggered by roster events and re-requests;
 *   post-handshake membership changes rely on members acting on those events.
 */

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export async function ensureIdentity(token: string): Promise<void> {
  const existing = await loadIdentity();
  if (existing) return;

  const identity = finalizeIdentity(generateIdentity());
  const spk = generateSignedPreKey(identity.ed.priv);
  const pub = {
    ikPub: toBase64(identity.ik.pub),
    edPub: toBase64(identity.ed.pub),
    spkPub: toBase64(spk.pub),
    spkSig: toBase64(spk.sig),
  };
  await saveIdentity({
    ikPriv: identity.ik.priv,
    edPriv: identity.ed.priv,
    spkPriv: spk.priv,
    pub,
  });
  await api.publishBundle(token, pub);
}

/* ------------------------------------------------------------------ */
/* Private sessions                                                    */
/* ------------------------------------------------------------------ */

const sessionKeyOf = (peerId: number): string => `p:${peerId}`;

interface SessionHandle {
  state: RatchetState;
  /** Set only right after session creation — must ride on the first message. */
  prekey?: { ik: string; ek: string };
}

export async function ensurePrivateSession(
  token: string,
  peerId: number,
): Promise<SessionHandle> {
  const key = sessionKeyOf(peerId);
  const existing = await loadSession(key);
  if (existing) return { state: existing };

  const me = await loadIdentity();
  if (!me) throw new Error('E2EE: local identity missing');

  const res = await api.fetchBundle(token, peerId);
  const init = x3dhInitiate(fromBase64(me.ikPriv as unknown as string), {
    ikPub: fromBase64(res.bundle.ikPub),
    edPub: fromBase64(res.bundle.edPub),
    spkPub: fromBase64(res.bundle.spkPub),
    spkSig: fromBase64(res.bundle.spkSig),
  });

  const state = initAsInitiator(init.sk, fromBase64(res.bundle.spkPub));
  await saveSession(key, state);
  return {
    state,
    prekey: { ik: toBase64(init.header.ik), ek: toBase64(init.header.ek) },
  };
}

/** Opens an inbound envelope from a known peer (X3DH bootstrap when needed). */
export async function openPrivateIncoming(
  _token: string,
  peerId: number,
  envelope: string,
): Promise<InnerPayload> {
  const key = sessionKeyOf(peerId);
  let session = await loadSession(key);

  const parsed = parseEnvelopeSafe(envelope);

  if (!session && parsed?.header.prekey) {
    const me = await loadIdentity();
    if (!me) throw new Error('E2EE: local identity missing');
    const sk = x3dhRespondFrom(me.ikPriv, me.spkPriv, parsed.header.prekey);
    session = initAsResponder(sk, {
      priv: fromBase64(me.spkPriv as unknown as string),
      pub: fromBase64(me.pub.spkPub),
    });
    await saveSession(key, session);
  }
  if (!session || !parsed) throw new Error('E2EE: no session with peer');

  return openWithRatchet(session, envelope);
}

function parseEnvelopeSafe(envelope: string) {
  try {
    return parseEnvelope(envelope);
  } catch {
    return null;
  }
}

import { x3dhRespond } from '@tianshangchat/crypto';
import { isEnvelope } from '@tianshangchat/crypto';
export { isEnvelope };
function x3dhRespondFrom(ikPriv: Uint8Array, spkPriv: Uint8Array, prekey: { ik: string; ek: string }) {
  return x3dhRespond(ikPriv, spkPriv, {
    ik: fromBase64(prekey.ik),
    ek: fromBase64(prekey.ek),
  });
}

/* ------------------------------------------------------------------ */
/* Outgoing sealing                                                    */
/* ------------------------------------------------------------------ */

export async function sealPrivateOutgoing(
  token: string,
  peerId: number,
  inner: InnerPayload,
): Promise<string> {
  const handle = await ensurePrivateSession(token, peerId);
  const envelope = sealWithRatchet(handle.state, inner, handle.prekey ? { prekey: handle.prekey } : undefined);
  await saveSession(sessionKeyOf(peerId), handle.state);
  return envelope;
}

/* ------------------------------------------------------------------ */
/* Group sender keys                                                   */
/* ------------------------------------------------------------------ */

const ownSkKey = (groupId: number): string => `skown:g:${groupId}`;
const peerSkKey = (groupId: number, fromId: number): string => `skpeer:g:${groupId}:${fromId}`;

export async function getOwnSenderKey(groupId: number): Promise<{ seed: Uint8Array; counter: number }> {
  const existing = await loadSenderKey(ownSkKey(groupId));
  if (existing) return existing;
  const created = generateSenderKey();
  await saveSenderKey(ownSkKey(groupId), created);
  return created;
}

export async function rotateOwnSenderKey(groupId: number): Promise<{ seed: Uint8Array; counter: number }> {
  const fresh = generateSenderKey();
  await saveSenderKey(ownSkKey(groupId), fresh);
  return fresh;
}

export async function storePeerSenderKey(
  groupId: number,
  fromUserId: number,
  seedB64: string,
  baseCounter: number,
): Promise<void> {
  await saveSenderKey(peerSkKey(groupId, fromUserId), {
    seed: fromBase64(seedB64),
    counter: baseCounter,
  });
}

export async function getPeerSenderKey(
  groupId: number,
  fromUserId: number,
): Promise<{ seed: Uint8Array; counter: number } | null> {
  const stored = await loadSenderKey(peerSkKey(groupId, fromUserId));
  if (!stored) return null;
  // Peers' counters advance independently; we track the next expected one here.
  const next = stored.counter + 1;
  await saveSenderKey(peerSkKey(groupId, fromUserId), { seed: stored.seed, counter: next });
  return { seed: stored.seed, counter: next - 1 };
}

