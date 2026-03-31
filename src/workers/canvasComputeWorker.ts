/// <reference lib="webworker" />

import {
  estimateSnapshotBytes,
  listLargestNodeDataFields,
  sanitizeSnapshotForRemoteSave,
} from '@/lib/spacePayloadOptimizer';
import { SpatialGridIndex } from '@/lib/spatialIndex';
import type { CanvasWorkerRequest, CanvasWorkerResponse } from '@/lib/canvasWorkerProtocol';
import { horizontalBezierControls, sampleCubicBezier } from '@/lib/pixiBoard/cubicBezier';

const spatialIndex = new SpatialGridIndex();
let spatialRevision = 0;
let wasmPointSegmentHit:
  | ((
      px: number,
      py: number,
      ax: number,
      ay: number,
      bx: number,
      by: number,
      thresholdSq: number
    ) => number)
  | null = null;
let wasmInitPromise: Promise<void> | null = null;

type WasmExports = {
  point_segment_hit?: (
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    thresholdSq: number
  ) => number;
};

function getEdgeEndpoints(
  nodes: Map<string, { x: number; y: number; width: number; height: number }>,
  sourceId: string,
  targetId: string
): { sx: number; sy: number; tx: number; ty: number } | null {
  const s = nodes.get(sourceId);
  const t = nodes.get(targetId);
  if (!s || !t) return null;
  return {
    sx: s.x + s.width,
    sy: s.y + s.height / 2,
    tx: t.x,
    ty: t.y + t.height / 2,
  };
}

function post(message: CanvasWorkerResponse): void {
  self.postMessage(message);
}

function minDistSqToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    const ddx = px - ax;
    const ddy = py - ay;
    return ddx * ddx + ddy * ddy;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  const ddx = px - qx;
  const ddy = py - qy;
  return ddx * ddx + ddy * ddy;
}

function jsPointSegmentHit(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  thresholdSq: number
): boolean {
  return minDistSqToSegment(px, py, ax, ay, bx, by) <= thresholdSq;
}

function minDistSqToPolylineWithKernel(
  px: number,
  py: number,
  pts: { x: number; y: number }[],
  thresholdSq: number,
  kernel: (
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    thresholdSq: number
  ) => boolean
): boolean {
  if (pts.length < 2) return false;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (kernel(px, py, a.x, a.y, b.x, b.y, thresholdSq)) return true;
  }
  return false;
}

async function ensureEdgePickWasm(): Promise<void> {
  if (wasmPointSegmentHit) return;
  if (wasmInitPromise) return wasmInitPromise;
  wasmInitPromise = (async () => {
    try {
      const wasmUrl = new URL('/wasm/edgePickKernel.wasm', self.location.origin);
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new Error(`WASM fetch failed: ${response.status}`);
      const bytes = await response.arrayBuffer();
      const instance = await WebAssembly.instantiate(bytes, {});
      const fn = (instance.instance.exports as WasmExports).point_segment_hit;
      if (typeof fn === 'function') {
        wasmPointSegmentHit = fn;
      }
    } catch {
      wasmPointSegmentHit = null;
    }
  })();
  await wasmInitPromise;
}

async function handleMessage(msg: CanvasWorkerRequest): Promise<void> {
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

    if (msg.type === 'edge-pick-query') {
      if (msg.useWasm) {
        await ensureEdgePickWasm();
      }
      const segmentKernel = wasmPointSegmentHit
        ? (
            px: number,
            py: number,
            ax: number,
            ay: number,
            bx: number,
            by: number,
            thresholdSq: number
          ) => wasmPointSegmentHit!(px, py, ax, ay, bx, by, thresholdSq) !== 0
        : jsPointSegmentHit;
      const nodeById = new Map(msg.nodes.map((n) => [n.id, n]));
      let edgeId: string | null = null;
      for (let i = msg.edges.length - 1; i >= 0; i--) {
        const e = msg.edges[i]!;
        const pts = getEdgeEndpoints(nodeById, e.source, e.target);
        if (!pts) continue;
        const [p0, p1, p2, p3] = horizontalBezierControls(pts.sx, pts.sy, pts.tx, pts.ty);
        const samples = sampleCubicBezier(p0, p1, p2, p3, 24);
        if (minDistSqToPolylineWithKernel(msg.flowX, msg.flowY, samples, msg.thresholdSq, segmentKernel)) {
          edgeId = e.id;
          break;
        }
      }
      post({
        id: msg.id,
        ok: true,
        type: 'edge-pick-query',
        revision: msg.revision,
        edgeId,
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
}

self.onmessage = (event: MessageEvent<CanvasWorkerRequest>) => {
  void handleMessage(event.data);
};
