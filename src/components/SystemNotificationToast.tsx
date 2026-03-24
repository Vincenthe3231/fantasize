import { type ReactNode } from 'react';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemNotificationLevel } from '@/stores/systemNotificationStore';

export type SystemNotificationToastProps = {
  title?: string;
  subtitle?: string;
  /** Primary action when the card is activated (not the dismiss control). */
  onOpen?: () => void;
  onDismiss?: () => void;
  className?: string;
  /** Override the default bell icon inside the gradient square. */
  icon?: ReactNode;
  level?: SystemNotificationLevel;
};

export function SystemNotificationToast({
  title = 'New Updates',
  subtitle = 'Check your notifications',
  onOpen,
  onDismiss,
  className,
  icon,
  level = 'info',
}: SystemNotificationToastProps) {
  const accentClass =
    level === 'success' ? 'from-emerald-400 to-emerald-600'
    : level === 'warning' ? 'from-amber-400 to-amber-600'
    : level === 'error' ? 'from-rose-400 to-rose-600'
    : 'from-sky-400 to-sky-600';
  const glowClass =
    level === 'success' ? 'bg-emerald-500/50'
    : level === 'warning' ? 'bg-amber-500/50'
    : level === 'error' ? 'bg-rose-500/50'
    : 'bg-sky-500/50';
  const subtitleClass =
    level === 'success' ? 'text-emerald-400/80'
    : level === 'warning' ? 'text-amber-400/80'
    : level === 'error' ? 'text-rose-400/80'
    : 'text-sky-400/80';

  return (
    <div className={cn('group relative', className)}>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss?.();
        }}
        className="pointer-events-auto absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-gray-950/90 text-white/90 shadow-md backdrop-blur-sm transition-colors hover:border-red-400/40 hover:bg-red-500/90 hover:text-white"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => onOpen?.()}
        className="relative w-full overflow-visible rounded-xl border-0 bg-transparent p-0 text-left shadow-none outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-gray-950"
      >
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-bl from-gray-900 via-gray-950 to-black p-[1px] shadow-2xl shadow-emerald-500/20">
          <div className="relative flex items-center gap-4 rounded-xl bg-gray-950 px-6 py-3 transition-all duration-300 group-hover:bg-gray-950/50">
            <div className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br transition-transform duration-300 group-hover:scale-110', accentClass)}>
              <span className="relative z-[1] text-white [&_svg]:h-5 [&_svg]:w-5">
                {icon ?? <Bell strokeWidth={2} className="h-5 w-5" aria-hidden />}
              </span>
              <div className={cn('absolute inset-0 rounded-lg blur-sm transition-all duration-300 group-hover:blur-md', glowClass)} />
            </div>

            <div className="flex min-w-0 flex-col items-start text-left">
              <span className="text-sm font-semibold text-white">{title}</span>
              <span className={cn('text-[10px] font-medium', subtitleClass)}>{subtitle}</span>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 transition-transform duration-300 group-hover:scale-150" />
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 transition-transform duration-300 group-hover:scale-150 group-hover:delay-100" />
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/30 transition-transform duration-300 group-hover:scale-150 group-hover:delay-200" />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 opacity-20 transition-opacity duration-300 group-hover:opacity-40" />
        </div>
      </button>
    </div>
  );
}

/** Alias only — import from `@/components/SystemNotificationToast`, not `@/components/ui/toast`. */
export { SystemNotificationToast as Toast };
