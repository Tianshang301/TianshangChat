import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { authMiddleware } from '../auth.middleware.js';
import { updateUserAvatar } from '../../data/user.repo.js';
import { requireUser } from '../auth.middleware.js';
import { config } from '../../config.js';

const router = Router();

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

const avatarsDir = path.join(config.uploadDir, 'avatars');
const voiceDir = path.join(config.uploadDir, 'voice');

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDir(avatarsDir);
    cb(null, avatarsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Legacy semantics kept: avatar requires ext AND mimetype match.
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (max 1MB)!'));
    }
  },
});

const voiceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDir(voiceDir);
    cb(null, voiceDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voice-${uniqueSuffix}${ext}`);
  },
});

// Legacy semantics kept: voice accepts ext OR mimetype match.
const voiceUpload = multer({
  storage: voiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /webm|wav|mp3|ogg|aac|m4a|opus/;
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype);
    if (extOk || mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed (max 10MB)!'));
    }
  },
});

router.post(
  '/avatar',
  authMiddleware,
  avatarUpload.single('avatar'),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    updateUserAvatar(requireUser(req).id, avatarUrl);
    res.json({ success: true, url: avatarUrl });
  },
);

router.post('/voice', authMiddleware, voiceUpload.single('voice'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const voiceUrl = `/uploads/voice/${req.file.filename}`;
  res.json({ success: true, url: voiceUrl });
});

export default router;
