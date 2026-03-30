import type { SpatialNodeBounds, SpatialNodeDelta } from '@/lib/canvasWorkerProtocol';

type CellKey = string;

function cellKey(cx: number, cy: number): CellKey {
  return `${cx}:${cy}`;
}

function clampSize(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function rectToCellRange(
  rect: { x: number; y: number; width: number; height: number },
  cellSize: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const w = clampSize(rect.width);
  const h = clampSize(rect.height);
  const minX = Math.floor(rect.x / cellSize);
  const minY = Math.floor(rect.y / cellSize);
  const maxX = Math.floor((rect.x + w) / cellSize);
  const maxY = Math.floor((rect.y + h) / cellSize);
  return { minX, minY, maxX, maxY };
}

export class SpatialGridIndex {
  private readonly cellSize: number;
  private readonly cells = new Map<CellKey, Set<string>>();
  private readonly byId = new Map<string, SpatialNodeBounds>();

  constructor(cellSize = 320) {
    this.cellSize = Math.max(16, Math.round(cellSize));
  }

  clear(): void {
    this.cells.clear();
    this.byId.clear();
  }

  size(): number {
    return this.byId.size;
  }

  init(nodes: SpatialNodeBounds[]): void {
    this.clear();
    for (const node of nodes) this.insert(node);
  }

  applyDeltas(deltas: SpatialNodeDelta[]): void {
    for (const delta of deltas) {
      if (delta.from?.id) this.remove(delta.from.id);
      else if (delta.id) this.remove(delta.id);
      if (delta.to) this.insert(delta.to);
    }
  }

  queryRect(rect: { x: number; y: number; width: number; height: number }): string[] {
    const range = rectToCellRange(rect, this.cellSize);
    const seen = new Set<string>();
    for (let cx = range.minX; cx <= range.maxX; cx++) {
      for (let cy = range.minY; cy <= range.maxY; cy++) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const id of bucket) seen.add(id);
      }
    }
    return [...seen];
  }

  private insert(node: SpatialNodeBounds): void {
    const width = clampSize(node.width);
    const height = clampSize(node.height);
    if (width <= 0 || height <= 0) return;
    const normalized: SpatialNodeBounds = {
      id: node.id,
      x: node.x,
      y: node.y,
      width,
      height,
    };
    this.byId.set(node.id, normalized);
    const range = rectToCellRange(normalized, this.cellSize);
    for (let cx = range.minX; cx <= range.maxX; cx++) {
      for (let cy = range.minY; cy <= range.maxY; cy++) {
        const key = cellKey(cx, cy);
        const bucket = this.cells.get(key);
        if (bucket) bucket.add(node.id);
        else this.cells.set(key, new Set([node.id]));
      }
    }
  }

  private remove(id: string): void {
    const existing = this.byId.get(id);
    if (!existing) return;
    const range = rectToCellRange(existing, this.cellSize);
    for (let cx = range.minX; cx <= range.maxX; cx++) {
      for (let cy = range.minY; cy <= range.maxY; cy++) {
        const key = cellKey(cx, cy);
        const bucket = this.cells.get(key);
        if (!bucket) continue;
        bucket.delete(id);
        if (bucket.size === 0) this.cells.delete(key);
      }
    }
    this.byId.delete(id);
  }
}
