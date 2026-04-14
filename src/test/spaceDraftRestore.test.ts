import { describe, expect, it } from 'vitest';
import { localDraftIsRegressiveVersusServer } from '@/lib/spaceDraftStorage';
import type { SpaceRow } from '@/lib/spaceApi';

function minimalSpace(overrides: Partial<SpaceRow>): SpaceRow {
  return {
    id: 's',
    owner_id: 'o',
    name: 't',
    nodes: [],
    edges: [],
    comments: [],
    canvas_drawings: [],
    settings: null,
    node_grid_layouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('localDraftIsRegressiveVersusServer', () => {
  it('returns false when server is empty', () => {
    const space = minimalSpace({ nodes: [], edges: [] });
    expect(
      localDraftIsRegressiveVersusServer(
        { nodes: [], edges: [], comments: [], settings: {} as never, node_grid_layouts: {}, viewport: { x: 0, y: 0, zoom: 1 } },
        space
      )
    ).toBe(false);
  });

  it('returns true when server has graph but draft is completely empty', () => {
    const space = minimalSpace({
      nodes: [{ id: 'a' } as never],
      edges: [{ id: 'e1' } as never],
    });
    expect(
      localDraftIsRegressiveVersusServer(
        {
          nodes: [],
          edges: [],
          comments: [],
          settings: {} as never,
          node_grid_layouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        space
      )
    ).toBe(true);
  });

  it('returns true when server has many edges but draft has none (bad IDB snapshot)', () => {
    const edges = Array.from({ length: 24 }, (_, i) => ({ id: `e${i}` }));
    const space = minimalSpace({
      nodes: [{ id: 'n1' } as never],
      edges: edges as never[],
    });
    expect(
      localDraftIsRegressiveVersusServer(
        {
          nodes: [{ id: 'n1' } as never],
          edges: [],
          comments: [],
          settings: {} as never,
          node_grid_layouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        space
      )
    ).toBe(true);
  });

  it('returns false when draft also has edges (real local edits)', () => {
    const space = minimalSpace({
      nodes: [{ id: 'n1' } as never],
      edges: [{ id: 'e1' } as never, { id: 'e2' } as never],
    });
    expect(
      localDraftIsRegressiveVersusServer(
        {
          nodes: [{ id: 'n1' } as never],
          edges: [{ id: 'e1' } as never],
          comments: [],
          settings: {} as never,
          node_grid_layouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        space
      )
    ).toBe(false);
  });
});
