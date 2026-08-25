import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tianshangchat/shared';
import {
  ErrorCode,
  protocolError,
  validateUploadPath,
} from '@tianshangchat/shared';
import { createMessage, markDelivered } from '../../data/message.repo.js';
import { sendPushToUser } from '../../api/routes/push.routes.js';
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

/** Wire timestamp parity with legacy broadcasts (Date → ISO string via socket.io). */
function nowIso(): string {
  return new Date().toISOString();
}

/** Ack helper: responds with the persisted id when the client passed a callback. */
function ackSend(ack: ((res: { id: number }) => void) | undefined, id: number): void {
  try {
    ack?.({ id });
  } catch {
    /* client gone before ack — nothing to do */
  }
}

export function registerMessageHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: ChatSocket,
): void {
  // ---------------- public ----------------
  socket.on(
    'send-message',
    safeHandler((data, ack) => {
      const user = requireUser(socket);
      if (!user) return;

      const message = createMessage({
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        content: data.content,
        type: 'text',
      });

      io.emit('receive-message', {
        id: message.id,
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        content: data.content,
        type: 'text',
        timestamp: nowIso(),
      });

      ackSend(ack, message.id);
    }),
  );

  socket.on(
    'send-voice',
    safeHandler((data, ack) => {
      const user = requireUser(socket);
      if (!user) return;

      if (!validateUploadPath(data.audioUrl, 'voice')) {
        socket.emit('error', protocolError('Invalid audio URL', ErrorCode.InvalidAudioUrl));
        return;
      }

      const message = createMessage({
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        audioUrl: data.audioUrl,
        duration: data.duration ?? null,
        type: 'voice',
      });

      io.emit('receive-message', {
        id: message.id,
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        audioUrl: data.audioUrl,
        duration: data.duration,
        type: 'voice',
        timestamp: nowIso(),
      });

      ackSend(ack, message.id);
    }),
  );

  // ---------------- private ----------------
  socket.on(
    'send-private-message',
    safeHandler((data, ack) => {
      const user = requireUser(socket);
      if (!user) return;

      const { recipientId, content } = data;

      const message = createMessage({
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        recipientId,
        content,
        type: 'text',
      });

      const payload = {
        message: {
          id: message.id,
          senderId: user.id,
          senderName: user.username,
          senderAvatar: user.avatar,
          recipientId,
          content,
          type: 'text' as const,
          timestamp: nowIso(),
        },
        fromUser: user,
      };

      socket.emit('receive-private-message', payload);

      const recipientSocket = presence.getSocketByUserId(recipientId);
      let deliveredNow = false;
      if (recipientSocket) {
        recipientSocket.emit('receive-private-message', payload);
        markDelivered([message.id], recipientId, null);
        deliveredNow = true;
      } else {
        // Recipient offline: Web Push (no-op when VAPID is not configured).
        void sendPushToUser(recipientId, {
          title: `私聊消息 · ${user.username}`,
          body: content.slice(0, 120),
        });
      }
      if (deliveredNow) {
        socket.emit('message-status', { statuses: [{ id: message.id, status: 'delivered' }] });
      }

      ackSend(ack, message.id);
    }),
  );

  socket.on(
    'send-private-voice',
    safeHandler((data, ack) => {
      const user = requireUser(socket);
      if (!user) return;

      const { recipientId, audioUrl, duration } = data;

      if (!validateUploadPath(audioUrl, 'voice')) {
        socket.emit('error', protocolError('Invalid audio URL', ErrorCode.InvalidAudioUrl));
        return;
      }

      const message = createMessage({
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        recipientId,
        audioUrl,
        duration: duration ?? null,
        type: 'voice',
      });

      const payload = {
        message: {
          id: message.id,
          senderId: user.id,
          senderName: user.username,
          senderAvatar: user.avatar,
          recipientId,
          audioUrl,
          duration,
          type: 'voice' as const,
          timestamp: nowIso(),
        },
        fromUser: user,
      };

      socket.emit('receive-private-message', payload);

      const recipientSocket = presence.getSocketByUserId(recipientId);
      let deliveredNow = false;
      if (recipientSocket) {
        recipientSocket.emit('receive-private-message', payload);
        markDelivered([message.id], recipientId, null);
        deliveredNow = true;
      } else {
        // Recipient offline: Web Push (no-op when VAPID is not configured).
        void sendPushToUser(recipientId, {
          title: `私聊消息 · ${user.username}`,
          body: '收到一条语音消息',
        });
      }
      if (deliveredNow) {
        socket.emit('message-status', { statuses: [{ id: message.id, status: 'delivered' }] });
      }

      ackSend(ack, message.id);
    }),
  );

  // ---------------- typing (private) ----------------
  socket.on(
    'private-typing',
    safeHandler((data) => {
      const user = presence.getUserBySocket(socket.id);
      if (!user) return;
      presence
        .getSocketByUserId(data.recipientId)
        ?.emit('private-typing-start', {
          fromUserId: user.id,
          username: user.username,
          senderName: user.username,
          senderAvatar: user.avatar,
        });
    }),
  );

  socket.on(
    'stop-private-typing',
    safeHandler((data) => {
      const user = presence.getUserBySocket(socket.id);
      if (!user) return;
      presence.getSocketByUserId(data.recipientId)?.emit('private-typing-stop', {
        fromUserId: user.id,
      });
    }),
  );

}
