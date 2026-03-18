import type { Node, Edge } from 'reactflow';
import { createStore, get, set, del } from 'idb-keyval';
import { logLocalDraftWrite } from '@/lib/persistenceConsole';
import type { Comment, WorkflowSettings, GridLayout } from '@/stores/workflowStore';
import type { ViewportState } from '@/lib/spaceApi';

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

export async function shouldRestoreDraftFromLocal(
  spaceId: string,
  serverUpdatedAtIso: string
): Promise<StoredSpaceDraft | null> {
  const draft = await readSpaceDraft(spaceId);
  if (!draft) return null;
  const serverMs = Date.parse(serverUpdatedAtIso);
  if (Number.isNaN(serverMs)) return null;
  return draft.clientUpdatedAt > serverMs ? draft : null;
}
