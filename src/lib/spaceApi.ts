import type { Node, Edge } from 'reactflow';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { Comment, WorkflowSettings, GridLayout } from '@/stores/workflowStore';
import { sanitizeCanvasStrokes, type CanvasStroke } from '@/lib/canvasStrokeUtils';
import { createVirtualProductionScoutTemplate } from '@/stores/workflowStore';

function scoutTemplate(): { nodes: Node[]; edges: Edge[] } {
  return createVirtualProductionScoutTemplate();
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
  canvas_drawings: CanvasStroke[];
  settings: WorkflowSettings | null;
  node_grid_layouts: Record<string, GridLayout>;
  viewport: ViewportState | null;
  updated_at: string;
}

/** Explicit columns for reads — avoids `select('*')` shipping unused DB columns / huge accidental payloads. */
const SPACE_SELECT_FULL =
  'id,owner_id,name,nodes,edges,comments,canvas_drawings,settings,node_grid_layouts,viewport,updated_at';

/** Accepts any canonical 8-4-4-4-12 hex id (matches Postgres `uuid` text form). */
export function isUuidParam(value: string | undefined): value is string {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * Load a space by primary key. RLS (`spaces_select_own`) restricts rows to the current session’s
 * `auth.uid()`; we do not filter `owner_id` in the query so the session JWT is the single source
 * of truth (avoids edge cases where client `userId` lags the Supabase session).
 */
export async function fetchSpaceById(_ownerId: string, spaceId: string): Promise<SpaceRow | null> {
  const { data, error } = await supabase
    .from('spaces')
    .select(SPACE_SELECT_FULL)
    .eq('id', spaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeSpaceRow(data as Record<string, unknown>);
}

export async function fetchOrCreateSpace(ownerId: string): Promise<SpaceRow> {
  /** Tiny first round-trip: only `id` to pick latest space without pulling multi‑MB JSON twice. */
  const { data: head, error: headErr } = await supabase
    .from('spaces')
    .select('id')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (headErr) throw headErr;

  if (head?.id) {
    const full = await fetchSpaceById(ownerId, head.id);
    if (full) return full;
  }

  const { nodes, edges } = scoutTemplate();
  const defaultViewport: ViewportState = { x: 0, y: 0, zoom: 1 };

  const { data: inserted, error: insErr } = await supabase
    .from('spaces')
    .insert([
      {
        owner_id: ownerId,
        name: 'My space',
        nodes: nodes as unknown as Json,
        edges: edges as unknown as Json,
        comments: [] as unknown as Json,
        canvas_drawings: [] as unknown as Json,
        settings: null,
        node_grid_layouts: {} as unknown as Json,
        viewport: defaultViewport as unknown as Json,
      },
    ])
    .select(SPACE_SELECT_FULL)
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
    canvas_drawings: sanitizeCanvasStrokes(r.canvas_drawings ?? []),
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
    canvas_drawings: CanvasStroke[];
    settings: WorkflowSettings;
    node_grid_layouts: Record<string, GridLayout>;
    viewport: ViewportState;
  }
): Promise<SpaceRow> {
  const { data, error } = await supabase
    .from('spaces')
    .update({
      nodes: payload.nodes as unknown as Json,
      edges: payload.edges as unknown as Json,
      comments: payload.comments as unknown as Json,
      canvas_drawings: payload.canvas_drawings as unknown as Json,
      settings: payload.settings as unknown as Json,
      node_grid_layouts: payload.node_grid_layouts as unknown as Json,
      viewport: payload.viewport as unknown as Json,
    })
    .eq('id', spaceId)
    .select(SPACE_SELECT_FULL)
    .single();

  if (error) throw error;
  return normalizeSpaceRow(data as Record<string, unknown>);
}
