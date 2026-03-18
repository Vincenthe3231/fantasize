import RemoteSaveCountdown from './RemoteSaveCountdown';
import SaveToRemoteButton from './SaveToRemoteButton';

/** Auto-save countdown + manual cloud save, shared glass styling. */
export default function RemoteSavePanel() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <RemoteSaveCountdown />
      <SaveToRemoteButton />
    </div>
  );
}
