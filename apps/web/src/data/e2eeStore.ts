import {
  type RatchetState,
  deserializeRatchet,
  sealJson,
  openSealedJson,
  serializeRatchet,
  toBase64,
  fromBase64,
} from '@tianshangchat/crypto';
import { chatDb, type MetaRow } from './db';

/**
 * Sealed E2EE key store. Everything persisted is encrypted with the
 * non-extractable per-install DEK (stateCrypto); plaintext key material only
 * ever lives in this module's in-memory caches for the duration of a session.
 */

/* ------------------------------------------------------------------ */
/* In-memory caches (unsealed)                                         */
/* ------------------------------------------------------------------ */

export interface StoredIdentity {
  ikPriv: Uint8Array;
  edPriv: Uint8Array;
  spkPriv: Uint8Array;
  /** Base64 public fields as uploaded to the server. */
  pub: { ikPub: string; edPub: string; spkPub: string; spkSig: string };
}

let identityCache: StoredIdentity | null = null;
const sessionCache = new Map<string, RatchetState>();
const senderKeyCache = new Map<string, { seed: Uint8Array; counter: number }>();

export function cachedSession(key: string): RatchetState | undefined {
  return sessionCache.get(key);
}

export function putSessionCache(key: string, state: RatchetState): void {
  sessionCache.set(key, state);
}

export function cachedSenderKey(key: string): { seed: Uint8Array; counter: number } | undefined {
  return senderKeyCache.get(key);
}

export function putSenderKeyCache(key: string, value: { seed: Uint8Array; counter: number }): void {
  senderKeyCache.set(key, value);
}

export function e2eeWipeMemory(): void {
  identityCache = null;
  sessionCache.clear();
  senderKeyCache.clear();
}

/** Logout hygiene: drop caches AND sealed blobs. */
export async function e2eeDestroyLocal(): Promise<void> {
  e2eeWipeMemory();
  await chatDb.e2eeKv.bulkDelete(['identity']);
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

async function kvGet(key: string): Promise<unknown | undefined> {
  const row = await chatDb.e2eeKv.get(key);
  if (!row) return undefined;
  try {
    return await openSealedJson(fromBase64(row.value));
  } catch (err) {
    console.error('[e2ee] failed to open sealed blob', key, err);
    return undefined;
  }
}

async function kvPut(key: string, value: unknown): Promise<void> {
  const blob = await sealJson(value);
  const row: MetaRow = { key, value: toBase64(blob) };
  await chatDb.e2eeKv.put(row);
}

export async function loadIdentity(): Promise<StoredIdentity | null> {
  if (identityCache) return identityCache;
  const stored = (await kvGet('identity')) as StoredIdentity | undefined;
  if (!stored) return null;
  identityCache = {
    ...stored,
    ikPriv: fromBase64(stored.ikPriv as unknown as string),
    edPriv: fromBase64(stored.edPriv as unknown as string),
    spkPriv: fromBase64(stored.spkPriv as unknown as string),
  };
  // Rehydrate typed arrays lost through JSON.
  return identityCache;
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  identityCache = identity;
  await kvPut('identity', {
    ...identity,
    ikPriv: toBase64(identity.ikPriv),
    edPriv: toBase64(identity.edPriv),
    spkPriv: toBase64(identity.spkPriv),
  });
}

export async function loadSession(key: string): Promise<RatchetState | null> {
  const mem = sessionCache.get(key);
  if (mem) return mem;
  const raw = (await kvGet(`session:${key}`)) as string | undefined;
  if (!raw) return null;
  const state = deserializeRatchet(raw);
  sessionCache.set(key, state);
  return state;
}

export async function saveSession(key: string, state: RatchetState): Promise<void> {
  sessionCache.set(key, state);
  await kvPut(`session:${key}`, serializeRatchet(state));
}

export async function loadSenderKey(
  key: string,
): Promise<{ seed: Uint8Array; counter: number } | null> {
  const mem = senderKeyCache.get(key);
  if (mem) return mem;
  const stored = (await kvGet(`sk:${key}`)) as
    | { seedB64: string; counter: number }
    | undefined;
  if (!stored) return null;
  const value = { seed: fromBase64(stored.seedB64), counter: stored.counter };
  senderKeyCache.set(key, value);
  return value;
}

export async function saveSenderKey(
  key: string,
  value: { seed: Uint8Array; counter: number },
): Promise<void> {
  senderKeyCache.set(key, value);
  await kvPut(`sk:${key}`, { seedB64: toBase64(value.seed), counter: value.counter });
}
