import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import {
  resolveStage1Context,
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
