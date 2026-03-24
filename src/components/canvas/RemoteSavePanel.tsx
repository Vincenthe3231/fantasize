import SaveToRemoteButton from './SaveToRemoteButton';

/** Manual cloud save when the canvas differs from Supabase. */
export default function RemoteSavePanel() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SaveToRemoteButton />
    </div>
  );
}
