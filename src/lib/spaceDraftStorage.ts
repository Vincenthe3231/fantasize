import type { Node, Edge } from 'reactflow';
import { createStore, get, set, del } from 'idb-keyval';
import { logLocalDraftWrite } from '@/lib/persistenceConsole';
import { DEFAULT_WORKFLOW_SETTINGS, type Comment, type GridLayout, type WorkflowSettings } from '@/stores/workflowStore';
import type { SpaceRow, ViewportState } from '@/lib/spaceApi';

const LS_KEY_PREFIX = 'vf-space-draft:';

/** Dedicated DB so drafts are isolated and easy to clear */
const draftStore =
  typeof indexedDB !== 'undefined'
    ? createStore('vision-forge-drafts', 'space-drafts')
    : null;

function idbKey(spaceId: string) {
  return `draft:${spaceId}`;
}

function lsKey(spaceId: string) {
  return `${LS_KEY_PREFIX}${spaceId}`;
}

export type CanvasSnapshotPayload = {
  nodes: Node[];
  edges: Edge[];
  comments: Comment[];
  settings: WorkflowSettings;
  node_grid_layouts: Record<string, GridLayout>;
  viewport: ViewportState;
};

export type StoredSpaceDraft = {
  v: 1 | 2;
  spaceId: string;
  clientUpdatedAt: number;
  remoteBaselineIso: string;
  payload: CanvasSnapshotPayload;
};

function isValidDraft(d: unknown, spaceId: string): d is StoredSpaceDraft {
  if (!d || typeof d !== 'object') return false;
  const x = d as StoredSpaceDraft;
  return (
    (x.v === 1 || x.v === 2) &&
    x.spaceId === spaceId &&
    typeof x.clientUpdatedAt === 'number' &&
    typeof x.remoteBaselineIso === 'string' &&
    x.payload != null
  );
}

async function migrateFromLocalStorage(spaceId: string): Promise<StoredSpaceDraft | null> {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lsKey(spaceId));
    if (!raw) return null;
    const d = JSON.parse(raw) as unknown;
    if (!isValidDraft(d, spaceId)) {
      localStorage.removeItem(lsKey(spaceId));
      return null;
    }
    if (draftStore) {
      await set(idbKey(spaceId), { ...d, v: 2 as const }, draftStore);
    }
    localStorage.removeItem(lsKey(spaceId));
    return { ...d, v: 2 };
  } catch {
    return null;
  }
}

/** @returns clientUpdatedAt written, or undefined on failure/skip */
export async function writeSpaceDraft(
  spaceId: string,
  remoteBaselineIso: string,
  payload: CanvasSnapshotPayload,
  logOpts?: { everyWrite?: boolean }
): Promise<number | undefined> {
  if (!draftStore) return undefined;
  const clientUpdatedAt = Date.now();
  const draft: StoredSpaceDraft = {
    v: 2,
    spaceId,
    clientUpdatedAt,
    remoteBaselineIso,
    payload,
  };
  try {
    await set(idbKey(spaceId), draft, draftStore);
    logLocalDraftWrite(true, {
      spaceId,
      clientUpdatedAt,
      nodes: payload.nodes.length,
      edges: payload.edges.length,
      force: Boolean(logOpts?.everyWrite),
    });
    return clientUpdatedAt;
  } catch (e) {
    logLocalDraftWrite(false, { spaceId, error: e });
    return undefined;
  }
}

export async function readSpaceDraft(spaceId: string): Promise<StoredSpaceDraft | null> {
  if (!draftStore) return null;
  try {
    const fromIdb = await get<StoredSpaceDraft>(idbKey(spaceId), draftStore);
    if (fromIdb && isValidDraft(fromIdb, spaceId)) {
      return fromIdb;
    }
    return await migrateFromLocalStorage(spaceId);
  } catch (e) {
    console.warn('[Vision Forge] IndexedDB draft read failed:', e);
    return null;
  }
}

function mergedSettingsFromSpace(space: SpaceRow): WorkflowSettings {
  return {
    ...DEFAULT_WORKFLOW_SETTINGS,
    ...(space.settings && typeof space.settings === 'object' ? space.settings : {}),
  };
}

/** React Flow UI / derived fields — excluded when comparing local canvas to Supabase. */
function stripNodeForParity(n: Node): Record<string, unknown> {
  const o = { ...n } as Record<string, unknown>;
  delete o.selected;
  delete o.dragging;
  delete o.resizing;
  delete o.positionAbsolute;
  return o;
}

function stripEdgeForParity(e: Edge): Record<string, unknown> {
  const o = { ...e } as Record<string, unknown>;
  delete o.selected;
  return o;
}

/** Deep parity of two payloads (viewport ignored). Used after a successful save before query refetch. */
export function canvasSnapshotPayloadParityEqual(a: CanvasSnapshotPayload, b: CanvasSnapshotPayload): boolean {
  try {
    if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
    for (let i = 0; i < a.nodes.length; i++) {
      const an = stripNodeForParity(a.nodes[i]);
      const bn = stripNodeForParity(b.nodes[i]);
      if (
        an.id !== bn.id ||
        JSON.stringify(an.position ?? null) !== JSON.stringify(bn.position ?? null) ||
        JSON.stringify(an.parentId ?? null) !== JSON.stringify(bn.parentId ?? null) ||
        JSON.stringify(an.data ?? null) !== JSON.stringify(bn.data ?? null)
      ) {
        return false;
      }
    }
    for (let i = 0; i < a.edges.length; i++) {
      const ae = stripEdgeForParity(a.edges[i]);
      const be = stripEdgeForParity(b.edges[i]);
      if (
        ae.id !== be.id ||
        ae.source !== be.source ||
        ae.target !== be.target ||
        ae.sourceHandle !== be.sourceHandle ||
        ae.targetHandle !== be.targetHandle
      ) {
        return false;
      }
    }
    return (
      JSON.stringify(a.comments) === JSON.stringify(b.comments) &&
      JSON.stringify(a.node_grid_layouts) === JSON.stringify(b.node_grid_layouts) &&
      JSON.stringify(a.settings) === JSON.stringify(b.settings)
    );
  } catch {
    return false;
  }
}

/**
 * True when the in-memory canvas matches the Supabase row (viewport ignored; RF chrome stripped).
 */
export function canvasSnapshotMatchesSpaceRow(payload: CanvasSnapshotPayload, space: SpaceRow): boolean {
  try {
    const spaceNodes = space.nodes ?? [];
    const spaceEdges = space.edges ?? [];
    if (payload.nodes.length !== spaceNodes.length || payload.edges.length !== spaceEdges.length) {
      return false;
    }
    for (let i = 0; i < payload.nodes.length; i++) {
      const pn = stripNodeForParity(payload.nodes[i]);
      const sn = stripNodeForParity(spaceNodes[i]);
      if (
        pn.id !== sn.id ||
        JSON.stringify(pn.position ?? null) !== JSON.stringify(sn.position ?? null) ||
        JSON.stringify(pn.parentId ?? null) !== JSON.stringify(sn.parentId ?? null) ||
        JSON.stringify(pn.data ?? null) !== JSON.stringify(sn.data ?? null)
      ) {
        return false;
      }
    }
    for (let i = 0; i < payload.edges.length; i++) {
      const pe = stripEdgeForParity(payload.edges[i]);
      const se = stripEdgeForParity(spaceEdges[i]);
      if (
        pe.id !== se.id ||
        pe.source !== se.source ||
        pe.target !== se.target ||
        pe.sourceHandle !== se.sourceHandle ||
        pe.targetHandle !== se.targetHandle
      ) {
        return false;
      }
    }
    return (
      JSON.stringify(payload.comments) === JSON.stringify(space.comments ?? []) &&
      JSON.stringify(payload.node_grid_layouts) === JSON.stringify(space.node_grid_layouts ?? {}) &&
      JSON.stringify(payload.settings) === JSON.stringify(mergedSettingsFromSpace(space))
    );
  } catch {
    return false;
  }
}

/** True when the draft has no meaningful diff from the server row (viewport may differ). */
function draftPayloadMatchesServer(draft: CanvasSnapshotPayload, space: SpaceRow): boolean {
  return canvasSnapshotMatchesSpaceRow(draft, space);
}

export async function clearSpaceDraft(spaceId: string): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(lsKey(spaceId));
    }
    if (draftStore) {
      await del(idbKey(spaceId), draftStore);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Returns a local draft to hydrate only when it may contain work newer than the server.
 * If IndexedDB was bumped by viewport-only saves but graph+settings match the server row,
 * the draft is cleared and we return null so the UI is not treated as unsaved (no auto-save countdown).
 */
export async function shouldRestoreDraftFromLocal(
  spaceId: string,
  serverUpdatedAtIso: string,
  space: SpaceRow
): Promise<StoredSpaceDraft | null> {
  const draft = await readSpaceDraft(spaceId);
  if (!draft) return null;
  const serverMs = Date.parse(serverUpdatedAtIso);
  if (Number.isNaN(serverMs)) return null;
  if (draft.clientUpdatedAt <= serverMs) return null;

  if (draftPayloadMatchesServer(draft.payload, space)) {
    await clearSpaceDraft(spaceId);
    return null;
  }

  return draft;
}
