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

router.get('/private/:userId', authMiddleware, (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId);
    const { days = 30, limit = 100 } = req.query;
    
    const messages = Message.getPrivateHistory(req.user.id, otherUserId, parseInt(days), parseInt(limit));
    
    Message.markPrivateAsRead(req.user.id, otherUserId);

    res.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderAvatar: m.sender_avatar,
        recipientId: m.recipient_id,
        content: m.content,
        audioUrl: m.audio_url,
        duration: m.duration,
        type: m.type,
        timestamp: m.timestamp
      }))
    });
  } catch (error) {
    console.error('Get private messages error:', error);
    res.status(500).json({ error: 'Failed to get private messages' });
  }
});

router.get('/private-list', authMiddleware, (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const conversations = Message.getPrivateList(req.user.id, parseInt(limit));
    
    res.json({
      success: true,
      conversations: conversations.map(c => ({
        userId: c.other_user_id,
        username: c.other_username,
        avatar: c.other_avatar,
        lastMessage: c.last_message,
        lastMessageTime: c.last_message_time,
        unreadCount: c.unread_count
      }))
    });
  } catch (error) {
    console.error('Get private list error:', error);
    res.status(500).json({ error: 'Failed to get private list' });
  }
});

router.get('/unread', authMiddleware, (req, res) => {
  try {
    const count = Message.getUnreadCount(req.user.id);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Get unread error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

module.exports = router;
