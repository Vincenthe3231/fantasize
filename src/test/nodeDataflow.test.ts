import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeReactivePatchesFromSources } from '@/lib/nodeDataflow';

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
  it('propagates assistant refined prompt to image generator text-in', () => {
    const nodes: Node[] = [
      node('assistant-1', 'assistantNode', { refinedPrompt: 'A cinematic interior prompt.' }),
      node('img-1', 'imageGeneratorNode', { prompt: '' }),
    ];
    const edges: Edge[] = [edge('assistant-1', 'img-1', 'text-out', 'text-in')];
    const patches = computeReactivePatchesFromSources(['assistant-1'], nodes, edges);
    expect(patches['img-1']?.prompt).toBe('A cinematic interior prompt.');
  });

  it('merges multiple text sources on same handle with dedupe ordering', () => {
    const nodes: Node[] = [
      node('text-1', 'textNode', { content: '<p>Shot from window side</p>' }),
      node('text-2', 'textNode', { content: '<p>Shot from window side</p>' }),
      node('text-3', 'textNode', { content: '<p>Warm practical lamp tone</p>' }),
      node('assistant-1', 'assistantNode', { prompt: '' }),
    ];
    const edges: Edge[] = [
      edge('text-1', 'assistant-1', 'text-out', 'text-in'),
      edge('text-2', 'assistant-1', 'text-out', 'text-in'),
      edge('text-3', 'assistant-1', 'text-out', 'text-in'),
    ];
    const patches = computeReactivePatchesFromSources(['text-1', 'text-2', 'text-3'], nodes, edges);
    expect(patches['assistant-1']?.prompt).toBe('Shot from window side\n\nWarm practical lamp tone');
  });

  it('propagates through downstream chain in one recompute pass', () => {
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
    expect(patches['assistant-1']?.prompt).toBe('Stage 2 intent');
    expect(patches['img-1']?.prompt).toBe('Stage 2 intent');
  });

  it('keeps only unique image urls when merging same-handle media', () => {
    const nodes: Node[] = [
      node('upload-1', 'uploadNode', { mediaUrl: 'https://example.com/a.jpg' }),
      node('upload-2', 'uploadNode', { mediaUrl: 'https://example.com/a.jpg' }),
      node('upload-3', 'uploadNode', { mediaUrl: 'https://example.com/b.jpg' }),
      node('assistant-1', 'assistantNode', { referenceUrl: '' }),
    ];
    const edges: Edge[] = [
      edge('upload-1', 'assistant-1', 'image-out', 'image-in'),
      edge('upload-2', 'assistant-1', 'image-out', 'image-in'),
      edge('upload-3', 'assistant-1', 'image-out', 'image-in'),
    ];
    const patches = computeReactivePatchesFromSources(['upload-1', 'upload-2', 'upload-3'], nodes, edges);
    expect(patches['assistant-1']?.referenceUrl).toBe('https://example.com/a.jpg');
  });
});
