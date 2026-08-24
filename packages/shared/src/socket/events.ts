import type { OnlineUser, UserSummary } from '../dto/user.js';
import type { MessageDTO } from '../dto/message.js';
import type { GroupPayload, GroupSummary } from '../dto/group.js';
import type { ProtocolError } from '../errors.js';

/* ------------------------------------------------------------------ */
/* Payload shapes                                                      */
/* ------------------------------------------------------------------ */

export interface AuthenticatePayload {
  token: string;
}

export interface AuthenticatedPayload {
  user: OnlineUser;
}

export interface GroupListPayload {
  groups: GroupSummary[];
}

export interface GroupCreatedPayload {
  group: GroupPayload;
}

export interface PrivateMessagePayload {
  message: MessageDTO;
  fromUser: OnlineUser;
}

export interface GroupMessagePayload {
  message: MessageDTO;
  group: GroupPayload;
}

export interface MemberJoinedPayload {
  groupId: number;
  user: Pick<UserSummary, 'id' | 'username'> & { avatar: string | null };
  group: GroupPayload;
}

export interface MemberLeftPayload {
  groupId: number;
  userId: number;
  username: string;
}

/** NOTE: public-channel typing uses the raw socket id as `userId` (legacy quirk, kept). */
export interface PublicTypingPayload {
  userId: string;
  username?: string;
}

export interface PrivateTypingStartPayload {
  fromUserId: number;
  username: string;
  senderName: string;
  senderAvatar: string | null;
}

export interface PrivateTypingStopPayload {
  fromUserId: number;
}

export interface AvatarUpdatedPayload {
  userId: number;
  username: string;
  avatar: string | null | undefined;
}

export interface UserLeftPayload {
  userId: number;
  username: string;
}

export type CreateGroupSocketPayload = {
  name: string;
  memberIds?: number[];
};

/* ------------------------------------------------------------------ */
/* Contracts                                                           */
/* ------------------------------------------------------------------ */

/** Events emitted by clients, handled by `apps/server`. */
export interface ClientToServerEvents {
  authenticate: (payload: AuthenticatePayload) => void;

  // public channel
  'send-message': (payload: { content: string }) => void;
  'send-voice': (payload: { audioUrl: string; duration?: string | number }) => void;
  typing: () => void;
  'stop-typing': () => void;

  // private channel
  'send-private-message': (payload: { recipientId: number; content: string }) => void;
  'send-private-voice': (payload: {
    recipientId: number;
    audioUrl: string;
    duration?: string | number;
  }) => void;
  'private-typing': (payload: { recipientId: number }) => void;
  'stop-private-typing': (payload: { recipientId: number }) => void;

  // group channel
  'send-group-message': (payload: { groupId: number; content: string }) => void;
  'send-group-voice': (payload: {
    groupId: number;
    audioUrl: string;
    duration?: string | number;
  }) => void;
  'create-group': (payload: CreateGroupSocketPayload) => void;
  'join-group': (payload: { groupId: number }) => void;
  'leave-group': (payload: { groupId: number }) => void;

  // profile
  'update-avatar': (avatarUrl: string) => void;
}

/** Events emitted by the server to clients. */
export interface ServerToClientEvents {
  authenticated: (payload: AuthenticatedPayload) => void;
  'auth-error': (payload: ProtocolError) => void;

  'user-list-update': (users: OnlineUser[]) => void;
  'user-left': (payload: UserLeftPayload) => void;

  'group-list-update': (payload: GroupListPayload) => void;
  'group-created': (payload: GroupCreatedPayload) => void;
  'group-updated': (payload: { group: GroupPayload }) => void;
  'member-joined': (payload: MemberJoinedPayload) => void;
  'member-left': (payload: MemberLeftPayload) => void;

  'receive-message': (message: MessageDTO) => void;
  'receive-private-message': (payload: PrivateMessagePayload) => void;
  'receive-group-message': (payload: GroupMessagePayload) => void;

  'private-typing-start': (payload: PrivateTypingStartPayload) => void;
  'private-typing-stop': (payload: PrivateTypingStopPayload) => void;
  'user-typing': (payload: PublicTypingPayload) => void;
  'user-stop-typing': (payload: PublicTypingPayload) => void;

  'avatar-updated': (payload: AvatarUpdatedPayload) => void;

  error: (payload: ProtocolError) => void;
}
