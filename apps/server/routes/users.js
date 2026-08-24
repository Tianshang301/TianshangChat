const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/search', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 1) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    const db = require('../database/db');
    const users = db.prepare(`
      SELECT id, username, avatar, created_at 
      FROM users 
      WHERE username LIKE ? AND id != ?
      LIMIT 20
    `).all(`%${q}%`, req.user.id);

    res.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        avatar: u.avatar,
        created_at: u.created_at
      }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
