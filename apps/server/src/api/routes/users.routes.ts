import { Router } from 'express';
import { ErrorCode, protocolError } from '@tianshangchat/shared';
import { z } from 'zod';
import { authMiddleware } from '../auth.middleware.js';
import { handler, parseIntParam, parseQuery } from '../validation.js';
import { findUserById, searchUsers } from '../../data/user.repo.js';

const router = Router();

const SearchQuerySchema = z.object({
  q: z.string().min(1),
});

router.get(
  '/search',
  authMiddleware,
  handler(async (req, res) => {
    const { q } = parseQuery(SearchQuerySchema, req.query);
    const users = searchUsers(q, req.user!.id);

    res.json({
      success: true,
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        avatar: u.avatar,
        createdAt: u.createdAt,
      })),
    });
  }),
);

router.get(
  '/:id',
  authMiddleware,
  handler(async (req, res) => {
    const userId = parseIntParam(req.params['id'], 'userId');
    const user = findUserById(userId);

    if (!user) {
      res.status(404).json(protocolError('User not found', ErrorCode.NotFound));
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  }),
);

export default router;
