import { useSystemNotificationStore, type SystemNotificationLevel } from '@/stores/systemNotificationStore';

type NotifyInput = {
  title: string;
  subtitle?: string;
  level?: SystemNotificationLevel;
  /** Overrides default auto-dismiss (ms). Timer pauses while the toast is hovered. */
  autoDismissMs?: number;
};

export function notify({ title, subtitle, level = 'info', autoDismissMs }: NotifyInput): void {
  useSystemNotificationStore.getState().push({ title, subtitle, level, autoDismissMs });
}

const PROCESS_COMPLETE_DISMISS_MS = 3000;

/** Success toast for finished canvas/Scout work; dismisses after 3s (pauses on hover). */
export function notifyProcessComplete(title: string, subtitle?: string): void {
  notify({ title, subtitle, level: 'success', autoDismissMs: PROCESS_COMPLETE_DISMISS_MS });
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

