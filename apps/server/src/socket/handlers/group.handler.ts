import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tianshangchat/shared';
import { ErrorCode, groupRoom, protocolError, validateUploadPath } from '@tianshangchat/shared';
import { createMessage } from '../../data/message.repo.js';
import * as groupRepo from '../../data/group.repo.js';
import { presence, type ChatSocket } from './presence.js';
import { safeHandler } from './safe.js';

function requireUser(socket: ChatSocket) {
  const user = presence.getUserBySocket(socket.id);
  if (!user) {
    socket.emit('error', protocolError('Not authenticated', ErrorCode.NotAuthenticated));
    return null;
  }
  return user;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function registerGroupHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: ChatSocket,
): void {
  // ---------------- group messages ----------------
  socket.on(
    'send-group-message',
    safeHandler((data) => {
      const user = requireUser(socket);
      if (!user) return;

      const { groupId, content } = data;

      if (!groupRepo.isMember(groupId, user.id)) {
        socket.emit('error', protocolError('Not a member of this group', ErrorCode.NotMember));
        return;
      }

      const message = createMessage({
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        groupId,
        content,
        type: 'text',
      });

      io.to(groupRoom(groupId)).emit('receive-group-message', {
        message: {
          id: message.id,
          senderId: user.id,
          senderName: user.username,
          senderAvatar: user.avatar,
          groupId,
          content,
          type: 'text' as const,
          timestamp: nowIso(),
        },
        group: groupRepo.findGroupById(groupId)!,
      });
    }),
  );

  socket.on(
    'send-group-voice',
    safeHandler((data) => {
      const user = requireUser(socket);
      if (!user) return;

      const { groupId, audioUrl, duration } = data;

      if (!validateUploadPath(audioUrl, 'voice')) {
        socket.emit('error', protocolError('Invalid audio URL', ErrorCode.InvalidAudioUrl));
        return;
      }

      if (!groupRepo.isMember(groupId, user.id)) {
        socket.emit('error', protocolError('Not a member of this group', ErrorCode.NotMember));
        return;
      }

      const message = createMessage({
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        groupId,
        audioUrl,
        duration: duration ?? null,
        type: 'voice',
      });

      io.to(groupRoom(groupId)).emit('receive-group-message', {
        message: {
          id: message.id,
          senderId: user.id,
          senderName: user.username,
          senderAvatar: user.avatar,
          groupId,
          audioUrl,
          duration,
          type: 'voice' as const,
          timestamp: nowIso(),
        },
        group: groupRepo.findGroupById(groupId)!,
      });
    }),
  );

  // ---------------- group lifecycle ----------------
  socket.on(
    'create-group',
    safeHandler((data) => {
      const user = requireUser(socket);
      if (!user) return;

      const group = groupRepo.createGroup(data.name, user.id, data.memberIds ?? []);

      socket.join(groupRoom(group.id));

      socket.emit('group-list-update', { groups: groupRepo.getUserGroups(user.id) });
      socket.emit('group-created', { group });
    }),
  );

  socket.on(
    'join-group',
    safeHandler((data) => {
      const user = requireUser(socket);
      if (!user) return;

      const groupId = data.groupId;
      const group = groupRepo.findGroupById(groupId);

      if (!group) {
        socket.emit('error', protocolError('Group not found', ErrorCode.GroupNotFound));
        return;
      }

      if (groupRepo.isMember(groupId, user.id)) {
        socket.join(groupRoom(groupId));
        socket.emit('group-list-update', { groups: groupRepo.getUserGroups(user.id) });
        return;
      }

      const role = groupRepo.getMemberRole(groupId, user.id);
      if (role === 'creator' || role === 'admin') {
        groupRepo.addMember(groupId, user.id);
        socket.join(groupRoom(groupId));

        io.to(groupRoom(groupId)).emit('member-joined', {
          groupId,
          user: { id: user.id, username: user.username, avatar: user.avatar },
          group,
        });

        socket.emit('group-list-update', { groups: groupRepo.getUserGroups(user.id) });
      }
    }),
  );

  socket.on(
    'leave-group',
    safeHandler((data) => {
      const user = requireUser(socket);
      if (!user) return;

      const groupId = data.groupId;
      const group = groupRepo.findGroupById(groupId);

      if (!group) {
        socket.emit('error', protocolError('Group not found', ErrorCode.GroupNotFound));
        return;
      }

      if (group.creatorId === user.id) {
        socket.emit(
          'error',
          protocolError(
            'Creator cannot leave. Transfer ownership or delete the group.',
            ErrorCode.CreatorCannotLeave,
          ),
        );
        return;
      }

      socket.leave(groupRoom(groupId));
      groupRepo.removeMember(groupId, user.id);

      io.to(groupRoom(groupId)).emit('member-left', {
        groupId,
        userId: user.id,
        username: user.username,
      });

      socket.emit('group-list-update', { groups: groupRepo.getUserGroups(user.id) });
    }),
  );
}
