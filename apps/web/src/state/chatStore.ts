import { create } from 'zustand';
import type { GroupDetail, GroupSummary, MessageDTO, OnlineUser, UserSummary } from '@tianshangchat/shared';
import type { MessageStatus } from '../core/messageStatus';

export interface ChatPartner {
  id: number;
  username: string;
  avatar: string | null;
}

/** Wire message + local delivery lifecycle annotation. */
export type StoreMessage = MessageDTO & { status?: MessageStatus };

interface ChatState {
  currentUser: UserSummary | null;
  connected: boolean;
  users: OnlineUser[];
  groups: GroupSummary[];
  /** convKey (`public` / `p:3` / `g:5`) → ascending messages. */
  messagesByConv: Record<string, StoreMessage[]>;
  unreadPrivate: Record<number, number>;
  unreadGroup: Record<number, number>;
  privateChatUser: ChatPartner | null;
  selectedGroup: GroupDetail | null;
  groupSettingsGroup: GroupDetail | null;
  privateTypingFrom: string | null;

  setCurrentUser: (u: UserSummary | null) => void;
  setConnected: (v: boolean) => void;
  setUsers: (users: OnlineUser[]) => void;
  removeUser: (id: number) => void;
  setGroups: (groups: GroupSummary[]) => void;
  upsertGroup: (group: GroupSummary | GroupDetail) => void;

  appendMessage: (convKey: string, msg: StoreMessage) => void;
  replaceTempMessage: (convKey: string, tempId: number, realId: number) => void;
  setMessageStatuses: (ids: number[], status: MessageStatus) => void;
  setConversation: (convKey: string, msgs: StoreMessage[]) => void;

  bumpUnreadPrivate: (peerId: number) => void;
  clearUnreadPrivate: (peerId: number) => void;
  bumpUnreadGroup: (groupId: number) => void;
  clearUnreadGroup: (groupId: number) => void;

  openPrivateChat: (partner: ChatPartner) => void;
  closePrivateChat: () => void;
  setSelectedGroup: (group: GroupDetail | null) => void;
  setGroupSettingsGroup: (group: GroupDetail | null) => void;
  setPrivateTyping: (username: string | null) => void;
  reset: () => void;
}

const initial = {
  currentUser: null,
  connected: false,
  users: [] as OnlineUser[],
  groups: [] as GroupSummary[],
  messagesByConv: {} as Record<string, StoreMessage[]>,
  unreadPrivate: {} as Record<number, number>,
  unreadGroup: {} as Record<number, number>,
  privateChatUser: null,
  selectedGroup: null,
  groupSettingsGroup: null,
  privateTypingFrom: null,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initial,

  setCurrentUser: (u) => set({ currentUser: u }),
  setConnected: (v) => set({ connected: v }),
  setUsers: (users) => set({ users }),
  removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
  setGroups: (groups) => set({ groups }),
  upsertGroup: (group) =>
    set((s) => {
      const summary: GroupSummary =
        'members' in group
          ? {
              ...group,
              role: s.groups.find((g) => g.id === group.id)?.role ?? ('member' as const),
              memberCount: group.members.length,
            }
          : group;
      const exists = s.groups.some((g) => g.id === summary.id);
      return {
        groups: exists
          ? s.groups.map((g) => (g.id === summary.id ? { ...g, ...summary } : g))
          : [...s.groups, summary],
      };
    }),

  appendMessage: (convKey, msg) =>
    set((s) => ({
      messagesByConv: {
        ...s.messagesByConv,
        [convKey]: [...(s.messagesByConv[convKey] ?? []), msg],
      },
    })),

  replaceTempMessage: (convKey, tempId, realId) =>
    set((s) => ({
      messagesByConv: {
        ...s.messagesByConv,
        [convKey]: (s.messagesByConv[convKey] ?? []).map((m) =>
          m.id === tempId ? { ...m, id: realId, status: 'sent' as const } : m,
        ),
      },
    })),

  setMessageStatuses: (ids, status) =>
    set((s) => {
      const idSet = new Set(ids);
      const next: Record<string, StoreMessage[]> = {};
      for (const [key, list] of Object.entries(s.messagesByConv)) {
        next[key] = list.map((m) => (idSet.has(m.id) ? { ...m, status } : m));
      }
      return { messagesByConv: next };
    }),

  setConversation: (convKey, msgs) =>
    set((s) => ({ messagesByConv: { ...s.messagesByConv, [convKey]: msgs } })),

  bumpUnreadPrivate: (peerId) =>
    set((s) => ({
      unreadPrivate: { ...s.unreadPrivate, [peerId]: (s.unreadPrivate[peerId] ?? 0) + 1 },
    })),
  clearUnreadPrivate: (peerId) =>
    set((s) => ({ unreadPrivate: { ...s.unreadPrivate, [peerId]: 0 } })),
  bumpUnreadGroup: (groupId) =>
    set((s) => ({
      unreadGroup: { ...s.unreadGroup, [groupId]: (s.unreadGroup[groupId] ?? 0) + 1 },
    })),
  clearUnreadGroup: (groupId) =>
    set((s) => ({ unreadGroup: { ...s.unreadGroup, [groupId]: 0 } })),

  openPrivateChat: (partner) => set({ privateChatUser: partner }),
  closePrivateChat: () => set({ privateChatUser: null }),
  setSelectedGroup: (group) => set({ selectedGroup: group }),
  setGroupSettingsGroup: (group) => set({ groupSettingsGroup: group }),
  setPrivateTyping: (username) => set({ privateTypingFrom: username }),
  reset: () => set({ ...initial }),
}));

/** Imperative accessor for non-React layers (socket handlers, outbox flush). */
export const chatStoreApi = useChatStore;
