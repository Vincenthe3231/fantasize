import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpaceRow } from '@/lib/spaceApi';
import type { StoredSpaceDraft } from '@/lib/spaceDraftStorage';
import { SpacePersistenceContext } from '@/contexts/SpacePersistenceContext';
import { useSpaceLocalPersistence } from '@/hooks/useSpaceLocalPersistence';
import TopBar from '@/components/canvas/TopBar';
import Toolbar from '@/components/canvas/Toolbar';
import SettingsPanel from '@/components/canvas/SettingsPanel';
import BottomBar from '@/components/canvas/BottomBar';
import { SystemNotificationToast } from '@/components/SystemNotificationToast';
import { useSystemNotificationStore } from '@/stores/systemNotificationStore';
import { useWorkflowStore, type NodeType } from '@/stores/workflowStore';
import { PixiBoardViewport } from '@/components/canvas/PixiBoardViewport';
import { PixiBoardInspector } from '@/components/canvas/PixiBoardInspector';
import { CanvasFrameMetricsOverlay } from '@/components/canvas/CanvasFrameMetricsOverlay';
import { screenToFlow } from '@/lib/pixiBoard/screenFlowTransform';

function canvasClass(pattern: string) {
  switch (pattern) {
    case 'grid':
      return 'canvas-grid';
    case 'lines':
      return 'canvas-lines';
    case 'none':
      return 'canvas-plain';
    default:
      return 'canvas-dot-grid';
  }
}

/**
 * Pixi/WebGL canvas path: same persistence + chrome as React Flow, GPU board + inspector (plan Phases 1–3).
 * Viewport authority lives in `PixiBoardViewport` (`lastViewport` + `pagehide` / visibility flush
 * so drafts persist after mid-gesture navigation).
 */
export function CanvasInnerPixi({
  space,
  resolvedDraft,
  initialLastWriteAt,
}: {
  space: SpaceRow;
  resolvedDraft: StoredSpaceDraft | null;
  initialLastWriteAt: number;
}) {
  const settings = useWorkflowStore((s) => s.settings);
  const hydrateFromSpace = useWorkflowStore((s) => s.hydrateFromSpace);
  const addNodeAction = useWorkflowStore((s) => s.addNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const setNodesSilently = useWorkflowStore((s) => s.setNodesSilently);
  const setEdgesSilently = useWorkflowStore((s) => s.setEdgesSilently);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hydratedSpaceId = useRef<string | null>(null);

  const notifications = useSystemNotificationStore((s) => s.notifications);
  const dismissNotification = useSystemNotificationStore((s) => s.dismiss);
  const pauseNotificationAutoDismiss = useSystemNotificationStore((s) => s.pauseAutoDismiss);
  const resumeNotificationAutoDismiss = useSystemNotificationStore((s) => s.resumeAutoDismiss);

  const onApplyExternalDraft = useCallback(
    (draft: StoredSpaceDraft) => {
      hydrateFromSpace({
        id: space.id,
        nodes: draft.payload.nodes,
        edges: draft.payload.edges,
        comments: draft.payload.comments,
        canvas_drawings: draft.payload.canvas_drawings ?? [],
        settings: draft.payload.settings,
        node_grid_layouts: draft.payload.node_grid_layouts,
        viewport: draft.payload.viewport,
      });
    },
    [space.id, hydrateFromSpace]
  );

  const persistence = useSpaceLocalPersistence(space, {
    initialLastWriteAt,
    onApplyExternalDraft,
  });

  useEffect(() => {
    if (hydratedSpaceId.current === space.id) return;
    hydratedSpaceId.current = space.id;
    if (resolvedDraft) {
      hydrateFromSpace({
        id: space.id,
        nodes: resolvedDraft.payload.nodes,
        edges: resolvedDraft.payload.edges,
        comments: resolvedDraft.payload.comments,
        canvas_drawings: resolvedDraft.payload.canvas_drawings ?? [],
        settings: resolvedDraft.payload.settings,
        node_grid_layouts: resolvedDraft.payload.node_grid_layouts,
        viewport: resolvedDraft.payload.viewport,
      });
    } else {
      hydrateFromSpace(space);
    }
  }, [space, resolvedDraft, hydrateFromSpace]);

  const handleAddNode = useCallback(
    (type: string) => {
      const el = wrapperRef.current;
      const rect = el?.getBoundingClientRect();
      const w = typeof window !== 'undefined' ? window.innerWidth : 800;
      const h = typeof window !== 'undefined' ? window.innerHeight : 600;
      const r = rect ?? new DOMRect(0, 0, w, h);
      const vp = useWorkflowStore.getState().lastViewport;
      const { x, y } = screenToFlow(r.left + r.width / 2, r.top + r.height / 2, r, vp);
      addNodeAction(type as NodeType, { x: x - 100, y: y - 80 });
    },
    [addNodeAction]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement)?.closest?.('.ProseMirror')) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const st = useWorkflowStore.getState();
        st.nodes.filter((n) => n.selected).forEach((n) => deleteNode(n.id));
      }
      if (e.key === 'Escape') {
        const st = useWorkflowStore.getState();
        setNodesSilently(st.nodes.map((n) => ({ ...n, selected: false })));
        setEdgesSilently(st.edges.map((e) => ({ ...e, selected: false })));
      }
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setAddPanelOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteNode, setNodesSilently, setEdgesSilently]);

  useEffect(() => {
    const st = useWorkflowStore.getState().settings;
    document.body.setAttribute('data-theme', st.darkMode ? 'dark' : 'light');
    document.body.setAttribute('data-performance', String(st.performanceMode));
  }, []);

  return (
    <SpacePersistenceContext.Provider
      value={{
        isRemoteDirtyPending: persistence.isRemoteDirtyPending,
        saveToRemoteNow: persistence.saveToRemoteNow,
        isSavingToRemote: persistence.isSavingToRemote,
      }}
    >
      <div
        ref={wrapperRef}
        className={`relative h-screen w-screen ${canvasClass(settings.canvasPattern)} ${settings.showNodeLabels ? '' : 'workflow-hide-labels'}`}
      >
        <TopBar />
        <Toolbar
          onAddNode={handleAddNode}
          onOpenSettings={() => setSettingsOpen(true)}
          addPanelOpen={addPanelOpen}
          onAddPanelOpenChange={setAddPanelOpen}
        />
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <CanvasFrameMetricsOverlay />
        <PixiBoardViewport key={space.id} spaceId={space.id} />
        <PixiBoardInspector />

        <BottomBar />
        {notifications.length > 0 ? (
          <div className="fixed bottom-24 right-4 z-[55] flex w-[min(300px,calc(100vw-2rem))] max-w-[300px] flex-col gap-2 max-sm:right-3">
            {notifications.map((n) => (
              <SystemNotificationToast
                key={n.id}
                title={n.title}
                subtitle={n.subtitle}
                level={n.level}
                onDismiss={() => dismissNotification(n.id)}
                onMouseEnter={() => pauseNotificationAutoDismiss(n.id)}
                onMouseLeave={() => resumeNotificationAutoDismiss(n.id)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </SpacePersistenceContext.Provider>
  );
}
