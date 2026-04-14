import { useEffect, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import SaveToRemoteButton from './SaveToRemoteButton';
import { useSpacePersistenceUi } from '@/contexts/SpacePersistenceContext';

/** Manual cloud save plus compact sync status (server `updated_at` vs last successful push). */
export default function RemoteSavePanel() {
  const {
    isRemoteDirtyPending,
    isSavingToRemote,
    spaceUpdatedAtIso,
    lastRemoteSaveSucceededAtMs,
  } = useSpacePersistenceUi();

  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      tick((n) => n + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const cloudParsed = spaceUpdatedAtIso ? parseISO(spaceUpdatedAtIso) : undefined;
  const cloudOk = cloudParsed != null && !Number.isNaN(cloudParsed.getTime());
  const cloudLabel = cloudOk ? formatDistanceToNow(cloudParsed, { addSuffix: true }) : '—';

  const pushLabel =
    lastRemoteSaveSucceededAtMs != null
      ? formatDistanceToNow(lastRemoteSaveSucceededAtMs, { addSuffix: true })
      : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-mono-display text-muted-foreground leading-tight max-w-[260px]">
        {isSavingToRemote ? (
          <>Saving to cloud…</>
        ) : isRemoteDirtyPending ? (
          <>Unsaved changes · cloud {cloudLabel}</>
        ) : pushLabel ? (
          <>Synced {pushLabel} · cloud data {cloudLabel}</>
        ) : (
          <>Cloud data {cloudLabel}</>
        )}
      </span>
      <SaveToRemoteButton />
    </div>
  );
}
