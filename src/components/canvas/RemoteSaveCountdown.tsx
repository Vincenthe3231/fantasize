import { useSpacePersistenceUi } from '@/contexts/SpacePersistenceContext';

function Digit({ n }: { n: string }) {
  return (
    <span className="inline-flex min-w-[0.65em] justify-center rounded px-0.5 font-mono-display text-[11px] tabular-nums text-foreground/90 bg-[var(--node-control-bg)] border border-[var(--node-control-border)]">
      {n}
    </span>
  );
}

/** Countdown until idle auto-save to Supabase (5 min after last canvas change). */
export default function RemoteSaveCountdown() {
  const { remoteSaveCountdownSec, isRemoteDirtyPending } = useSpacePersistenceUi();

  if (!isRemoteDirtyPending) {
    return null;
  }

  const sec = remoteSaveCountdownSec ?? 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg glass-toolbar"
      title="Time until automatic cloud save (also saves when you leave the tab)"
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-display">
        Auto-save
      </span>
      <div className="flex items-center gap-0.5">
        <Digit n={mm[0]} />
        <Digit n={mm[1]} />
        <span className="text-muted-foreground font-mono-display text-[11px] px-0.5">:</span>
        <Digit n={ss[0]} />
        <Digit n={ss[1]} />
      </div>
    </div>
  );
}
