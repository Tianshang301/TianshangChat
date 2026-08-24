import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  SendAck,
  ServerToClientEvents,
} from '@tianshangchat/shared';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 5000;

let socket: ChatSocket | null = null;

export function getSocket(): ChatSocket | null {
  return socket;
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}

/** Connects (replacing any previous socket) and performs the auth handshake. */
export function connect(token: string): ChatSocket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  // SERVER_URL is baked at module load of ../config; adapter keeps IO concerns only.
  const s: ChatSocket = io(getBaseUrlForSocket(), {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  s.on('connect', () => {
    s.emit('authenticate', { token });
  });
  socket = s;
  return s;
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}

function getBaseUrlForSocket(): string {
  // Lazy import avoidance: config is a pure module; read from global set at boot.
  return (globalThis as { __TSC_SERVER_URL__?: string }).__TSC_SERVER_URL__ ?? 'http://127.0.0.1:3000';
}

/** Socket base URL injection point — called once from config.ts on load. */
export function configureSocketUrl(url: string): void {
  (globalThis as { __TSC_SERVER_URL__?: string }).__TSC_SERVER_URL__ = url;
}

/**
 * Emit a send-style event and await the persistence ack.
 * Rejects on timeout or when the socket is not connected.
 */
export function emitWithAck(
  event: keyof ClientToServerEvents,
  payload: object,
): Promise<number> {
  const s = socket;
  if (!s || !s.connected) {
    return Promise.reject(new Error('offline'));
  }
  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ack timeout')), ACK_TIMEOUT_MS);
    try {
      (
        s.emit as unknown as (
          ev: string,
          payload: object,
          ack: (res: SendAck) => void,
        ) => void
      )(event, payload, (res) => {
        clearTimeout(timer);
        resolve(res.id);
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/* ------------------------------------------------------------------ */
/* Typed listener registration helper                                  */
/* ------------------------------------------------------------------ */

type ServerHandlers = {
  [K in keyof ServerToClientEvents]: ServerToClientEvents[K] extends (payload: infer P) => void
    ? (payload: P) => void
    : never;
};

export function bindServerHandlers(handlers: Partial<ServerHandlers>): void {
  const s = socket;
  if (!s) throw new Error('connect() before bindServerHandlers()');
  for (const [event, handler] of Object.entries(handlers)) {
    if (handler) {
      (s.on as unknown as (ev: string, fn: (...args: unknown[]) => void) => void)(
        event,
        handler as (...args: unknown[]) => void,
      );
    }
  }
}
