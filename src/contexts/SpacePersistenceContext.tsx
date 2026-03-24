import { createContext, useContext } from 'react';

export type SpacePersistenceUi = {
  isRemoteDirtyPending: boolean;
  saveToRemoteNow: () => Promise<void>;
  isSavingToRemote: boolean;
};

export const SpacePersistenceContext = createContext<SpacePersistenceUi>({
  isRemoteDirtyPending: false,
  saveToRemoteNow: async () => {},
  isSavingToRemote: false,
});

export function useSpacePersistenceUi() {
  return useContext(SpacePersistenceContext);
}
