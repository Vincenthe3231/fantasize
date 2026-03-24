import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeScoutNode } from '@/lib/scoutRunCoordinator';
import { createVirtualProductionScoutTemplate } from '@/stores/workflowStore';
import type { ScoutPipelineState } from '@/lib/scoutPipeline';
import { DEFAULT_SCOUT_PIPELINE } from '@/lib/scoutPipeline';

vi.mock('@/lib/scoutExecutionApi', () => ({
  invokeScoutExecute: vi.fn(async () => ({
    ok: true,
    mock: true,
    result: {
      kind: 'stage2_instructions',
      refinedPrompt: 'Mock refined prompt from test.',
    },
  })),
}));

describe('scoutRunCoordinator', () => {
  const patches: Record<string, Record<string, unknown>> = {};

  beforeEach(() => {
    for (const k of Object.keys(patches)) delete patches[k];
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
});
