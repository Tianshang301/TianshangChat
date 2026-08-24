import { Server as SocketIoServer } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@tianshangchat/shared';
import type { ChatSocket } from './handlers/presence.js';
import { registerAuthHandler } from './handlers/auth.handler.js';
import { registerMessageHandlers } from './handlers/message.handler.js';
import { registerGroupHandlers } from './handlers/group.handler.js';
import { registerPresenceHandlers } from './handlers/presence.handler.js';

export type ChatServer = SocketIoServer<ClientToServerEvents, ServerToClientEvents>;

export function createChatServer(
  httpServer: import('node:http').Server,
  corsOrigin: (origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) => void,
): ChatServer {
  const io: ChatServer = new SocketIoServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // All handlers registered up-front; each one independently verifies presence
  // so a socket cannot act before `authenticate` succeeds.
  registerAuthHandler(io);

  io.on('connection', (socket: ChatSocket) => {
    registerMessageHandlers(io, socket);
    registerGroupHandlers(io, socket);
    registerPresenceHandlers(io, socket);
  });

  return io;
}
