import type { CanvasSnapshotPayload } from '@/lib/spaceDraftStorage';
import type { NodeDataFieldSize } from '@/lib/spacePayloadOptimizer';

export type SpatialNodeBounds = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpatialNodeDelta = {
  id: string;
  from?: SpatialNodeBounds | null;
  to?: SpatialNodeBounds | null;
};

export type CanvasWorkerRequest =
  | {
      id: number;
      type: 'prepare-remote-save';
      revision: number;
      payload: CanvasSnapshotPayload;
      topN?: number;
    }
  | {
      id: number;
      type: 'spatial-index-init';
      revision: number;
      nodes: SpatialNodeBounds[];
    }
  | {
      id: number;
      type: 'spatial-index-update';
      revision: number;
      deltas: SpatialNodeDelta[];
    }
  | {
      id: number;
      type: 'spatial-index-query-rect';
      revision: number;
      rect: { x: number; y: number; width: number; height: number };
    };

export type CanvasWorkerResponse =
  | {
      id: number;
      ok: true;
      type: 'prepare-remote-save';
      revision: number;
      sanitized: CanvasSnapshotPayload;
      bytesBefore: number;
      largestFields: NodeDataFieldSize[];
    }
  | {
      id: number;
      ok: true;
      type: 'spatial-index-init';
      revision: number;
      nodeCount: number;
    }
  | {
      id: number;
      ok: true;
      type: 'spatial-index-update';
      revision: number;
      nodeCount: number;
    }
  | {
      id: number;
      ok: true;
      type: 'spatial-index-query-rect';
      revision: number;
      candidateIds: string[];
    }
  | {
      id: number;
      ok: false;
      revision?: number;
      error: string;
    };
