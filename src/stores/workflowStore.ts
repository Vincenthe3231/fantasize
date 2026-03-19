import { create } from 'zustand';
import { type Node, type Edge, type XYPosition } from 'reactflow';
import { MOCK, SCENE_DESCRIPTION } from '@/lib/mockPipelineAssets';

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

  runFromNode: (id: string) => void;
  runAll: () => void;

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

export function createVirtualProductionScoutTemplate(): { nodes: Node[]; edges: Edge[] } {
  return { nodes: structuredClone(defaultNodes), edges: structuredClone(defaultEdges) };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => {
  const pushCmd = (cmd: CanvasCommand) => {
    set((s) => ({
      pastStack: capStack([...s.pastStack, cmd]),
      futureStack: [],
    }));
  };

  return {
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
    focusedNodeContentId: null,
    currentSpaceId: null,
    lastViewport: { x: 0, y: 0, zoom: 1 },
    pastStack: [],
    futureStack: [],

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
        focusedNodeContentId: null,
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
      const newNode: Node = { id, type, position, data };
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
        style: { width: groupW, height: groupH } as any,
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

      // Apply immediately so UI stays responsive
      set({
        nodes: s.nodes.map((x) =>
          x.id === id ? { ...x, data: { ...x.data, ...data } } : x
        ),
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
      set({
        nodes: s.nodes.map((x) =>
          x.id === id ? { ...x, data: { ...x.data, ...data } } : x
        ),
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
      });
      pushCmd({
        undo: () =>
          set({
            nodes: structuredClone(before.nodes),
            edges: structuredClone(before.edges),
            comments: structuredClone(before.comments),
            runningNodes: new Set(),
            runningEdges: new Set(),
          }),
        execute: () =>
          set({
            nodes: structuredClone(afterNodes),
            edges: structuredClone(afterEdges),
            comments: [],
            runningNodes: new Set(),
            runningEdges: new Set(),
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
