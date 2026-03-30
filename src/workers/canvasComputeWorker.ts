/// <reference lib="webworker" />

import {
  estimateSnapshotBytes,
  listLargestNodeDataFields,
  sanitizeSnapshotForRemoteSave,
} from '@/lib/spacePayloadOptimizer';
import { SpatialGridIndex } from '@/lib/spatialIndex';
import type { CanvasWorkerRequest, CanvasWorkerResponse } from '@/lib/canvasWorkerProtocol';

const spatialIndex = new SpatialGridIndex();
let spatialRevision = 0;

function post(message: CanvasWorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<CanvasWorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'prepare-remote-save') {
      const sanitized = sanitizeSnapshotForRemoteSave(msg.payload);
      const bytesBefore = estimateSnapshotBytes(sanitized);
      const largestFields = listLargestNodeDataFields(sanitized.nodes, msg.topN ?? 8);
      post({
        id: msg.id,
        ok: true,
        type: 'prepare-remote-save',
        revision: msg.revision,
        sanitized,
        bytesBefore,
        largestFields,
      });
      return;
    }

    if (msg.type === 'spatial-index-init') {
      spatialRevision = msg.revision;
      spatialIndex.init(msg.nodes);
      post({
        id: msg.id,
        ok: true,
        type: 'spatial-index-init',
        revision: spatialRevision,
        nodeCount: spatialIndex.size(),
      });
      return;
    }

    if (msg.type === 'spatial-index-update') {
      // Ignore stale updates from older state snapshots.
      if (msg.revision < spatialRevision) {
        post({
          id: msg.id,
          ok: true,
          type: 'spatial-index-update',
          revision: spatialRevision,
          nodeCount: spatialIndex.size(),
        });
        return;
      }
      spatialRevision = msg.revision;
      spatialIndex.applyDeltas(msg.deltas);
      post({
        id: msg.id,
        ok: true,
        type: 'spatial-index-update',
        revision: spatialRevision,
        nodeCount: spatialIndex.size(),
      });
      return;
    }

    if (msg.type === 'spatial-index-query-rect') {
      const candidateIds = spatialIndex.queryRect(msg.rect);
      post({
        id: msg.id,
        ok: true,
        type: 'spatial-index-query-rect',
        revision: spatialRevision,
        candidateIds,
      });
      return;
    }

    post({
      id: msg.id,
      ok: false,
      revision: msg.revision,
      error: `Unsupported worker request: ${(msg as { type?: string }).type ?? 'unknown'}`,
    });
  } catch (error) {
    post({
      id: msg.id,
      ok: false,
      revision: (msg as { revision?: number }).revision,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
