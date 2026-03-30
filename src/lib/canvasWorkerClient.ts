import { canvasPerfFlags, markCanvasPerfEnd, markCanvasPerfStart } from '@/lib/canvasPerf';
import type {
  CanvasWorkerRequest,
  CanvasWorkerResponse,
  SpatialNodeBounds,
  SpatialNodeDelta,
} from '@/lib/canvasWorkerProtocol';
import type { CanvasSnapshotPayload } from '@/lib/spaceDraftStorage';
import {
  estimateSnapshotBytes,
  listLargestNodeDataFields,
  sanitizeSnapshotForRemoteSave,
} from '@/lib/spacePayloadOptimizer';
import { SpatialGridIndex } from '@/lib/spatialIndex';

type PrepareRemoteSaveResult = {
  revision: number;
  sanitized: CanvasSnapshotPayload;
  bytesBefore: number;
  largestFields: ReturnType<typeof listLargestNodeDataFields>;
};

type Pending = {
  resolve: (value: CanvasWorkerResponse) => void;
  reject: (error: unknown) => void;
};

class CanvasWorkerClient {
  private nextId = 1;
  private workerRevision = 0;
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private fallbackSpatial = new SpatialGridIndex();
  private fallbackSpatialRevision = 0;

  private ensureWorker(): Worker | null {
    if (!canvasPerfFlags.enableCanvasWorkerBridge || typeof Worker === 'undefined') return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL('../workers/canvasComputeWorker.ts', import.meta.url), {
        type: 'module',
      });
      w.onmessage = (event: MessageEvent<CanvasWorkerResponse>) => {
        const response = event.data;
        const pending = this.pending.get(response.id);
        if (!pending) return;
        this.pending.delete(response.id);
        pending.resolve(response);
      };
      w.onerror = (event) => {
        const err = event.error ?? new Error(event.message || 'Canvas worker failed');
        this.rejectAll(err);
        this.worker = null;
      };
      this.worker = w;
      return w;
    } catch {
      this.worker = null;
      return null;
    }
  }

  private rejectAll(error: unknown): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  nextRevision(): number {
    this.workerRevision += 1;
    return this.workerRevision;
  }

  async prepareRemoteSave(
    payload: CanvasSnapshotPayload,
    revision = this.nextRevision(),
    topN = 8
  ): Promise<PrepareRemoteSaveResult> {
    const worker = this.ensureWorker();
    if (!worker) {
      const sanitized = sanitizeSnapshotForRemoteSave(payload);
      return {
        revision,
        sanitized,
        bytesBefore: estimateSnapshotBytes(sanitized),
        largestFields: listLargestNodeDataFields(sanitized.nodes, topN),
      };
    }
    const response = await this.request({
      id: this.nextId++,
      type: 'prepare-remote-save',
      revision,
      payload,
      topN,
    });
    if (!response.ok || response.type !== 'prepare-remote-save') {
      throw new Error(response.ok ? 'Worker prepare response mismatch' : response.error);
    }
    return {
      revision: response.revision,
      sanitized: response.sanitized,
      bytesBefore: response.bytesBefore,
      largestFields: response.largestFields,
    };
  }

  async spatialInit(nodes: SpatialNodeBounds[], revision = this.nextRevision()): Promise<void> {
    const worker = this.ensureWorker();
    if (!worker) {
      this.fallbackSpatialRevision = revision;
      this.fallbackSpatial.init(nodes);
      return;
    }
    const response = await this.request({
      id: this.nextId++,
      type: 'spatial-index-init',
      revision,
      nodes,
    });
    if (!response.ok || response.type !== 'spatial-index-init') {
      throw new Error(response.ok ? 'Worker spatial init response mismatch' : response.error);
    }
  }

  async spatialUpdate(deltas: SpatialNodeDelta[], revision = this.nextRevision()): Promise<void> {
    const worker = this.ensureWorker();
    if (!worker) {
      if (revision < this.fallbackSpatialRevision) return;
      this.fallbackSpatialRevision = revision;
      this.fallbackSpatial.applyDeltas(deltas);
      return;
    }
    const response = await this.request({
      id: this.nextId++,
      type: 'spatial-index-update',
      revision,
      deltas,
    });
    if (!response.ok || response.type !== 'spatial-index-update') {
      throw new Error(response.ok ? 'Worker spatial update response mismatch' : response.error);
    }
  }

  async spatialQueryRect(
    rect: { x: number; y: number; width: number; height: number },
    revision = this.workerRevision
  ): Promise<string[]> {
    const worker = this.ensureWorker();
    if (!worker) {
      return this.fallbackSpatial.queryRect(rect);
    }
    const response = await this.request({
      id: this.nextId++,
      type: 'spatial-index-query-rect',
      revision,
      rect,
    });
    if (!response.ok || response.type !== 'spatial-index-query-rect') {
      throw new Error(response.ok ? 'Worker spatial query response mismatch' : response.error);
    }
    return response.candidateIds;
  }

  private request(message: CanvasWorkerRequest): Promise<CanvasWorkerResponse> {
    const worker = this.ensureWorker();
    if (!worker) {
      return Promise.reject(new Error('Canvas worker unavailable'));
    }
    return new Promise<CanvasWorkerResponse>((resolve, reject) => {
      const markName = `canvas.worker.${message.type}`;
      const t0 = markCanvasPerfStart(markName);
      this.pending.set(message.id, { resolve, reject });
      worker.postMessage(message);
      const previous = this.pending.get(message.id);
      if (!previous) return;
      this.pending.set(message.id, {
        resolve: (value) => {
          markCanvasPerfEnd(markName, t0);
          previous.resolve(value);
        },
        reject: (error) => {
          markCanvasPerfEnd(markName, t0);
          previous.reject(error);
        },
      });
    });
  }
}

export const canvasWorkerClient = new CanvasWorkerClient();
