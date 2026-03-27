import { create } from 'zustand';
import { type Node, type Edge, type XYPosition } from 'reactflow';
import {
  type ScoutPipelineState,
  DEFAULT_SCOUT_PIPELINE,
  applyScoutStaleOnDataChange,
  canRunScoutNode,
} from '@/lib/scoutPipeline';
import { executeScoutNode, type ScoutRunOptions } from '@/lib/scoutRunCoordinator';
import { richTextToPlainForScout } from '@/lib/richTextForScout';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/systemNotify';
import { computeReactivePatchesFromSources } from '@/lib/nodeDataflow';
import {
  DEFAULT_GROUP_H,
  DEFAULT_GROUP_W,
  MAX_STACK,
  SCOUT_REMOTE_EXECUTION_TYPES,
  UPDATE_NODE_DATA_DEBOUNCE_MS,
} from '@/stores/workflowStore.constants';
import {
  applyGroupDropReparent,
  bfsDownstream,
  capStack,
  edgesBetweenLevels,
  nodeDragSnapshotEqual,
  topologicalOrderIdsForTypes,
  unionEdgeIdsByRunSource,
} from '@/stores/workflowGraphUtils';
import { createVirtualProductionScoutTemplate } from '@/stores/workflowScoutTemplate';
import { migrateEdgesToScopedHandles } from '@/lib/portHandles';
export type { ScoutPipelineState } from '@/lib/scoutPipeline';
export type { ScoutRunOptions } from '@/lib/scoutRunCoordinator';
const pendingNodeDataUpdates = new Map<
  string,
  { timeoutId: number; before: Record<string, unknown>; keys: string[] }
>();

function withTransientNodeDataStripped(node: Node): Node {
  if (!node.data || typeof node.data !== 'object') return node;
  if (!('_animateEntrance' in node.data)) return node;
  const nextData = { ...(node.data as Record<string, unknown>) };
  delete nextData._animateEntrance;
  return { ...node, data: nextData };
}

// ── Types ──────────────────────────────────────────────

export type NodeType =
  | 'textNode'
  | 'uploadNode'
  | 'assistantNode'
  | 'imageGeneratorNode'
  | 'imageVariationsNode'
  | 'videoGeneratorNode'
  | 'imageUpscalerNode'
  | 'listNode'
  | 'propsInputNode'
  | 'angleVariationsNode'
  | 'angleVariationsListNode'
  | 'selectedShotNode'
  | 'annotationNode'
  | 'setDressingNode'
  | 'lightingScenarioNode'
  | 'atmosphereTestNode'
  | 'placementRefNode'
  | 'group';

export type SelectedTool =
  | 'select'
  | 'hand'
  | 'connection'
  | 'cut'
  | 'draw'
  | 'comment'
  | 'sticker'
  | 'stickyNote';

export type GridLayout = '1x1' | '2x2' | '3x3';

export interface Comment {
  id: string;
  x: number;
  y: number;
  text: string;
  resolved: boolean;
  author: string;
}

export interface ContextMenu {
  x: number;
  y: number;
  type: 'canvas' | 'node';
  targetId?: string;
}

export interface WorkflowSettings {
  helperLines: boolean;
  videoAutoplay: boolean;
  performanceMode: boolean;
  richTooltips: boolean;
  experimentalTools: boolean;
  edgePathType: 'bezier' | 'palma';
  mouseWheelBehavior: 'pan' | 'zoom';
  darkMode: boolean;
  showMinimap: boolean;
  edgeAnimation: boolean;
  showNodeLabels: boolean;
  canvasPattern: 'dots' | 'grid' | 'lines' | 'none';
  /** Animated pointer trails on the canvas (can reduce distraction when off). */
  canvasCursorTrails: boolean;
}

/** Default settings for new sessions and for merging with persisted `space.settings`. */
export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  helperLines: true,
  videoAutoplay: true,
  performanceMode: false,
  richTooltips: true,
  experimentalTools: false,
  edgePathType: 'bezier',
  mouseWheelBehavior: 'zoom',
  darkMode: true,
  showMinimap: false,
  edgeAnimation: true,
  showNodeLabels: true,
  canvasPattern: 'dots',
  canvasCursorTrails: true,
};

const WORKFLOW_SETTINGS_STORAGE_KEY = 'vision-forge.workflow-settings.v1';

function readPersistedWorkflowSettings(): Partial<WorkflowSettings> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(WORKFLOW_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const r = o as Record<string, unknown>;
    const out: Partial<WorkflowSettings> = {};
    if (typeof r.helperLines === 'boolean') out.helperLines = r.helperLines;
    if (typeof r.videoAutoplay === 'boolean') out.videoAutoplay = r.videoAutoplay;
    if (typeof r.performanceMode === 'boolean') out.performanceMode = r.performanceMode;
    if (typeof r.richTooltips === 'boolean') out.richTooltips = r.richTooltips;
    if (typeof r.experimentalTools === 'boolean') out.experimentalTools = r.experimentalTools;
    if (typeof r.darkMode === 'boolean') out.darkMode = r.darkMode;
    if (typeof r.showMinimap === 'boolean') out.showMinimap = r.showMinimap;
    if (typeof r.edgeAnimation === 'boolean') out.edgeAnimation = r.edgeAnimation;
    if (typeof r.showNodeLabels === 'boolean') out.showNodeLabels = r.showNodeLabels;
    if (typeof r.canvasCursorTrails === 'boolean') out.canvasCursorTrails = r.canvasCursorTrails;
    if (r.edgePathType === 'bezier' || r.edgePathType === 'palma')
      out.edgePathType = r.edgePathType;
    if (r.mouseWheelBehavior === 'pan' || r.mouseWheelBehavior === 'zoom')
      out.mouseWheelBehavior = r.mouseWheelBehavior;
    if (r.canvasPattern === 'dots' || r.canvasPattern === 'grid' || r.canvasPattern === 'lines' || r.canvasPattern === 'none')
      out.canvasPattern = r.canvasPattern;
    return out;
  } catch {
    return {};
  }
}

function writePersistedWorkflowSettings(settings: WorkflowSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(WORKFLOW_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* quota / private mode */
  }
}

/** Command: execute = redo forward, undo = revert */
export interface CanvasCommand {
  execute: () => void;
  undo: () => void;
}

interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
  comments: Comment[];
}

/** Payload from Supabase `spaces` row (hydrate without undo history) */
export interface HydratableSpace {
  id: string;
  nodes: Node[];
  edges: Edge[];
  comments?: Comment[];
  settings?: Partial<WorkflowSettings> | null;
  node_grid_layouts?: Record<string, GridLayout>;
}

export interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  comments: Comment[];
  runningNodes: Set<string>;
  runningEdges: Set<string>;
  /** Per `runFromNode` root id: edge ids for that run (unioned into `runningEdges`). */
  runningEdgeIdsByRunSource: Record<string, string[]>;
  selectedTool: SelectedTool;
  settings: WorkflowSettings;
  pastStack: CanvasCommand[];
  futureStack: CanvasCommand[];
  isDragging: boolean;

  hoveredNodeId: string | null;
  hoveredImageCell: { nodeId: string; cellIndex: number } | null;
  nodeGridLayouts: Record<string, GridLayout>;
  contextMenu: ContextMenu | null;
  nodesClipboard: Node[] | null;

  focusedNodeContentId: string | null;
  setFocusedNodeContentId: (id: string | null) => void;
  currentSpaceId: string | null;
  lastViewport: { x: number; y: number; zoom: number };
  setLastViewport: (v: { x: number; y: number; zoom: number }) => void;
  hydrateFromSpace: (space: HydratableSpace & { viewport?: { x: number; y: number; zoom: number } | null }) => void;
  /** Merge graph/comments/settings from a row returned after save — preserves undo, scout pipeline, running state, focus. */
  applySavedSpaceRowToStore: (
    space: HydratableSpace & { viewport?: { x: number; y: number; zoom: number } | null }
  ) => void;

  setNodesSilently: (nodes: Node[]) => void;
  setEdgesSilently: (edges: Edge[]) => void;
  pushSelectionCommand: (
    prevNodes: Node[],
    prevEdges: Edge[],
    nextNodes: Node[],
    nextEdges: Edge[]
  ) => void;
  commitNodesAfterDrag: (nodes: Node[], deltas: Record<string, { from: XYPosition; to: XYPosition }>) => void;
  /** Full graph undo after drag + optional group reparent (replaces commitNodesAfterDrag when used). */
  commitNodesAfterFlowDrag: (beforeNodes: Node[], afterNodes: Node[]) => void;
  connectEdgeWithHistory: (nextEdges: Edge[], newEdge: Edge) => void;
  applyEdgeRemoval: (nextEdges: Edge[], removed: Edge[]) => void;
  removeEdgeById: (id: string) => void;

  groupSelectedNodes: (color?: string) => void;
  ungroupSelectedNodes: () => void;

  addNode: (type: NodeType, position: XYPosition, data?: Record<string, unknown>) => string;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  lockNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  updateNodeDataSilent: (id: string, data: Partial<Record<string, unknown>>) => void;
  commitNodeLabelRename: (
    id: string,
    nextTrimmed: string,
    before: { labelText?: unknown; title?: unknown }
  ) => void;
  restoreNodeLabelSnapshot: (id: string, before: { labelText?: unknown; title?: unknown }) => void;

  runFromNode: (id: string, options?: ScoutRunOptions) => void;
  runAll: () => void;

  /** Virtual Production Scout pipeline orchestration */
  scoutPipeline: ScoutPipelineState;
  setScoutPipeline: (partial: Partial<ScoutPipelineState>) => void;
  approveStage2Pipeline: () => void;
  clearStage2Stale: () => void;
  setSelectedShotCommitted: (committed: boolean) => void;
  finalizeScoutDeliverable: (payload: NonNullable<ScoutPipelineState['finalDeliverable']>) => void;
  clearScoutFinalDeliverable: () => void;

  setSelectedTool: (tool: SelectedTool) => void;
  setIsDragging: (dragging: boolean) => void;

  setHoveredNode: (id: string | null) => void;
  setHoveredImageCell: (cell: { nodeId: string; cellIndex: number } | null) => void;
  toggleGridLayout: (nodeId: string) => void;
  setContextMenu: (menu: ContextMenu | null) => void;

  addComment: (x: number, y: number, author?: string) => void;
  updateComment: (id: string, text: string) => void;
  resolveComment: (id: string) => void;
  deleteComment: (id: string) => void;

  updateSettings: (s: Partial<WorkflowSettings>) => void;

  undo: () => void;
  redo: () => void;

  loadTemplate: (nodes: Node[], edges: Edge[]) => void;

  copyNodesByIds: (ids: string[]) => void;
  pasteClipboard: (offset?: XYPosition) => void;
}

const GRID_CYCLE: GridLayout[] = ['1x1', '2x2', '3x3'];
let runAllInFlight = false;
export { createVirtualProductionScoutTemplate } from '@/stores/workflowScoutTemplate';
export { applyGroupDropReparent } from '@/stores/workflowGraphUtils';

export const useWorkflowStore = create<WorkflowState>((set, get) => {
  const initialTemplate = createVirtualProductionScoutTemplate();

  const pushCmd = (cmd: CanvasCommand) => {
    set((s) => ({
      pastStack: capStack([...s.pastStack, cmd], MAX_STACK),
      futureStack: [],
    }));
  };

  const applyReactiveDataflow = (changedSourceIds: string[], fullRecompute = false) => {
    const s = get();
    const sourceIds =
      fullRecompute ? s.nodes.map((n) => n.id) : [...new Set(changedSourceIds.filter(Boolean))];
    if (sourceIds.length === 0) return;
    const patches = computeReactivePatchesFromSources(sourceIds, s.nodes, s.edges);
    if (Object.keys(patches).length === 0) return;
    set((st) => {
      let changed = false;
      let nextPipeline = st.scoutPipeline;
      const nextNodes = st.nodes.map((node) => {
        const patch = patches[node.id];
        if (!patch) return node;
        if (st.runningNodes.has(node.id)) return node;
        const keys = Object.keys(patch);
        const hasAnyChange = keys.some((k) => node.data?.[k] !== patch[k]);
        if (!hasAnyChange) return node;
        changed = true;
        if (get().settings.experimentalTools) {
          if (node.type === 'imageGeneratorNode' && patch.prompt != null) {
            const plen = String(patch.prompt).length;
            console.debug('[Scout]', 'Dataflow: image generator prompt updated', { nodeId: node.id, chars: plen });
          }
        }
        nextPipeline = applyScoutStaleOnDataChange(nextPipeline, node.type, keys);
        return { ...node, data: { ...node.data, ...patch } };
      });
      if (!changed) return st;
      return { nodes: nextNodes, scoutPipeline: nextPipeline };
    });
  };

  const runScoutRemoteOnce = async (
    nodeId: string,
    options?: ScoutRunOptions,
    batchOpts?: { suppressFailureToast?: boolean }
  ): Promise<{ ok: boolean; reason?: string }> => {
    const s = get();
    const guard = canRunScoutNode(s.nodes, s.scoutPipeline, nodeId);
    if (!guard.ok) return { ok: false, reason: guard.reason };
    const node = s.nodes.find((n) => n.id === nodeId);
    if (!node || !SCOUT_REMOTE_EXECUTION_TYPES.has(node.type)) {
      return { ok: false, reason: 'Not a Scout execution node' };
    }

    const levels = bfsDownstream(nodeId, s.edges);
    const affectedEdgeIds = edgesBetweenLevels(levels, s.edges);
    set((st) => {
      const reg = { ...st.runningEdgeIdsByRunSource, [nodeId]: affectedEdgeIds };
      return {
        runningEdgeIdsByRunSource: reg,
        runningEdges: unionEdgeIdsByRunSource(reg),
        runningNodes: new Set([...st.runningNodes, nodeId]),
      };
    });

    const clearRunning = () => {
      set((st) => {
        const rn = new Set(st.runningNodes);
        rn.delete(nodeId);
        const { [nodeId]: _removed, ...rest } = st.runningEdgeIdsByRunSource;
        return {
          runningNodes: rn,
          runningEdgeIdsByRunSource: rest,
          runningEdges: unionEdgeIdsByRunSource(rest),
        };
      });
    };

    try {
      const r = await executeScoutNode({
        nodeId,
        nodes: get().nodes,
        edges: get().edges,
        pipeline: get().scoutPipeline,
        getGridLayout: (nid) => get().nodeGridLayouts[nid] ?? '2x2',
        updateNodeData: (nid, data) => get().updateNodeData(nid, data),
        options,
        experimentalDebug: get().settings.experimentalTools,
      });

      if (!r.ok && !batchOpts?.suppressFailureToast) {
        const sub = r.reason ?? 'Scout run failed';
        notifyError(
          'Scout run failed',
          sub.length > 800 ? `${sub.slice(0, 800)}…` : sub
        );
      }
      return r;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!batchOpts?.suppressFailureToast) {
        notifyError('Scout run failed', msg.length > 800 ? `${msg.slice(0, 800)}…` : msg);
      }
      return { ok: false, reason: msg };
    } finally {
      clearRunning();
    }
  };

  return {
    nodes: initialTemplate.nodes,
    edges: migrateEdgesToScopedHandles(structuredClone(initialTemplate.edges)),
    comments: [],
    runningNodes: new Set(),
    runningEdges: new Set(),
    runningEdgeIdsByRunSource: {},
    selectedTool: 'select',
    isDragging: false,
    hoveredNodeId: null,
    hoveredImageCell: null,
    nodeGridLayouts: {},
    contextMenu: null,
    settings: { ...DEFAULT_WORKFLOW_SETTINGS, ...readPersistedWorkflowSettings() },
    nodesClipboard: null,
    focusedNodeContentId: null,
    currentSpaceId: null,
    lastViewport: { x: 0, y: 0, zoom: 1 },
    pastStack: [],
    futureStack: [],

    scoutPipeline: { ...DEFAULT_SCOUT_PIPELINE },

    setScoutPipeline: (partial) =>
      set((s) => ({ scoutPipeline: { ...s.scoutPipeline, ...partial } })),

    approveStage2Pipeline: () =>
      set((s) => ({
        scoutPipeline: {
          ...s.scoutPipeline,
          stage2Approved: true,
          stage2Stale: false,
        },
      })),

    clearStage2Stale: () =>
      set((s) => ({ scoutPipeline: { ...s.scoutPipeline, stage2Stale: false } })),

    setSelectedShotCommitted: (committed) =>
      set((s) => ({
        scoutPipeline: {
          ...s.scoutPipeline,
          selectedShotCommitted: committed,
          ...(committed
            ? {}
            : { stage4Stale: false, stage5Stale: false, finalAtmosphereSelected: false }),
        },
      })),

    finalizeScoutDeliverable: (payload) =>
      set((s) => ({
        scoutPipeline: {
          ...s.scoutPipeline,
          finalDeliverable: payload,
          finalAtmosphereSelected: true,
          stage5Stale: false,
        },
      })),

    clearScoutFinalDeliverable: () =>
      set((s) => ({
        scoutPipeline: {
          ...s.scoutPipeline,
          finalDeliverable: null,
          finalAtmosphereSelected: false,
        },
      })),

    setFocusedNodeContentId: (id) => set({ focusedNodeContentId: id }),
    setLastViewport: (v) => set({ lastViewport: v }),

    hydrateFromSpace: (space) => {
      const baseSettings = get().settings;
      const merged: WorkflowSettings = {
        ...baseSettings,
        ...(space.settings && typeof space.settings === 'object' ? space.settings : {}),
      };
      const vp = space.viewport ?? { x: 0, y: 0, zoom: 1 };
      set({
        nodes: structuredClone(space.nodes).map(withTransientNodeDataStripped),
        edges: migrateEdgesToScopedHandles(structuredClone(space.edges)),
        comments: structuredClone(space.comments || []),
        nodeGridLayouts: structuredClone(space.node_grid_layouts || {}),
        settings: merged,
        currentSpaceId: space.id,
        lastViewport: vp,
        pastStack: [],
        futureStack: [],
        runningNodes: new Set(),
        runningEdges: new Set(),
        runningEdgeIdsByRunSource: {},
        focusedNodeContentId: null,
        scoutPipeline: { ...DEFAULT_SCOUT_PIPELINE },
      });
      document.body.setAttribute('data-theme', merged.darkMode ? 'dark' : 'light');
      document.body.setAttribute('data-performance', String(merged.performanceMode));
    },

    applySavedSpaceRowToStore: (space) => {
      const st = get();
      const baseSettings = st.settings;
      const merged: WorkflowSettings = {
        ...baseSettings,
        ...(space.settings && typeof space.settings === 'object' ? space.settings : {}),
      };
      const vp = space.viewport ?? st.lastViewport;
      const byId = new Map(st.nodes.map((n) => [n.id, n]));
      const nextNodes = space.nodes.map((sn) => {
        const live = byId.get(sn.id);
        return {
          ...withTransientNodeDataStripped(structuredClone(sn)),
          selected: live?.selected ?? false,
          dragging: false,
          resizing: false,
        };
      });
      const byEid = new Map(st.edges.map((e) => [e.id, e]));
      const nextEdges = migrateEdgesToScopedHandles(space.edges).map((se) => {
        const live = byEid.get(se.id);
        return { ...structuredClone(se), selected: live?.selected ?? false };
      });
      set({
        nodes: nextNodes,
        edges: nextEdges,
        comments: structuredClone(space.comments || []),
        nodeGridLayouts: structuredClone(space.node_grid_layouts || {}),
        settings: merged,
        currentSpaceId: space.id,
        lastViewport: vp,
      });
      document.body.setAttribute('data-theme', merged.darkMode ? 'dark' : 'light');
      document.body.setAttribute('data-performance', String(merged.performanceMode));
      applyReactiveDataflow([], true);
    },

    /** Sync from React Flow without undo (selection, resize). Full dataflow here caused stalls when selection fired in tight loops. */
    setNodesSilently: (nodes) => {
      set({ nodes });
    },
    setEdgesSilently: (edges) => {
      set({ edges });
    },

    pushSelectionCommand: (prevNodes, prevEdges, nextNodes, nextEdges) => {
      const prev = {
        nodes: structuredClone(prevNodes),
        edges: structuredClone(prevEdges),
      };
      const next = {
        nodes: structuredClone(nextNodes),
        edges: structuredClone(nextEdges),
      };
      set({ nodes: next.nodes, edges: next.edges });
      pushCmd({
        undo: () => set({ nodes: prev.nodes, edges: prev.edges }),
        execute: () => set({ nodes: next.nodes, edges: next.edges }),
      });
    },

    commitNodesAfterDrag: (nodes, deltas) => {
      set({ nodes });
      const ids = Object.keys(deltas);
      if (ids.length === 0) return;
      pushCmd({
        undo: () =>
          set((st) => ({
            nodes: st.nodes.map((n) =>
              deltas[n.id] ? { ...n, position: { ...deltas[n.id].from } } : n
            ),
          })),
        execute: () =>
          set((st) => ({
            nodes: st.nodes.map((n) =>
              deltas[n.id] ? { ...n, position: { ...deltas[n.id].to } } : n
            ),
          })),
      });
    },

    commitNodesAfterFlowDrag: (beforeNodes, afterNodes) => {
      const before = structuredClone(beforeNodes);
      const after = structuredClone(afterNodes);
      if (nodeDragSnapshotEqual(before, after)) return;
      set({ nodes: after });
      pushCmd({
        undo: () => set({ nodes: structuredClone(before) }),
        execute: () => set({ nodes: structuredClone(after) }),
      });
    },

    connectEdgeWithHistory: (nextEdges, newEdge) => {
      const edge = structuredClone(newEdge);
      set({ edges: nextEdges });
      // Let the connect interaction paint first, then propagate downstream patches.
      queueMicrotask(() => {
        applyReactiveDataflow([edge.source]);
      });
      pushCmd({
        undo: () => set((st) => ({ edges: st.edges.filter((e) => e.id !== edge.id) })),
        execute: () => set((st) => ({ edges: [...st.edges, structuredClone(edge)] })),
      });
    },

    applyEdgeRemoval: (nextEdges, removed) => {
      if (removed.length === 0) {
        set({ edges: nextEdges });
        return;
      }
      const clones = removed.map((e) => structuredClone(e));
      set({ edges: nextEdges });
      applyReactiveDataflow([], true);
      pushCmd({
        undo: () => set((st) => ({ edges: [...st.edges, ...clones.map((c) => structuredClone(c))] })),
        execute: () =>
          set((st) => ({
            edges: st.edges.filter((e) => !clones.some((r) => r.id === e.id)),
          })),
      });
    },

    removeEdgeById: (id) => {
      const s = get();
      const edge = s.edges.find((e) => e.id === id);
      if (!edge) return;
      const clone = structuredClone(edge);
      set({ edges: s.edges.filter((e) => e.id !== id) });
      applyReactiveDataflow([], true);
      pushCmd({
        undo: () => set((st) => ({ edges: [...st.edges, structuredClone(clone)] })),
        execute: () => set((st) => ({ edges: st.edges.filter((e) => e.id !== id) })),
      });
    },

    setIsDragging: (dragging) => set({ isDragging: dragging }),

    setHoveredNode: (id) => set({ hoveredNodeId: id }),
    setHoveredImageCell: (cell) => set({ hoveredImageCell: cell }),
    setContextMenu: (menu) => set({ contextMenu: menu }),

    toggleGridLayout: (nodeId) => {
      const s = get();
      const current = s.nodeGridLayouts[nodeId] || '2x2';
      const idx = GRID_CYCLE.indexOf(current);
      const next = GRID_CYCLE[(idx + 1) % GRID_CYCLE.length];
      set({ nodeGridLayouts: { ...s.nodeGridLayouts, [nodeId]: next } });
      pushCmd({
        undo: () =>
          set((st) => ({
            nodeGridLayouts: { ...st.nodeGridLayouts, [nodeId]: current },
          })),
        execute: () =>
          set((st) => ({
            nodeGridLayouts: { ...st.nodeGridLayouts, [nodeId]: next },
          })),
      });
    },

    addNode: (type, position, data = {}) => {
      const s = get();
      const id = `${type.replace('Node', '')}-${Date.now()}`;
      const withEntrance = { ...data, _animateEntrance: true };
      const newNode: Node =
        type === 'group'
          ? {
              id,
              type: 'group',
              position,
              data: { labelText: 'Group', ...withEntrance },
              style: { width: DEFAULT_GROUP_W, height: DEFAULT_GROUP_H },
              draggable: true,
              selectable: true,
            }
          : { id, type, position, data: withEntrance };
      set({ nodes: [...s.nodes, newNode] });
      applyReactiveDataflow([id]);
      pushCmd({
        undo: () => set((st) => ({ nodes: st.nodes.filter((n) => n.id !== id) })),
        execute: () => set((st) => ({ nodes: [...st.nodes, structuredClone(newNode)] })),
      });
      return id;
    },

    groupSelectedNodes: (color?: string) => {
      const s = get();
      const selected = s.nodes.filter((n) => n.selected && !n.parentId && n.type !== 'group');
      if (selected.length === 0) return;

      const DEFAULT_NODE_WIDTH = 280;
      const DEFAULT_NODE_HEIGHT = 120;
      const GROUP_PADDING = 24;

      const widths = selected.map((n) =>
        typeof n.width === 'number' && n.width > 0 ? n.width : DEFAULT_NODE_WIDTH
      );
      const heights = selected.map((n) =>
        typeof n.height === 'number' && n.height > 0 ? n.height : DEFAULT_NODE_HEIGHT
      );

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < selected.length; i++) {
        const n = selected[i];
        const w = widths[i];
        const h = heights[i];
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }

      const groupX = minX - GROUP_PADDING;
      const groupY = minY - GROUP_PADDING;
      const groupW = Math.max(1, maxX - minX + GROUP_PADDING * 2);
      const groupH = Math.max(1, maxY - minY + GROUP_PADDING * 2);

      const groupId = `group-${Date.now()}`;

      const beforeNodes = structuredClone(s.nodes);
      const beforeEdges = structuredClone(s.edges);

      const groupNode: Node = {
        id: groupId,
        type: 'group',
        position: { x: groupX, y: groupY },
        data: { labelText: 'Group', ...(color != null ? { color } : {}) },
        style: { width: groupW, height: groupH },
        selected: true,
        draggable: true,
        selectable: true,
      };

      const selectedIds = new Set(selected.map((n) => n.id));
      const children = selected.map((child) => ({
        ...structuredClone(child),
        parentId: groupId,
        extent: 'parent' as const,
        position: { x: child.position.x - groupX, y: child.position.y - groupY },
        selected: false,
      }));

      // Keep all non-selected nodes (including existing groups); deselect everything except the newly created group.
      const nextNodesBase = s.nodes.filter((n) => !selectedIds.has(n.id));
      const nextNodes = [
        ...nextNodesBase.map((n) => ({ ...n, selected: false })),
        groupNode,
        ...children,
      ];

      set({ nodes: structuredClone(nextNodes), edges: structuredClone(s.edges) });
      pushCmd({
        undo: () => set({ nodes: beforeNodes, edges: beforeEdges }),
        execute: () => set({ nodes: structuredClone(nextNodes), edges: structuredClone(beforeEdges) }),
      });
    },

    ungroupSelectedNodes: () => {
      const s = get();
      const selectedGroups = s.nodes.filter((n) => n.selected && n.type === 'group');
      if (selectedGroups.length === 0) return;

      const beforeNodes = structuredClone(s.nodes);
      const beforeEdges = structuredClone(s.edges);

      const groupIds = new Set(selectedGroups.map((g) => g.id));

      const updatedChildById = new Map<string, Node>();
      for (const group of selectedGroups) {
        for (const child of s.nodes) {
          if (child.parentId !== group.id) continue;
          updatedChildById.set(child.id, {
            ...structuredClone(child),
            parentId: undefined,
            extent: undefined,
            position: { x: child.position.x + group.position.x, y: child.position.y + group.position.y },
            selected: true,
          });
        }
      }

      const nextNodes = s.nodes
        .filter((n) => !groupIds.has(n.id))
        .map((n) => {
          const updated = updatedChildById.get(n.id);
          if (updated) return updated;
          return { ...n, selected: false };
        });

      set({ nodes: structuredClone(nextNodes), edges: structuredClone(s.edges) });
      pushCmd({
        undo: () => set({ nodes: beforeNodes, edges: beforeEdges }),
        execute: () => set({ nodes: structuredClone(nextNodes), edges: structuredClone(beforeEdges) }),
      });
    },

    deleteNode: (id) => {
      const s = get();
      const node = s.nodes.find((n) => n.id === id);
      if (!node) return;

      const beforeNodes = structuredClone(s.nodes);
      const beforeEdges = structuredClone(s.edges);

      const nextNodes = s.nodes.filter((n) => n.id !== id).map((n) => {
        // If deleting a group, detach its children so their position remains correct in absolute space.
        if (node.type === 'group' && n.parentId === id) {
          return {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: { x: n.position.x + node.position.x, y: n.position.y + node.position.y },
            selected: false,
          };
        }
        return n;
      });
      const nextEdges = s.edges.filter((e) => e.source !== id && e.target !== id);

      set({ nodes: structuredClone(nextNodes), edges: structuredClone(nextEdges) });
      applyReactiveDataflow([], true);
      pushCmd({
        undo: () => set({ nodes: beforeNodes, edges: beforeEdges }),
        execute: () => set({ nodes: structuredClone(nextNodes), edges: structuredClone(nextEdges) }),
      });
    },

    duplicateNode: (id) => {
      const s = get();
      const node = s.nodes.find((n) => n.id === id);
      if (!node) return;
      const dup: Node = {
        ...structuredClone(node),
        id: `${node.type}-${Date.now()}`,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
      };
      set({ nodes: [...s.nodes, dup] });
      const dupId = dup.id;
      const dupSnap = structuredClone(dup);
      pushCmd({
        undo: () => set((st) => ({ nodes: st.nodes.filter((n) => n.id !== dupId) })),
        execute: () => set((st) => ({ nodes: [...st.nodes, structuredClone(dupSnap)] })),
      });
    },

    lockNode: (id) => {
      const s = get();
      const n = s.nodes.find((x) => x.id === id);
      if (!n) return;
      const wasLocked = n.draggable === false;
      const nextLocked = !wasLocked;
      set({
        nodes: s.nodes.map((x) =>
          x.id === id ? { ...x, draggable: nextLocked ? false : undefined } : x
        ),
      });
      pushCmd({
        undo: () =>
          set((st) => ({
            nodes: st.nodes.map((x) =>
              x.id === id ? { ...x, draggable: wasLocked ? false : undefined } : x
            ),
          })),
        execute: () =>
          set((st) => ({
            nodes: st.nodes.map((x) =>
              x.id === id ? { ...x, draggable: nextLocked ? false : undefined } : x
            ),
          })),
      });
    },

    updateNodeData: (id, data) => {
      const s = get();
      const n = s.nodes.find((x) => x.id === id);
      if (!n) return;
      const keys = Object.keys(data) as string[];

      // Apply immediately so UI stays responsive; update Scout stale flags
      set((st) => {
        const nextNodes = st.nodes.map((x) =>
          x.id === id ? { ...x, data: { ...x.data, ...data } } : x
        );
        const scoutPipeline = applyScoutStaleOnDataChange(st.scoutPipeline, n.type, keys);
        return { nodes: nextNodes, scoutPipeline };
      });
      const reactiveSources = [id, n.parentId].filter((x): x is string => Boolean(x));
      applyReactiveDataflow(reactiveSources);

      const existing = pendingNodeDataUpdates.get(id);
      if (existing) {
        clearTimeout(existing.timeoutId);
        const current = get().nodes.find((x) => x.id === id);
        if (current) {
          keys.forEach((k) => {
            if (!(k in existing.before)) {
              existing.before[k] = current.data[k];
              existing.keys.push(k);
            }
          });
        }
      } else {
        const before: Record<string, unknown> = {};
        keys.forEach((k) => {
          before[k] = n.data[k];
        });
        pendingNodeDataUpdates.set(id, { timeoutId: 0, before, keys: [...keys] });
      }

      const timeoutId = window.setTimeout(() => {
        const entry = pendingNodeDataUpdates.get(id);
        if (!entry) return;
        pendingNodeDataUpdates.delete(id);

        const current = get().nodes.find((x) => x.id === id);
        if (!current) return;
        const after: Record<string, unknown> = {};
        entry.keys.forEach((k) => {
          after[k] = current.data[k];
        });

        pushCmd({
          undo: () =>
            set((st) => ({
              nodes: st.nodes.map((x) => {
                if (x.id !== id) return x;
                const nextData = { ...x.data };
                entry.keys.forEach((k) => {
                  if (entry.before[k] === undefined) delete nextData[k];
                  else nextData[k] = entry.before[k];
                });
                return { ...x, data: nextData };
              }),
            })),
          execute: () =>
            set((st) => ({
              nodes: st.nodes.map((x) => {
                if (x.id !== id) return x;
                const nextData = { ...x.data };
                entry.keys.forEach((k) => {
                  if (after[k] === undefined) delete nextData[k];
                  else nextData[k] = after[k];
                });
                return { ...x, data: nextData };
              }),
            })),
        });
      }, UPDATE_NODE_DATA_DEBOUNCE_MS);

      pendingNodeDataUpdates.get(id)!.timeoutId = timeoutId;
    },

    updateNodeDataSilent: (id, data) => {
      const s = get();
      if (!s.nodes.some((x) => x.id === id)) return;
      const n = s.nodes.find((x) => x.id === id);
      const keys = Object.keys(data) as string[];
      set((st) => {
        const nextNodes = st.nodes.map((x) =>
          x.id === id ? { ...x, data: { ...x.data, ...data } } : x
        );
        const scoutPipeline = n
          ? applyScoutStaleOnDataChange(st.scoutPipeline, n.type, keys)
          : st.scoutPipeline;
        return { nodes: nextNodes, scoutPipeline };
      });
      applyReactiveDataflow([id]);
    },

    commitNodeLabelRename: (id, nextTrimmed, before) => {
      const s = get();
      const n = s.nodes.find((x) => x.id === id);
      if (!n) return;
      const prevDisplay = String(before.labelText ?? before.title ?? '').trim();

      const snap = {
        labelText: before.labelText,
        title: before.title,
      };

      const applyFinal = (nodes: Node[]) =>
        nodes.map((x) => {
          if (x.id !== id) return x;
          const d = { ...x.data };
          if (nextTrimmed === '') delete d.labelText;
          else d.labelText = nextTrimmed;
          return { ...x, data: d };
        });

      const applyBefore = (nodes: Node[]) =>
        nodes.map((x) => {
          if (x.id !== id) return x;
          const d = { ...x.data };
          if (snap.labelText === undefined) delete d.labelText;
          else d.labelText = snap.labelText;
          if (snap.title === undefined) delete d.title;
          else d.title = snap.title;
          return { ...x, data: d };
        });

      if (prevDisplay === nextTrimmed) {
        set({ nodes: applyFinal(s.nodes) });
        return;
      }

      set({ nodes: applyFinal(s.nodes) });
      pushCmd({
        undo: () => set((st) => ({ nodes: applyBefore(st.nodes) })),
        execute: () => set((st) => ({ nodes: applyFinal(st.nodes) })),
      });
    },

    restoreNodeLabelSnapshot: (id, before) => {
      set((st) => ({
        nodes: st.nodes.map((x) => {
          if (x.id !== id) return x;
          const d = { ...x.data };
          if (before.labelText === undefined) delete d.labelText;
          else d.labelText = before.labelText;
          if (before.title === undefined) delete d.title;
          else d.title = before.title;
          return { ...x, data: d };
        }),
      }));
    },

    runFromNode: (id, options) => {
      const s = get();
      const guard = canRunScoutNode(s.nodes, s.scoutPipeline, id);
      if (!guard.ok) {
        notifyInfo('Run blocked', guard.reason ?? 'Cannot run this node yet.');
        return;
      }
      const node = s.nodes.find((n) => n.id === id);
      if (node && SCOUT_REMOTE_EXECUTION_TYPES.has(node.type)) {
        void runScoutRemoteOnce(id, options);
        return;
      }

      const levels = bfsDownstream(id, s.edges);
      const affectedEdgeIds = edgesBetweenLevels(levels, s.edges);
      set((st) => {
        const reg = { ...st.runningEdgeIdsByRunSource, [id]: affectedEdgeIds };
        return {
          runningEdgeIdsByRunSource: reg,
          runningEdges: unionEdgeIdsByRunSource(reg),
        };
      });
      levels.forEach((level, depth) => {
        setTimeout(() => {
          set((state) => ({
            runningNodes: new Set([...state.runningNodes, ...level]),
          }));
          setTimeout(() => {
            set((state) => {
              const next = new Set(state.runningNodes);
              level.forEach((nid) => next.delete(nid));
              const isLast = depth === levels.length - 1;
              if (!isLast) {
                return { runningNodes: next, runningEdges: state.runningEdges };
              }
              const { [id]: _removed, ...rest } = state.runningEdgeIdsByRunSource;
              return {
                runningNodes: next,
                runningEdgeIdsByRunSource: rest,
                runningEdges: unionEdgeIdsByRunSource(rest),
              };
            });
          }, 1500);
        }, depth * 600);
      });
    },

    runAll: () => {
      console.log('[RunAll] invoked');
      if (runAllInFlight) {
        notifyInfo('Run All', 'A Run All is already in progress.');
        return;
      }
      runAllInFlight = true;
      void (async () => {
        try {
          const order = topologicalOrderIdsForTypes(
            get().nodes,
            get().edges,
            SCOUT_REMOTE_EXECUTION_TYPES
          );
          console.debug('[RunAll] topological order:', order);
          let succeeded = 0;
          let failed = 0;
          let skipped = 0;

          for (const id of order) {
            const node = get().nodes.find((n) => n.id === id);
            if (!node || !SCOUT_REMOTE_EXECUTION_TYPES.has(node.type)) continue;

            if (node.type === 'atmosphereTestNode') {
              const d = node.data as { moodText?: string; referenceUrl?: string };
              const mood = richTextToPlainForScout(String(d?.moodText ?? '')).trim();
              const ref = String(d?.referenceUrl ?? '').trim();
              if (!mood && !ref) {
                skipped++;
                continue;
              }
              if (mood) {
                const g = canRunScoutNode(get().nodes, get().scoutPipeline, id);
                if (!g.ok) {
                  skipped++;
                } else {
                  const r = await runScoutRemoteOnce(id, { atmosphereBranch: 'text' }, { suppressFailureToast: true });
                  if (r.ok) succeeded++;
                  else failed++;
                }
              }
              if (ref) {
                const g = canRunScoutNode(get().nodes, get().scoutPipeline, id);
                if (!g.ok) {
                  skipped++;
                } else {
                  const r = await runScoutRemoteOnce(
                    id,
                    { atmosphereBranch: 'reference' },
                    { suppressFailureToast: true }
                  );
                  if (r.ok) succeeded++;
                  else failed++;
                }
              }
              continue;
            }

            const guard = canRunScoutNode(get().nodes, get().scoutPipeline, id);
            if (!guard.ok) {
              console.debug('[RunAll] skipping', id, 'guard:', guard.reason);
              skipped++;
              continue;
            }
            console.debug('[RunAll] executing', id, node.type);
            const r = await runScoutRemoteOnce(id, undefined, { suppressFailureToast: true });
            console.debug('[RunAll] result', id, r.ok, r.reason);
            if (r.ok) succeeded++;
            else failed++;
          }

          if (succeeded === 0 && failed === 0) {
            notifyInfo(
              'Run All',
              'No Scout steps ran — add or complete Stage 1 (location, placement, props), approve Stage 2 where required, and satisfy downstream gates (hero shot, lighting batch).'
            );
          } else if (succeeded === 0 && failed > 0) {
            notifyInfo(
              'Run All',
              `${failed} Scout step(s) could not complete. Run a single node to see the error.`
            );
          } else {
            const parts = [`Completed ${succeeded} Scout step(s).`];
            if (failed > 0) parts.push(`${failed} failed.`);
            if (skipped > 0) parts.push(`${skipped} skipped (gates).`);
            notifySuccess('Run All', parts.join(' '));
          }
        } finally {
          runAllInFlight = false;
        }
      })();
    },

    setSelectedTool: (tool) => set({ selectedTool: tool }),

    addComment: (x, y, author = 'CD') => {
      const cid = `comment-${Date.now()}`;
      const comment: Comment = { id: cid, x, y, text: '', resolved: false, author };
      set((s) => ({ comments: [...s.comments, comment] }));
      pushCmd({
        undo: () => set((st) => ({ comments: st.comments.filter((c) => c.id !== cid) })),
        execute: () => set((st) => ({ comments: [...st.comments, { ...comment }] })),
      });
    },

    updateComment: (id, text) => {
      const s = get();
      const c = s.comments.find((x) => x.id === id);
      if (!c) return;
      const prev = c.text;
      set((st) => ({
        comments: st.comments.map((x) => (x.id === id ? { ...x, text } : x)),
      }));
      pushCmd({
        undo: () =>
          set((st) => ({
            comments: st.comments.map((x) => (x.id === id ? { ...x, text: prev } : x)),
          })),
        execute: () =>
          set((st) => ({
            comments: st.comments.map((x) => (x.id === id ? { ...x, text } : x)),
          })),
      });
    },

    resolveComment: (id) => {
      const s = get();
      const c = s.comments.find((x) => x.id === id);
      if (!c) return;
      const prev = c.resolved;
      set((st) => ({
        comments: st.comments.map((x) => (x.id === id ? { ...x, resolved: !x.resolved } : x)),
      }));
      pushCmd({
        undo: () =>
          set((st) => ({
            comments: st.comments.map((x) => (x.id === id ? { ...x, resolved: prev } : x)),
          })),
        execute: () =>
          set((st) => ({
            comments: st.comments.map((x) => (x.id === id ? { ...x, resolved: !prev } : x)),
          })),
      });
    },

    deleteComment: (id) => {
      const s = get();
      const c = s.comments.find((x) => x.id === id);
      if (!c) return;
      const clone = { ...c };
      set((st) => ({ comments: st.comments.filter((x) => x.id !== id) }));
      pushCmd({
        undo: () => set((st) => ({ comments: [...st.comments, clone] })),
        execute: () => set((st) => ({ comments: st.comments.filter((x) => x.id !== id) })),
      });
    },

    updateSettings: (partial) => {
      set((s) => {
        const next = { ...s.settings, ...partial };
        if (partial.performanceMode !== undefined)
          document.body.setAttribute('data-performance', String(next.performanceMode));
        if (partial.darkMode !== undefined)
          document.body.setAttribute('data-theme', next.darkMode ? 'dark' : 'light');
        writePersistedWorkflowSettings(next);
        return { settings: next };
      });
    },

    undo: () => {
      const s = get();
      if (s.pastStack.length === 0) return;
      const cmd = s.pastStack[s.pastStack.length - 1];
      cmd.undo();
      set({
        pastStack: s.pastStack.slice(0, -1),
        futureStack: capStack([...s.futureStack, cmd], MAX_STACK),
      });
    },

    redo: () => {
      const s = get();
      if (s.futureStack.length === 0) return;
      const cmd = s.futureStack[s.futureStack.length - 1];
      cmd.execute();
      set({
        futureStack: s.futureStack.slice(0, -1),
        pastStack: capStack([...s.pastStack, cmd], MAX_STACK),
      });
    },

    loadTemplate: (nodes, edges) => {
      const s = get();
      const before: GraphSnapshot = {
        nodes: structuredClone(s.nodes),
        edges: structuredClone(s.edges),
        comments: structuredClone(s.comments),
      };
      const afterNodes = structuredClone(nodes);
      const afterEdges = migrateEdgesToScopedHandles(structuredClone(edges));
      set({
        nodes: afterNodes,
        edges: afterEdges,
        comments: [],
        runningNodes: new Set(),
        runningEdges: new Set(),
        runningEdgeIdsByRunSource: {},
        scoutPipeline: { ...DEFAULT_SCOUT_PIPELINE },
      });
      pushCmd({
        undo: () =>
          set({
            nodes: structuredClone(before.nodes),
            edges: structuredClone(before.edges),
            comments: structuredClone(before.comments),
            runningNodes: new Set(),
            runningEdges: new Set(),
            runningEdgeIdsByRunSource: {},
            scoutPipeline: { ...DEFAULT_SCOUT_PIPELINE },
          }),
        execute: () =>
          set({
            nodes: structuredClone(afterNodes),
            edges: structuredClone(afterEdges),
            comments: [],
            runningNodes: new Set(),
            runningEdges: new Set(),
            runningEdgeIdsByRunSource: {},
            scoutPipeline: { ...DEFAULT_SCOUT_PIPELINE },
          }),
      });
    },

    copyNodesByIds: (ids) => {
      const s = get();
      const picked = s.nodes.filter((n) => ids.includes(n.id));
      if (picked.length === 0) return;
      set({ nodesClipboard: structuredClone(picked.map((n) => ({ ...n, selected: false }))) });
    },

    pasteClipboard: (offset = { x: 48, y: 48 }) => {
      const s = get();
      if (!s.nodesClipboard?.length) return;
      const dx = offset.x;
      const dy = offset.y;
      const t = Date.now();
      const newNodes: Node[] = s.nodesClipboard.map((n, i) => {
        const newId = `${n.type}-${t}-${i}`;
        return {
          ...structuredClone(n),
          id: newId,
          position: { x: n.position.x + dx, y: n.position.y + dy },
          selected: true,
        };
      });
      const ids = new Set(newNodes.map((n) => n.id));
      const snapshots = newNodes.map((n) => structuredClone(n));
      set({
        nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      });
      pushCmd({
        undo: () =>
          set((st) => ({
            nodes: st.nodes.filter((n) => !ids.has(n.id)),
          })),
        execute: () =>
          set((st) => ({
            nodes: [
              ...st.nodes.map((n) => ({ ...n, selected: false })),
              ...snapshots.map((n) => structuredClone(n)),
            ],
          })),
      });
    },
  };
});
