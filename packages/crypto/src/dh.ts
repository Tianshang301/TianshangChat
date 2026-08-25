import { x25519, ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { concatBytes, bytesEq, utf8Encode } from './encoding.js';

export { x25519, ed25519 };

export interface DhKeyPair {
  priv: Uint8Array;
  pub: Uint8Array;
}

export function generateDhKeyPair(seed?: Uint8Array): DhKeyPair {
  const priv = seed ?? x25519.utils.randomPrivateKey();
  return { priv, pub: x25519.getPublicKey(priv) };
}

export function dh(priv: Uint8Array, pub: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(priv, pub);
}

/* ------------------------------------------------------------------ */
/* Identity + signed prekey                                            */
/* ------------------------------------------------------------------ */

export interface IdentityKeyPair {
  /** X25519 pair used for X3DH agreement. */
  ik: DhKeyPair;
  /** Ed25519 pair used to sign the prekey. */
  ed: { priv: Uint8Array; pub: Uint8Array };
}

export interface SignedPreKeyPair extends DhKeyPair {
  /** Ed25519 signature over spkPub, made with the identity signing key. */
  sig: Uint8Array;
}

export interface PublicBundle {
  ikPub: Uint8Array;
  edPub: Uint8Array;
  spkPub: Uint8Array;
  spkSig: Uint8Array;
}

const SIGN_CONTEXT = utf8Encode('tianshangchat-spk-v1');

function utf8(s: string): Uint8Array {
  return utf8Encode(s);
}

export function generateIdentity(): IdentityKeyPair {
  const edPriv = ed25519.utils.randomPrivateKey();
  return {
    ik: generateDhKeyPair(),
    ed: { priv: edPriv, pub: ed25519.getPublicKey(edPriv) },
  };
}

/** Completes the Ed25519 public key derivation (kept separate for clarity). */
export function finalizeIdentity(identity: IdentityKeyPair): IdentityKeyPair {
  identity.ed.pub = ed25519.getPublicKey(identity.ed.priv);
  return identity;
}

export function generateSignedPreKey(
  identityEdPriv: Uint8Array,
  seed?: Uint8Array,
): SignedPreKeyPair {
  const pair = generateDhKeyPair(seed);
  const sig = ed25519.sign(concatBytes(SIGN_CONTEXT, pair.pub), identityEdPriv);
  return { ...pair, sig };
}

/** Verifies a fetched bundle's prekey signature (TOFU via server-delivered edPub). */
export function verifyBundle(bundle: PublicBundle): boolean {
  try {
    return ed25519.verify(bundle.spkSig, concatBytes(SIGN_CONTEXT, bundle.spkPub), bundle.edPub);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* X3DH (simplified: IK + SPK, no one-time prekeys)                    */
/* ------------------------------------------------------------------ */

export interface InitiatorSecret {
  sk: Uint8Array;
  /** Header fields the responder needs to derive the same secret. */
  header: { ik: Uint8Array; ek: Uint8Array };
}

const X3DH_INFO = utf8('TSC_X3DH_v1');
const F = new Uint8Array(32).fill(0xff);

/**
 * X3DH initiator: DH1=DH(IKa,SPKb) DH2=DH(EKa,IKb) DH3=DH(EKa,SPKb)
 * SK = HKDF(F || DH1 || DH2 || DH3)
 */
export function x3dhInitiate(selfIkPriv: Uint8Array, peerBundle: PublicBundle): InitiatorSecret {
  if (!verifyBundle(peerBundle)) throw new Error('E2EE: peer bundle failed prekey signature check');
  const eph = generateDhKeyPair();
  const dh1 = dh(selfIkPriv, peerBundle.spkPub);
  const dh2 = dh(eph.priv, peerBundle.ikPub);
  const dh3 = dh(eph.priv, peerBundle.spkPub);
  const sk = hkdf(sha256, concatBytes(F, dh1, dh2, dh3), new Uint8Array(32), X3DH_INFO, 32);
  return { sk, header: { ik: x25519.getPublicKey(selfIkPriv), ek: eph.pub } };
}

export function x3dhRespond(
  selfIkPriv: Uint8Array,
  selfSpkPriv: Uint8Array,
  header: { ik: Uint8Array; ek: Uint8Array },
): Uint8Array {
  const dh1 = dh(selfSpkPriv, header.ik);
  const dh2 = dh(selfIkPriv, header.ek);
  const dh3 = dh(selfSpkPriv, header.ek);
  return hkdf(sha256, concatBytes(F, dh1, dh2, dh3), new Uint8Array(32), X3DH_INFO, 32);
}

/* ------------------------------------------------------------------ */
/* KDFs                                                                */
/* ------------------------------------------------------------------ */

export const ROOT_INFO = utf8('TSC_RatchetRoot_v1');
export const CHAIN_MSG = new Uint8Array([0x01]);
export const CHAIN_NEXT = new Uint8Array([0x02]);

export type Bytes32 = Uint8Array & { length: 32 };

export function kdfRootKey(rootKey: Uint8Array, dhOut: Uint8Array): { rootKey: Bytes32; chainKey: Bytes32 } {
  const okm = hkdf(sha256, dhOut, rootKey, ROOT_INFO, 64);
  return { rootKey: okm.slice(0, 32) as Bytes32, chainKey: okm.slice(32, 64) as Bytes32 };
}

/** Deterministic per-message key from the current chain key (hash ratchet step). */
export function kdfMessageKey(chainKey: Bytes32): { messageKey: Uint8Array; nextChainKey: Bytes32 } {
  // HMAC-ish construction via hkdf with distinct info per output keeps deps minimal.
  const mk = hkdf(sha256, CHAIN_MSG, chainKey, utf8('TSC_CK_msg'), 32);
  const nk = hkdf(sha256, CHAIN_NEXT, chainKey, utf8('TSC_CK_next'), 32);
  return { messageKey: mk, nextChainKey: nk as Bytes32 };
}

export { bytesEq, sha256, concatBytes };
