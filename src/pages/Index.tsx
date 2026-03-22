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
  type Edge,
  type NodeChange,
  useNodesState,
  useEdgesState,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  useReactFlow,
  useStoreApi,
  useStore,
  ReactFlowProvider,
  SelectionMode,
  getConnectedEdges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';
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
import ImageVariationsNode from '@/components/canvas/ImageVariationsNode';
import CustomEdge from '@/components/canvas/CustomEdge';
import Toolbar from '@/components/canvas/Toolbar';
import TopBar from '@/components/canvas/TopBar';
import SettingsPanel from '@/components/canvas/SettingsPanel';
import BottomBar from '@/components/canvas/BottomBar';
import CommentPin from '@/components/canvas/CommentPin';
import SelectionOverlay from '@/components/canvas/SelectionOverlay';
import GroupNode from '@/components/canvas/GroupNode';
import { CanvasCursor } from '@/components/canvas/CanvasCursor';
import {
  useWorkflowStore,
  type NodeType,
  applyGroupDropReparent,
} from '@/stores/workflowStore';

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
  imageVariationsNode: ImageVariationsNode,
  group: GroupNode,
};

const edgeTypes = { custom: CustomEdge };

function getOverlappingArea(
  rectA: { x: number; y: number; width: number; height: number },
  rectB: { x: number; y: number; width: number; height: number }
): number {
  const xOverlap = Math.max(
    0,
    Math.min(rectA.x + rectA.width, rectB.x + rectB.width) - Math.max(rectA.x, rectB.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(rectA.y + rectA.height, rectB.y + rectB.height) - Math.max(rectA.y, rectB.y)
  );
  return xOverlap * yOverlap;
}

/** Returns nodes that are fully inside the given flow-space rect and have measured dimensions. */
function getNodesFullyInsideRect(
  flowRect: { x: number; y: number; width: number; height: number },
  nodes: Node[]
): Node[] {
  return nodes.filter((node) => {
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    if (typeof node.width !== 'number' || typeof node.height !== 'number' || w <= 0 || h <= 0) {
      return false;
    }
    const pos = node.positionAbsolute ?? node.position;
    const nodeRect = { x: pos.x, y: pos.y, width: w, height: h };
    const area = w * h;
    const overlap = getOverlappingArea(flowRect, nodeRect);
    return overlap >= area;
  });
}

/**
 * Reapply selection flags without dropping in-drag positions: store nodes can lag
 * React Flow until `onNodeDragStop`; always prefer matching nodes from `getNodes()`.
 */
function mergeNodesWithSelection(
  storeNodes: Node[],
  flowNodes: Node[],
  selectedNodeIds: Set<string>
): Node[] {
  const flowById = new Map(flowNodes.map((n) => [n.id, n]));
  return storeNodes.map((n) => {
    const live = flowById.get(n.id);
    if (live) {
      return { ...live, selected: selectedNodeIds.has(n.id) };
    }
    return { ...n, selected: selectedNodeIds.has(n.id) };
  });
}

/**
 * While the store lags behind React Flow during drag/resize, re-applying `storeNodes`
 * would stomp live width/height/position and cause jitter. Keep store fields (data, type,
 * …) but preserve measured geometry from the current flow snapshot.
 */
function mergeStoreNodesWithFlowGeometry(storeNodes: Node[], flowNodes: Node[]): Node[] {
  const flowById = new Map(flowNodes.map((n) => [n.id, n]));
  return storeNodes.map((sn) => {
    const live = flowById.get(sn.id);
    if (!live) return sn;
    return {
      ...live,
      ...sn,
      position: live.position,
      ...(live.positionAbsolute !== undefined ? { positionAbsolute: live.positionAbsolute } : {}),
      width: live.width ?? sn.width,
      height: live.height ?? sn.height,
      style: live.style ?? sn.style,
      selected: live.selected,
    };
  });
}

function applyEdgeSelection(storeEdges: Edge[], selectedEdgeIds: Set<string>): Edge[] {
  return storeEdges.map((e) => ({ ...e, selected: selectedEdgeIds.has(e.id) }));
}

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
  const commitNodesAfterFlowDrag = useWorkflowStore((s) => s.commitNodesAfterFlowDrag);
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
  const pushSelectionCommand = useWorkflowStore((s) => s.pushSelectionCommand);
  const isDragging = useWorkflowStore((s) => s.isDragging);

  const [nodes, setNodes] = useNodesState(storeNodes);
  const isNodeResizeActiveRef = useRef(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        let resizeEnded = false;
        for (const c of changes) {
          if (c.type === 'dimensions' && 'resizing' in c) {
            if (c.resizing === true) {
              isNodeResizeActiveRef.current = true;
            } else {
              // Keep merge mode until the store catches up (microtask), or a stale
              // storeNodes effect can replace RF dimensions before setNodesSilently runs.
              isNodeResizeActiveRef.current = true;
              resizeEnded = true;
            }
          }
        }
        const next = applyNodeChanges(changes, nds);
        if (resizeEnded) {
          queueMicrotask(() => {
            setNodesSilently(structuredClone(next));
            isNodeResizeActiveRef.current = false;
          });
        }
        return next;
      });
    },
    [setNodes, setNodesSilently]
  );
  const [edges, setEdges] = useEdgesState(storeEdges);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({});
  const dragGraphSnapshotRef = useRef<Node[] | null>(null);
  const selectionPrevRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const selectionSelectedIdsRef = useRef<{ nodeIds: Set<string>; edgeIds: Set<string> } | null>(null);
  const selectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSelectionRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const { screenToFlowPosition, fitView, getNodes, setViewport } = useReactFlow();
  const storeApi = useStoreApi();
  const userSelectionRect = useStore((s) => s.userSelectionRect);
  const hydratedSpaceId = useRef<string | null>(null);

  useEffect(() => {
    userSelectionRectRef.current = userSelectionRect ?? null;
  }, [userSelectionRect]);

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
          typeof v.x === 'number' &&
          typeof v.y === 'number' &&
          typeof v.zoom === 'number'
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
        typeof v.x === 'number' &&
        typeof v.y === 'number' &&
        typeof v.zoom === 'number'
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
    setNodes((current) => {
      if (isDragging || isNodeResizeActiveRef.current) {
        return mergeStoreNodesWithFlowGeometry(storeNodes, current);
      }
      return storeNodes;
    });
  }, [storeNodes, setNodes, isDragging]);
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

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      const store = useWorkflowStore.getState();
      if (!selectionPrevRef.current) {
        selectionPrevRef.current = { nodes: [...store.nodes], edges: [...store.edges] };
      }
      // Prefer nodes with measured dimensions (avoids marquee phantom selections). For a
      // single-node click, keep selection even before width/height exist so NodeResizer shows
      // on the first click.
      const measuredSelected = selectedNodes.filter(
        (n) =>
          typeof n.width === 'number' &&
          typeof n.height === 'number' &&
          n.width > 0 &&
          n.height > 0
      );
      const selectedNodeIds = new Set(
        measuredSelected.length > 0
          ? measuredSelected.map((n) => n.id)
          : selectedNodes.length === 1
            ? [selectedNodes[0]!.id]
            : []
      );
      const selectedEdgeIds = new Set(
        selectedEdges.filter(
          (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
        ).map((e) => e.id)
      );
      const flowNodes = getNodes();
      const nextNodes = mergeNodesWithSelection(store.nodes, flowNodes, selectedNodeIds);
      const nextEdges = applyEdgeSelection(store.edges, selectedEdgeIds);
      setNodesSilently(nextNodes);
      setEdgesSilently(nextEdges);
      selectionSelectedIdsRef.current = { nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds };
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current);
      selectionDebounceRef.current = setTimeout(() => {
        selectionDebounceRef.current = null;
        const prev = selectionPrevRef.current;
        const ids = selectionSelectedIdsRef.current;
        selectionPrevRef.current = null;
        selectionSelectedIdsRef.current = null;
        if (prev && ids) {
          const current = useWorkflowStore.getState();
          const flowNodesAtCommit = getNodes();
          const nextNodesFromStore = mergeNodesWithSelection(
            current.nodes,
            flowNodesAtCommit,
            ids.nodeIds
          );
          const nextEdgesFromStore = applyEdgeSelection(current.edges, ids.edgeIds);
          pushSelectionCommand(prev.nodes, prev.edges, nextNodesFromStore, nextEdgesFromStore);
        }
      }, 120);
    },
    [getNodes, setNodesSilently, setEdgesSilently, pushSelectionCommand]
  );

  useEffect(() => {
    return () => {
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current);
    };
  }, []);

  const onSelectionStart = useCallback(() => {
    const store = useWorkflowStore.getState();
    selectionPrevRef.current = { nodes: [...store.nodes], edges: [...store.edges] };
  }, []);

  const onSelectionEnd = useCallback(() => {
    if (selectionDebounceRef.current) {
      clearTimeout(selectionDebounceRef.current);
      selectionDebounceRef.current = null;
    }
    const rect = userSelectionRectRef.current;
    const store = useWorkflowStore.getState();
    const { transform } = storeApi.getState();
    const [tx, ty, tScale] = transform ?? [0, 0, 1];

    let selectedNodeIds: Set<string>;
    let selectedEdgeIds: Set<string>;

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      selectedNodeIds = new Set();
      selectedEdgeIds = new Set();
    } else {
      const flowRect = {
        x: (rect.x - tx) / tScale,
        y: (rect.y - ty) / tScale,
        width: rect.width / tScale,
        height: rect.height / tScale,
      };
      const allNodes = storeApi.getState().getNodes();
      const validNodes = getNodesFullyInsideRect(flowRect, allNodes);
      selectedNodeIds = new Set(validNodes.map((n) => n.id));
      selectedEdgeIds = new Set(
        getConnectedEdges(validNodes, store.edges).map((e) => e.id)
      );
    }

    const flowNodes = storeApi.getState().getNodes();
    const nextNodes = mergeNodesWithSelection(store.nodes, flowNodes, selectedNodeIds);
    const nextEdges = applyEdgeSelection(store.edges, selectedEdgeIds);
    setNodesSilently(nextNodes);
    setEdgesSilently(nextEdges);
    const prev = selectionPrevRef.current;
    selectionPrevRef.current = null;
    if (prev) {
      pushSelectionCommand(prev.nodes, prev.edges, nextNodes, nextEdges);
    }
  }, [storeApi, setNodesSilently, setEdgesSilently, pushSelectionCommand]);

  const handleAddNode = useCallback(
    (type: string) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      addNodeAction(type as NodeType, { x: position.x - 100, y: position.y - 80 });
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
      if (e.key === 'Escape') {
        setContextMenu(null);
        const store = useWorkflowStore.getState();
        const hasSelection = store.nodes.some((n) => n.selected) || store.edges.some((e) => e.selected);
        if (hasSelection) {
          const empty = new Set<string>();
          const flowNodes = getNodes();
          setNodesSilently(mergeNodesWithSelection(store.nodes, flowNodes, empty));
          setEdgesSilently(applyEdgeSelection(store.edges, empty));
        }
      }
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
    setNodesSilently,
    setEdgesSilently,
    selectAllNodes,
    fitView,
    copyNodesByIds,
    pasteClipboard,
    getNodes,
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
      <CanvasCursor />

      {(storeNodes.some((n) => n.selected) || storeEdges.some((e) => e.selected)) && (
        <SelectionOverlay
          nodes={storeNodes}
          edges={storeEdges}
          wrapperRef={reactFlowWrapper}
        />
      )}

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
        nodesConnectable
        defaultViewport={
          resolvedDraft?.payload.viewport ??
          space.viewport ??
          { x: 0, y: 0, zoom: 1 }
        }
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChangeTracked}
        onConnect={onConnect}
        onNodeDragStart={(_, node) => {
          setIsDragging(true);
          const ns = getNodes();
          dragGraphSnapshotRef.current = structuredClone(ns);
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
          const beforeSnap = dragGraphSnapshotRef.current;
          const draggedIds = new Set(Object.keys(start));
          const reparented =
            draggedIds.size > 0 ? applyGroupDropReparent(structuredClone(end), draggedIds) : end;
          if (beforeSnap) {
            commitNodesAfterFlowDrag(beforeSnap, reparented);
            dragGraphSnapshotRef.current = null;
          } else {
            commitNodesAfterDrag(end, deltas);
          }
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
        onSelectionChange={onSelectionChange}
        onSelectionStart={onSelectionStart}
        onSelectionEnd={onSelectionEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={selectedTool === 'hand' ? true : [1]}
        panOnScroll={settings.mouseWheelBehavior === 'pan'}
        zoomOnScroll={settings.mouseWheelBehavior === 'zoom'}
        selectionOnDrag={selectedTool === 'select'}
        selectionMode={SelectionMode.Full}
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
