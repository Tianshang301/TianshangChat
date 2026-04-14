const express = require('express');
const { body, validationResult } = require('express-validator');
const Group = require('../models/Group');
const User = require('../models/User');
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  try {
    const groups = Group.getUserGroups(req.user.id);
    res.json({
      success: true,
      groups
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

router.post('/',
  authMiddleware,
  body('name').isLength({ min: 1, max: 50 }).trim(),
  body('memberIds').isArray(),
  (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid input', details: errors.array() });
      }

      const { name, memberIds } = req.body;
      const group = Group.create(name, req.user.id, memberIds || []);
      
      res.status(201).json({
        success: true,
        group
      });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  }
);

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const group = Group.findById(parseInt(req.params.id));
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!Group.isMember(group.id, req.user.id)) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

router.put('/:id', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const group = Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const role = Group.getMemberRole(groupId, req.user.id);
    if (role !== 'creator') {
      return res.status(403).json({ error: 'Only creator can update group' });
    }

    const { name } = req.body;
    if (name) {
      Group.updateName(groupId, name);
    }

    res.json({
      success: true,
      group: Group.findById(groupId)
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const group = Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only creator can delete group' });
    }

    Group.delete(groupId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

router.get('/:id/messages', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    if (!Group.isMember(groupId, req.user.id)) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const { days = 30, limit = 500 } = req.query;
    const messages = Message.getGroupHistory(groupId, parseInt(days), parseInt(limit));
    
    Message.markGroupAsRead(groupId, req.user.id);

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
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.post('/:id/members', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const group = Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const role = Group.getMemberRole(groupId, req.user.id);
    if (role !== 'creator' && role !== 'admin') {
      return res.status(403).json({ error: 'Only creator or admin can add members' });
    }

    if (Group.isFull(groupId)) {
      return res.status(400).json({ error: 'Group is full' });
    }

    const { userId } = req.body;
    const userToAdd = User.findById(userId);
    if (!userToAdd) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (Group.isMember(groupId, userId)) {
      return res.status(400).json({ error: 'User already in group' });
    }

    Group.addMember(groupId, userId);
    
    res.json({
      success: true,
      group: Group.findById(groupId)
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/:id/members/:userId', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    const group = Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const role = Group.getMemberRole(groupId, req.user.id);
    const targetRole = Group.getMemberRole(groupId, targetUserId);

    if (req.user.id !== targetUserId && role !== 'creator' && role !== 'admin') {
      return res.status(403).json({ error: 'No permission' });
    }

    if (targetRole === 'creator') {
      return res.status(400).json({ error: 'Cannot remove creator' });
    }

    const result = Group.removeMember(groupId, targetUserId);
    
    if (result === 'group_deleted') {
      return res.json({ success: true, groupDeleted: true });
    }

    res.json({
      success: true,
      group: Group.findById(groupId)
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.put('/:id/admin/:userId', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    const { isAdmin } = req.body;

    const group = Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only creator can set admin' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot change own role' });
    }

    Group.setAdmin(groupId, targetUserId, isAdmin);
    
    res.json({
      success: true,
      group: Group.findById(groupId)
    });
  } catch (error) {
    console.error('Set admin error:', error);
    res.status(500).json({ error: 'Failed to set admin' });
  }
});

router.post('/:id/transfer', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { newOwnerId } = req.body;

    const group = Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only creator can transfer ownership' });
    }

    if (!Group.isMember(groupId, newOwnerId)) {
      return res.status(400).json({ error: 'New owner must be a member' });
    }

    Group.transferOwner(groupId, newOwnerId);
    
    res.json({
      success: true,
      group: Group.findById(groupId)
    });
  } catch (error) {
    console.error('Transfer owner error:', error);
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

router.post('/:id/leave', authMiddleware, (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const group = Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator_id === req.user.id) {
      return res.status(400).json({ error: 'Creator cannot leave. Transfer ownership first or delete the group.' });
    }

    Group.removeMember(groupId, req.user.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

module.exports = router;
