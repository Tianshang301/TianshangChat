import { Router } from 'express';
import webpush from 'web-push';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../infra/db.js';
import { pushSubscriptions } from '../../infra/schema.js';
import { authMiddleware, requireUser } from '../auth.middleware.js';
import { handler, parseBody } from '../validation.js';

const router = Router();

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(40).max(200),
    auth: z.string().min(16).max(100),
  }),
});

/** Public key for client PushManager.subscribe (empty string = push disabled). */
router.get('/vapid-public', (_req, res) => {
  res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY ?? '' });
});

router.post(
  '/subscribe',
  authMiddleware,
  handler(async (req, res) => {
    const me = requireUser(req);
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      res.status(501).json({ error: 'Push notifications disabled on this server' });
      return;
    }
    const sub = parseBody(SubscriptionSchema, req.body);

    configureWebpush();
    db.insert(pushSubscriptions)
      .values({
        userId: me.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      })
      .run();

    res.json({ success: true });
  }),
);

router.post(
  '/unsubscribe',
  authMiddleware,
  handler(async (req, res) => {
    const me = requireUser(req);
    const { endpoint } = parseBody(z.object({ endpoint: z.string().min(1) }), req.body);
    db.delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, me.id), eq(pushSubscriptions.endpoint, endpoint)))
      .run();
    res.json({ success: true });
  }),
);

let configured = false;
function configureWebpush(): void {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@tianshangchat.local',
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
}

export interface OutgoingPush {
  title: string;
  body: string;
}

/**
 * Fire-and-forget push to all of a user's subscriptions.
 * Expired endpoints (404/410) are pruned automatically.
 */
export async function sendPushToUser(userId: number, payload: OutgoingPush): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  configureWebpush();

  const subs = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
  if (subs.length === 0) return;

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).run();
        } else {
          console.warn('[push] delivery failed', status, err instanceof Error ? err.message : err);
        }
      }
    }),
  );
}

export default router;
