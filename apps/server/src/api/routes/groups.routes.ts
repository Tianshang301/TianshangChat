import { Router } from 'express';
import { z } from 'zod';
import {
  CreateGroupRequestSchema,
  ErrorCode,
  protocolError,
} from '@tianshangchat/shared';
import { authMiddleware } from '../auth.middleware.js';
import { handler, parseIntParam, parseBody, parseQuery } from '../validation.js';
import * as groupRepo from '../../data/group.repo.js';
import { findUserById } from '../../data/user.repo.js';
import * as messageRepo from '../../data/message.repo.js';

const router = Router();

router.get(
  '/',
  authMiddleware,
  handler(async (req, res) => {
    const groups = groupRepo.getUserGroups(req.user!.id);
    res.json({ success: true, groups });
  }),
);

router.post(
  '/',
  authMiddleware,
  handler(async (req, res) => {
    const { name, memberIds } = parseBody(CreateGroupRequestSchema, req.body);
    const group = groupRepo.createGroup(name, req.user!.id, memberIds);
    res.status(201).json({ success: true, group });
  }),
);

router.get(
  '/:id',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const group = groupRepo.findGroupById(groupId);
    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }
    if (!groupRepo.isMember(group.id, req.user!.id)) {
      res.status(403).json(protocolError('Not a member of this group', ErrorCode.NotMember));
      return;
    }
    res.json({ success: true, group });
  }),
);

router.put(
  '/:id',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const group = groupRepo.findGroupById(groupId);
    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    const role = groupRepo.getMemberRole(groupId, req.user!.id);
    if (role !== 'creator') {
      res.status(403).json(protocolError('Only creator can update group', ErrorCode.Forbidden));
      return;
    }

    const { name } = parseBody(UpdateGroupNameSchema, req.body);
    if (name !== undefined) {
      groupRepo.updateGroupName(groupId, name);
    }

    res.json({ success: true, group: groupRepo.findGroupById(groupId) });
  }),
);

const UpdateGroupNameSchema = z.object({ name: z.string().trim().min(1).max(50).optional() });

router.delete(
  '/:id',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const group = groupRepo.findGroupById(groupId);
    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    if (group.creatorId !== req.user!.id) {
      res.status(403).json(protocolError('Only creator can delete group', ErrorCode.Forbidden));
      return;
    }

    groupRepo.deleteGroup(groupId);
    res.json({ success: true });
  }),
);

router.get(
  '/:id/messages',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    if (!groupRepo.isMember(groupId, req.user!.id)) {
      res.status(403).json(protocolError('Not a member of this group', ErrorCode.NotMember));
      return;
    }

    const QuerySchema = z.object({
      days: z.coerce.number().int().positive().max(365).default(30),
      limit: z.coerce.number().int().positive().max(2000).default(500),
    });
    const { days, limit } = parseQuery(QuerySchema, req.query);

    const rows = messageRepo.getGroupHistory(groupId, days, limit);
    messageRepo.markGroupAsRead(groupId, req.user!.id);

    res.json({
      success: true,
      messages: rows.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar,
        content: m.content,
        audioUrl: m.audioUrl,
        duration: m.duration,
        type: m.type,
        timestamp: m.timestamp,
      })),
    });
  }),
);

router.post(
  '/:id/members',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const group = groupRepo.findGroupById(groupId);
    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    const role = groupRepo.getMemberRole(groupId, req.user!.id);
    if (role !== 'creator' && role !== 'admin') {
      res
        .status(403)
        .json(protocolError('Only creator or admin can add members', ErrorCode.Forbidden));
      return;
    }

    if (groupRepo.isFull(groupId)) {
      res.status(400).json(protocolError('Group is full', ErrorCode.GroupFull));
      return;
    }

    const { userId } = parseBody(z.object({ userId: z.number().int() }), req.body);
    const userToAdd = findUserById(userId);
    if (!userToAdd) {
      res.status(404).json(protocolError('User not found', ErrorCode.NotFound));
      return;
    }

    if (groupRepo.isMember(groupId, userId)) {
      res.status(400).json(protocolError('User already in group', ErrorCode.AlreadyMember));
      return;
    }

    groupRepo.addMember(groupId, userId);

    res.json({ success: true, group: groupRepo.findGroupById(groupId) });
  }),
);

router.delete(
  '/:id/members/:userId',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const targetUserId = parseIntParam(req.params['userId'], 'userId');
    const group = groupRepo.findGroupById(groupId);
    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    const role = groupRepo.getMemberRole(groupId, req.user!.id);
    const targetRole = groupRepo.getMemberRole(groupId, targetUserId);

    if (req.user!.id !== targetUserId && role !== 'creator' && role !== 'admin') {
      res.status(403).json(protocolError('No permission', ErrorCode.Forbidden));
      return;
    }

    if (targetRole === 'creator') {
      res
        .status(400)
        .json(protocolError('Cannot remove creator', ErrorCode.CannotRemoveCreator));
      return;
    }

    const result = groupRepo.removeMember(groupId, targetUserId);

    if (result === 'group_deleted') {
      res.json({ success: true, groupDeleted: true });
      return;
    }

    res.json({ success: true, group: groupRepo.findGroupById(groupId) });
  }),
);

router.put(
  '/:id/admin/:userId',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const targetUserId = parseIntParam(req.params['userId'], 'userId');
    const { isAdmin } = parseBody(z.object({ isAdmin: z.boolean() }), req.body);

    const group = groupRepo.findGroupById(groupId);
    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    if (group.creatorId !== req.user!.id) {
      res.status(403).json(protocolError('Only creator can set admin', ErrorCode.Forbidden));
      return;
    }

    if (targetUserId === req.user!.id) {
      res.status(400).json(protocolError('Cannot change own role', ErrorCode.Forbidden));
      return;
    }

    groupRepo.setAdminRole(groupId, targetUserId, isAdmin);

    res.json({ success: true, group: groupRepo.findGroupById(groupId) });
  }),
);

router.post(
  '/:id/transfer',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const { newOwnerId } = parseBody(z.object({ newOwnerId: z.number().int() }), req.body);

    const group = groupRepo.findGroupById(groupId);
    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    if (group.creatorId !== req.user!.id) {
      res
        .status(403)
        .json(protocolError('Only creator can transfer ownership', ErrorCode.Forbidden));
      return;
    }

    if (!groupRepo.isMember(groupId, newOwnerId)) {
      res
        .status(400)
        .json(protocolError('New owner must be a member', ErrorCode.NotMember));
      return;
    }

    groupRepo.transferOwnership(groupId, newOwnerId);

    res.json({ success: true, group: groupRepo.findGroupById(groupId) });
  }),
);

router.post(
  '/:id/join',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const group = groupRepo.findGroupById(groupId);

    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    if (groupRepo.isMember(groupId, req.user!.id)) {
      res.status(400).json(protocolError('Already in this group', ErrorCode.AlreadyMember));
      return;
    }

    if (groupRepo.isFull(groupId)) {
      res.status(400).json(protocolError('Group is full', ErrorCode.GroupFull));
      return;
    }

    groupRepo.addMember(groupId, req.user!.id);

    res.json({ success: true, group: groupRepo.findGroupById(groupId) });
  }),
);

router.post(
  '/:id/leave',
  authMiddleware,
  handler(async (req, res) => {
    const groupId = parseIntParam(req.params['id'], 'groupId');
    const group = groupRepo.findGroupById(groupId);

    if (!group) {
      res.status(404).json(protocolError('Group not found', ErrorCode.GroupNotFound));
      return;
    }

    if (group.creatorId === req.user!.id) {
      res
        .status(400)
        .json(
          protocolError(
            'Creator cannot leave. Transfer ownership first or delete the group.',
            ErrorCode.CreatorCannotLeave,
          ),
        );
      return;
    }

    groupRepo.removeMember(groupId, req.user!.id);

    res.json({ success: true });
  }),
);

export default router;
