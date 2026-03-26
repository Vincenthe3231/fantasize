import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import {
  resolveStage1Context,
  resolveStage2ImageGeneratorContext,
  resolveStage2InstructionsContext,
  resolveStage4Context,
} from '@/lib/scoutContextResolver';
import { MOCK } from '@/lib/mockPipelineAssets';
import { createVirtualProductionScoutTemplate } from '@/stores/workflowStore';

describe('scoutContextResolver', () => {
  it('resolves Stage 1 from the default Scout template', () => {
    const { nodes } = createVirtualProductionScoutTemplate();
    const r = resolveStage1Context(nodes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.locationImages.length).toBeGreaterThan(0);
      expect(r.value.props.length).toBeGreaterThan(0);
    }
  });

  it('picks a non-empty upload/placement when earlier nodes of the same type are empty', () => {
    const { nodes: base } = createVirtualProductionScoutTemplate();
    const nodes = base.map((n) => {
      if (n.id === 'upload-1') {
        return { ...n, data: { ...n.data, mediaUrl: '' } } as Node;
      }
      if (n.id === 'placement-1') {
        return { ...n, data: { ...n.data, placementText: '<p></p>', placementRefUrl: '' } } as Node;
      }
      return n;
    });
    nodes.push({
      id: 'upload-2',
      type: 'uploadNode',
      position: { x: 0, y: 0 },
      data: { mediaUrl: MOCK.location2 },
    });
    nodes.push({
      id: 'placement-2',
      type: 'placementRefNode',
      position: { x: 0, y: 0 },
      data: { placementText: `<p>Marked placement</p>`, placementRefUrl: '' },
    });
    const r = resolveStage1Context(nodes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.locationImages[0]?.url).toBe(MOCK.location2);
      expect(r.value.placementPlain).toContain('Marked placement');
    }
  });

  it('uses default prop slots when propsInputNode has empty props array', () => {
    const { nodes: base } = createVirtualProductionScoutTemplate();
    const nodes = base.map((n) =>
      n.id === 'props-input-1' ? ({ ...n, data: { props: [] } } as Node) : n
    );
    const r = resolveStage1Context(nodes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.props.length).toBeGreaterThan(0);
    }
  });

  it('resolves Stage 2 instructions context for the assistant node', () => {
    const { nodes, edges } = createVirtualProductionScoutTemplate();
    const r = resolveStage2InstructionsContext(nodes, edges, 'assistant-1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe('stage2_instructions');
      expect(r.value.assistantNodeId).toBe('assistant-1');
    }
  });

  it('resolves edgeInputs for assistant text-in and image-in (handle-aware)', () => {
    const { nodes, edges } = createVirtualProductionScoutTemplate();
    const r = resolveStage2InstructionsContext(nodes, edges, 'assistant-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.edgeInputs.length).toBe(2);
    expect(r.value.edgeInputs[0]?.kind).toBe('text');
    expect(r.value.edgeInputs[0]?.edgeId).toBe('e-text-assistant');
    expect(r.value.edgeInputs[1]?.kind).toBe('image');
    expect(r.value.edgeInputs[1]?.edgeId).toBe('e-upload-assistant');
    if (r.value.edgeInputs[1]?.kind === 'image') {
      expect(r.value.edgeInputs[1].url).toBe(MOCK.location1);
    }
    const s1 = resolveStage1Context(nodes);
    expect(s1.ok).toBe(true);
    if (s1.ok) {
      expect(r.value.placementAndNotes).toBe(s1.value.placementPlain);
    }
  });

  it('resolves Stage 2 image generator with handle-aware text-in and image-in', () => {
    const nodes: Node[] = [
      { id: 'tx', type: 'textNode', data: { content: '<p>Wired hint</p>' }, position: { x: 0, y: 0 } },
      { id: 'up', type: 'uploadNode', data: { mediaUrl: 'https://example.com/x.jpg' }, position: { x: 0, y: 0 } },
      { id: 'ig', type: 'imageGeneratorNode', data: { prompt: '<p>Local</p>' }, position: { x: 0, y: 0 } },
    ];
    const edges = [
      {
        id: 'e-tx-ig',
        source: 'tx',
        target: 'ig',
        sourceHandle: 'text-out',
        targetHandle: 'text-in',
        type: 'custom' as const,
      },
      {
        id: 'e-up-ig',
        source: 'up',
        target: 'ig',
        sourceHandle: 'image-out',
        targetHandle: 'image-in',
        type: 'custom' as const,
      },
    ];
    const r = resolveStage2ImageGeneratorContext(nodes, edges, 'ig');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.prompt).toContain('Local');
    expect(r.value.wiredTextFromEdges).toBe('Wired hint');
    expect(r.value.anchorImageUrls).toContain('https://example.com/x.jpg');
  });

  it('extracts ordered promptItems from listNode text cells for queue mode', () => {
    const nodes: Node[] = [
      {
        id: 'list-1',
        type: 'listNode',
        data: {
          items: [
            { id: 't1', type: 'text', text: 'Prompt A' },
            { id: 't2', type: 'text', text: 'Prompt B' },
          ],
        },
        position: { x: 0, y: 0 },
      },
      { id: 'ig', type: 'imageGeneratorNode', data: { prompt: '' }, position: { x: 0, y: 0 } },
    ];
    const edges = [
      {
        id: 'e-list-ig',
        source: 'list-1',
        target: 'ig',
        sourceHandle: 'text-out',
        targetHandle: 'text-in',
        type: 'custom' as const,
      },
    ];
    const r = resolveStage2ImageGeneratorContext(nodes, edges, 'ig');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.queueMode).toBe('perPromptSequential');
    expect(r.value.promptItems).toEqual(['Prompt A', 'Prompt B']);
  });

  it('resolves Stage 2 image generator with group-out-image aggregate', () => {
    const nodes: Node[] = [
      { id: 'g', type: 'group', data: {}, position: { x: 0, y: 0 } },
      {
        id: 'up',
        type: 'uploadNode',
        data: { mediaUrl: 'https://example.com/g.jpg' },
        position: { x: 0, y: 0 },
        parentId: 'g',
      },
      { id: 'ig', type: 'imageGeneratorNode', data: { prompt: 'Scene' }, position: { x: 0, y: 0 } },
    ];
    const edges = [
      {
        id: 'e-g-ig',
        source: 'g',
        target: 'ig',
        sourceHandle: 'group-out-image',
        targetHandle: 'image-in',
        type: 'custom' as const,
      },
    ];
    const r = resolveStage2ImageGeneratorContext(nodes, edges, 'ig');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.anchorImageUrls).toEqual(['https://example.com/g.jpg']);
  });

  it('allows image generator context when prompt is empty but text-in supplies wired text', () => {
    const nodes: Node[] = [
      { id: 'tx', type: 'textNode', data: { content: '<p>Edge only</p>' }, position: { x: 0, y: 0 } },
      { id: 'ig', type: 'imageGeneratorNode', data: { prompt: '' }, position: { x: 0, y: 0 } },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'tx',
        target: 'ig',
        sourceHandle: 'text-out',
        targetHandle: 'text-in',
        type: 'custom' as const,
      },
    ];
    const r = resolveStage2ImageGeneratorContext(nodes, edges, 'ig');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.prompt).toBe('');
    expect(r.value.wiredTextFromEdges).toBe('Edge only');
  });

  it('resolves Stage 4 lighting batch when selected shot is wired', () => {
    const { nodes, edges } = createVirtualProductionScoutTemplate();
    const r = resolveStage4Context(nodes, edges, 'lighting-1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe('stage4_lighting_batch');
      expect(r.value.lightingLabels.length).toBeGreaterThan(0);
    }
  });
});
