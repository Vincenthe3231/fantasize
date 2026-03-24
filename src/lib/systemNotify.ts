import { useSystemNotificationStore, type SystemNotificationLevel } from '@/stores/systemNotificationStore';

type NotifyInput = {
  title: string;
  subtitle?: string;
  level?: SystemNotificationLevel;
};

export function notify({ title, subtitle, level = 'info' }: NotifyInput): void {
  useSystemNotificationStore.getState().push({ title, subtitle, level });
}

export function notifyInfo(title: string, subtitle?: string): void {
  notify({ title, subtitle, level: 'info' });
}

export function notifySuccess(title: string, subtitle?: string): void {
  notify({ title, subtitle, level: 'success' });
}

export function notifyWarning(title: string, subtitle?: string): void {
  notify({ title, subtitle, level: 'warning' });
}

export function notifyError(title: string, subtitle?: string): void {
  notify({ title, subtitle, level: 'error' });
}

