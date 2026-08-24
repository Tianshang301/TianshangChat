import Dexie, { type Table } from 'dexie';
import type { MessageDTO } from '@tianshangchat/shared';
import type { MessageStatus } from '../core/messageStatus';

/** Cached message with local delivery lifecycle + conversation partition key. */
export interface StoredMessage extends MessageDTO {
  convKey: string;
  status: MessageStatus;
}

export type OutboxKind =
  | 'public-text'
  | 'public-voice'
  | 'private-text'
  | 'private-voice'
  | 'group-text'
  | 'group-voice';

export interface OutboxItem {
  id?: number;
  kind: OutboxKind;
  /** Temp local message id this entry will resolve to. */
  tempId: number;
  convKey: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
  nextAttemptAt: string;
}

export interface MetaRow {
  key: string;
  value: string;
}

class ChatDatabase extends Dexie {
  messages!: Table<StoredMessage, number>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('tianshangchat');
    this.version(1).stores({
      // Primary key is the server message id (temp ids are negative and
      // replaced once the ack arrives).
      messages: 'id, convKey, timestamp, [convKey+timestamp]',
      outbox: '++id, nextAttemptAt',
      meta: 'key',
    });
  }
}

export const chatDb = new ChatDatabase();
