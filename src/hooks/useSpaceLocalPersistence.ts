import { useEffect, useRef, useState, useCallback } from 'react';
import { saveSpace, type SpaceRow } from '@/lib/spaceApi';
import {
  writeSpaceDraft,
  clearSpaceDraft,
  readSpaceDraft,
  type CanvasSnapshotPayload,
  type StoredSpaceDraft,
} from '@/lib/spaceDraftStorage';
import { registerCanvasRemoteFlush } from '@/lib/canvasRemoteFlush';
import {
  logRemoteFlush,
  logLocalDraftCleared,
  type RemoteFlushReason,
} from '@/lib/persistenceConsole';
import { useWorkflowStore, type WorkflowState } from '@/stores/workflowStore';
import { queryClient } from '@/lib/queryClient';

const IDLE_FLUSH_MS = 5 * 60 * 1000;

export type SpacePersistenceOpts = {
  seedDirty?: boolean;
  /** Baseline so cross-tab detection does not fire before first paint (draft or server time ms) */
  initialLastWriteAt: number;
  onApplyExternalDraft?: (draft: StoredSpaceDraft) => void;
};

function snapshotFromStore(): CanvasSnapshotPayload {
  const s = useWorkflowStore.getState();
  return {
    nodes: s.nodes,
    edges: s.edges,
    comments: s.comments,
    settings: s.settings,
    node_grid_layouts: s.nodeGridLayouts,
    viewport: s.lastViewport,
  };
}

function graphDirty(state: WorkflowState, prev: WorkflowState) {
  return (
    state.nodes !== prev.nodes ||
    state.edges !== prev.edges ||
    state.comments !== prev.comments ||
    state.settings !== prev.settings ||
    state.nodeGridLayouts !== prev.nodeGridLayouts ||
    state.lastViewport !== prev.lastViewport
  );
}

/** Blur + React/Zustand may commit on the next frame; snapshot too early loses e.g. labelText */
function waitForPersistenceSettled(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
}

function snapshotDiffers(a: CanvasSnapshotPayload, b: CanvasSnapshotPayload): boolean {
  return (
    a.nodes !== b.nodes ||
    a.edges !== b.edges ||
    a.comments !== b.comments ||
    a.settings !== b.settings ||
    a.node_grid_layouts !== b.node_grid_layouts ||
    a.viewport !== b.viewport
  );
}

export function useSpaceLocalPersistence(space: SpaceRow, opts: SpacePersistenceOpts) {
  const seedDirty = Boolean(opts?.seedDirty);
  const onApplyExternalDraft = opts.onApplyExternalDraft;
  const initialLastWriteAt = opts.initialLastWriteAt;

  const dirtyRef = useRef(false);
  const remoteBaselineRef = useRef(space.updated_at);
  const spaceIdRef = useRef(space.id);
  spaceIdRef.current = space.id;

  const lastLocalWriteAtRef = useRef(initialLastWriteAt);
  const rafPendingRef = useRef(false);
  const idleDeadlineRef = useRef(Date.now() + IDLE_FLUSH_MS);
  const pendingFlushReasonRef = useRef<RemoteFlushReason>('explicit');

  const [remoteSaveCountdownSec, setRemoteSaveCountdownSec] = useState<number | null>(null);
  const [isRemoteDirtyPending, setIsRemoteDirtyPending] = useState(seedDirty);
  const [isSavingToRemote, setIsSavingToRemote] = useState(false);

  useEffect(() => {
    remoteBaselineRef.current = space.updated_at;
  }, [space.updated_at, space.id]);

  useEffect(() => {
    lastLocalWriteAtRef.current = initialLastWriteAt;
  }, [space.id, initialLastWriteAt]);

  useEffect(() => {
    if (seedDirty) dirtyRef.current = true;
  }, [space.id, seedDirty]);

  const syncFocusedInputToStore = () => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.blur();
    }
  };

  const flushRemote = useRef<() => Promise<void>>(async () => {});

  flushRemote.current = async () => {
    const spaceId = spaceIdRef.current;
    const reason = pendingFlushReasonRef.current;
    syncFocusedInputToStore();
    const s = useWorkflowStore.getState();
    if (s.currentSpaceId !== spaceId) {
      logRemoteFlush('skip', { spaceId, skipReason: 'wrong_space' });
      return;
    }
    if (!dirtyRef.current) {
      logRemoteFlush('skip', { spaceId, skipReason: 'not_dirty' });
      return;
    }
    logRemoteFlush('start', { spaceId, reason });
    const t0 = performance.now();
    try {
      await waitForPersistenceSettled();

      const MAX_SAVE_ATTEMPTS = 3;
      for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
        await waitForPersistenceSettled();
        const lastSnap = snapshotFromStore();
        const t = await writeSpaceDraft(spaceId, remoteBaselineRef.current, lastSnap, {
          everyWrite: true,
        });
        if (t != null) lastLocalWriteAtRef.current = t;
        await saveSpace(spaceId, lastSnap);
        await waitForPersistenceSettled();
        const after = snapshotFromStore();
        if (!snapshotDiffers(lastSnap, after)) break;
      }

      await clearSpaceDraft(spaceId);
      logLocalDraftCleared(spaceId);

      await queryClient.invalidateQueries({ queryKey: ['canvas-space'] });
      await queryClient.refetchQueries({ queryKey: ['canvas-space'] });

      dirtyRef.current = false;
      setIsRemoteDirtyPending(false);
      remoteBaselineRef.current = new Date().toISOString();
      idleDeadlineRef.current = Date.now() + IDLE_FLUSH_MS;
      setRemoteSaveCountdownSec(null);
      logRemoteFlush('ok', {
        spaceId,
        reason,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (e) {
      logRemoteFlush('fail', { spaceId, reason, error: e });
    }
  };

  const queueIdbWrite = useCallback(() => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      const sid = spaceIdRef.current;
      void writeSpaceDraft(sid, remoteBaselineRef.current, snapshotFromStore()).then((t) => {
        if (t != null) lastLocalWriteAtRef.current = t;
      });
    });
  }, []);

  useEffect(() => {
    const unsub = useWorkflowStore.subscribe((state, prev) => {
      if (!prev || state.currentSpaceId !== spaceIdRef.current) return;
      if (!graphDirty(state, prev)) return;
      if (prev.currentSpaceId !== spaceIdRef.current && state.currentSpaceId === spaceIdRef.current) {
        return;
      }
      dirtyRef.current = true;
      setIsRemoteDirtyPending(true);
      idleDeadlineRef.current = Date.now() + IDLE_FLUSH_MS;
      queueIdbWrite();
    });
    return () => unsub();
  }, [space.id, queueIdbWrite]);

  useEffect(() => {
    return registerCanvasRemoteFlush(() => {
      pendingFlushReasonRef.current = 'explicit';
      return flushRemote.current();
    });
  }, [space.id]);

  useEffect(() => {
    const tick = () => {
      if (!dirtyRef.current) {
        setRemoteSaveCountdownSec(null);
        return;
      }
      const sec = Math.max(0, Math.ceil((idleDeadlineRef.current - Date.now()) / 1000));
      setRemoteSaveCountdownSec(sec);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [space.id]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    const bump = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        pendingFlushReasonRef.current = 'idle_5m';
        void flushRemote.current();
      }, IDLE_FLUSH_MS);
    };
    bump();
    const unsub = useWorkflowStore.subscribe((state, prev) => {
      if (!prev || state.currentSpaceId !== spaceIdRef.current) return;
      if (graphDirty(state, prev)) bump();
    });
    return () => {
      clearTimeout(idleTimer);
      unsub();
    };
  }, [space.id]);

  useEffect(() => {
    const onHidden = async () => {
      if (document.visibilityState === 'hidden') {
        syncFocusedInputToStore();
        const sid = spaceIdRef.current;
        if (dirtyRef.current) {
          const t = await writeSpaceDraft(sid, remoteBaselineRef.current, snapshotFromStore(), {
            everyWrite: true,
          });
          if (t != null) lastLocalWriteAtRef.current = t;
        }
      }
    };

    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || !onApplyExternalDraft) return;
      const sid = spaceIdRef.current;
      const draft = await readSpaceDraft(sid);
      if (!draft) return;
      if (draft.clientUpdatedAt <= lastLocalWriteAtRef.current) return;
      const st = useWorkflowStore.getState();
      if (st.currentSpaceId !== sid) return;
      onApplyExternalDraft(draft);
      lastLocalWriteAtRef.current = draft.clientUpdatedAt;
    };

    const onPageHide = async () => {
      syncFocusedInputToStore();
      const sid = spaceIdRef.current;
      if (dirtyRef.current) {
        const t = await writeSpaceDraft(sid, remoteBaselineRef.current, snapshotFromStore(), {
          everyWrite: true,
        });
        if (t != null) lastLocalWriteAtRef.current = t;
      }
    };

    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [space.id, onApplyExternalDraft]);

  const saveToRemoteNow = useCallback(async () => {
    pendingFlushReasonRef.current = 'explicit';
    setIsSavingToRemote(true);
    try {
      await flushRemote.current();
    } finally {
      setIsSavingToRemote(false);
    }
  }, []);

  return {
    flushRemote: () => flushRemote.current(),
    remoteSaveCountdownSec,
    isRemoteDirtyPending,
    saveToRemoteNow,
    isSavingToRemote,
  };
}
