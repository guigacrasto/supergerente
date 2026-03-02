import { create } from 'zustand';

const STORAGE_KEY = 'sg_sidebar_collapsed';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: localStorage.getItem(STORAGE_KEY) === 'true',

  toggle: () =>
    set((state) => {
      const next = !state.collapsed;
      localStorage.setItem(STORAGE_KEY, String(next));
      return { collapsed: next };
    }),
}));
