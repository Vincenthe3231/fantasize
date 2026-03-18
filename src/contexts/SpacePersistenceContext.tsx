import { createContext, useContext } from 'react';

export type SpacePersistenceUi = {
  remoteSaveCountdownSec: number | null;
  isRemoteDirtyPending: boolean;
  saveToRemoteNow: () => Promise<void>;
  isSavingToRemote: boolean;
};

export const SpacePersistenceContext = createContext<SpacePersistenceUi>({
  remoteSaveCountdownSec: null,
  isRemoteDirtyPending: false,
  saveToRemoteNow: async () => {},
  isSavingToRemote: false,
});

export function useSpacePersistenceUi() {
  return useContext(SpacePersistenceContext);
}
