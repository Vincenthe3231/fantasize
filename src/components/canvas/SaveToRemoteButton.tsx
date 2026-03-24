import { CloudUpload, Loader2 } from 'lucide-react';
import { useSpacePersistenceUi } from '@/contexts/SpacePersistenceContext';

/** Saves canvas to Supabase when there are unsynced changes (manual only). */
export default function SaveToRemoteButton() {
  const { isRemoteDirtyPending, saveToRemoteNow, isSavingToRemote } = useSpacePersistenceUi();

  if (!isRemoteDirtyPending && !isSavingToRemote) {
    return null;
  }

  const canSave = isRemoteDirtyPending && !isSavingToRemote;

  return (
    <button
      type="button"
      disabled={!canSave}
      onClick={() => void saveToRemoteNow()}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-toolbar text-[10px] uppercase tracking-wider font-mono-display transition-colors disabled:opacity-40 disabled:pointer-events-none text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[saving=true]:opacity-90"
      title={
        canSave
          ? 'Save to cloud now'
          : isSavingToRemote
            ? 'Saving…'
            : 'No unsaved changes'
      }
      data-saving={isSavingToRemote || undefined}
    >
      {isSavingToRemote ? (
        <Loader2 size={13} className="shrink-0 animate-spin text-[var(--accent-color)]" />
      ) : (
        <CloudUpload size={13} className="shrink-0" />
      )}
      <span>Save now</span>
    </button>
  );
}
