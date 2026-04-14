const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const db = require('../database/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const TOKEN_EXPIRY_SHORT = '24h';
const TOKEN_EXPIRY_LONG = '7d';

router.post('/register',
  body('username').isLength({ min: 3, max: 20 }).trim().escape(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors.array() 
        });
      }

      const { username, password } = req.body;

      const existingUser = User.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const passwordHash = await User.hashPassword(password);
      const user = User.create(username, passwordHash);

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

router.post('/login',
  body('username').isLength({ min: 3, max: 20 }),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors.array() 
        });
      }

      const { username, password, remember } = req.body;

      const user = User.findByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isValid = await User.verifyPassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const expiresIn = remember ? TOKEN_EXPIRY_LONG : TOKEN_EXPIRY_SHORT;
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn }
      );

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (remember ? 24 * 7 : 24));

      db.prepare(`
        INSERT INTO sessions (user_id, token, expires_at, remember_me)
        VALUES (?, ?, ?, ?)
      `).run(user.id, token, expiresAt.toISOString(), remember ? 1 : 0);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        },
        expiresIn
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.post('/logout', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

router.get('/user', authMiddleware, (req, res) => {
  const user = User.findById(req.user.id);
  if (user) {
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        created_at: user.created_at
      }
    });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

module.exports = router;
