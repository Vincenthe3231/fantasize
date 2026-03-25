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

/** Auto-remove system notification cards after this delay (manual dismiss clears the timer). */
export const AUTO_DISMISS_MS = 1500;

const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearDismissTimer(id: string) {
  const t = dismissTimers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    dismissTimers.delete(id);
  }
}

export const useSystemNotificationStore = create<SystemNotificationState>((set, get) => ({
  notifications: [],
  push: (item) => {
    const id = `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();
    set((state) => {
      const next = [{ id, createdAt, ...item }, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      const nextIds = new Set(next.map((n) => n.id));
      for (const n of state.notifications) {
        if (!nextIds.has(n.id)) clearDismissTimer(n.id);
      }
      return { notifications: next };
    });
    const t = setTimeout(() => {
      dismissTimers.delete(id);
      get().dismiss(id);
    }, AUTO_DISMISS_MS);
    dismissTimers.set(id, t);
  },
  dismiss: (id) => {
    clearDismissTimer(id);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  clear: () => {
    for (const t of dismissTimers.values()) clearTimeout(t);
    dismissTimers.clear();
    set({ notifications: [] });
  },
}));
