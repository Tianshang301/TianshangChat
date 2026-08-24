import { create } from 'zustand';
import type { MobileTab } from '../ui/components/BottomNav';

interface UiState {
  mobileTab: MobileTab;
  isWindowFocused: boolean;
  showCreateGroup: boolean;
  showUserSearch: boolean;
  showJoinGroup: boolean;

  setMobileTab: (tab: MobileTab) => void;
  setWindowFocused: (v: boolean) => void;
  setShowCreateGroup: (v: boolean) => void;
  setShowUserSearch: (v: boolean) => void;
  setShowJoinGroup: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileTab: 'public',
  isWindowFocused: true,
  showCreateGroup: false,
  showUserSearch: false,
  showJoinGroup: false,

  setMobileTab: (tab) => set({ mobileTab: tab }),
  setWindowFocused: (v) => set({ isWindowFocused: v }),
  setShowCreateGroup: (v) => set({ showCreateGroup: v }),
  setShowUserSearch: (v) => set({ showUserSearch: v }),
  setShowJoinGroup: (v) => set({ showJoinGroup: v }),
}));
