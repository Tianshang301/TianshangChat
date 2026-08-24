import { Router } from 'express';
import {
  ErrorCode,
  LoginRequestSchema,
  RegisterRequestSchema,
  protocolError,
} from '@tianshangchat/shared';
import { authMiddleware, signSessionToken } from '../auth.middleware.js';
import { handler, parseBody } from '../validation.js';
import {
  createUser,
  findUserById,
  findUserWithSecretByUsername,
} from '../../data/user.repo.js';
import { replaceUserSession, deleteSessionByToken } from '../../data/session.repo.js';
import { hashPassword, verifyPassword } from '../../data/password.js';

const router = Router();

const TOKEN_EXPIRY_SHORT = '24h' as const;
const TOKEN_EXPIRY_LONG = '7d' as const;

router.post(
  '/register',
  handler(async (req, res) => {
    const { username, password } = parseBody(RegisterRequestSchema, req.body);

    // Legacy pre-check kept: duplicate usernames answer 400 (not the UNIQUE-constraint 500).
    if (findUserWithSecretByUsername(username)) {
      res.status(400).json(protocolError('Username already exists', ErrorCode.UsernameExists));
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = createUser(username, passwordHash);
    res.status(201).json({ success: true, user });
  }),
);

router.post(
  '/login',
  handler(async (req, res) => {
    const { username, password, remember } = parseBody(LoginRequestSchema, req.body);

    const user = findUserWithSecretByUsername(username);
    if (!user) {
      res.status(401).json(protocolError('Invalid username or password', ErrorCode.InvalidCredentials));
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json(protocolError('Invalid username or password', ErrorCode.InvalidCredentials));
      return;
    }

    const expiresIn = remember ? TOKEN_EXPIRY_LONG : TOKEN_EXPIRY_SHORT;
    const token = signSessionToken({ id: user.id, username: user.username }, expiresIn);

    // Session row expiry computed independently of JWT exp — legacy quirk preserved.
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (remember ? 24 * 7 : 24));

    replaceUserSession({
      userId: user.id,
      token,
      expiresAt: expiresAt.toISOString(),
      rememberMe: remember === true,
    });

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, avatar: user.avatar },
      expiresIn,
    });
  }),
);

router.post(
  '/logout',
  authMiddleware,
  handler(async (req, res) => {
    if (req.token) deleteSessionByToken(req.token);
    res.json({ success: true });
  }),
);

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.get(
  '/user',
  authMiddleware,
  handler(async (req, res) => {
    const user = findUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
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
