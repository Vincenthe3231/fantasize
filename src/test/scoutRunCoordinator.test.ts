import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeScoutNode } from '@/lib/scoutRunCoordinator';
import { createVirtualProductionScoutTemplate } from '@/stores/workflowStore';
import type { ScoutPipelineState } from '@/lib/scoutPipeline';
import { DEFAULT_SCOUT_PIPELINE } from '@/lib/scoutPipeline';
import { invokeScoutExecute } from '@/lib/scoutExecutionApi';
import { normalizeImageReferenceUrls } from '@/lib/scoutMediaUrlNormalizer';
import { notifySuccess, notifyWarning } from '@/lib/systemNotify';
import { uploadGeneratedImagesWithMetadata } from '@/lib/batchImageUpload';
import type { Edge, Node } from 'reactflow';

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

vi.mock('@/lib/batchImageUpload', () => ({
  uploadGeneratedImagesWithMetadata: vi.fn(async (urls: string[], meta: { referer?: string; generatedBy?: string }) =>
    Object.fromEntries(urls.map((u) => [u, { ...meta, timestamp: 1, supabaseUrl: u }]))
  ),
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
      updateNodeDataSilent: (id, data) => {
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
      updateNodeDataSilent: (id, data) => {
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
      updateNodeDataSilent: () => {},
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

  it('runs prompt queue sequentially with retry once and incremental stage2 updates', async () => {
    const nodes: Node[] = [
      {
        id: 'list-1',
        type: 'listNode',
        position: { x: 0, y: 0 },
        data: {
          items: [
            { id: 't1', type: 'text', text: 'Prompt One' },
            { id: 't2', type: 'text', text: 'Prompt Two' },
          ],
        },
      },
      {
        id: 'img-1',
        type: 'imageGeneratorNode',
        position: { x: 0, y: 0 },
        data: { prompt: '', images: 2, mode: 'Auto', aspect: '1:1' },
      },
    ];
    const edges: Edge[] = [
      {
        id: 'e-list-img',
        source: 'list-1',
        target: 'img-1',
        sourceHandle: 'text-out',
        targetHandle: 'text-in',
        type: 'custom' as const,
      },
    ];
    const pipeline: ScoutPipelineState = { ...DEFAULT_SCOUT_PIPELINE };

    const seenPrompts: string[] = [];
    let failSecondPromptOnce = true;
    vi.mocked(invokeScoutExecute).mockImplementation(async (_kind, context: Record<string, unknown>) => {
      const prompt = String(context.prompt ?? '');
      seenPrompts.push(prompt);
      if (prompt === 'Prompt Two' && failSecondPromptOnce) {
        failSecondPromptOnce = false;
        return { ok: false, error: 'Temporary failure' };
      }
      return {
        ok: true,
        mock: true,
        result: {
          kind: 'stage2_image_generator',
          generatedUrl: `https://cdn.example/${encodeURIComponent(prompt)}-1.jpg`,
          generatedUrls: [
            `https://cdn.example/${encodeURIComponent(prompt)}-1.jpg`,
            `https://cdn.example/${encodeURIComponent(prompt)}-2.jpg`,
          ],
          status: 'success' as const,
        },
      };
    });

    const imageUpdateBatches: Array<string[]> = [];
    const r = await executeScoutNode({
      nodeId: 'img-1',
      nodes,
      edges,
      pipeline,
      getGridLayout: () => '2x2',
      updateNodeDataSilent: (_id, data) => {
        if (Array.isArray(data.generatedUrls)) {
          imageUpdateBatches.push(data.generatedUrls.map((u) => String(u)));
        }
      },
    });

    expect(r.ok).toBe(true);
    expect(seenPrompts).toEqual(['Prompt One', 'Prompt Two', 'Prompt Two']);
    expect(imageUpdateBatches).toHaveLength(2);
    expect(imageUpdateBatches[0]?.length).toBe(2);
    expect(imageUpdateBatches[1]?.length).toBe(2);
    expect(uploadGeneratedImagesWithMetadata).toHaveBeenCalledTimes(2);
    expect(notifyWarning).toHaveBeenCalledWith('Prompt generation failed', expect.stringContaining('Retrying prompt 2/2'));
  });

  it('appends generated images to list nodes wired image-out → image-in', async () => {
    const nodes: Node[] = [
      {
        id: 'list-1',
        type: 'listNode',
        position: { x: 0, y: 0 },
        data: { items: [{ id: 't1', type: 'text', text: 'keep' }] },
      },
      {
        id: 'img-1',
        type: 'imageGeneratorNode',
        position: { x: 0, y: 0 },
        data: { prompt: 'a cat', images: 1, mode: 'Auto', aspect: '1:1' },
      },
    ];
    const edges: Edge[] = [
      {
        id: 'e-ig-list',
        source: 'img-1',
        target: 'list-1',
        sourceHandle: 'image-out',
        targetHandle: 'image-in',
        type: 'custom' as const,
      },
    ];
    vi.mocked(invokeScoutExecute).mockImplementationOnce(async () => ({
      ok: true,
      mock: true,
      result: {
        kind: 'stage2_image_generator',
        generatedUrl: 'https://cdn.example/gen.jpg',
        generatedUrls: ['https://cdn.example/gen.jpg'],
        status: 'success' as const,
      },
    }));

    const patches: Record<string, Record<string, unknown>> = {};
    const r = await executeScoutNode({
      nodeId: 'img-1',
      nodes,
      edges,
      pipeline: DEFAULT_SCOUT_PIPELINE,
      getGridLayout: () => '2x2',
      updateNodeDataSilent: (id, data) => {
        patches[id] = { ...(patches[id] ?? {}), ...data };
      },
    });

    expect(r.ok).toBe(true);
    const items = patches['list-1']?.items as Array<{ type?: string; mediaUrl?: string; text?: string }> | undefined;
    expect(Array.isArray(items)).toBe(true);
    expect(items?.some((x) => x.type === 'image' && x.mediaUrl === 'https://cdn.example/gen.jpg')).toBe(true);
    expect(items?.some((x) => x.type === 'text' && x.text === 'keep')).toBe(true);
  });
});
