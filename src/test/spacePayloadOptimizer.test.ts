import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import {
  estimateSnapshotBytes,
  sanitizeSnapshotForRemoteSave,
  listLargestNodeDataFields,
} from '@/lib/spacePayloadOptimizer';
import type { CanvasSnapshotPayload } from '@/lib/spaceDraftStorage';
import { DEFAULT_WORKFLOW_SETTINGS } from '@/stores/workflowStore';

function minimalPayload(overrides: Partial<CanvasSnapshotPayload> = {}): CanvasSnapshotPayload {
  return {
    nodes: [],
    edges: [],
    comments: [],
    settings: { ...DEFAULT_WORKFLOW_SETTINGS },
    node_grid_layouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

describe('spacePayloadOptimizer', () => {
  it('strips transient React Flow keys from nodes and edges', () => {
    const node: Node = {
      id: 'n1',
      type: 'default',
      position: { x: 1, y: 2 },
      data: { foo: 1 },
      selected: true,
      dragging: true,
      resizing: true,
      positionAbsolute: { x: 0, y: 0 },
    };
    const payload = minimalPayload({
      nodes: [node],
      edges: [{ id: 'e1', source: 'a', target: 'b', selected: true }],
    });
    const out = sanitizeSnapshotForRemoteSave(payload);
    expect((out.nodes[0] as Record<string, unknown>).selected).toBeUndefined();
    expect((out.nodes[0] as Record<string, unknown>).dragging).toBeUndefined();
    expect((out.edges[0] as Record<string, unknown>).selected).toBeUndefined();
    expect(out.nodes[0].id).toBe('n1');
  });

  it('estimateSnapshotBytes returns stable UTF-8 length', () => {
    const p = minimalPayload({
      nodes: [{ id: 'x', position: { x: 0, y: 0 }, data: { t: 'é' } }],
    });
    const sanitized = sanitizeSnapshotForRemoteSave(p);
    expect(estimateSnapshotBytes(sanitized)).toBeGreaterThan(100);
  });

  it('listLargestNodeDataFields ranks large strings', () => {
    const big = 'x'.repeat(5000);
    const nodes: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { small: 'hi', big } },
    ];
    const top = listLargestNodeDataFields(nodes, 5);
    expect(top[0]?.path).toContain('big');
    expect(top[0]?.bytes).toBeGreaterThan(4000);
  });
});
