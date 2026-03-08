import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Notification {
  id: string;
  user_id: string;
  team: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  panelOpen: boolean;
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  panelOpen: false,

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ count: number }>('/notifications/unread-count');
      set({ unreadCount: res.data.count });
    } catch {
      // silently fail
    }
  },

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const res = await api.get<{ notifications: Notification[] }>('/notifications?limit=20');
      set({ notifications: res.data.notifications, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      await api.post('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {
      // silently fail
    }
  },

  togglePanel: () => {
    const willOpen = !get().panelOpen;
    set({ panelOpen: willOpen });
    if (willOpen) {
      get().fetchNotifications();
    }
  },

  closePanel: () => set({ panelOpen: false }),
}));
