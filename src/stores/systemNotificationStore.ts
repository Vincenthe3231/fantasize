import { create } from 'zustand';

export type SystemNotificationLevel = 'info' | 'success' | 'warning' | 'error';

export type SystemNotificationItem = {
  id: string;
  title: string;
  subtitle?: string;
  level: SystemNotificationLevel;
  createdAt: number;
  /** Auto-dismiss after this many ms of wall time (pauses while hovered via pause/resume). */
  autoDismissMs?: number;
};

type SystemNotificationState = {
  notifications: SystemNotificationItem[];
  push: (item: Omit<SystemNotificationItem, 'id' | 'createdAt'>) => void;
  dismiss: (id: string) => void;
  pauseAutoDismiss: (id: string) => void;
  resumeAutoDismiss: (id: string) => void;
  clear: () => void;
};

const MAX_NOTIFICATIONS = 5;

/** Auto-remove system notification cards after this delay (manual dismiss clears the timer). */
export const AUTO_DISMISS_MS = 1500;

const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
const dismissDueAt = new Map<string, number>();
const dismissRemainingMs = new Map<string, number>();

function scheduleDismiss(id: string, ms: number, dismiss: (id: string) => void) {
  if (ms <= 0) {
    dismiss(id);
    return;
  }
  dismissDueAt.set(id, Date.now() + ms);
  dismissRemainingMs.set(id, ms);
  const t = setTimeout(() => {
    dismissTimers.delete(id);
    dismissDueAt.delete(id);
    dismissRemainingMs.delete(id);
    dismiss(id);
  }, ms);
  dismissTimers.set(id, t);
}

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
    const autoDismissMs = item.autoDismissMs ?? AUTO_DISMISS_MS;
    set((state) => {
      const next = [{ id, createdAt, ...item, autoDismissMs }, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      const nextIds = new Set(next.map((n) => n.id));
      for (const n of state.notifications) {
        if (!nextIds.has(n.id)) {
          clearDismissTimer(n.id);
          dismissDueAt.delete(n.id);
          dismissRemainingMs.delete(n.id);
        }
      }
      return { notifications: next };
    });
    scheduleDismiss(id, autoDismissMs, get().dismiss);
  },
  dismiss: (id) => {
    clearDismissTimer(id);
    dismissDueAt.delete(id);
    dismissRemainingMs.delete(id);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  pauseAutoDismiss: (id) => {
    const dueAt = dismissDueAt.get(id);
    if (dueAt !== undefined) {
      dismissRemainingMs.set(id, Math.max(0, dueAt - Date.now()));
    }
    clearDismissTimer(id);
  },
  resumeAutoDismiss: (id) => {
    const exists = get().notifications.some((n) => n.id === id);
    if (!exists || dismissTimers.has(id)) return;
    const remaining = dismissRemainingMs.get(id) ?? AUTO_DISMISS_MS;
    scheduleDismiss(id, remaining, get().dismiss);
  },
  clear: () => {
    for (const t of dismissTimers.values()) clearTimeout(t);
    dismissTimers.clear();
    dismissDueAt.clear();
    dismissRemainingMs.clear();
    set({ notifications: [] });
  },
}));
