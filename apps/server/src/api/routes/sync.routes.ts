import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { authMiddleware } from '../auth.middleware.js';
import { parseQuery } from '../validation.js';
import { db } from '../../infra/db.js';
import { messages } from '../../infra/schema.js';
import * as groupRepo from '../../data/group.repo.js';

const router = Router();

const SyncQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

/**
 * Incremental message pull for offline catch-up.
 * Returns every message visible to the caller with `id > cursor`, ascending.
 * Cursor = highest message id the client has persisted.
 */
router.get('/', authMiddleware, (req, res) => {
  const { cursor, limit } = parseQuery(SyncQuerySchema, req.query);
  const me = req.user!.id;

  const myGroupIds = groupRepo.getUserGroups(me).map((g) => g.id);
  const groupFilter =
    myGroupIds.length > 0 ? inArray(messages.groupId, myGroupIds) : sql`0`;

  const rows = db
    .select()
    .from(messages)
    .where(
      and(
        gt(messages.id, cursor),
        or(
          and(isNull(messages.recipientId), isNull(messages.groupId)),
          eq(messages.recipientId, me),
          eq(messages.senderId, me),
          groupFilter,
        ),
      ),
    )
    .orderBy(asc(messages.id))
    .limit(limit)
    .all();

  const nextCursor = rows.length > 0 ? rows[rows.length - 1]!.id : cursor;

  res.json({
    success: true,
    messages: rows.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName,
      senderAvatar: m.senderAvatar,
      recipientId: m.recipientId,
      groupId: m.groupId,
      content: m.content,
      audioUrl: m.audioUrl,
      duration: m.duration,
      type: m.type,
      timestamp: m.timestamp,
    })),
    nextCursor,
  });
});

export default router;
