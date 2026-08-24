import type { ClientToServerEvents, OnlineUser, ServerToClientEvents } from '@tianshangchat/shared';
import type { Socket } from 'socket.io';

export type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Presence row stored per connected socket. */
export interface AuthedUser {
  id: number;
  username: string;
  avatar: string | null;
  socketId: string;
}

class PresenceStore {
  private readonly onlineUsers = new Map<string, AuthedUser>();
  private readonly userSockets = new Map<number, ChatSocket>();

  attach(socket: ChatSocket, user: AuthedUser): void {
    this.onlineUsers.set(socket.id, user);
    this.userSockets.set(user.id, socket);
  }

  detachBySocket(socketId: string): AuthedUser | undefined {
    const user = this.onlineUsers.get(socketId);
    if (user) {
      this.onlineUsers.delete(socketId);
      // Only clear the reverse mapping if it still points at this session.
      if (this.userSockets.get(user.id) === undefined || this.userSockets.get(user.id)?.id === socketId) {
        this.userSockets.delete(user.id);
      }
    }
    return user;
  }

  /** Legacy parity: a fresh login from the same account evicts the previous socket mapping. */
  detachByUserId(userId: number): void {
    const previous = this.userSockets.get(userId);
    if (previous) {
      this.onlineUsers.delete(previous.id);
      this.userSockets.delete(userId);
    }
  }

  getUserBySocket(socketId: string): AuthedUser | undefined {
    return this.onlineUsers.get(socketId);
  }

  getSocketByUserId(userId: number): ChatSocket | undefined {
    return this.userSockets.get(userId);
  }

  listOnline(): OnlineUser[] {
    return Array.from(this.onlineUsers.values());
  }

  get size(): number {
    return this.onlineUsers.size;
  }
}

export const presence = new PresenceStore();
