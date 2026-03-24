import { create } from 'zustand';
import { type Node, type Edge, type XYPosition } from 'reactflow';
import { MOCK, SCENE_DESCRIPTION, DEFAULT_SCOUT_PROP_SLOTS } from '@/lib/mockPipelineAssets';
import {
  type ScoutPipelineState,
  DEFAULT_SCOUT_PIPELINE,
  applyScoutStaleOnDataChange,
  canRunScoutNode,
} from '@/lib/scoutPipeline';
import { executeScoutNode, type ScoutRunOptions } from '@/lib/scoutRunCoordinator';
import { richTextToPlainForScout } from '@/lib/richTextForScout';
import { notifyInfo, notifySuccess } from '@/lib/systemNotify';
export type { ScoutPipelineState } from '@/lib/scoutPipeline';
export type { ScoutRunOptions } from '@/lib/scoutRunCoordinator';

/** Node types executed via Supabase `scout-execute` + graph resolver (replaces timer-only mock). */
const SCOUT_REMOTE_EXECUTION_TYPES = new Set<string>([
  'assistantNode',
  'imageGeneratorNode',
  'setDressingNode',
  'angleVariationsNode',
  'lightingScenarioNode',
  'atmosphereTestNode',
]);

/** Pending updateNodeData batches: flush after 1s idle per node */
const UPDATE_NODE_DATA_DEBOUNCE_MS = 1000;
const pendingNodeDataUpdates = new Map<
  string,
  { timeoutId: number; before: Record<string, unknown>; keys: string[] }
>();

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

const MAX_STACK = 50;

function capStack<T>(arr: T[]): T[] {
  return arr.length > MAX_STACK ? arr.slice(-MAX_STACK) : arr;
}

const GRID_CYCLE: GridLayout[] = ['1x1', '2x2', '3x3'];

function bfsDownstream(startId: string, edges: Edge[]): string[][] {
  const adj: Record<string, string[]> = {};
  edges.forEach((e) => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });
  const levels: string[][] = [[startId]];
  const visited = new Set<string>([startId]);
  let frontier = [startId];
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of adj[nodeId] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextFrontier.push(neighbor);
        }
      }
    }
    if (nextFrontier.length > 0) {
      levels.push(nextFrontier);
      frontier = nextFrontier;
    } else break;
  }
  return levels;
}

function edgesBetweenLevels(levels: string[][], edges: Edge[]): string[] {
  const allNodes = new Set(levels.flat());
  return edges.filter((e) => allNodes.has(e.source) && allNodes.has(e.target)).map((e) => e.id);
}

function unionEdgeIdsByRunSource(reg: Record<string, string[]>): Set<string> {
  const out = new Set<string>();
  for (const ids of Object.values(reg)) {
    for (const eid of ids) out.add(eid);
  }
  return out;
}

/** Scout remote nodes in topological order (sources before targets along edges). */
function topologicalOrderScoutRemoteIds(nodes: Node[], edges: Edge[]): string[] {
  const scoutIds = new Set(
    nodes.filter((n) => SCOUT_REMOTE_EXECUTION_TYPES.has(n.type)).map((n) => n.id)
  );
  if (scoutIds.size === 0) return [];

  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of scoutIds) {
    indeg.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    if (!scoutIds.has(e.source) || !scoutIds.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const queue = [...scoutIds].filter((id) => indeg.get(id) === 0);
  queue.sort();
  const out: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    out.push(u);
    for (const v of adj.get(u) ?? []) {
      const next = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, next);
      if (next === 0) {
        queue.push(v);
        queue.sort();
      }
    }
  }
  if (out.length < scoutIds.size) {
    for (const id of scoutIds) {
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

let runAllInFlight = false;

const defaultNodes: Node[] = [
  {
    id: 'text-1',
    type: 'textNode',
    position: { x: 80, y: 80 },
    data: { content: `<p>${SCENE_DESCRIPTION}</p>` },
  },
  {
    id: 'upload-1',
    type: 'uploadNode',
    position: { x: 80, y: 280 },
    data: { mediaUrl: MOCK.location1, label: 'Location reference', labelText: 'Location reference' },
  },
  {
    id: 'placement-1',
    type: 'placementRefNode',
    position: { x: 80, y: 520 },
    data: {
      placementText: `<p>${SCENE_DESCRIPTION}</p>`,
      placementRefUrl: MOCK.placement,
    },
  },
  {
    id: 'props-input-1',
    type: 'propsInputNode',
    position: { x: 80, y: 700 },
    data: { props: [...DEFAULT_SCOUT_PROP_SLOTS] },
  },
  {
    id: 'assistant-1',
    type: 'assistantNode',
    position: { x: 400, y: 200 },
    data: {
      refinedPrompt: '',
      prompt: '',
      view: 'prompt',
      result: '',
      assistantModel: 'GPT-5 Mini',
      labelText: 'Assistant',
    },
  },
  {
    id: 'generator-1',
    type: 'imageGeneratorNode',
    position: { x: 720, y: 200 },
    data: {
      model: 'mystic',
      mode: 'Auto',
      aspect: '16:9',
      images: 1,
      prompt: '',
      negativePrompt: '',
      status: 'idle',
      generatedUrl: MOCK.setDressing,
      labelText: 'Image Generator',
    },
  },
  {
    id: 'set-dressing-1',
    type: 'setDressingNode',
    position: { x: 1060, y: 180 },
    data: { previewUrl: MOCK.setDressing },
  },
  {
    id: 'angle-var-1',
    type: 'angleVariationsNode',
    position: { x: 1520, y: 400 },
    data: {},
  },
  {
    id: 'lighting-1',
    type: 'lightingScenarioNode',
    position: { x: 1960, y: 400 },
    data: {
      lightingStrings: ['Golden hour', 'Studio', 'Natural light'],
      accumulatedLighting: [] as { id: string; label: string; src: string }[],
      lastBatchResults: [] as { id: string; label: string; src: string }[],
    },
  },
  {
    id: 'atmosphere-1',
    type: 'atmosphereTestNode',
    position: { x: 2400, y: 400 },
    data: {
      moodText: '',
      referenceUrl: '',
      textResults: [] as { id: string; label: string; src: string }[],
      referenceResults: [] as { id: string; label: string; src: string }[],
      selectedBranch: null as 'text' | 'reference' | null,
      selectedIndex: null as number | null,
    },
  },
  {
    id: 'angle-list-1',
    type: 'angleVariationsListNode',
    position: { x: 1520, y: 700 },
    data: {
      accumulatedAngles: [] as { id: string; src: string; resolution?: string }[],
      selectedAngleId: null as string | null,
    },
  },
  {
    id: 'selected-shot-1',
    type: 'selectedShotNode',
    position: { x: 1920, y: 700 },
    data: {
      mediaUrl: MOCK.selectedShot,
      resolution: '3840 × 2133',
      committed: false,
    },
  },
  {
    id: 'annotation-1',
    type: 'annotationNode',
    position: { x: 1520, y: 960 },
    data: {
      text: '💡 Scout: Approve Stage 2 → run angles → pick in list → Commit hero shot → Lighting batch → Text/Reference atmosphere → Finalize.',
    },
    selectable: false,
    draggable: false,
  },
];

const defaultEdges: Edge[] = [
  { id: 'e-text-assistant', source: 'text-1', target: 'assistant-1', targetHandle: 'text-in', type: 'custom' },
  { id: 'e-upload-assistant', source: 'upload-1', target: 'assistant-1', targetHandle: 'image-in', type: 'custom' },
  { id: 'e-assistant-generator', source: 'assistant-1', target: 'generator-1', type: 'custom' },
  { id: 'e-upload-set', source: 'upload-1', target: 'set-dressing-1', targetHandle: 'location-in', type: 'custom' },
  {
    id: 'e-placement-set',
    source: 'placement-1',
    target: 'set-dressing-1',
    targetHandle: 'placement-in',
    sourceHandle: 'text-out',
    type: 'custom',
  },
  {
    id: 'e-props-set',
    source: 'props-input-1',
    target: 'set-dressing-1',
    targetHandle: 'props-in',
    sourceHandle: 'image-out',
    type: 'custom',
  },
  { id: 'e-gen-set', source: 'generator-1', target: 'set-dressing-1', targetHandle: 'scene-in', type: 'custom' },
  { id: 'e-set-angle', source: 'set-dressing-1', target: 'angle-var-1', type: 'custom' },
  {
    id: 'e-shot-light',
    source: 'selected-shot-1',
    target: 'lighting-1',
    targetHandle: 'image-in',
    sourceHandle: 'image-out',
    type: 'custom',
  },
  { id: 'e-light-atmo', source: 'lighting-1', target: 'atmosphere-1', type: 'custom' },
  { id: 'e-angle-list', source: 'angle-var-1', target: 'angle-list-1', type: 'custom' },
  { id: 'e-list-shot', source: 'angle-list-1', target: 'selected-shot-1', targetHandle: 'image-in', type: 'custom' },
];

export function createVirtualProductionScoutTemplate(): { nodes: Node[]; edges: Edge[] } {
  return { nodes: structuredClone(defaultNodes), edges: structuredClone(defaultEdges) };
}

const DEFAULT_NODE_W = 280;
const DEFAULT_NODE_H = 120;
const DEFAULT_GROUP_W = 400;
const DEFAULT_GROUP_H = 240;

function nodeDragSnapshotEqual(a: Node[], b: Node[]): boolean {
  if (a.length !== b.length) return false;
  const mapB = new Map(b.map((n) => [n.id, n]));
  for (const n of a) {
    const m = mapB.get(n.id);
    if (!m) return false;
    if (n.position.x !== m.position.x || n.position.y !== m.position.y) return false;
    if (n.parentId !== m.parentId) return false;
    if (n.extent !== m.extent) return false;
  }
  return true;
}

/**
 * After a drag, parent/unparent nodes into group frames using center-point containment.
 * Only mutates clones of nodes whose ids are in draggedIds.
 */
export function applyGroupDropReparent(nodes: Node[], draggedIds: Set<string>): Node[] {
  const list = nodes.map((n) => {
    const c = { ...n, position: { ...n.position } } as Node;
    delete (c as { positionAbsolute?: unknown }).positionAbsolute;
    return c;
  });
  const byId = new Map(list.map((n) => [n.id, n]));

  const absPos = (n: Node): { x: number; y: number } => {
    const pa = (n as Node & { positionAbsolute?: XYPosition }).positionAbsolute;
    if (pa && typeof pa.x === 'number' && typeof pa.y === 'number') {
      return { x: pa.x, y: pa.y };
    }
    let x = n.position.x;
    let y = n.position.y;
    let pid = n.parentId;
    while (pid) {
      const p = byId.get(pid);
      if (!p) break;
      x += p.position.x;
      y += p.position.y;
      pid = p.parentId;
    }
    return { x, y };
  };

  const groupBounds = (g: Node) => {
    const st = g.style as { width?: number; height?: number } | undefined;
    const w = typeof st?.width === 'number' && st.width > 0 ? st.width : DEFAULT_GROUP_W;
    const h = typeof st?.height === 'number' && st.height > 0 ? st.height : DEFAULT_GROUP_H;
    const p = absPos(g);
    return { x: p.x, y: p.y, w, h };
  };

  const groupArea = (g: Node) => {
    const b = groupBounds(g);
    return b.w * b.h;
  };

  const groups = list.filter((n) => n.type === 'group').sort((a, b) => groupArea(a) - groupArea(b));

  for (const n of list) {
    if (!draggedIds.has(n.id)) continue;
    if (n.type === 'group') continue;
    if (n.draggable === false) continue;

    const abs = absPos(n);
    const w = typeof n.width === 'number' && n.width > 0 ? n.width : DEFAULT_NODE_W;
    const h = typeof n.height === 'number' && n.height > 0 ? n.height : DEFAULT_NODE_H;
    const cx = abs.x + w / 2;
    const cy = abs.y + h / 2;

    let target: Node | null = null;
    for (const g of groups) {
      if (g.id === n.id) continue;
      const b = groupBounds(g);
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        target = g;
        break;
      }
    }

    if (target) {
      const gAbs = absPos(target);
      if (n.parentId === target.id) continue;
      n.parentId = target.id;
      n.extent = 'parent';
      n.position = { x: abs.x - gAbs.x, y: abs.y - gAbs.y };
    } else if (n.parentId) {
      const p = byId.get(n.parentId);
      if (p?.type === 'group') {
        n.position = { x: abs.x, y: abs.y };
        n.parentId = undefined;
        n.extent = undefined;
      }
    }
  }

  return list;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => {
  const pushCmd = (cmd: CanvasCommand) => {
    set((s) => ({
      pastStack: capStack([...s.pastStack, cmd]),
      futureStack: [],
    }));
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
      });

      if (!r.ok && !batchOpts?.suppressFailureToast) {
        notifyInfo('Scout run failed', r.reason ?? 'Scout run failed');
      }
      return r;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!batchOpts?.suppressFailureToast) notifyInfo('Scout run failed', msg);
      return { ok: false, reason: msg };
    } finally {
      clearRunning();
    }
  };

  return {
    nodes: defaultNodes,
    edges: defaultEdges,
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
    settings: DEFAULT_WORKFLOW_SETTINGS,
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
        nodes: structuredClone(space.nodes),
        edges: structuredClone(space.edges),
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

    setNodesSilently: (nodes) => set({ nodes }),
    setEdgesSilently: (edges) => set({ edges }),

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
      const newNode: Node =
        type === 'group'
          ? {
              id,
              type: 'group',
              position,
              data: { labelText: 'Group', ...data },
              style: { width: DEFAULT_GROUP_W, height: DEFAULT_GROUP_H },
              draggable: true,
              selectable: true,
            }
          : { id, type, position, data };
      set({ nodes: [...s.nodes, newNode] });
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
          const order = topologicalOrderScoutRemoteIds(get().nodes, get().edges);
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
        futureStack: capStack([...s.futureStack, cmd]),
      });
    },

    redo: () => {
      const s = get();
      if (s.futureStack.length === 0) return;
      const cmd = s.futureStack[s.futureStack.length - 1];
      cmd.execute();
      set({
        futureStack: s.futureStack.slice(0, -1),
        pastStack: capStack([...s.pastStack, cmd]),
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
      const afterEdges = structuredClone(edges);
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
