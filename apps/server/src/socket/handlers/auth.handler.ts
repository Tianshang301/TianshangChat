import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tianshangchat/shared';
import jwt from 'jsonwebtoken';
import { ErrorCode, protocolError } from '@tianshangchat/shared';
import { config } from '../../config.js';
import { findLiveSessionByToken } from '../../data/session.repo.js';
import { findUserById } from '../../data/user.repo.js';
import * as groupRepo from '../../data/group.repo.js';
import { groupRoom } from '@tianshangchat/shared';
import { presence, type AuthedUser } from './presence.js';
import { createLogger } from '../../infra/logger.js';

const log = createLogger('socket:auth');

export function registerAuthHandler(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  io.on('connection', (socket) => {
    log.debug(`connected ${socket.id}`);

    socket.on('authenticate', (data) => {
      try {
        const token = data.token;
        if (!token) {
          socket.emit('auth-error', protocolError('No token provided', ErrorCode.TokenInvalid));
          return;
        }

        let decoded: { id: number; username: string } | null = null;
        try {
          const payload = jwt.verify(token, config.jwtSecret);
          if (typeof payload !== 'string' && typeof payload.id === 'number') {
            decoded = { id: payload.id, username: String(payload.username ?? '') };
          }
        } catch {
          decoded = null;
        }
        if (!decoded) {
          socket.emit(
            'auth-error',
            protocolError('Token expired or invalid', ErrorCode.TokenInvalid),
          );
          return;
        }

        const session = findLiveSessionByToken(token);
        if (!session) {
          socket.emit(
            'auth-error',
            protocolError('Token expired or invalid', ErrorCode.TokenInvalid),
          );
          return;
        }

        const dbUser = findUserById(decoded.id);
        if (!dbUser) {
          socket.emit('auth-error', protocolError('User not found', ErrorCode.NotFound));
          return;
        }

        // Legacy behavior: a user's newest socket replaces the previous mapping.
        presence.detachByUserId(dbUser.id);

        const user: AuthedUser = {
          id: dbUser.id,
          username: dbUser.username,
          avatar: dbUser.avatar,
          socketId: socket.id,
        };

        presence.attach(socket, user);

        socket.emit('authenticated', { user });
        socket.emit('user-list-update', presence.listOnline());
        socket.broadcast.emit('user-list-update', presence.listOnline());

        for (const g of groupRepo.getUserGroups(user.id)) {
          socket.join(groupRoom(g.id));
        }
        socket.emit('group-list-update', { groups: groupRepo.getUserGroups(user.id) });

        log.info(`authenticated ${user.username}`);
      } catch (err) {
        log.error('authenticate failed', err);
        socket.emit('auth-error', protocolError('Authentication failed', ErrorCode.Internal));
      }
    });

    socket.on('disconnect', () => {
      const user = presence.detachBySocket(socket.id);
      if (user) {
        io.emit('user-left', { userId: user.id, username: user.username });
      }
      log.debug(`disconnected ${socket.id}`);
    });
  });
}
