import { API_URL } from '../config';

/** Converts a base64url VAPID key to the Uint8Array PushManager expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSetupResult = 'subscribed' | 'denied' | 'unsupported' | 'disabled';

export async function subscribePush(token: string): Promise<PushSetupResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';

  const res = await fetch(`${API_URL}/push/vapid-public`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) return 'disabled';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey) as unknown as BufferSource,
  });

  const json = sub.toJSON();
  const post = await fetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(json),
  });
  return post.ok ? 'subscribed' : 'denied';
}

export async function unsubscribePush(token: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;
  await fetch(`${API_URL}/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}
