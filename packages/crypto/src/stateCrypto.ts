
/**
 * At-rest sealing helpers for the browser (also works in Node 24 / Electron
 * renderer via WebCrypto). The Data Encryption Key is generated per install and
 * stored as a NON-extractable AES-GCM CryptoKey inside IndexedDB — raw DB copies
 * cannot recover it.
 */

const DEK_STORE = 'tsc-keystore';
const DEK_ID = 'dek-v1';

async function openKeystoreDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DEK_STORE, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('keys');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
  });
}

let cachedDek: CryptoKey | null = null;

/** Non-exportable per-install key used to seal E2EE session material at rest. */
export async function getOrCreateDek(): Promise<CryptoKey> {
  if (cachedDek) return cachedDek;
  const db = await openKeystoreDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction('keys', 'readonly');
    const req = tx.objectStore('keys').get(DEK_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });
  if (existing) {
    cachedDek = existing;
    return existing;
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    tx.objectStore('keys').put(key, DEK_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  cachedDek = key;
  return key;
}

/** iv || ciphertext blob sealed with the device DEK. */
export async function sealBytes(plaintext: Uint8Array): Promise<Uint8Array> {
  const key = await getOrCreateDek();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext as unknown as BufferSource);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), 12);
  return out;
}

export async function openSealed(blob: Uint8Array): Promise<Uint8Array> {
  const key = await getOrCreateDek();
  const iv = blob.slice(0, 12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(blob.slice(12)) as unknown as BufferSource);
  return new Uint8Array(pt);
}

export async function sealJson(value: unknown): Promise<Uint8Array> {
  return sealBytes(new TextEncoder().encode(JSON.stringify(value)));
}

export async function openSealedJson<T>(blob: Uint8Array): Promise<T> {
  const bytes = await openSealed(blob);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
