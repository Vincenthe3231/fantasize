import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeNodeInputPatch, computeReactivePatchesFromSources } from '@/lib/nodeDataflow';
import { resolveStage2ImageGeneratorContext } from '@/lib/scoutContextResolver';
import { upstreamImageItemsFromNode, upstreamTextFromNode } from '@/lib/graphUpstreamPayload';

function node(id: string, type: string, data: Record<string, unknown>): Node {
  return {
    id,
    type,
    data,
    position: { x: 0, y: 0 },
  };
}

function edge(source: string, target: string, sourceHandle?: string, targetHandle?: string): Edge {
  return {
    id: `e-${source}-${target}-${sourceHandle ?? 'default'}-${targetHandle ?? 'default'}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'custom',
  };
}

describe('nodeDataflow', () => {
  it('does not write upstream text into image generator prompt (context via edges only)', () => {
    const nodes: Node[] = [
      node('assistant-1', 'assistantNode', { refinedPrompt: 'A cinematic interior prompt.' }),
      node('img-1', 'imageGeneratorNode', { prompt: '' }),
    ];
    const edges: Edge[] = [edge('assistant-1', 'img-1', 'text-out', 'text-in')];
    const patches = computeReactivePatchesFromSources(['assistant-1'], nodes, edges);
    expect(patches['img-1']).toBeUndefined();
  });

  it('does not patch target when sourceHandle is omitted (default resolution)', () => {
    const nodes: Node[] = [
      node('assistant-1', 'assistantNode', { refinedPrompt: 'Wired without explicit source handle.' }),
      node('img-1', 'imageGeneratorNode', { prompt: '' }),
    ];
    const edges: Edge[] = [edge('assistant-1', 'img-1', undefined, 'text-in')];
    const patches = computeReactivePatchesFromSources(['assistant-1'], nodes, edges);
    expect(patches['img-1']).toBeUndefined();
  });

  it('does not merge text into assistant wiredTextFromEdges field', () => {
    const nodes: Node[] = [
      node('text-1', 'textNode', { content: '<p>Shot from window side</p>' }),
      node('text-2', 'textNode', { content: '<p>Warm practical lamp tone</p>' }),
      node('assistant-1', 'assistantNode', { prompt: '' }),
    ];
    const edges: Edge[] = [
      edge('text-1', 'assistant-1', 'text-out', 'text-in'),
      edge('text-2', 'assistant-1', 'text-out', 'text-in'),
    ];
    const patches = computeReactivePatchesFromSources(['text-1', 'text-2'], nodes, edges);
    expect(patches['assistant-1']).toBeUndefined();
  });

  it('does not propagate through chain into downstream node data', () => {
    const nodes: Node[] = [
      node('text-1', 'textNode', { content: '<p>Stage 2 intent</p>' }),
      node('assistant-1', 'assistantNode', { prompt: '' }),
      node('img-1', 'imageGeneratorNode', { prompt: '' }),
    ];
    const edges: Edge[] = [
      edge('text-1', 'assistant-1', 'text-out', 'text-in'),
      edge('assistant-1', 'img-1', 'text-out', 'text-in'),
    ];
    const patches = computeReactivePatchesFromSources(['text-1'], nodes, edges);
    expect(patches['assistant-1']).toBeUndefined();
    expect(patches['img-1']).toBeUndefined();
  });

  it('does not copy image wires into assistant referenceUrl', () => {
    const nodes: Node[] = [
      node('upload-1', 'uploadNode', { mediaUrl: 'https://example.com/a.jpg' }),
      node('assistant-1', 'assistantNode', { referenceUrl: '' }),
    ];
    const edges: Edge[] = [edge('upload-1', 'assistant-1', 'image-out', 'image-in')];
    const patches = computeReactivePatchesFromSources(['upload-1'], nodes, edges);
    expect(patches['assistant-1']).toBeUndefined();
  });

  it('does not patch image generator from group-out-text', () => {
    const nodes: Node[] = [
      { id: 'g1', type: 'group', data: {}, position: { x: 0, y: 0 } },
      {
        id: 't1',
        type: 'textNode',
        data: { content: '<p>Alpha</p>' },
        position: { x: 0, y: 0 },
        parentId: 'g1',
      },
      {
        id: 't2',
        type: 'textNode',
        data: { content: '<p>Beta</p>' },
        position: { x: 0, y: 0 },
        parentId: 'g1',
      },
      node('img-1', 'imageGeneratorNode', { prompt: '' }),
    ];
    const edges: Edge[] = [edge('g1', 'img-1', 'group-out-text', 'text-in')];
    const img = nodes.find((n) => n.id === 'img-1')!;
    const patch = computeNodeInputPatch(img, nodes, edges);
    expect(patch).toBeNull();
  });

  it('does not patch when both group and child are recomputed', () => {
    const nodes: Node[] = [
      { id: 'g1', type: 'group', data: {}, position: { x: 0, y: 0 } },
      {
        id: 't1',
        type: 'textNode',
        data: { content: '<p>From child</p>' },
        position: { x: 0, y: 0 },
        parentId: 'g1',
      },
      node('img-1', 'imageGeneratorNode', { prompt: '' }),
    ];
    const edges: Edge[] = [edge('g1', 'img-1', 'group-out-text', 'text-in')];
    const patches = computeReactivePatchesFromSources(['t1', 'g1'], nodes, edges);
    expect(patches['img-1']).toBeUndefined();
  });

  it('does not patch listNode text into assistant', () => {
    const nodes: Node[] = [
      node('list-1', 'listNode', {
        items: [
          { id: 't1', type: 'text', text: 'Lighting soft cool' },
          { id: 't2', type: 'text', text: 'Golden hour warmth' },
        ],
      }),
      node('assistant-1', 'assistantNode', { prompt: '' }),
    ];
    const edges: Edge[] = [edge('list-1', 'assistant-1', 'text-out', 'text-in')];
    const patches = computeReactivePatchesFromSources(['list-1'], nodes, edges);
    expect(patches['assistant-1']).toBeUndefined();
  });

  it('does not patch image generator from list image-out', () => {
    const nodes: Node[] = [
      node('list-1', 'listNode', {
        items: [
          { id: 'm1', type: 'image', mediaUrl: 'https://example.com/first.jpg', mediaName: 'First' },
          { id: 'm2', type: 'image', mediaUrl: 'https://example.com/second.jpg', mediaName: 'Second' },
        ],
      }),
      node('img-1', 'imageGeneratorNode', { mediaUrl: '' }),
    ];
    const edges: Edge[] = [edge('list-1', 'img-1', 'image-out', 'image-in')];
    const patches = computeReactivePatchesFromSources(['list-1'], nodes, edges);
    expect(patches['img-1']).toBeUndefined();
  });

  it('does not patch mediaUrl from multi-select list', () => {
    const nodes: Node[] = [
      node('list-1', 'listNode', {
        listMultiSelectMode: true,
        listSelectedImageIds: ['m2'],
        items: [
          { id: 'm1', type: 'image', mediaUrl: 'https://example.com/first.jpg', mediaName: 'First' },
          { id: 'm2', type: 'image', mediaUrl: 'https://example.com/second.jpg', mediaName: 'Second' },
        ],
      }),
      node('img-1', 'imageGeneratorNode', { mediaUrl: '' }),
    ];
    const edges: Edge[] = [edge('list-1', 'img-1', 'image-out', 'image-in')];
    const patches = computeReactivePatchesFromSources(['list-1'], nodes, edges);
    expect(patches['img-1']).toBeUndefined();
  });

  it('emits no listNode image packet when multi-select mode is enabled and no image is selected', () => {
    const list = node('list-1', 'listNode', {
      listMultiSelectMode: true,
      listSelectedImageIds: [],
      items: [
        { id: 'm1', type: 'image', mediaUrl: 'https://example.com/x.png', mediaName: 'X' },
      ],
    });
    const nodes: Node[] = [list];
    expect(upstreamImageItemsFromNode(list, nodes)).toEqual([]);
  });

  it('keeps list subset for upstream wiring after multi-select mode is turned off', () => {
    const list = node('list-1', 'listNode', {
      listMultiSelectMode: false,
      listSelectedImageIds: ['m2', 'm3'],
      items: [
        { id: 'm1', type: 'image', mediaUrl: 'https://example.com/a.png', mediaName: 'A' },
        { id: 'm2', type: 'image', mediaUrl: 'https://example.com/b.png', mediaName: 'B' },
        { id: 'm3', type: 'image', mediaUrl: 'https://example.com/c.png', mediaName: 'C' },
      ],
    });
    const nodes: Node[] = [list];
    expect(upstreamImageItemsFromNode(list, nodes)).toEqual([
      { url: 'https://example.com/b.png', label: 'B' },
      { url: 'https://example.com/c.png', label: 'C' },
    ]);
  });

  it('exposes listNode items via upstreamTextFromNode and upstreamImageItemsFromNode', () => {
    const list = node('list-1', 'listNode', {
      items: [
        { id: 't1', type: 'text', text: 'Scout line' },
        { id: 'm1', type: 'image', mediaUrl: 'https://example.com/x.png', mediaName: 'X' },
      ],
    });
    const nodes: Node[] = [list];
    expect(upstreamTextFromNode(list, nodes)).toBe('Scout line');
    expect(upstreamImageItemsFromNode(list, nodes)).toEqual([
      { url: 'https://example.com/x.png', label: 'X' },
    ]);
  });

  it('does not append to listNode items from image generator image-out', () => {
    const nodes: Node[] = [
      node('img-1', 'imageGeneratorNode', {
        generatedUrl: 'https://example.com/a.png',
        generatedUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
        generatedImageMetaByUrl: {
          'https://example.com/a.png': { referer: 'https://vision-forge.local', generatedBy: 'img-1' },
          'https://example.com/b.png': { referer: 'https://vision-forge.local', generatedBy: 'img-1' },
        },
      }),
      node('list-2', 'listNode', {
        items: [{ id: 't1', type: 'text', text: 'keep me' }],
      }),
    ];
    const edges: Edge[] = [edge('img-1', 'list-2', 'image-out', 'image-in')];
    const patches = computeReactivePatchesFromSources(['img-1'], nodes, edges);
    expect(patches['list-2']).toBeUndefined();
  });

  it('resolveStage2ImageGeneratorContext still reads wired text from edge sources', () => {
    const nodes: Node[] = [
      node('text-1', 'textNode', { content: '<p>From upstream</p>' }),
      node('img-1', 'imageGeneratorNode', { prompt: 'Local only' }),
    ];
    const edges: Edge[] = [edge('text-1', 'img-1', 'text-out', 'text-in')];
    const res = resolveStage2ImageGeneratorContext(nodes, edges, 'img-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.wiredTextFromEdges).toContain('From upstream');
    expect(res.value.prompt).toBe('Local only');
  });

  it('resolveStage2ImageGeneratorContext follows Text → Assistant → IG without patched target data', () => {
    const nodes: Node[] = [
      node('text-1', 'textNode', { content: '<p>Chain hint</p>' }),
      node('asst-1', 'assistantNode', { prompt: '' }),
      node('img-1', 'imageGeneratorNode', { prompt: '' }),
    ];
    const edges: Edge[] = [
      edge('text-1', 'asst-1', 'text-out', 'text-in'),
      edge('asst-1', 'img-1', 'text-out', 'text-in'),
    ];
    const res = resolveStage2ImageGeneratorContext(nodes, edges, 'img-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.wiredTextFromEdges).toContain('Chain hint');
  });
});
