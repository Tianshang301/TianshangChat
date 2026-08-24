import type { GroupDetail } from '@tianshangchat/shared';
import { chatStoreApi as store } from '../state/chatStore';
import { api } from '../data/apiClient';

/** Group management use-cases: REST mutation + store refresh via detail re-fetch. */

async function refreshDetail(token: string, groupId: number): Promise<GroupDetail | null> {
  const detail = await api.groupDetail(token, groupId);
  if (detail) store.getState().upsertGroup(detail);
  return detail;
}

export function makeGroupUseCases(token: string) {
  return {
    async addMember(groupId: number, userId: number): Promise<void> {
      await api.addMember(token, groupId, userId);
      await refreshDetail(token, groupId);
    },

    async removeMember(groupId: number, userId: number): Promise<void> {
      await api.removeMember(token, groupId, userId);
      const detail = await api.groupDetail(token, groupId).catch(() => null);
      if (detail) {
        store.getState().upsertGroup(detail);
      } else {
        // Group dissolved (last member left).
        store.getState().setGroups(store.getState().groups.filter((g) => g.id !== groupId));
        if (store.getState().selectedGroup?.id === groupId) {
          store.getState().setSelectedGroup(null);
          store.getState().setGroupSettingsGroup(null);
        }
      }
    },

    async setAdmin(groupId: number, userId: number, isAdmin: boolean): Promise<void> {
      await api.setAdmin(token, groupId, userId, isAdmin);
      await refreshDetail(token, groupId);
    },

    async transferOwner(groupId: number, newOwnerId: number): Promise<void> {
      await api.transferOwner(token, groupId, newOwnerId);
      await refreshDetail(token, groupId);
    },

    async leave(groupId: number): Promise<void> {
      await api.leaveGroup(token, groupId);
      if (store.getState().selectedGroup?.id === groupId) {
        store.getState().setSelectedGroup(null);
      }
    },

    async remove(groupId: number): Promise<void> {
      await api.deleteGroup(token, groupId);
      if (store.getState().selectedGroup?.id === groupId) {
        store.getState().setSelectedGroup(null);
      }
      store.getState().setGroupSettingsGroup(null);
      store
        .getState()
        .setGroups(store.getState().groups.filter((g) => g.id !== groupId));
    },
  };
}
