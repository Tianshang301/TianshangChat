import { z } from 'zod';
import { LIMITS } from '../constants.js';

/** Role of a member inside a group. `creator` > `admin` > `member`. */
export const GroupRoleSchema = z.enum(['creator', 'admin', 'member']);
export type GroupRole = z.infer<typeof GroupRoleSchema>;

/** Member row as embedded in `GroupDetail.members`. */
export const GroupMemberSchema = z.object({
  id: z.number().int(),
  groupId: z.number().int(),
  userId: z.number().int(),
  role: GroupRoleSchema,
  joinedAt: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
});

export type GroupMember = z.infer<typeof GroupMemberSchema>;

/**
 * Group shape returned by `GET /api/groups` (list view):
 * base columns + creatorName + caller's role + memberCount.
 */
export const GroupSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  creatorId: z.number().int(),
  maxMembers: z.number().int().optional(),
  createdAt: z.string(),
  creatorName: z.string(),
  role: GroupRoleSchema,
  memberCount: z.number().int(),
});

export type GroupSummary = z.infer<typeof GroupSummarySchema>;

/** Group shape returned by `GET /api/groups/:id` (detail view with members). */
export const GroupDetailSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  creatorId: z.number().int(),
  maxMembers: z.number().int().optional(),
  createdAt: z.string(),
  creatorName: z.string(),
  members: z.array(GroupMemberSchema),
});

export type GroupDetail = z.infer<typeof GroupDetailSchema>;

/** Loosest wire form used by socket broadcasts where list/detail shapes overlap. */
export type GroupPayload = GroupSummary | GroupDetail;

/* ------------------------------------------------------------------ */
/* Requests / responses                                                */
/* ------------------------------------------------------------------ */

export const CreateGroupRequestSchema = z.object({
  name: z.string().trim().min(LIMITS.groupNameMin).max(LIMITS.groupNameMax),
  memberIds: z.array(z.number().int()).max(LIMITS.createGroupMaxInitialMembers).default([]),
});

export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const UpdateGroupRequestSchema = z.object({
  name: z.string().trim().min(LIMITS.groupNameMin).max(LIMITS.groupNameMax).optional(),
});

export type UpdateGroupRequest = z.infer<typeof UpdateGroupRequestSchema>;

export const AddMemberRequestSchema = z.object({
  userId: z.number().int(),
});

export type AddMemberRequest = z.infer<typeof AddMemberRequestSchema>;

export const SetAdminRequestSchema = z.object({
  isAdmin: z.boolean(),
});

export type SetAdminRequest = z.infer<typeof SetAdminRequestSchema>;

export const TransferOwnerRequestSchema = z.object({
  newOwnerId: z.number().int(),
});

export type TransferOwnerRequest = z.infer<typeof TransferOwnerRequestSchema>;
