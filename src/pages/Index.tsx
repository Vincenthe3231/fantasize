import { useCallback, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrCreateSpace, type SpaceRow } from '@/lib/spaceApi';
import { shouldRestoreDraftFromLocal, type StoredSpaceDraft } from '@/lib/spaceDraftStorage';
import { SpacePersistenceContext } from '@/contexts/SpacePersistenceContext';
import { useSpaceLocalPersistence } from '@/hooks/useSpaceLocalPersistence';
import { useAuth } from '@/hooks/useAuth';
import ReactFlow, {
  Background,
  MiniMap,
  type Node,
  useNodesState,
  useEdgesState,
  addEdge,
  applyEdgeChanges,
  type Connection,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';

import TextNode from '@/components/canvas/TextNode';
import UploadNode from '@/components/canvas/UploadNode';
import AssistantNode from '@/components/canvas/AssistantNode';
import ImageGeneratorNode from '@/components/canvas/ImageGeneratorNode';
import VideoGeneratorNode from '@/components/canvas/VideoGeneratorNode';
import ImageUpscalerNode from '@/components/canvas/ImageUpscalerNode';
import ListNode from '@/components/canvas/ListNode';
import PropsInputNode from '@/components/canvas/PropsInputNode';
import AngleVariationsNode from '@/components/canvas/AngleVariationsNode';
import AngleVariationsListNode from '@/components/canvas/AngleVariationsListNode';
import SelectedShotNode from '@/components/canvas/SelectedShotNode';
import AnnotationNode from '@/components/canvas/AnnotationNode';
import SetDressingNode from '@/components/canvas/SetDressingNode';
import LightingScenarioNode from '@/components/canvas/LightingScenarioNode';
import AtmosphereTestNode from '@/components/canvas/AtmosphereTestNode';
import PlacementRefNode from '@/components/canvas/PlacementRefNode';
import CustomEdge from '@/components/canvas/CustomEdge';
import Toolbar from '@/components/canvas/Toolbar';
import TopBar from '@/components/canvas/TopBar';
import SettingsPanel from '@/components/canvas/SettingsPanel';
import BottomBar from '@/components/canvas/BottomBar';
import CommentPin from '@/components/canvas/CommentPin';
import { useWorkflowStore } from '@/stores/workflowStore';

const nodeTypes = {
  textNode: TextNode,
  uploadNode: UploadNode,
  assistantNode: AssistantNode,
  imageGeneratorNode: ImageGeneratorNode,
  videoGeneratorNode: VideoGeneratorNode,
  imageUpscalerNode: ImageUpscalerNode,
  listNode: ListNode,
  propsInputNode: PropsInputNode,
  angleVariationsNode: AngleVariationsNode,
  angleVariationsListNode: AngleVariationsListNode,
  selectedShotNode: SelectedShotNode,
  annotationNode: AnnotationNode,
  setDressingNode: SetDressingNode,
  lightingScenarioNode: LightingScenarioNode,
  atmosphereTestNode: AtmosphereTestNode,
  placementRefNode: PlacementRefNode,
};

const edgeTypes = { custom: CustomEdge };

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

const CanvasInner = ({
  space,
  resolvedDraft,
  initialLastWriteAt,
  restoredFromLocalDraft,
}: {
  space: SpaceRow;
  resolvedDraft: StoredSpaceDraft | null;
  initialLastWriteAt: number;
  restoredFromLocalDraft: boolean;
}) => {
  const storeNodes = useWorkflowStore((s) => s.nodes);
  const storeEdges = useWorkflowStore((s) => s.edges);
  const comments = useWorkflowStore((s) => s.comments);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const settings = useWorkflowStore((s) => s.settings);
  const addComment = useWorkflowStore((s) => s.addComment);
  const addNodeAction = useWorkflowStore((s) => s.addNode);
  const setNodesSilently = useWorkflowStore((s) => s.setNodesSilently);
  const connectEdgeWithHistory = useWorkflowStore((s) => s.connectEdgeWithHistory);
  const applyEdgeRemoval = useWorkflowStore((s) => s.applyEdgeRemoval);
  const setEdgesSilently = useWorkflowStore((s) => s.setEdgesSilently);
  const commitNodesAfterDrag = useWorkflowStore((s) => s.commitNodesAfterDrag);
  const setIsDragging = useWorkflowStore((s) => s.setIsDragging);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const runAll = useWorkflowStore((s) => s.runAll);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const contextMenu = useWorkflowStore((s) => s.contextMenu);
  const setContextMenu = useWorkflowStore((s) => s.setContextMenu);
  const setHoveredNode = useWorkflowStore((s) => s.setHoveredNode);
  const copyNodesByIds = useWorkflowStore((s) => s.copyNodesByIds);
  const pasteClipboard = useWorkflowStore((s) => s.pasteClipboard);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const setFocusedNodeContentId = useWorkflowStore((s) => s.setFocusedNodeContentId);
  const hydrateFromSpace = useWorkflowStore((s) => s.hydrateFromSpace);
  const setLastViewport = useWorkflowStore((s) => s.setLastViewport);

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges] = useEdgesState(storeEdges);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({});
  const { screenToFlowPosition, fitView, getNodes, setViewport } = useReactFlow();
  const hydratedSpaceId = useRef<string | null>(null);

  const onApplyExternalDraft = useCallback(
    (draft: StoredSpaceDraft) => {
      hydrateFromSpace({
        id: space.id,
        nodes: draft.payload.nodes,
        edges: draft.payload.edges,
        comments: draft.payload.comments,
        settings: draft.payload.settings,
        node_grid_layouts: draft.payload.node_grid_layouts,
        viewport: draft.payload.viewport,
      });
      const v = draft.payload.viewport;
      requestAnimationFrame(() => {
        if (
          v &&
          (Math.abs(v.zoom - 1) > 0.02 || Math.abs(v.x) > 2 || Math.abs(v.y) > 2)
        ) {
          setViewport({ x: v.x, y: v.y, zoom: v.zoom }, { duration: 0 });
        } else {
          fitView({ padding: 0.2, duration: 0 });
        }
      });
    },
    [space.id, hydrateFromSpace, setViewport, fitView]
  );

  const persistence = useSpaceLocalPersistence(space, {
    seedDirty: restoredFromLocalDraft,
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
        settings: resolvedDraft.payload.settings,
        node_grid_layouts: resolvedDraft.payload.node_grid_layouts,
        viewport: resolvedDraft.payload.viewport,
      });
    } else {
      hydrateFromSpace(space);
    }
    const v = resolvedDraft?.payload.viewport ?? space.viewport;
    requestAnimationFrame(() => {
      if (
        v &&
        (Math.abs(v.zoom - 1) > 0.02 || Math.abs(v.x) > 2 || Math.abs(v.y) > 2)
      ) {
        setViewport({ x: v.x, y: v.y, zoom: v.zoom }, { duration: 0 });
      } else {
        fitView({ padding: 0.2, duration: 0 });
      }
    });
  }, [space, resolvedDraft, hydrateFromSpace, setViewport, fitView]);

  useEffect(() => {
    const st = useWorkflowStore.getState().settings;
    document.body.setAttribute('data-theme', st.darkMode ? 'dark' : 'light');
    document.body.setAttribute('data-performance', String(st.performanceMode));
  }, []);

  useEffect(() => {
    setNodes(storeNodes);
  }, [storeNodes, setNodes]);
  useEffect(() => {
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...connection, type: 'custom' }, eds);
        const added = next.find((e) => !eds.some((oe) => oe.id === e.id));
        if (added) connectEdgeWithHistory(next, added);
        return next;
      });
    },
    [setEdges, connectEdgeWithHistory]
  );

  const onEdgesChangeTracked = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => {
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        const removed = eds.filter((e) => !next.some((ne) => ne.id === e.id));
        if (removed.length > 0) {
          applyEdgeRemoval(next, removed);
        } else {
          setEdgesSilently(next);
        }
        return next;
      });
    },
    [setEdges, applyEdgeRemoval, setEdgesSilently]
  );

  const handleAddNode = useCallback(
    (type: string) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      addNodeAction(type as any, { x: position.x - 100, y: position.y - 80 });
    },
    [addNodeAction, screenToFlowPosition]
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).closest('.react-flow__node')) return;
      setFocusedNodeContentId(null);
      setContextMenu(null);
      if (selectedTool === 'comment') {
        const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        addComment(x, y);
      }
    },
    [selectedTool, addComment, setContextMenu, setFocusedNodeContentId]
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).closest('.react-flow__node')) return;
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'canvas' });
    },
    [setContextMenu]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', targetId: node.id });
    },
    [setContextMenu]
  );

  const selectAllNodes = useCallback(() => {
    const next = nodes.map((n) => ({ ...n, selected: true }));
    setNodes(next);
    setNodesSilently(next);
    setContextMenu(null);
  }, [nodes, setNodes, setNodesSilently, setContextMenu]);

  const zoomToFit = useCallback(() => {
    fitView({ padding: 0.25, duration: 300 });
    setContextMenu(null);
  }, [fitView, setContextMenu]);

  const handlePaste = useCallback(() => {
    const pos = contextMenu
      ? screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })
      : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    pasteClipboard({ x: pos.x - 80, y: pos.y - 60 });
    setContextMenu(null);
  }, [contextMenu, pasteClipboard, screenToFlowPosition, setContextMenu]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement)?.closest?.('.ProseMirror')) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runAll();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        nodes.filter((n) => n.selected).forEach((n) => deleteNode(n.id));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        nodes.filter((n) => n.selected).forEach((n) => duplicateNode(n.id));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAllNodes();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        fitView({ padding: 0.25, duration: 300 });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && nodes.some((n) => n.selected)) {
        e.preventDefault();
        copyNodesByIds(nodes.filter((n) => n.selected).map((n) => n.id));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteClipboard({ x: 48, y: 48 });
      }
      if (e.key === 'Escape') setContextMenu(null);
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setAddPanelOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    nodes,
    deleteNode,
    duplicateNode,
    runAll,
    setContextMenu,
    selectAllNodes,
    fitView,
    copyNodesByIds,
    pasteClipboard,
  ]);

  const cursorClass =
    selectedTool === 'cut'
      ? 'cursor-scissors'
      : selectedTool === 'hand'
        ? 'cursor-grab'
        : selectedTool === 'connection'
          ? 'cursor-crosshair'
          : '';

  const targetId = contextMenu?.targetId;

  return (
    <SpacePersistenceContext.Provider
      value={{
        remoteSaveCountdownSec: persistence.remoteSaveCountdownSec,
        isRemoteDirtyPending: persistence.isRemoteDirtyPending,
        saveToRemoteNow: persistence.saveToRemoteNow,
        isSavingToRemote: persistence.isSavingToRemote,
      }}
    >
    <div
      className={`w-screen h-screen ${canvasClass(settings.canvasPattern)} ${cursorClass} ${settings.showNodeLabels ? '' : 'workflow-hide-labels'}`}
      onClick={handleCanvasClick}
      onContextMenu={handleContextMenu}
      ref={reactFlowWrapper}
    >
      <TopBar />
      <Toolbar
        onAddNode={handleAddNode}
        onOpenSettings={() => setSettingsOpen(true)}
        addPanelOpen={addPanelOpen}
        onAddPanelOpenChange={setAddPanelOpen}
      />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {comments.map((c) => (
        <CommentPin key={c.id} comment={c} />
      ))}

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            className="fixed z-[100] py-1 shadow-xl context-menu-surface backdrop-blur-xl"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 320),
              borderRadius: '10px',
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'canvas' ? (
              <>
                {[
                  { label: 'Paste', shortcut: '⌘V', action: handlePaste },
                  { label: 'Add node…', shortcut: 'N', action: () => setAddPanelOpen(true) },
                  {
                    label: 'Add comment',
                    shortcut: 'C',
                    action: () => {
                      setSelectedTool('comment');
                      setContextMenu(null);
                    },
                  },
                  { divider: true },
                  { label: 'Select all', shortcut: '⌘A', action: selectAllNodes },
                  { label: 'Zoom to fit', shortcut: '⌘1', action: zoomToFit },
                  { divider: true },
                  { label: 'Run All', shortcut: '⌘↵', action: runAll },
                  { label: 'Canvas settings', action: () => setSettingsOpen(true) },
                ].map((item, i) =>
                  'divider' in item ? (
                    <div key={i} className="h-px bg-black/[0.06] dark:bg-white/[0.06] my-1" />
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        item.action?.();
                        setContextMenu(null);
                      }}
                      className="context-menu-item w-full text-left px-3 py-1.5 text-[12px] transition-colors flex items-center justify-between gap-6 min-w-[180px]"
                    >
                      <span>{item.label}</span>
                      {'shortcut' in item && item.shortcut && (
                        <span className="context-menu-kbd text-[10px]">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </>
            ) : (
              <>
                {[
                  {
                    label: 'Run this node',
                    action: () => targetId && runFromNode(targetId),
                  },
                  {
                    label: 'Run from here',
                    action: () => targetId && runFromNode(targetId),
                  },
                  { divider: true },
                  {
                    label: 'Duplicate',
                    shortcut: '⌘D',
                    action: () => targetId && duplicateNode(targetId),
                  },
                  {
                    label: 'Copy',
                    shortcut: '⌘C',
                    action: () => targetId && copyNodesByIds([targetId]),
                  },
                  {
                    label: 'Cut',
                    shortcut: '⌘X',
                    action: () => {
                      if (targetId) {
                        copyNodesByIds([targetId]);
                        deleteNode(targetId);
                      }
                    },
                  },
                  { divider: true },
                  {
                    label: 'Lock position',
                    action: () => targetId && lockNode(targetId),
                  },
                  { label: 'Rename', action: () => {} },
                  { divider: true },
                  {
                    label: 'Delete',
                    shortcut: '⌫',
                    action: () => targetId && deleteNode(targetId),
                  },
                ].map((item, i) =>
                  'divider' in item && !('label' in item) ? (
                    <div key={i} className="h-px bg-black/[0.06] dark:bg-white/[0.06] my-1" />
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        (item as { action?: () => void }).action?.();
                        setContextMenu(null);
                      }}
                      className="context-menu-item w-full text-left px-3 py-1.5 text-[12px] transition-colors flex items-center justify-between gap-6 min-w-[180px]"
                    >
                      <span>{(item as { label: string }).label}</span>
                      {'shortcut' in item && (item as { shortcut?: string }).shortcut && (
                        <span className="context-menu-kbd text-[10px]">
                          {(item as { shortcut: string }).shortcut}
                        </span>
                      )}
                    </button>
                  )
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChangeTracked}
        onConnect={onConnect}
        onNodeDragStart={(_, node) => {
          setIsDragging(true);
          const ns = getNodes();
          const targets = ns.filter((n) => n.selected || n.id === node.id);
          dragStartPositions.current = Object.fromEntries(
            targets.map((n) => [n.id, { x: n.position.x, y: n.position.y }])
          );
        }}
        onNodeDragStop={() => {
          setIsDragging(false);
          const end = getNodes();
          const start = dragStartPositions.current;
          const deltas: Record<string, { from: { x: number; y: number }; to: { x: number; y: number } }> =
            {};
          for (const id of Object.keys(start)) {
            const en = end.find((n) => n.id === id);
            if (
              en &&
              (en.position.x !== start[id].x || en.position.y !== start[id].y)
            ) {
              deltas[id] = { from: start[id], to: { x: en.position.x, y: en.position.y } };
            }
          }
          commitNodesAfterDrag(end, deltas);
          dragStartPositions.current = {};
        }}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        onNodeContextMenu={onNodeContextMenu}
        onMoveStart={() => setContextMenu(null)}
        onMoveEnd={(_, vp) =>
          setLastViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
        }
        onPaneClick={() => setFocusedNodeContentId(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={selectedTool === 'hand'}
        panOnScroll={settings.mouseWheelBehavior === 'pan'}
        zoomOnScroll={settings.mouseWheelBehavior === 'zoom'}
        selectionOnDrag={selectedTool === 'select'}
        fitView={false}
        defaultEdgeOptions={{ type: 'custom' }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.02}
        maxZoom={4}
      >
        <Background
          gap={28}
          size={1}
          color={
            settings.canvasPattern === 'none'
              ? 'transparent'
              : settings.darkMode
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.08)'
          }
        />
        {settings.showMinimap && (
          <MiniMap
            className="minimap-light !border rounded-lg overflow-hidden !bg-[#1a1a1e]/95 dark:!bg-[#1a1a1e]/95 !border-white/10 dark:!border-white/10"
            maskColor={settings.darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'}
            nodeColor={() => 'var(--accent-color)'}
            style={{ position: 'absolute', bottom: 72, right: 16, width: 160, height: 100, zIndex: 40 }}
          />
        )}
      </ReactFlow>
      <BottomBar />
    </div>
    </SpacePersistenceContext.Provider>
  );
};

function CanvasRoot() {
  const { userId, isLoading: authLoading } = useAuth();
  const {
    data: space,
    isLoading: spaceLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['canvas-space', userId],
    queryFn: () => fetchOrCreateSpace(userId!),
    enabled: Boolean(userId),
    staleTime: Infinity,
  });

  if (authLoading || !userId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--canvas-bg)] text-muted-foreground">
        Connecting…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-[var(--canvas-bg)] px-6 text-center text-muted-foreground">
        <p className="text-foreground">Could not load workspace.</p>
        <p className="max-w-md text-sm">
          Enable <strong>Anonymous sign-ins</strong> in Supabase Dashboard → Authentication → Providers.
        </p>
        <p className="text-xs opacity-70">{String((error as Error)?.message ?? error)}</p>
      </div>
    );
  }
  if (spaceLoading || !space) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--canvas-bg)] text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  return <CanvasRootWithDraft space={space} />;
}

function CanvasRootWithDraft({ space }: { space: SpaceRow }) {
  const [draftBoot, setDraftBoot] = useState<{
    draft: StoredSpaceDraft | null;
    ready: boolean;
  }>({ draft: null, ready: false });

  useEffect(() => {
    setDraftBoot({ draft: null, ready: false });
    let cancelled = false;
    void shouldRestoreDraftFromLocal(space.id, space.updated_at).then((d) => {
      if (!cancelled) setDraftBoot({ draft: d, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, [space.id, space.updated_at]);

  if (!draftBoot.ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--canvas-bg)] text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  const serverMs = Date.parse(space.updated_at);
  const initialLastWriteAt =
    draftBoot.draft?.clientUpdatedAt ?? (Number.isNaN(serverMs) ? Date.now() : serverMs);

  return (
    <CanvasInner
      space={space}
      resolvedDraft={draftBoot.draft}
      initialLastWriteAt={initialLastWriteAt}
      restoredFromLocalDraft={draftBoot.draft !== null}
    />
  );
}

const Index = () => (
  <ReactFlowProvider>
    <CanvasRoot />
  </ReactFlowProvider>
);

export default Index;
