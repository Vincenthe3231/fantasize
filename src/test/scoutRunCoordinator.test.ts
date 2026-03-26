import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeScoutNode } from '@/lib/scoutRunCoordinator';
import { createVirtualProductionScoutTemplate } from '@/stores/workflowStore';
import type { ScoutPipelineState } from '@/lib/scoutPipeline';
import { DEFAULT_SCOUT_PIPELINE } from '@/lib/scoutPipeline';
import { invokeScoutExecute } from '@/lib/scoutExecutionApi';
import { normalizeImageReferenceUrls } from '@/lib/scoutMediaUrlNormalizer';
import { notifySuccess, notifyWarning } from '@/lib/systemNotify';

vi.mock('@/lib/scoutExecutionApi', () => ({
  invokeScoutExecute: vi.fn(async (executionKind: string) => {
    if (executionKind === 'stage3_angle_variations') {
      return {
        ok: true,
        mock: true,
        result: {
          kind: 'stage3_angle_variations',
          angles: [{ id: 'a1', src: 'https://cdn.example/angle.jpg', resolution: '2K' }],
        },
      };
    }
    return {
      ok: true,
      mock: true,
      result: {
        kind: 'stage2_instructions',
        refinedPrompt: 'Mock refined prompt from test.',
      },
    };
  }),
}));

vi.mock('@/lib/scoutMediaUrlNormalizer', () => ({
  normalizeImageReferenceUrl: vi.fn(async (url: string) =>
    url.startsWith('http') ? url : 'https://cdn.example/normalized.jpg'
  ),
  normalizeImageReferenceUrls: vi.fn(async (urls: string[]) =>
    urls.map((u) => (u.startsWith('http') ? u : 'https://cdn.example/normalized.jpg'))
  ),
}));

vi.mock('@/lib/systemNotify', () => ({
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn(),
}));

describe('scoutRunCoordinator', () => {
  const patches: Record<string, Record<string, unknown>> = {};

  beforeEach(() => {
    for (const k of Object.keys(patches)) delete patches[k];
    vi.clearAllMocks();
  });

  it('executes assistant node and writes prompt result', async () => {
    const { nodes, edges } = createVirtualProductionScoutTemplate();
    const pipeline: ScoutPipelineState = { ...DEFAULT_SCOUT_PIPELINE };

    const r = await executeScoutNode({
      nodeId: 'assistant-1',
      nodes,
      edges,
      pipeline,
      getGridLayout: () => '2x2',
      updateNodeData: (id, data) => {
        patches[id] = { ...(patches[id] ?? {}), ...data };
      },
    });

    expect(r.ok).toBe(true);
    expect(patches['assistant-1']?.result).toBe('Mock refined prompt from test.');
  });

  it('normalizes Stage 3 sourceImageUrl before invoking scout-execute', async () => {
    const { nodes: baseNodes, edges } = createVirtualProductionScoutTemplate();
    const nodes = baseNodes.map((n) =>
      n.id === 'set-dressing-1' ? { ...n, data: { ...(n.data as object), previewUrl: 'data:image/png;base64,AAAA' } } : n
    );
    const pipeline: ScoutPipelineState = { ...DEFAULT_SCOUT_PIPELINE };

    const r = await executeScoutNode({
      nodeId: 'angle-var-1',
      nodes,
      edges,
      pipeline,
      getGridLayout: () => '2x2',
      updateNodeData: (id, data) => {
        patches[id] = { ...(patches[id] ?? {}), ...data };
      },
    });

    expect(r.ok).toBe(true);
    expect(normalizeImageReferenceUrls).toHaveBeenCalledWith(['data:image/png;base64,AAAA']);
    expect(invokeScoutExecute).toHaveBeenCalledWith(
      'stage3_angle_variations',
      expect.objectContaining({
        sourceImageUrl: 'https://cdn.example/normalized.jpg',
        sourceImageUrls: ['https://cdn.example/normalized.jpg'],
      }),
      expect.any(Object)
    );
    expect(notifyWarning).toHaveBeenCalledWith(
      'Stage 3 angle mismatch',
      expect.stringContaining('Requested 4 angles')
    );
  });

  it('fails fast when normalization throws and does not invoke scout-execute', async () => {
    vi.mocked(normalizeImageReferenceUrls).mockRejectedValueOnce(new Error('Upload blocked'));
    const { nodes: baseNodes, edges } = createVirtualProductionScoutTemplate();
    const nodes = baseNodes.map((n) =>
      n.id === 'set-dressing-1' ? { ...n, data: { ...(n.data as object), previewUrl: 'data:image/png;base64,AAAA' } } : n
    );
    const pipeline: ScoutPipelineState = { ...DEFAULT_SCOUT_PIPELINE };

    const r = await executeScoutNode({
      nodeId: 'angle-var-1',
      nodes,
      edges,
      pipeline,
      getGridLayout: () => '2x2',
      updateNodeData: () => {},
    });

    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Image reference normalization failed');
    expect(invokeScoutExecute).not.toHaveBeenCalledWith(
      'stage3_angle_variations',
      expect.anything(),
      expect.anything()
    );
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });
});
