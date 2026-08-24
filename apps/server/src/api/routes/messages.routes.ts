import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth.middleware.js';
import { handler, parseIntParam, parseQuery } from '../validation.js';
import * as messageRepo from '../../data/message.repo.js';
import type { MessageRecord } from '../../data/message.repo.js';

const router = Router();

const HistoryQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(7),
  limit: z.coerce.number().int().positive().max(2000).default(500),
});

const BeforeQuerySchema = z.object({
  before: z.string().min(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const PrivateHistoryQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

function toWireMessage(m: MessageRecord): Record<string, unknown> {
  return {
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar,
    content: m.content,
    audioUrl: m.audioUrl,
    duration: m.duration,
    type: m.type,
    timestamp: m.timestamp,
  };
}

router.get(
  '/history',
  authMiddleware,
  handler(async (req, res) => {
    const { days, limit } = parseQuery(HistoryQuerySchema, req.query);
    const rows = messageRepo.getHistory(days, limit);
    res.json({ success: true, messages: rows.map(toWireMessage) });
  }),
);

router.get(
  '/before',
  authMiddleware,
  handler(async (req, res) => {
    const { before, limit } = parseQuery(BeforeQuerySchema, req.query);
    const rows = messageRepo.getHistoryBefore(before, limit);
    res.json({ success: true, messages: rows.map(toWireMessage) });
  }),
);

router.get(
  '/private/:userId',
  authMiddleware,
  handler(async (req, res) => {
    const otherUserId = parseIntParam(req.params['userId'], 'userId');
    const { days, limit } = parseQuery(PrivateHistoryQuerySchema, req.query);

    const rows = messageRepo.getPrivateHistory(req.user!.id, otherUserId, days, limit);
    // Legacy side effect preserved: fetching a private thread marks it read.
    messageRepo.markPrivateAsRead(req.user!.id, otherUserId);

    res.json({
      success: true,
      messages: rows.map((m) => ({ ...toWireMessage(m), recipientId: m.recipientId })),
    });
  }),
);

router.get(
  '/private-list',
  authMiddleware,
  handler(async (req, res) => {
    const LimitSchema = z.object({ limit: z.coerce.number().int().positive().max(200).default(50) });
    const { limit } = parseQuery(LimitSchema, req.query);
    const conversations = messageRepo.getPrivateList(req.user!.id, limit);

    res.json({
      success: true,
      conversations: conversations.map((c) => ({
        userId: c.otherUserId,
        username: c.otherUsername,
        avatar: c.otherAvatar,
        lastMessage: c.lastMessage,
        lastMessageTime: c.lastMessageTime,
        unreadCount: c.unreadCount,
      })),
    });
  }),
);

router.get(
  '/unread',
  authMiddleware,
  handler(async (req, res) => {
    res.json({ success: true, count: messageRepo.getUnreadCount(req.user!.id) });
  }),
);

export default router;
