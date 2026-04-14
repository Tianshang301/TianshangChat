const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Message = require('../models/Message');

const router = express.Router();

router.get('/history', authMiddleware, (req, res) => {
  try {
    const { days = 7, limit = 500 } = req.query;
    const messages = Message.getHistory(parseInt(days), parseInt(limit));
    res.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderAvatar: m.sender_avatar,
        content: m.content,
        audioUrl: m.audio_url,
        duration: m.duration,
        type: m.type,
        timestamp: m.timestamp
      }))
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

router.get('/before', authMiddleware, (req, res) => {
  try {
    const { before, limit = 100 } = req.query;
    if (!before) {
      return res.status(400).json({ error: 'Missing before parameter' });
    }
    const messages = Message.getHistoryBefore(before, parseInt(limit));
    res.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderAvatar: m.sender_avatar,
        content: m.content,
        audioUrl: m.audio_url,
        duration: m.duration,
        type: m.type,
        timestamp: m.timestamp
      }))
    });
  } catch (error) {
    console.error('Get messages before error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

module.exports = router;
