import { createContext, useContext } from 'react';

export type SpacePersistenceUi = {
  isRemoteDirtyPending: boolean;
  saveToRemoteNow: () => Promise<void>;
  isSavingToRemote: boolean;
  /** Server row `updated_at` ISO for the active workspace (cloud document version). */
  spaceUpdatedAtIso: string;
  /** Last successful cloud push from this tab, or null before first save this session. */
  lastRemoteSaveSucceededAtMs: number | null;
};

export const SpacePersistenceContext = createContext<SpacePersistenceUi>({
  isRemoteDirtyPending: false,
  saveToRemoteNow: async () => {},
  isSavingToRemote: false,
  spaceUpdatedAtIso: '',
  lastRemoteSaveSucceededAtMs: null,
});

export function useSpacePersistenceUi() {
  return useContext(SpacePersistenceContext);
}
