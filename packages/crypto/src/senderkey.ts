import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Group Sender Keys (simplified): each member owns a symmetric seed per group,
 * distributed pairwise through the private Double Ratchet. Per-message keys are
 * derived deterministically from (seed, counter), so delivery order does not
 * matter within a sender's stream.
 */

export interface SenderKeySeed {
  /** 32-byte symmetric seed. */
  seed: Uint8Array;
  /** Next counter this sender will use. */
  counter: number;
}

export function generateSenderKey(): SenderKeySeed {
  const seed = new Uint8Array(32);
  globalThis.crypto.getRandomValues(seed);
  return { seed, counter: 0 };
}

function deriveMaterial(seed: Uint8Array, n: number): { key: Uint8Array; iv: Uint8Array } {
  const counter = new Uint8Array(8);
  new DataView(counter.buffer).setBigUint64(0, BigInt(n));
  const okm = hkdf(sha256, counter, seed, 'TSC_SenderKey_v1', 44);
  return { key: okm.slice(0, 32), iv: okm.slice(32, 44) };
}

export function senderKeyEncrypt(
  state: SenderKeySeed,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): { counter: number; iv: Uint8Array; ciphertext: Uint8Array } {
  const { key, iv } = deriveMaterial(state.seed, state.counter);
  const aadBytes = aad ?? new Uint8Array(0);
  const fullAad = concatAad(aadBytes, state.counter);
  const ciphertext = gcm(key, iv).encrypt(concat(fullAad, plaintext));
  const used = state.counter;
  state.counter += 1;
  return { counter: used, iv, ciphertext };
}

export function senderKeyDecrypt(
  seed: Uint8Array,
  counter: number,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  const { key, iv: expectedIv } = deriveMaterial(seed, counter);
  for (let i = 0; i < 12; i++) {
    if ((expectedIv[i] as number) !== (iv[i] as number)) throw new Error('E2EE: sender-key IV mismatch');
  }
  const aadBytes = aad ?? new Uint8Array(0);
  const fullAad = concatAad(aadBytes, counter);
  const full = gcm(key, iv).decrypt(ciphertext);
  if (full.length < fullAad.length) throw new Error('E2EE: malformed sender-key payload');
  for (let i = 0; i < fullAad.length; i++) {
    if ((full[i] as number) !== (fullAad[i] as number)) throw new Error('E2EE: AAD mismatch');
  }
  return full.slice(fullAad.length);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Counter participates in the AAD so headers cannot be swapped between messages. */
function concatAad(aad: Uint8Array, counter: number): Uint8Array {
  const c = new Uint8Array(aad.length + 4);
  c.set(aad, 0);
  new DataView(c.buffer).setUint32(aad.length, counter >>> 0);
  return c;
}
