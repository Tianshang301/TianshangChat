import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tianshangchat/shared';
import { ErrorCode, protocolError, validateUploadPath } from '@tianshangchat/shared';
import { updateUserAvatar } from '../../data/user.repo.js';
import { presence, type ChatSocket } from './presence.js';
import { safeHandler } from './safe.js';

export function registerPresenceHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: ChatSocket,
): void {
  // Public typing indicator — legacy quirk preserved: `userId` is the raw socket id.
  socket.on(
    'typing',
    safeHandler(() => {
      const user = presence.getUserBySocket(socket.id);
      if (user) {
        socket.broadcast.emit('user-typing', { userId: socket.id, username: user.username });
      }
    }),
  );

  socket.on(
    'stop-typing',
    safeHandler(() => {
      socket.broadcast.emit('user-stop-typing', { userId: socket.id });
    }),
  );

  socket.on(
    'update-avatar',
    safeHandler((avatarUrl) => {
      const user = presence.getUserBySocket(socket.id);
      if (!user) return;

      // Legacy allowed null (clearing); non-null values must hit the whitelist.
      if (avatarUrl && !validateUploadPath(avatarUrl, 'avatars')) {
        socket.emit('error', protocolError('Invalid avatar URL', ErrorCode.InvalidAvatarUrl));
        return;
      }

      updateUserAvatar(user.id, avatarUrl || null);
      user.avatar = avatarUrl;

      io.emit('avatar-updated', {
        userId: user.id,
        username: user.username,
        avatar: avatarUrl,
      });
    }),
  );
}
