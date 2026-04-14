import {
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  startTransition,
  Suspense,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useViewportHandleBoundsSync } from '@/hooks/useViewportHandleBoundsSync';
import { fetchOrCreateSpace, fetchSpaceById, isUuidParam, type SpaceRow } from '@/lib/spaceApi';
import { shouldRestoreDraftFromLocal, type StoredSpaceDraft } from '@/lib/spaceDraftStorage';
import { SpacePersistenceContext } from '@/contexts/SpacePersistenceContext';
import { CanvasEdgeLodProvider } from '@/contexts/CanvasEdgeLodContext';
import { CanvasViewportGestureContext } from '@/contexts/CanvasViewportGestureContext';
import { CanvasViewportImagePolicyBridge } from '@/contexts/CanvasViewportImagePolicyContext';
import { CanvasStrokeRenderProvider } from '@/contexts/CanvasStrokeRenderContext';
import { CanvasDrawInteraction } from '@/components/canvas/CanvasDrawInteraction';
import { CanvasDrawControls } from '@/components/canvas/CanvasDrawControls';
import { CanvasFlowDrawingsSvg } from '@/components/canvas/CanvasFlowDrawingsSvg';
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
  ConnectionLineType,
  useUpdateNodeInternals,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';

import Toolbar from '@/components/canvas/Toolbar';
import TopBar from '@/components/canvas/TopBar';
import BottomBar from '@/components/canvas/BottomBar';
import CommentPin from '@/components/canvas/CommentPin';
import BeLiveLoader from '@/components/canvas/BeLiveLoader';
import { SystemNotificationToast } from '@/components/SystemNotificationToast';
import { CanvasCursor } from '@/components/canvas/CanvasCursor';
import { PixiHybridBackgroundGate } from '@/components/canvas/PixiHybridBackgroundGate';
import ConnectionLineDomSource from '@/components/canvas/ConnectionLineDomSource';
import { DevReactProfiler } from '@/components/dev/DevReactProfiler';
import {
  canvasLazyEdgeTypes,
  canvasLazyNodeTypes,
  SelectionOverlayLazy,
  SettingsPanelLazy,
} from '@/lib/canvasFlowLazy';
import { useMinLoadingDisplay } from '@/hooks/useMinLoadingDisplay';
import { useSystemNotificationStore } from '@/stores/systemNotificationStore';
import { useShallow } from 'zustand/react/shallow';
import {
  useWorkflowStore,
  type NodeType,
  applyGroupDropReparentForMovedNodes,
} from '@/stores/workflowStore';
import {
  isCanvasShortcutTargetBlocked,
  nextCanvasPattern,
} from '@/lib/canvasKeymap';
import { validateScoutConnection } from '@/lib/scoutPipeline';
import { DEFAULT_FIT_VIEW_OPTIONS } from '@/lib/canvasViewport';
import { canvasPerfFlags, runWithCanvasPerfMark } from '@/lib/canvasPerf';
import { canvasWorkerClient } from '@/lib/canvasWorkerClient';
import type { SpatialNodeBounds, SpatialNodeDelta } from '@/lib/canvasWorkerProtocol';
import { readVfHybridBoardEnabled } from '@/lib/pixiBoard/vfBoardFlag';
import {
  bumpHandleFlowPositionRevision,
  measureAndCacheHandleFlowPosition,
} from '@/lib/canvasHandlePositionCache';
/** Minimum time (ms) the workspace loader stays visible after fetch/draft resolve — see `useMinLoadingDisplay`. */
const WORKSPACE_LOADER_MIN_MS = canvasPerfFlags.fastStartupMode ? 120 : 1000;
const ENTRY_SPLASH_MS = canvasPerfFlags.fastStartupMode ? 250 : 2000;

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

/**
 * Marquee hit-test: node bbox intersects `flowRect` (any overlap), with measured RF dimensions only.
 * Skips unmeasured nodes so we do not mirror RF `getNodesInside` false positives on dragging/unmeasured nodes.
 */
function getNodesMarqueeIntersectRect(
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
    return getOverlappingArea(flowRect, nodeRect) > 0;
  });
}

/** Pane marquee rect (screen space under `.react-flow`) → flow-space box; matches RF `getNodesInside` conversion. */
function flowRectFromPaneSelection(
  rect: { x: number; y: number; width: number; height: number },
  transform: readonly [number, number, number] | undefined
): { x: number; y: number; width: number; height: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const [tx, ty, tScale] = transform ?? [0, 0, 1];
  const z = tScale === 0 || !Number.isFinite(tScale) ? 1 : tScale;
  return {
    x: (rect.x - tx) / z,
    y: (rect.y - ty) / z,
    width: rect.width / z,
    height: rect.height / z,
  };
}

function toSpatialNodeBounds(node: Node): SpatialNodeBounds | null {
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  if (typeof node.width !== 'number' || typeof node.height !== 'number' || w <= 0 || h <= 0) {
    return null;
  }
  const pos = node.positionAbsolute ?? node.position;
  return {
    id: node.id,
    x: pos.x,
    y: pos.y,
    width: w,
    height: h,
  };
}

function spatialBoundsEqual(a: SpatialNodeBounds, b: SpatialNodeBounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
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
 * Merge Zustand graph fields into React Flow’s live snapshot so measured geometry wins:
 * `width` / `height` / `position` / `style` from RF (auto-resize, content growth, drag in progress)
 * while `data`, `type`, `parentId`, etc. come from the store. Without this, any `storeNodes`
 * effect that substitutes the store array would revert RF to stale dimensions and desync handles/edges.
 */
function mergeStoreNodesWithFlowGeometry(storeNodes: Node[], flowNodes: Node[]): Node[] {
  const flowById = new Map(flowNodes.map((n) => [n.id, n]));
  return storeNodes.map((sn) => {
    const live = flowById.get(sn.id);
    if (!live) return sn;
    const parentOrExtentChanged =
      sn.parentId !== live.parentId || sn.extent !== live.extent;
    const next: Node = {
      ...live,
      ...sn,
      position: parentOrExtentChanged ? { ...sn.position } : live.position,
      width: live.width ?? sn.width,
      height: live.height ?? sn.height,
      style: live.style ?? sn.style,
      /** Zustand is updated from `onSelectionChange` / `onSelectionEnd`; RF often omits `onNodesChange` when selection *count* is unchanged, so `live.selected` can stay stale during marquee — prefer store flags here. */
      selected: sn.selected,
    };
    if (parentOrExtentChanged) {
      delete (next as { positionAbsolute?: unknown }).positionAbsolute;
    } else if (live.positionAbsolute !== undefined) {
      (next as Node & { positionAbsolute?: NonNullable<Node['positionAbsolute']> }).positionAbsolute =
        live.positionAbsolute;
    }
    return next;
  });
}

function applyEdgeSelection(storeEdges: Edge[], selectedEdgeIds: Set<string>): Edge[] {
  return storeEdges.map((e) => ({ ...e, selected: selectedEdgeIds.has(e.id) }));
}

type MarqueeSnap = {
  active: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  tk: string;
};

function selectMarqueeSnap(s: {
  userSelectionActive: boolean;
  userSelectionRect: { x: number; y: number; width: number; height: number } | null | undefined;
  transform: readonly [number, number, number];
}): MarqueeSnap {
  const r = s.userSelectionRect;
  const active = s.userSelectionActive;
  return {
    active,
    x: r?.x ?? 0,
    y: r?.y ?? 0,
    w: r?.width ?? 0,
    h: r?.height ?? 0,
    // Only subscribe to transform while marquee is active — panning would otherwise re-run
    // `useLayoutEffect` + node/edge selection merges on every frame (see `marqueeSnap` + equality).
    tk: active
      ? `${s.transform[0]},${s.transform[1]},${s.transform[2]}`
      : 'idle',
  };
}

function marqueeSnapEqual(a: MarqueeSnap, b: MarqueeSnap): boolean {
  return (
    a.active === b.active &&
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h &&
    a.tk === b.tk
  );
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

const CanvasInnerReactFlow = ({
  space,
  resolvedDraft,
  initialLastWriteAt,
  hybridBackground = false,
}: {
  space: SpaceRow;
  resolvedDraft: StoredSpaceDraft | null;
  initialLastWriteAt: number;
  /** WebGL grid behind React Flow; `?vfBoard=hybrid` or `vf.perf.board=hybrid` */
  hybridBackground?: boolean;
}) => {
  const storeNodes = useWorkflowStore((s) => s.nodes);
  const storeEdges = useWorkflowStore((s) => s.edges);
  const comments = useWorkflowStore((s) => s.comments);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const drawSubTool = useWorkflowStore((s) => s.drawSubTool);
  /** Narrow settings subscription — avoids rerenders when unrelated `settings` fields change. */
  const { canvasPattern, showNodeLabels, darkMode, showMinimap, mouseWheelBehavior } =
    useWorkflowStore(
      useShallow((s) => ({
        canvasPattern: s.settings.canvasPattern,
        showNodeLabels: s.settings.showNodeLabels,
        darkMode: s.settings.darkMode,
        showMinimap: s.settings.showMinimap,
        mouseWheelBehavior: s.settings.mouseWheelBehavior,
      }))
    );
  /** Avoid CSS pattern + WebGL grid double-draw in hybrid mode */
  const shellCanvasClass = hybridBackground ? 'canvas-plain' : canvasClass(canvasPattern);
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
  const focusedNodeContentId = useWorkflowStore((s) => s.focusedNodeContentId);
  const hydrateFromSpace = useWorkflowStore((s) => s.hydrateFromSpace);
  const setLastViewport = useWorkflowStore((s) => s.setLastViewport);
  const updateSettings = useWorkflowStore((s) => s.updateSettings);

  const [nodes, setNodes] = useNodesState(storeNodes);
  const isNodeResizeActiveRef = useRef(false);
  const dragTxnRef = useRef<{
    movedNodeIds: Set<string>;
    startById: Map<string, { x: number; y: number; parentId?: string; extent?: 'parent' }>;
  } | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        let resizeEnded = false;
        /**
         * Persist RF dimensions to Zustand for:
         * - resize end
         * - organic ResizeObserver growth (changes without `resizing` metadata)
         *
         * During active resize drags, some RF dimension events may omit `resizing`.
         * Treat those as in-progress when a resize is already active to avoid
         * high-frequency structuredClone/store writes that can freeze the canvas.
         */
        let shouldPersistDimensions = false;
        for (const c of changes) {
          if (c.type === 'dimensions') {
            const hasResizeMeta = 'resizing' in c;
            const resizeMeta = hasResizeMeta
              ? (c as { resizing?: boolean }).resizing
              : undefined;
            const isResizeDrag = resizeMeta === true;
            const isResizeEnd = resizeMeta === false;

            if (isResizeDrag) {
              isNodeResizeActiveRef.current = true;
              continue;
            }

            if (isResizeEnd) {
              resizeEnded = true;
              shouldPersistDimensions = true;
              continue;
            }

            // No explicit `resizing` flag: persist only when no resize drag is active.
            if (!isNodeResizeActiveRef.current) {
              shouldPersistDimensions = true;
            }
          }
        }
        const next = applyNodeChanges(changes, nds);
        if (resizeEnded || shouldPersistDimensions) {
          queueMicrotask(() => {
            setNodesSilently(structuredClone(next));
            if (resizeEnded) {
              isNodeResizeActiveRef.current = false;
            }
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
  const [deferredUiReady, setDeferredUiReady] = useState(!canvasPerfFlags.deferNonCriticalCanvasUi);
  const [isViewportInteracting, setIsViewportInteracting] = useState(false);
  /** Linux / some drivers emit wheel events during middle-button drag; suppress scroll-based zoom/pan until release. */
  const [middleMouseButtonDown, setMiddleMouseButtonDown] = useState(false);
  /** Lift static edges above nodes while dragging a connection; CSS disables pointer events on that SVG so handles still receive the drop. */
  const [isConnectingFromHandle, setIsConnectingFromHandle] = useState(false);
  const notifications = useSystemNotificationStore((s) => s.notifications);
  const dismissNotification = useSystemNotificationStore((s) => s.dismiss);
  const pauseNotificationAutoDismiss = useSystemNotificationStore((s) => s.pauseAutoDismiss);
  const resumeNotificationAutoDismiss = useSystemNotificationStore((s) => s.resumeAutoDismiss);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button === 1) setMiddleMouseButtonDown(true);
    };
    const onUp = (e: PointerEvent) => {
      if (e.button === 1) setMiddleMouseButtonDown(false);
    };
    const clear = () => setMiddleMouseButtonDown(false);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const dragGraphSnapshotRef = useRef<Node[] | null>(null);
  const userSelectionRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const spatialBoundsByIdRef = useRef<Map<string, SpatialNodeBounds>>(new Map());
  const spatialPendingDeltasRef = useRef<Map<string, SpatialNodeDelta>>(new Map());
  const spatialUpdateRafRef = useRef<number | null>(null);
  const spatialRevisionRef = useRef(0);
  const {
    screenToFlowPosition,
    fitView,
    getNodes,
    getNode,
    getEdges,
    setViewport,
    zoomIn,
    zoomOut,
  } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { refreshAllHandleBounds, queueHandleBoundsRefresh } = useViewportHandleBoundsSync();
  const storeApi = useStoreApi();

  const onConnectStart = useCallback(
    (
      _event: unknown,
      meta: { nodeId?: string | null; handleId?: string | null; handleType?: string | null }
    ) => {
      const nodeId = meta?.nodeId ?? undefined;
      if (nodeId) {
        bumpHandleFlowPositionRevision();
        const handleId = meta?.handleId != null ? String(meta.handleId) : null;
        if (handleId) {
          measureAndCacheHandleFlowPosition(nodeId, handleId, screenToFlowPosition);
        }
        const chain: string[] = [];
        let cur: string | undefined = nodeId;
        const seen = new Set<string>();
        while (cur && !seen.has(cur)) {
          seen.add(cur);
          chain.push(cur);
          cur = getNode(cur)?.parentId;
        }
        refreshAllHandleBounds();
        if (chain.length > 0) updateNodeInternals(chain);
        requestAnimationFrame(() => {
          refreshAllHandleBounds();
          if (chain.length > 0) updateNodeInternals(chain);
        });
      }
      startTransition(() => {
        setIsConnectingFromHandle(true);
      });
    },
    [storeApi, refreshAllHandleBounds, updateNodeInternals, getNode, screenToFlowPosition]
  );
  const onConnectEnd = useCallback(() => {
    setIsConnectingFromHandle(false);
  }, []);

  const onMoveEnd = useCallback(
    (_: MouseEvent | TouchEvent | null, vp: { x: number; y: number; zoom: number }) => {
      setIsViewportInteracting(false);
      setLastViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
      // Keep post-gesture internals refresh: edges/handles must stay in sync immediately after pan/zoom.
      requestAnimationFrame(() => {
        refreshAllHandleBounds();
      });
    },
    [setLastViewport, refreshAllHandleBounds]
  );

  useEffect(() => {
    if (!canvasPerfFlags.deferNonCriticalCanvasUi) return;
    let cancelled = false;
    const onReady = () => {
      if (!cancelled) setDeferredUiReady(true);
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(onReady, { timeout: 1500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const t = globalThis.setTimeout(onReady, 650);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const enabled =
      canvasPerfFlags.enableSpatialIndexing &&
      nodes.length >= canvasPerfFlags.spatialIndexThreshold;
    if (!enabled) {
      spatialBoundsByIdRef.current.clear();
      spatialPendingDeltasRef.current.clear();
      if (spatialUpdateRafRef.current != null) {
        cancelAnimationFrame(spatialUpdateRafRef.current);
        spatialUpdateRafRef.current = null;
      }
      return;
    }

    const nextById = new Map<string, SpatialNodeBounds>();
    for (const n of nodes) {
      const b = toSpatialNodeBounds(n);
      if (b) nextById.set(b.id, b);
    }

    const prevById = spatialBoundsByIdRef.current;
    const deltas: SpatialNodeDelta[] = [];
    for (const [id, next] of nextById.entries()) {
      const prev = prevById.get(id);
      if (!prev) {
        deltas.push({ id, to: next });
        continue;
      }
      if (!spatialBoundsEqual(prev, next)) {
        deltas.push({ id, from: prev, to: next });
      }
    }
    for (const [id, prev] of prevById.entries()) {
      if (!nextById.has(id)) deltas.push({ id, from: prev, to: null });
    }

    spatialBoundsByIdRef.current = nextById;
    if (deltas.length === 0) return;

    for (const delta of deltas) {
      spatialPendingDeltasRef.current.set(delta.id, delta);
    }
    if (spatialUpdateRafRef.current != null) return;
    spatialUpdateRafRef.current = requestAnimationFrame(() => {
      spatialUpdateRafRef.current = null;
      const batched = [...spatialPendingDeltasRef.current.values()];
      spatialPendingDeltasRef.current.clear();
      if (batched.length === 0) return;
      const nextRevision = ++spatialRevisionRef.current;
      const hasBaseline = nextRevision > 1;
      if (!hasBaseline) {
        void canvasWorkerClient.spatialInit([...spatialBoundsByIdRef.current.values()], nextRevision);
        return;
      }
      void canvasWorkerClient.spatialUpdate(batched, nextRevision);
    });

    return () => {
      if (spatialUpdateRafRef.current != null) {
        cancelAnimationFrame(spatialUpdateRafRef.current);
        spatialUpdateRafRef.current = null;
      }
    };
  }, [nodes]);

  const userSelectionRect = useStore((s) => s.userSelectionRect);
  const hydratedSpaceId = useRef<string | null>(null);

  useEffect(() => {
    userSelectionRectRef.current = userSelectionRect ?? null;
  }, [userSelectionRect]);

  const persistence = useSpaceLocalPersistence(space, {
    initialLastWriteAt,
  });

  useEffect(() => {
    bumpHandleFlowPositionRevision();
    if (hydratedSpaceId.current === space.id) return;
    hydratedSpaceId.current = space.id;
    startTransition(() => {
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
    });
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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          refreshAllHandleBounds();
        });
      });
    });
  }, [space, resolvedDraft, hydrateFromSpace, setViewport, fitView, refreshAllHandleBounds]);

  useEffect(() => {
    const st = useWorkflowStore.getState().settings;
    document.body.setAttribute('data-theme', st.darkMode ? 'dark' : 'light');
    document.body.setAttribute('data-performance', String(st.performanceMode));
  }, []);

  useEffect(() => {
    if (useWorkflowStore.getState().isDragging && canvasPerfFlags.deltaDragTxn) return;
    // During pane marquee, `useLayoutEffect` clamps `selected` on the RF nodes array first; Zustand is
    // updated in `onSelectionChange`’s passive effect — later in the same tick. Merging here would
    // still see stale `storeNodes.selected` and collapse multi-select back to one.
    if (storeApi.getState().userSelectionActive) return;
    setNodes((current) => mergeStoreNodesWithFlowGeometry(storeNodes, current));
  }, [storeNodes, setNodes, storeApi]);
  useEffect(() => {
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  const isValidConnection = useCallback((connection: Connection) => {
    const store = useWorkflowStore.getState();
    return validateScoutConnection(connection, store.edges).ok;
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const store = useWorkflowStore.getState();
      const v = validateScoutConnection(connection, store.edges);
      if (!v.ok) return;
      const eds = getEdges();
      const next = addEdge({ ...connection, type: 'custom' }, eds);
      const added = next.find((e) => !eds.some((oe) => oe.id === e.id));
      setEdges(next);
      if (added) {
        queueMicrotask(() => {
          connectEdgeWithHistory(next, added);
        });
      }
    },
    [setEdges, connectEdgeWithHistory, getEdges]
  );

  const onEdgesChangeTracked = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => {
      const eds = getEdges();
      const next = applyEdgeChanges(changes, eds);
      const removed = eds.filter((e) => !next.some((ne) => ne.id === e.id));
      setEdges(next);
      queueMicrotask(() => {
        if (removed.length > 0) {
          applyEdgeRemoval(next, removed);
        } else {
          setEdgesSilently(next);
        }
      });
    },
    [setEdges, applyEdgeRemoval, setEdgesSilently, getEdges]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      const store = useWorkflowStore.getState();
      const rf = storeApi.getState();
      const { userSelectionActive, userSelectionRect, transform } = rf;
      const flowRect =
        userSelectionActive && userSelectionRect
          ? flowRectFromPaneSelection(userSelectionRect, transform)
          : null;

      let selectedNodeIds: Set<string>;
      let selectedEdgeIds: Set<string>;

      if (flowRect) {
        // Marquee: RF’s `getNodesInside` selects unmeasured / dragging nodes incorrectly; mirror
        // `onSelectionEnd` — intersecting bboxes with measured bounds only.
        const hitNodes = getNodesMarqueeIntersectRect(flowRect, getNodes());
        selectedNodeIds = new Set(hitNodes.map((n) => n.id));
        selectedEdgeIds = new Set(
          getConnectedEdges(hitNodes, getEdges()).map((e) => e.id)
        );
      } else {
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
        selectedNodeIds = new Set(
          measuredSelected.length > 0
            ? measuredSelected.map((n) => n.id)
            : selectedNodes.length === 1
              ? [selectedNodes[0]!.id]
              : []
        );
        selectedEdgeIds = new Set(
          selectedEdges.filter(
            (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
          ).map((e) => e.id)
        );
      }

      const flowNodes = getNodes();
      const nextNodes = mergeNodesWithSelection(store.nodes, flowNodes, selectedNodeIds);
      const nextEdges = applyEdgeSelection(store.edges, selectedEdgeIds);
      setNodesSilently(nextNodes);
      setEdgesSilently(nextEdges);
    },
    [getNodes, getEdges, storeApi, setNodesSilently, setEdgesSilently]
  );

  const onSelectionEnd = useCallback(async () => {
    const rect = userSelectionRectRef.current;
    const store = useWorkflowStore.getState();
    const { transform } = storeApi.getState();

    let selectedNodeIds: Set<string>;
    let selectedEdgeIds: Set<string>;

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      selectedNodeIds = new Set();
      selectedEdgeIds = new Set();
    } else {
      const flowRect = flowRectFromPaneSelection(rect, transform);
      if (!flowRect) {
        selectedNodeIds = new Set();
        selectedEdgeIds = new Set();
      } else {
        const allNodes = storeApi.getState().getNodes();
        let candidateNodes = allNodes;
        const shouldUseSpatial =
          canvasPerfFlags.enableSpatialIndexing &&
          allNodes.length >= canvasPerfFlags.spatialIndexThreshold &&
          spatialRevisionRef.current > 0;
        if (shouldUseSpatial) {
          try {
            const candidateIds = await canvasWorkerClient.spatialQueryRect(
              flowRect,
              spatialRevisionRef.current
            );
            if (candidateIds.length > 0) {
              const candidateSet = new Set(candidateIds);
              candidateNodes = allNodes.filter((n) => candidateSet.has(n.id));
            }
          } catch {
            // Keep marquee selection resilient: fall back to exact full-scan if worker/index fails.
            candidateNodes = allNodes;
          }
        }
        const validNodes = getNodesMarqueeIntersectRect(flowRect, candidateNodes);
        selectedNodeIds = new Set(validNodes.map((n) => n.id));
        selectedEdgeIds = new Set(
          getConnectedEdges(validNodes, store.edges).map((e) => e.id)
        );
      }
    }

    const flowNodes = storeApi.getState().getNodes();
    const nextNodes = mergeNodesWithSelection(store.nodes, flowNodes, selectedNodeIds);
    const nextEdges = applyEdgeSelection(store.edges, selectedEdgeIds);
    setNodesSilently(nextNodes);
    setEdgesSilently(nextEdges);
  }, [storeApi, setNodesSilently, setEdgesSilently]);

  const marqueeSnap = useStore(
    useCallback((s) => selectMarqueeSnap(s), []),
    marqueeSnapEqual
  );

  /** RF updates `userSelectionRect` after `onNodesChange`; clamp node/edge `selected` before paint so marquee matches intersect geometry (see `getNodesMarqueeIntersectRect`). */
  useLayoutEffect(() => {
    if (!marqueeSnap.active || marqueeSnap.w <= 0 || marqueeSnap.h <= 0) return;
    const paneRect = {
      x: marqueeSnap.x,
      y: marqueeSnap.y,
      width: marqueeSnap.w,
      height: marqueeSnap.h,
    };
    const fr = flowRectFromPaneSelection(paneRect, storeApi.getState().transform);
    if (!fr) return;

    const live = getNodes();
    const allowedNodes = getNodesMarqueeIntersectRect(fr, live);
    const allowedIds = new Set(allowedNodes.map((n) => n.id));
    const allowedEdgeIds = new Set(getConnectedEdges(allowedNodes, getEdges()).map((e) => e.id));

    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        const sel = allowedIds.has(n.id);
        if (n.selected === sel) return n;
        changed = true;
        return { ...n, selected: sel };
      });
      return changed ? next : nds;
    });

    setEdges((eds) => {
      let changed = false;
      const next = eds.map((e) => {
        const sel = allowedEdgeIds.has(e.id);
        if (e.selected === sel) return e;
        changed = true;
        return { ...e, selected: sel };
      });
      return changed ? next : eds;
    });
  }, [marqueeSnap, getNodes, getEdges, setNodes, setEdges, storeApi]);

  const handleAddNode = useCallback(
    (type: string) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      addNodeAction(type as NodeType, { x: position.x - 100, y: position.y - 80 });
    },
    [addNodeAction, screenToFlowPosition]
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      const el = event.target as HTMLElement;
      if (el.closest('.react-flow__node')) return;
      const onCommentUi = el.closest('[data-vf-comment-ui]') != null;
      setFocusedNodeContentId(null);
      setContextMenu(null);
      if (selectedTool === 'comment' && !onCommentUi) {
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
      const el = event.target as HTMLElement;
      if (el.closest('.react-flow__node')) return;
      if (el.closest('[data-vf-comment-ui]')) return;
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
    fitView(DEFAULT_FIT_VIEW_OPTIONS);
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
      if (isCanvasShortcutTargetBlocked(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          zoomIn({ duration: 200 });
          return;
        }
        if (e.key === '-' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          zoomOut({ duration: 200 });
          return;
        }
      }

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
        fitView(DEFAULT_FIT_VIEW_OPTIONS);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && nodes.some((n) => n.selected)) {
        e.preventDefault();
        copyNodesByIds(nodes.filter((n) => n.selected).map((n) => n.id));
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX' && nodes.some((n) => n.selected)) {
        e.preventDefault();
        const ids = nodes.filter((n) => n.selected).map((n) => n.id);
        copyNodesByIds(ids);
        ids.forEach((id) => deleteNode(id));
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
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        updateSettings({ canvasPattern: nextCanvasPattern(canvasPattern) });
        return;
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
    zoomIn,
    zoomOut,
    updateSettings,
    canvasPattern,
  ]);

  const cursorClass =
    selectedTool === 'cut'
      ? 'cursor-scissors'
      : selectedTool === 'hand'
        ? 'cursor-grab'
        : selectedTool === 'connection'
          ? 'cursor-crosshair'
          : selectedTool === 'draw'
            ? drawSubTool === 'eraser'
              ? 'cursor-crosshair'
              : 'cursor-pencil'
            : '';

  /** React Flow’s pane sets `cursor: grab` on the hit target; these classes override it for draw mode. */
  const drawPaneCursorClass =
    selectedTool === 'draw' ? (drawSubTool === 'eraser' ? 'vf-draw-cursor-eraser' : 'vf-draw-cursor-pencil') : '';

  /** While a node body is content-focused, wheel should scroll inside the node (not zoom/pan the canvas). */
  const nodeContentFocusActive = focusedNodeContentId != null;
  /**
   * **Hand tool:** left (0) + middle (1) drag pan the viewport.
   * **Select / other tools:** middle (1) only — left-drag on the pane keeps marquee select (Select) or
   * tool behavior; press **H** or choose Hand to pan with the left button.
   * When a node body is content-focused, only middle-drag pans.
   */
  const canvasPanOnDrag = nodeContentFocusActive
    ? [1]
    : selectedTool === 'hand'
      ? [0, 1]
      : [1];
  /** Wheel: Zoom mode → change scale; Pan mode → move viewing area (mutually exclusive in settings). */
  const canvasPanOnScroll = !nodeContentFocusActive && mouseWheelBehavior === 'pan';
  const canvasZoomOnScroll = !nodeContentFocusActive && mouseWheelBehavior === 'zoom';
  const canvasPanOnScrollWhileMiddleUp = canvasPanOnScroll && !middleMouseButtonDown;
  const canvasZoomOnScrollWhileMiddleUp = canvasZoomOnScroll && !middleMouseButtonDown;

  const edgeLodReduced = useMemo(() => {
    if (canvasPerfFlags.edgeLodDuringViewportInteraction && isViewportInteracting) return true;
    if (
      canvasPerfFlags.edgeLodInDenseGraph &&
      storeEdges.length >= canvasPerfFlags.denseEdgeLodThreshold
    ) {
      return true;
    }
    return false;
  }, [isViewportInteracting, storeEdges.length]);

  const edgeLodLevel = edgeLodReduced ? 'reduced' : 'full';
  const hybridEdgeCutoverActive =
    hybridBackground &&
    canvasPerfFlags.hybridEdgeLayer &&
    canvasPerfFlags.hybridEdgeDomCutover;

  const targetId = contextMenu?.targetId;

  return (
    <SpacePersistenceContext.Provider
      value={{
        isRemoteDirtyPending: persistence.isRemoteDirtyPending,
        saveToRemoteNow: persistence.saveToRemoteNow,
        isSavingToRemote: persistence.isSavingToRemote,
        spaceUpdatedAtIso: persistence.spaceUpdatedAtIso,
        lastRemoteSaveSucceededAtMs: persistence.lastRemoteSaveSucceededAtMs,
      }}
    >
    <CanvasStrokeRenderProvider>
    <DevReactProfiler id="vf-canvas-inner">
    <CanvasViewportGestureContext.Provider value={isViewportInteracting}>
    <CanvasViewportImagePolicyBridge>
    <div
      className={`w-screen h-screen ${hybridBackground ? 'flex min-h-0 flex-col' : ''} ${shellCanvasClass} ${cursorClass} ${drawPaneCursorClass} ${showNodeLabels ? '' : 'workflow-hide-labels'} ${isConnectingFromHandle ? 'vf-connecting-edge' : ''} ${selectedTool === 'cut' ? 'vf-snip-tool' : ''} ${hybridEdgeCutoverActive ? 'vf-hybrid-edge-cutover' : ''}`}
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
      {settingsOpen ? (
        <Suspense fallback={null}>
          <SettingsPanelLazy open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      ) : null}
      <CanvasCursor />
      <CanvasDrawControls />

      {(storeNodes.some((n) => n.selected) || storeEdges.some((e) => e.selected)) &&
      (!canvasPerfFlags.deferNonCriticalCanvasUi || deferredUiReady) ? (
        <Suspense fallback={null}>
          <SelectionOverlayLazy
            nodes={storeNodes}
            edges={storeEdges}
            wrapperRef={reactFlowWrapper}
            interactionCompressViewport={
              isViewportInteracting && canvasPerfFlags.selectionOverlayQuantizeDuringViewport
            }
          />
        </Suspense>
      ) : null}

      {!canvasPerfFlags.deferNonCriticalCanvasUi || deferredUiReady
        ? comments.map((c) => <CommentPin key={c.id} comment={c} />)
        : null}

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

      <div
        className={
          hybridBackground ? 'relative flex min-h-0 w-full flex-1 flex-col' : 'contents'
        }
      >
        <Suspense fallback={null}>
          {hybridBackground ? <PixiHybridBackgroundGate /> : null}
          <CanvasEdgeLodProvider value={edgeLodLevel}>
          <ReactFlow
        className={
          hybridBackground ? 'relative z-10 min-h-0 flex-1 !bg-transparent' : undefined
        }
        nodes={nodes}
        edges={edges}
        onlyRenderVisibleElements
        nodesConnectable
        defaultViewport={
          resolvedDraft?.payload.viewport ??
          space.viewport ??
          { x: 0, y: 0, zoom: 1 }
        }
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChangeTracked}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineComponent={ConnectionLineDomSource}
        connectionLineStyle={{ stroke: 'var(--edge-stroke)', strokeWidth: 2 }}
        onNodeDragStart={(_, node) => {
          runWithCanvasPerfMark('canvas.dragStart', () => {
            setIsViewportInteracting(true);
            setIsDragging(true);
            const ns = getNodes();
            const targets = ns.filter((n) => n.selected || n.id === node.id);
            const movedNodeIds = new Set(targets.map((n) => n.id));
            const startById = new Map(
              targets.map((n) => [
                n.id,
                {
                  x: n.position.x,
                  y: n.position.y,
                  parentId: n.parentId,
                  extent: n.extent as 'parent' | undefined,
                },
              ])
            );
            dragTxnRef.current = { movedNodeIds, startById };
            if (!canvasPerfFlags.deltaDragTxn) {
              dragGraphSnapshotRef.current = structuredClone(ns);
            } else {
              dragGraphSnapshotRef.current = ns.map((n) => ({ ...n, position: { ...n.position } }));
            }
          });
        }}
        onNodeDragStop={() => {
          runWithCanvasPerfMark('canvas.dragStop', () => {
            setIsViewportInteracting(false);
            setIsDragging(false);
            const end = getNodes();
            const txn = dragTxnRef.current;
            const beforeSnap = dragGraphSnapshotRef.current;
            if (!txn || !beforeSnap) return;

            const movedIds = txn.movedNodeIds;
            const byEndId = new Map(end.map((n) => [n.id, n]));
            const changedIds = new Set<string>();

            const positionPatches = [...txn.startById.entries()].flatMap(([id, s]) => {
              const current = byEndId.get(id);
              if (!current) return [];
              const changed = current.position.x !== s.x || current.position.y !== s.y;
              if (changed) changedIds.add(id);
              return changed
                ? [
                    {
                      id,
                      from: { x: s.x, y: s.y },
                      to: { x: current.position.x, y: current.position.y },
                    },
                  ]
                : [];
            });

            const { nextNodes: reparented } = applyGroupDropReparentForMovedNodes(end, movedIds);
            commitNodesAfterFlowDrag(beforeSnap, reparented);
            if (changedIds.size > 0) bumpHandleFlowPositionRevision();

            const affectedNodeIds = new Set<string>(changedIds);
            const movedNodes = reparented.filter((n) => changedIds.has(n.id));
            const touchedEdges = getConnectedEdges(movedNodes, getEdges());
            for (const e of touchedEdges) {
              affectedNodeIds.add(e.source);
              affectedNodeIds.add(e.target);
            }
            queueHandleBoundsRefresh(affectedNodeIds);

            if (!canvasPerfFlags.diffHistory && positionPatches.length > 0) {
              const deltas = Object.fromEntries(
                positionPatches.map((p) => [p.id, { from: p.from, to: p.to }])
              );
              commitNodesAfterDrag(end, deltas);
            }

            dragTxnRef.current = null;
            dragGraphSnapshotRef.current = null;
          });
        }}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        onNodeContextMenu={onNodeContextMenu}
        onMoveStart={() => {
          setContextMenu(null);
          setIsViewportInteracting(true);
        }}
        onMoveEnd={onMoveEnd}
        onPaneClick={() => setFocusedNodeContentId(null)}
        onSelectionChange={onSelectionChange}
        onSelectionEnd={onSelectionEnd}
        nodeTypes={canvasLazyNodeTypes}
        edgeTypes={canvasLazyEdgeTypes}
        panOnDrag={canvasPanOnDrag}
        panOnScroll={canvasPanOnScrollWhileMiddleUp}
        zoomOnScroll={canvasZoomOnScrollWhileMiddleUp}
        selectionOnDrag={selectedTool === 'select' && !nodeContentFocusActive}
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
            hybridBackground
              ? 'transparent'
              : canvasPattern === 'none'
                ? 'transparent'
                : darkMode
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.08)'
          }
        />
        {!hybridBackground ? <CanvasFlowDrawingsSvg /> : null}
        <CanvasDrawInteraction shellRef={reactFlowWrapper} />
        {showMinimap && (!canvasPerfFlags.deferNonCriticalCanvasUi || deferredUiReady) && (
          <MiniMap
            className="minimap-light !border rounded-lg overflow-hidden !bg-[#1a1a1e]/95 dark:!bg-[#1a1a1e]/95 !border-white/10 dark:!border-white/10"
            maskColor={darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'}
            nodeColor={() => 'var(--accent-color)'}
            style={{ position: 'absolute', bottom: 72, right: 16, width: 160, height: 100, zIndex: 40 }}
          />
        )}
      </ReactFlow>
          </CanvasEdgeLodProvider>
        </Suspense>
      </div>
      <BottomBar />
      {notifications.length > 0 &&
      (!canvasPerfFlags.deferToastsDuringInteraction || !isViewportInteracting) ? (
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
    </CanvasViewportImagePolicyBridge>
    </CanvasViewportGestureContext.Provider>
    </DevReactProfiler>
    </CanvasStrokeRenderProvider>
    </SpacePersistenceContext.Provider>
  );
};

function CanvasLoadingShell({ caption }: { caption?: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--canvas-bg)]">
      <div className="flex flex-col items-center gap-6">
        <BeLiveLoader size="lg" />
        {caption ? (
          <p className="text-sm text-muted-foreground" role="status">
            {caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CanvasRoot() {
  const { userId, isLoading: authLoading } = useAuth();
  const { spaceId: spaceIdParam } = useParams<{ spaceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const routeSpaceId = spaceIdParam?.trim();
  const spaceFromQuery = searchParams.get('space')?.trim();
  const needsSpaceRedirect =
    !routeSpaceId && spaceFromQuery != null && spaceFromQuery.length > 0 && isUuidParam(spaceFromQuery);

  useEffect(() => {
    if (needsSpaceRedirect) {
      navigate(`/w/${spaceFromQuery}`, { replace: true });
    }
  }, [needsSpaceRedirect, spaceFromQuery, navigate]);

  const loadExplicitSpace = isUuidParam(routeSpaceId);
  const explicitRouteInvalid = Boolean(routeSpaceId && !loadExplicitSpace);

  const queryEnabled =
    Boolean(userId) && !needsSpaceRedirect && !explicitRouteInvalid;

  const {
    data: space,
    isLoading: spaceLoading,
    isFetching,
    isError,
    error,
    isSuccess,
  } = useQuery({
    queryKey: ['canvas-space', userId, loadExplicitSpace ? routeSpaceId : 'default'] as const,
    queryFn: async () => {
      if (!userId) throw new Error('No user');
      if (loadExplicitSpace) {
        return fetchSpaceById(userId, routeSpaceId);
      }
      return fetchOrCreateSpace(userId);
    },
    enabled: queryEnabled,
    staleTime: Infinity,
  });

  /** `/` uses "latest space by updated_at". Replace with `/w/:id` so bookmarks and other browsers resolve the same row you save to. */
  useEffect(() => {
    if (!space?.id || !userId) return;
    if (loadExplicitSpace) return;
    queryClient.setQueryData(['canvas-space', userId, space.id], space);
    navigate(`/w/${space.id}`, { replace: true });
  }, [space, loadExplicitSpace, navigate, userId]);

  const spaceMissing = Boolean(loadExplicitSpace && isSuccess && space === null);
  const spacePending =
    needsSpaceRedirect ||
    (queryEnabled && (spaceLoading || isFetching) && space === undefined && !isError);
  const holdWorkspaceFetchLoader = useMinLoadingDisplay(spacePending, WORKSPACE_LOADER_MIN_MS);

  if (authLoading) {
    return <CanvasLoadingShell caption="Connecting…" />;
  }
  if (!userId) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/signin?redirect=${redirect}`} replace />;
  }

  if (explicitRouteInvalid) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-[var(--canvas-bg)] px-6 text-center text-muted-foreground">
        <p className="text-foreground">Invalid workspace link</p>
        <p className="max-w-md text-sm">The URL does not contain a valid space id.</p>
        <Link
          to="/"
          className="text-sm font-medium text-[var(--accent-color)] underline-offset-4 hover:underline"
        >
          Open default workspace
        </Link>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-[var(--canvas-bg)] px-6 text-center text-muted-foreground">
        <p className="text-foreground">Could not load workspace.</p>
        <p className="max-w-md text-sm">
          Check that you are signed in and that Supabase email auth is enabled. Try{' '}
          <Link to="/signin" className="font-medium text-[var(--accent-color)] underline-offset-4 hover:underline">
            signing in again
          </Link>
          .
        </p>
        <p className="text-xs opacity-70">{String((error as Error)?.message ?? error)}</p>
        <Link
          to="/"
          className="text-sm font-medium text-[var(--accent-color)] underline-offset-4 hover:underline"
        >
          Try default workspace
        </Link>
      </div>
    );
  }

  if (holdWorkspaceFetchLoader) {
    return (
      <CanvasLoadingShell
        caption={needsSpaceRedirect ? 'Opening workspace…' : 'Loading workspace…'}
      />
    );
  }

  if (spaceMissing) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-[var(--canvas-bg)] px-6 text-center text-muted-foreground">
        <p className="text-foreground">Workspace not found</p>
        <p className="max-w-md text-sm">
          No space with this id is visible to your account. The id may be wrong, the space may belong
          to another user, or you may need to{' '}
          <Link to="/signin" className="font-medium text-[var(--accent-color)] underline-offset-4 hover:underline">
            sign in
          </Link>{' '}
          with a different account.
        </p>
        <Link
          to="/"
          className="text-sm font-medium text-[var(--accent-color)] underline-offset-4 hover:underline"
        >
          Open default workspace
        </Link>
      </div>
    );
  }

  if (!space) {
    return <CanvasLoadingShell caption="Loading workspace…" />;
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
    void shouldRestoreDraftFromLocal(space.id, space.updated_at, space).then((d) => {
      if (!cancelled) setDraftBoot({ draft: d, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, [space.id, space.updated_at]);

  const draftPending = !draftBoot.ready;
  const holdDraftLoader = useMinLoadingDisplay(draftPending, WORKSPACE_LOADER_MIN_MS);

  if (holdDraftLoader) {
    return <CanvasLoadingShell caption="Loading workspace…" />;
  }

  const serverMs = Date.parse(space.updated_at);
  const initialLastWriteAt =
    draftBoot.draft?.clientUpdatedAt ?? (Number.isNaN(serverMs) ? Date.now() : serverMs);

  return (
    <CanvasInnerReactFlow
      space={space}
      resolvedDraft={draftBoot.draft}
      initialLastWriteAt={initialLastWriteAt}
      hybridBackground={readVfHybridBoardEnabled()}
    />
  );
}

function Index() {
  const [entrySplash, setEntrySplash] = useState(!canvasPerfFlags.fastStartupMode);
  useEffect(() => {
    if (canvasPerfFlags.fastStartupMode) return;
    const t = setTimeout(() => setEntrySplash(false), ENTRY_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence mode="wait">
      {entrySplash ? (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'hsl(var(--background))' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <BeLiveLoader size="lg" />
        </motion.div>
      ) : (
        <motion.div
          key="canvas"
          className="h-full w-full min-h-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <ReactFlowProvider>
            <CanvasRoot />
          </ReactFlowProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Index;
