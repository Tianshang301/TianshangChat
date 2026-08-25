import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireUser } from '../auth.middleware.js';
import { handler, parseIntParam, parseBody } from '../validation.js';
import { db } from '../../infra/db.js';
import { e2eeBundles } from '../../infra/schema.js';

const router = Router();

const BundleSchema = z.object({
  ikPub: z.string().min(40).max(80),
  edPub: z.string().min(40).max(80),
  spkPub: z.string().min(40).max(80),
  spkSig: z.string().min(60).max(160),
});

/** Publish/rotate this user's prekey bundle (public material only). */
router.put(
  '/bundle',
  authMiddleware,
  handler(async (req, res) => {
    const me = requireUser(req);
    const bundle = parseBody(BundleSchema, req.body);

    db.insert(e2eeBundles)
      .values({ userId: me.id, ...bundle, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: e2eeBundles.userId,
        set: { ...bundle, updatedAt: new Date().toISOString() },
      })
      .run();

    res.json({ success: true });
  }),
);

/** Fetch another member's bundle to start a session. */
router.get(
  '/bundle/:userId',
  authMiddleware,
  handler(async (req, res) => {
    const userId = parseIntParam(req.params['userId'], 'userId');
    const row = db.select().from(e2eeBundles).where(eq(e2eeBundles.userId, userId)).get();
    if (!row) {
      res.status(404).json({ error: 'Bundle not published' });
      return;
    }
    res.json({
      success: true,
      bundle: {
        ikPub: row.ikPub,
        edPub: row.edPub,
        spkPub: row.spkPub,
        spkSig: row.spkSig,
      },
    });
  }),
);

export default router;
