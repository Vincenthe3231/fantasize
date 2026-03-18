import { create } from 'zustand';
import { type Node, type Edge, type XYPosition } from 'reactflow';
import { MOCK, SCENE_DESCRIPTION } from '@/lib/mockPipelineAssets';

// ── Types ──────────────────────────────────────────────

export type NodeType =
  | 'textNode'
  | 'uploadNode'
  | 'assistantNode'
  | 'imageGeneratorNode'
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
  | 'placementRefNode';

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
}

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  comments: Comment[];
}

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  comments: Comment[];
  runningNodes: Set<string>;
  runningEdges: Set<string>;
  selectedTool: SelectedTool;
  settings: WorkflowSettings;
  past: Snapshot[];
  future: Snapshot[];
  isDragging: boolean;

  // Hover / selection overlay state
  hoveredNodeId: string | null;
  hoveredImageCell: { nodeId: string; cellIndex: number } | null;
  nodeGridLayouts: Record<string, GridLayout>;
  contextMenu: ContextMenu | null;
  nodesClipboard: Node[] | null;

  // Node CRUD
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (type: NodeType, position: XYPosition, data?: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  lockNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;

  // Execution
  runFromNode: (id: string) => void;
  runAll: () => void;

  // Tools
  setSelectedTool: (tool: SelectedTool) => void;
  setIsDragging: (dragging: boolean) => void;

  // Hover / overlay
  setHoveredNode: (id: string | null) => void;
  setHoveredImageCell: (cell: { nodeId: string; cellIndex: number } | null) => void;
  toggleGridLayout: (nodeId: string) => void;
  setContextMenu: (menu: ContextMenu | null) => void;

  // Comments
  addComment: (x: number, y: number, author?: string) => void;
  updateComment: (id: string, text: string) => void;
  resolveComment: (id: string) => void;
  deleteComment: (id: string) => void;

  // Settings
  updateSettings: (s: Partial<WorkflowSettings>) => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;

  // History
  takeSnapshot: () => void;

  // Templates
  loadTemplate: (nodes: Node[], edges: Edge[]) => void;

  copyNodesByIds: (ids: string[]) => void;
  pasteClipboard: (offset?: XYPosition) => void;
}

// ── Helpers ────────────────────────────────────────────

const MAX_HISTORY = 50;

function snapshot(state: WorkflowState): Snapshot {
  return {
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
    comments: structuredClone(state.comments),
  };
}

function pushSnapshot(s: WorkflowState): { past: Snapshot[]; future: Snapshot[] } {
  return {
    past: [...s.past.slice(-(MAX_HISTORY - 1)), snapshot(s)],
    future: [],
  };
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

// ── Initial data ───────────────────────────────────────

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
    data: { mediaUrl: MOCK.location1, label: 'Location reference' },
  },
  {
    id: 'placement-1',
    type: 'placementRefNode',
    position: { x: 80, y: 520 },
    data: {},
  },
  {
    id: 'props-input-1',
    type: 'propsInputNode',
    position: { x: 80, y: 700 },
    data: {},
  },
  {
    id: 'assistant-1',
    type: 'assistantNode',
    position: { x: 400, y: 200 },
    data: { refinedPrompt: '' },
  },
  {
    id: 'generator-1',
    type: 'imageGeneratorNode',
    position: { x: 720, y: 200 },
    data: {
      model: 'mystic',
      aspect: '16:9',
      images: 1,
      negativePrompt: '',
      status: 'idle',
      generatedUrl: MOCK.setDressing,
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
    data: {},
  },
  {
    id: 'atmosphere-1',
    type: 'atmosphereTestNode',
    position: { x: 2400, y: 400 },
    data: {},
  },
  {
    id: 'angle-list-1',
    type: 'angleVariationsListNode',
    position: { x: 1520, y: 700 },
    data: {},
  },
  {
    id: 'selected-shot-1',
    type: 'selectedShotNode',
    position: { x: 1920, y: 700 },
    data: { mediaUrl: MOCK.selectedShot, resolution: '3840 × 2133' },
  },
  {
    id: 'annotation-1',
    type: 'annotationNode',
    position: { x: 1520, y: 960 },
    data: {
      text: '💡 Pipeline: *Set dressing* → *Camera coverage* → *Lighting* → *Atmosphere*. Use *Reframe* in Angle variations to refine shots.',
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
  { id: 'e-placement-set', source: 'placement-1', target: 'set-dressing-1', targetHandle: 'placement-in', type: 'custom' },
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
  { id: 'e-angle-light', source: 'angle-var-1', target: 'lighting-1', type: 'custom' },
  { id: 'e-light-atmo', source: 'lighting-1', target: 'atmosphere-1', type: 'custom' },
  { id: 'e-angle-list', source: 'angle-var-1', target: 'angle-list-1', type: 'custom' },
  { id: 'e-list-shot', source: 'angle-list-1', target: 'selected-shot-1', type: 'custom' },
];

/** Clone default Virtual Production Scout graph for templates / reset. */
export function createVirtualProductionScoutTemplate(): { nodes: Node[]; edges: Edge[] } {
  return { nodes: structuredClone(defaultNodes), edges: structuredClone(defaultEdges) };
}

// ── Store ──────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: defaultNodes,
  edges: defaultEdges,
  comments: [],
  runningNodes: new Set(),
  runningEdges: new Set(),
  selectedTool: 'select',
  isDragging: false,
  hoveredNodeId: null,
  hoveredImageCell: null,
  nodeGridLayouts: {},
  contextMenu: null,
  settings: {
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
  },
  nodesClipboard: null,
  past: [],
  future: [],

  takeSnapshot: () => {
    const s = get();
    if (s.isDragging) return;
    set(pushSnapshot(s));
  },

  setNodes: (nodes) => {
    const s = get();
    if (s.isDragging) {
      set({ nodes });
    } else {
      set({ ...pushSnapshot(s), nodes });
    }
  },

  setEdges: (edges) => {
    const s = get();
    set({ ...pushSnapshot(s), edges });
  },

  setIsDragging: (dragging) => {
    const s = get();
    if (dragging) {
      set({ isDragging: true, ...pushSnapshot(s) });
    } else {
      set({ isDragging: false });
    }
  },

  // Hover / overlay
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setHoveredImageCell: (cell) => set({ hoveredImageCell: cell }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  toggleGridLayout: (nodeId) => {
    const s = get();
    const current = s.nodeGridLayouts[nodeId] || '2x2';
    const idx = GRID_CYCLE.indexOf(current);
    const next = GRID_CYCLE[(idx + 1) % GRID_CYCLE.length];
    set({ nodeGridLayouts: { ...s.nodeGridLayouts, [nodeId]: next } });
  },

  // Node CRUD
  addNode: (type, position, data = {}) => {
    const s = get();
    const id = `${type.replace('Node', '')}-${Date.now()}`;
    const newNode: Node = { id, type, position, data };
    set({ ...pushSnapshot(s), nodes: [...s.nodes, newNode] });
  },

  deleteNode: (id) => {
    const s = get();
    set({
      ...pushSnapshot(s),
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
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
    set({ ...pushSnapshot(s), nodes: [...s.nodes, dup] });
  },

  lockNode: (id) => {
    const s = get();
    set({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, draggable: n.draggable === false ? undefined : false } : n
      ),
    });
  },

  updateNodeData: (id, data) => {
    const s = get();
    set({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    });
  },

  // Execution
  runFromNode: (id) => {
    const s = get();
    const levels = bfsDownstream(id, s.edges);
    const affectedEdgeIds = edgesBetweenLevels(levels, s.edges);
    set({ runningEdges: new Set(affectedEdgeIds) });
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
            return { runningNodes: next, runningEdges: isLast ? new Set() : state.runningEdges };
          });
        }, 1500);
      }, depth * 600);
    });
  },

  runAll: () => {
    const s = get();
    const targets = new Set(s.edges.map((e) => e.target));
    const roots = s.nodes.filter((n) => !targets.has(n.id));
    roots.forEach((r) => get().runFromNode(r.id));
  },

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  // Comments
  addComment: (x, y, author = 'CD') => {
    const s = get();
    set({
      ...pushSnapshot(s),
      comments: [...s.comments, { id: `comment-${Date.now()}`, x, y, text: '', resolved: false, author }],
    });
  },
  updateComment: (id, text) => set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, text } : c)) })),
  resolveComment: (id) => set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)) })),
  deleteComment: (id) => set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

  // Settings
  updateSettings: (partial) => {
    set((s) => {
      const next = { ...s.settings, ...partial };
      if (partial.performanceMode !== undefined) document.body.setAttribute('data-performance', String(next.performanceMode));
      if (partial.darkMode !== undefined) document.body.setAttribute('data-theme', next.darkMode ? 'dark' : 'light');
      return { settings: next };
    });
  },

  // Undo / Redo
  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const prev = s.past[s.past.length - 1];
    set({ past: s.past.slice(0, -1), future: [snapshot(s), ...s.future].slice(0, MAX_HISTORY), nodes: prev.nodes, edges: prev.edges, comments: prev.comments });
  },
  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    set({ past: [...s.past, snapshot(s)].slice(-MAX_HISTORY), future: s.future.slice(1), nodes: next.nodes, edges: next.edges, comments: next.comments });
  },

  loadTemplate: (nodes, edges) => {
    const s = get();
    set({ ...pushSnapshot(s), nodes, edges, runningNodes: new Set(), runningEdges: new Set(), comments: [] });
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
    set({
      ...pushSnapshot(s),
      nodes: [
        ...s.nodes.map((n) => ({ ...n, selected: false })),
        ...newNodes,
      ],
    });
  },
}));
