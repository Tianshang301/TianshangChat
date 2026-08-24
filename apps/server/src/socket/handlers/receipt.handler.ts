import type { Server } from 'socket.io';
import type { ClientToServerEvents, MessageStatusEntry, ServerToClientEvents } from '@tianshangchat/shared';
import {
  markDelivered,
  markReadGroup,
  markReadPrivate,
  getMessageSenders,
} from '../../data/message.repo.js';
import * as groupRepo from '../../data/group.repo.js';
import { presence, type ChatSocket } from './presence.js';
import { safeHandler } from './safe.js';

/**
 * Fan a batch of status transitions back to every original sender that is online.
 */
function notifySenders(
  _io: Server<ClientToServerEvents, ServerToClientEvents>,
  messageIds: number[],
  status: MessageStatusEntry['status'],
): void {
  if (messageIds.length === 0) return;
  const owners = getMessageSenders(messageIds);
  const bySender = new Map<number, number[]>();
  for (const [messageId, senderId] of owners) {
    const list = bySender.get(senderId) ?? [];
    list.push(messageId);
    bySender.set(senderId, list);
  }
  for (const [senderId, ids] of bySender) {
    presence.getSocketByUserId(senderId)?.emit('message-status', {
      statuses: ids.map((id) => ({ id, status })),
    });
  }
}

export function registerReceiptHandlers(
  _io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: ChatSocket,
): void {
  socket.on(
    'mark-delivered',
    safeHandler((payload) => {
      const user = presence.getUserBySocket(socket.id);
      if (!user || payload.messageIds.length === 0) return;
      // Recipient-scoped update: private messages addressed to me plus group
      // messages of groups I belong to.
      let updated = markDelivered(payload.messageIds, user.id, null);
      for (const groupId of groupRepo.getUserGroups(user.id).map((g) => g.id)) {
        updated = updated.concat(markDelivered(payload.messageIds, null, groupId));
      }
      notifySenders(_io, Array.from(new Set(updated)), 'delivered');
    }),
  );

  socket.on(
    'mark-read',
    safeHandler((payload) => {
      const user = presence.getUserBySocket(socket.id);
      if (!user || payload.messageIds.length === 0) return;

      let updated: number[] = [];
      if (payload.kind === 'private') {
        updated = markReadPrivate(payload.messageIds, user.id);
      } else {
        if (!groupRepo.isMember(payload.groupId, user.id)) return;
        updated = markReadGroup(payload.messageIds, payload.groupId, user.id);
      }
      notifySenders(_io, updated, 'read');
    }),
  );
}
