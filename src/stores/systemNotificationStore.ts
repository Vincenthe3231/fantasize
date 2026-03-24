import { create } from 'zustand';

export type SystemNotificationLevel = 'info' | 'success' | 'warning' | 'error';

export type SystemNotificationItem = {
  id: string;
  title: string;
  subtitle?: string;
  level: SystemNotificationLevel;
  createdAt: number;
};

type SystemNotificationState = {
  notifications: SystemNotificationItem[];
  push: (item: Omit<SystemNotificationItem, 'id' | 'createdAt'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

const MAX_NOTIFICATIONS = 5;

export const useSystemNotificationStore = create<SystemNotificationState>((set) => ({
  notifications: [],
  push: (item) =>
    set((state) => ({
      notifications: [
        {
          id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          ...item,
        },
        ...state.notifications,
      ].slice(0, MAX_NOTIFICATIONS),
    })),
  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clear: () => set({ notifications: [] }),
}));

