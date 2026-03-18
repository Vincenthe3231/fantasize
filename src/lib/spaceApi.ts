import type { Node, Edge } from 'reactflow';
import { supabase } from '@/integrations/supabase/client';
import type { Comment, WorkflowSettings, GridLayout } from '@/stores/workflowStore';
import { MOCK, SCENE_DESCRIPTION } from '@/lib/mockPipelineAssets';

function scoutTemplate(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
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
  const edges: Edge[] = [
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
  return { nodes: structuredClone(nodes), edges: structuredClone(edges) };
}

export type ViewportState = { x: number; y: number; zoom: number };

export const DEFAULT_VIEWPORT: ViewportState = { x: 0, y: 0, zoom: 1 };

export interface SpaceRow {
  id: string;
  owner_id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  comments: Comment[];
  settings: WorkflowSettings | null;
  node_grid_layouts: Record<string, GridLayout>;
  viewport: ViewportState | null;
  updated_at: string;
}

export async function fetchOrCreateSpace(ownerId: string): Promise<SpaceRow> {
  const { data: rows, error: selErr } = await supabase
    .from('spaces')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (selErr) throw selErr;

  if (rows?.length) {
    const r = rows[0] as Record<string, unknown>;
    return normalizeSpaceRow(r);
  }

  const { nodes, edges } = scoutTemplate();
  const defaultViewport: ViewportState = { x: 0, y: 0, zoom: 1 };

  const { data: inserted, error: insErr } = await supabase
    .from('spaces')
    .insert({
      owner_id: ownerId,
      name: 'My space',
      nodes: nodes as unknown as Record<string, unknown>[],
      edges: edges as unknown as Record<string, unknown>[],
      comments: [],
      settings: null,
      node_grid_layouts: {},
      viewport: defaultViewport,
    })
    .select()
    .single();

  if (insErr) throw insErr;
  return normalizeSpaceRow(inserted as Record<string, unknown>);
}

function normalizeSpaceRow(r: Record<string, unknown>): SpaceRow {
  return {
    id: r.id as string,
    owner_id: r.owner_id as string,
    name: (r.name as string) || 'My space',
    nodes: (r.nodes as Node[]) || [],
    edges: (r.edges as Edge[]) || [],
    comments: (r.comments as Comment[]) || [],
    settings: r.settings as WorkflowSettings | null,
    node_grid_layouts: (r.node_grid_layouts as Record<string, GridLayout>) || {},
    viewport: (r.viewport as ViewportState) || { x: 0, y: 0, zoom: 1 },
    updated_at: r.updated_at as string,
  };
}

export async function saveSpace(
  spaceId: string,
  payload: {
    nodes: Node[];
    edges: Edge[];
    comments: Comment[];
    settings: WorkflowSettings;
    node_grid_layouts: Record<string, GridLayout>;
    viewport: ViewportState;
  }
): Promise<void> {
  const { error } = await supabase
    .from('spaces')
    .update({
      nodes: payload.nodes as unknown as Record<string, unknown>[],
      edges: payload.edges as unknown as Record<string, unknown>[],
      comments: payload.comments as unknown as Record<string, unknown>[],
      settings: payload.settings as unknown as Record<string, unknown>,
      node_grid_layouts: payload.node_grid_layouts as unknown as Record<string, unknown>,
      viewport: payload.viewport,
    })
    .eq('id', spaceId);

  if (error) throw error;
}
