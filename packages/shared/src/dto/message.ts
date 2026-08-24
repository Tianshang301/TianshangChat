import { z } from 'zod';
import { LIMITS } from '../constants.js';

export const MessageKindSchema = z.enum(['text', 'voice']);
export type MessageKind = z.infer<typeof MessageKindSchema>;

/**
 * Wire representation of a chat message (public, private, or group).
 * `content` XOR `audioUrl` is populated depending on `type`.
 * Timestamps are opaque strings on the wire (SQLite datetime or serialized Date from live broadcasts).
 */
export const MessageDTOSchema = z.object({
  id: z.number().int(),
  senderId: z.number().int(),
  senderName: z.string(),
  senderAvatar: z.string().nullable().optional(),
  recipientId: z.number().int().nullable().optional(),
  groupId: z.number().int().nullable().optional(),
  content: z.string().nullish(),
  audioUrl: z.string().nullish(),
  duration: z.union([z.string(), z.number()]).nullish(),
  type: MessageKindSchema,
  timestamp: z.string(),
});

export type MessageDTO = z.infer<typeof MessageDTOSchema>;

/** Text payload shared by public/private/group send events. */
export const SendTextPayloadSchema = z.object({
  content: z.string().min(1).max(LIMITS.messageMaxLength),
});

/** Voice payload shared by public/private/group send-voice events. */
export const SendVoicePayloadSchema = z.object({
  audioUrl: z.string().startsWith('/uploads/voice/'),
  duration: z.union([z.string(), z.number()]).optional(),
});

export const TargetUserSchema = z.object({ recipientId: z.number().int() });
export const TargetGroupSchema = z.object({ groupId: z.number().int() });

/** Conversation list entry (`GET /api/messages/private-list`). */
export const ConversationSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  avatar: z.string().nullable(),
  lastMessage: z.string().nullable(),
  lastMessageTime: z.string().nullable(),
  unreadCount: z.number().int(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

export const HistoryResponseSchema = z.object({
  success: z.literal(true),
  messages: z.array(MessageDTOSchema),
});

export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;

export const ConversationListResponseSchema = z.object({
  success: z.literal(true),
  conversations: z.array(ConversationSchema),
});

export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>;

export const UnreadCountResponseSchema = z.object({
  success: z.literal(true),
  count: z.number().int(),
});

export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

/** Incremental sync response (`GET /api/sync?cursor=`). */
export const SyncResponseSchema = z.object({
  success: z.literal(true),
  messages: z.array(MessageDTOSchema),
  /** Highest message id in this batch; pass back as next cursor. */
  nextCursor: z.number().int(),
});

export type SyncResponse = z.infer<typeof SyncResponseSchema>;
