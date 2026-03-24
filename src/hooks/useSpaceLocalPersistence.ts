import { useEffect, useRef, useState, useCallback } from 'react';
import type { Edge, Node } from 'reactflow';
import { saveSpace, type SpaceRow } from '@/lib/spaceApi';
import {
  writeSpaceDraft,
  clearSpaceDraft,
  readSpaceDraft,
  canvasSnapshotMatchesSpaceRow,
  canvasSnapshotPayloadParityEqual,
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

export type SpacePersistenceOpts = {
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

/** Strip RF UI / derived geometry — excluded from “meaningful” local draft bumps. */
function stripNodeForRemoteDirtyCompare(n: Node): Record<string, unknown> {
  const o = { ...n } as Record<string, unknown>;
  delete o.selected;
  delete o.dragging;
  delete o.resizing;
  delete o.positionAbsolute;
  return o;
}

function stripEdgeForRemoteDirtyCompare(e: Edge): Record<string, unknown> {
  const o = { ...e } as Record<string, unknown>;
  delete o.selected;
  return o;
}

function normalizedGraphDiffers(
  aNodes: Node[],
  aEdges: Edge[],
  bNodes: Node[],
  bEdges: Edge[]
): boolean {
  if (aNodes.length !== bNodes.length || aEdges.length !== bEdges.length) return true;
  const sa = JSON.stringify(aNodes.map(stripNodeForRemoteDirtyCompare));
  const sb = JSON.stringify(bNodes.map(stripNodeForRemoteDirtyCompare));
  if (sa !== sb) return true;
  const sea = JSON.stringify(aEdges.map(stripEdgeForRemoteDirtyCompare));
  const seb = JSON.stringify(bEdges.map(stripEdgeForRemoteDirtyCompare));
  return sea !== seb;
}

/** Content changes that should bump IndexedDB draft. Excludes viewport-only and selection-only churn. */
function meaningfulRemoteContentDirty(state: WorkflowState, prev: WorkflowState): boolean {
  if (state.comments !== prev.comments) return true;
  if (state.settings !== prev.settings) return true;
  if (state.nodeGridLayouts !== prev.nodeGridLayouts) return true;
  if (state.nodes === prev.nodes && state.edges === prev.edges) return false;
  return normalizedGraphDiffers(state.nodes, state.edges, prev.nodes, prev.edges);
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
  const onApplyExternalDraft = opts.onApplyExternalDraft;
  const initialLastWriteAt = opts.initialLastWriteAt;

  const dirtyRef = useRef(false);
  /** After saveSpace succeeds, React Query may not have refetched yet; treat local as in sync until then. */
  const lastPushedSnapshotRef = useRef<CanvasSnapshotPayload | null>(null);
  const spaceRowRef = useRef(space);
  spaceRowRef.current = space;

  const remoteBaselineRef = useRef(space.updated_at);
  const spaceIdRef = useRef(space.id);
  spaceIdRef.current = space.id;

  const lastLocalWriteAtRef = useRef(initialLastWriteAt);
  const rafPendingRef = useRef(false);
  const pendingFlushReasonRef = useRef<RemoteFlushReason>('explicit');

  const [isRemoteDirtyPending, setIsRemoteDirtyPending] = useState(false);
  const [isSavingToRemote, setIsSavingToRemote] = useState(false);

  const isInSyncWithRemote = useCallback((): boolean => {
    const snap = snapshotFromStore();
    if (
      lastPushedSnapshotRef.current &&
      canvasSnapshotPayloadParityEqual(snap, lastPushedSnapshotRef.current)
    ) {
      return true;
    }
    return canvasSnapshotMatchesSpaceRow(snap, spaceRowRef.current);
  }, []);

  const refreshParity = useCallback(() => {
    if (isInSyncWithRemote()) {
      dirtyRef.current = false;
      setIsRemoteDirtyPending(false);
    } else {
      dirtyRef.current = true;
      setIsRemoteDirtyPending(true);
    }
  }, [isInSyncWithRemote]);

  useEffect(() => {
    remoteBaselineRef.current = space.updated_at;
  }, [space.updated_at, space.id]);

  useEffect(() => {
    lastLocalWriteAtRef.current = initialLastWriteAt;
  }, [space.id, initialLastWriteAt]);

  useEffect(() => {
    lastPushedSnapshotRef.current = null;
    refreshParity();
  }, [space.id, space.updated_at, refreshParity]);

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
    if (isInSyncWithRemote()) {
      logRemoteFlush('skip', { spaceId, skipReason: 'not_dirty' });
      return;
    }
    logRemoteFlush('start', { spaceId, reason });
    const t0 = performance.now();
    try {
      await waitForPersistenceSettled();

      let lastCommittedSnap: CanvasSnapshotPayload | null = null;
      const MAX_SAVE_ATTEMPTS = 3;
      for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
        await waitForPersistenceSettled();
        const lastSnap = snapshotFromStore();
        const t = await writeSpaceDraft(spaceId, remoteBaselineRef.current, lastSnap, {
          everyWrite: true,
        });
        if (t != null) lastLocalWriteAtRef.current = t;
        await saveSpace(spaceId, lastSnap);
        lastCommittedSnap = lastSnap;
        await waitForPersistenceSettled();
        const after = snapshotFromStore();
        if (!snapshotDiffers(lastSnap, after)) break;
      }

      await clearSpaceDraft(spaceId);
      logLocalDraftCleared(spaceId);

      if (lastCommittedSnap) {
        lastPushedSnapshotRef.current = lastCommittedSnap;
      }
      refreshParity();

      await queryClient.invalidateQueries({ queryKey: ['canvas-space'] });
      await queryClient.refetchQueries({ queryKey: ['canvas-space'] });

      remoteBaselineRef.current = new Date().toISOString();
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
      if (meaningfulRemoteContentDirty(state, prev)) {
        queueIdbWrite();
      }
      refreshParity();
    });
    return () => {
      unsub();
    };
  }, [space.id, queueIdbWrite, refreshParity]);

  useEffect(() => {
    return registerCanvasRemoteFlush(() => {
      pendingFlushReasonRef.current = 'explicit';
      return flushRemote.current();
    });
  }, [space.id]);

  useEffect(() => {
    const onHidden = async () => {
      if (document.visibilityState === 'hidden') {
        syncFocusedInputToStore();
        const sid = spaceIdRef.current;
        if (!isInSyncWithRemote()) {
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
      if (!isInSyncWithRemote()) {
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
  }, [space.id, onApplyExternalDraft, isInSyncWithRemote]);

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
    isRemoteDirtyPending,
    saveToRemoteNow,
    isSavingToRemote,
  };
}
