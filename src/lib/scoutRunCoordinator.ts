import type { Edge, Node } from 'reactflow';
import type { ScoutExecutionKind, ScoutExecutionResult, ScoutRemoteContext } from '@/lib/scoutContextContracts';
import { invokeScoutExecute } from '@/lib/scoutExecutionApi';
import { mapScoutResultToNodePatches, type StageResultTargets } from '@/lib/scoutResultMappers';
import {
  resolveStage2InstructionsContext,
  resolveStage2ImageGeneratorContext,
  resolveStage2SetDressingContext,
  resolveStage3Context,
  resolveStage4Context,
  resolveStage5Context,
  scoutExecutionKindForNodeType,
  type ScoutGridLayout,
} from '@/lib/scoutContextResolver';
import { runScoutComplianceChecks } from '@/lib/scoutComplianceChecks';
import type { ScoutPipelineState } from '@/lib/scoutPipeline';
import { scoutDebugLog, summarizeForScoutLog } from '@/lib/scoutDebugLog';

export interface ScoutRunOptions {
  /** Required for `atmosphereTestNode` — which branch to execute */
  atmosphereBranch?: 'text' | 'reference';
}

export interface ScoutCoordinatorDeps {
  nodeId: string;
  nodes: Node[];
  edges: Edge[];
  pipeline: ScoutPipelineState;
  /** Grid layout for angle variations */
  getGridLayout: (nodeId: string) => ScoutGridLayout;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  options?: ScoutRunOptions;
}

function picsum(seed: string, w = 800, h = 450): string {
  const s = encodeURIComponent(seed.slice(0, 40));
  return `https://picsum.photos/seed/${s}/${w}/${h}`;
}

function buildMockResult(kind: ScoutExecutionKind, ctx: ScoutRemoteContext): ScoutExecutionResult {
  const ts = Date.now();
  switch (kind) {
    case 'stage2_instructions':
      return {
        kind: 'stage2_instructions',
        refinedPrompt: [
          '[Mock] Set dressing instructions based on placement and references.',
          'Layout: preserve spatial relationships from the placement brief.',
          'Style: match prop references; lighting intent: neutral studio key.',
          ctx && 'placementAndNotes' in ctx ? `Notes: ${String(ctx.placementAndNotes).slice(0, 500)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    case 'stage2_image_generator':
      return {
        kind: 'stage2_image_generator',
        generatedUrl: picsum(`gen-${ts}`),
        status: 'success',
      };
    case 'stage2_set_dressing':
      return {
        kind: 'stage2_set_dressing',
        previewUrl: picsum(`set-${ts}`),
      };
    case 'stage3_angle_variations': {
      const c = ctx as { count?: number };
      const n = Math.min(9, Math.max(1, c.count ?? 4));
      return {
        kind: 'stage3_angle_variations',
        angles: Array.from({ length: n }, (_, i) => ({
          id: `ang-mock-${ts}-${i}`,
          src: picsum(`ang-${ts}-${i}`),
          resolution: '4K',
        })),
      };
    }
    case 'stage4_lighting_batch': {
      const labels = (ctx as { lightingLabels?: string[] }).lightingLabels ?? [];
      return {
        kind: 'stage4_lighting_batch',
        results: labels.map((label, i) => ({
          id: `lit-mock-${ts}-${i}`,
          label,
          src: picsum(`lit-${label}-${i}`),
        })),
      };
    }
    case 'stage5_atmosphere_text': {
      const mood = (ctx as { moodText?: string }).moodText ?? 'mood';
      const vars = (ctx as { lightingVariants?: { id: string; label: string; src: string }[] }).lightingVariants ?? [];
      return {
        kind: 'stage5_atmosphere_text',
        results: vars.map((v, i) => ({
          id: `atm-t-mock-${ts}-${i}`,
          label: `${mood.slice(0, 40)} · ${v.label}`,
          src: picsum(`atm-t-${ts}-${i}`),
        })),
      };
    }
    case 'stage5_atmosphere_reference': {
      const vars = (ctx as { lightingVariants?: { id: string; label: string; src: string }[] }).lightingVariants ?? [];
      return {
        kind: 'stage5_atmosphere_reference',
        results: vars.map((v, i) => ({
          id: `atm-r-mock-${ts}-${i}`,
          label: `Ref look · ${v.label}`,
          src: picsum(`atm-r-${ts}-${i}`),
        })),
      };
    }
    default:
      return {
        kind: 'stage2_instructions',
        refinedPrompt: '[Mock] Unsupported stage.',
      };
  }
}

function targetsFor(
  kind: ScoutExecutionKind,
  nodeId: string,
  ctx: ScoutRemoteContext
): StageResultTargets {
  const t: StageResultTargets = {};
  switch (kind) {
    case 'stage2_instructions':
      t.assistantNodeId = nodeId;
      break;
    case 'stage2_image_generator':
      t.imageGeneratorNodeId = nodeId;
      break;
    case 'stage2_set_dressing':
      t.setDressingNodeId = nodeId;
      break;
    case 'stage3_angle_variations':
      t.angleVariationsNodeId = nodeId;
      if (ctx.kind === 'stage3_angle_variations' && ctx.listNodeId) {
        t.angleListNodeId = ctx.listNodeId;
      }
      break;
    case 'stage4_lighting_batch':
      t.lightingScenarioNodeId = nodeId;
      break;
    case 'stage5_atmosphere_text':
    case 'stage5_atmosphere_reference':
      t.atmosphereNodeId = nodeId;
      break;
    default:
      break;
  }
  return t;
}

/** Internal: single resolve without duplicate calls */
function resolveContextAndKind(
  node: Node,
  deps: ScoutCoordinatorDeps
): { kind: ScoutExecutionKind; context: ScoutRemoteContext } | { error: string } | null {
  const branch = deps.options?.atmosphereBranch;
  const kind = scoutExecutionKindForNodeType(node.type, branch);
  if (!kind) return null;

  const { nodes, edges, getGridLayout } = deps;

  switch (kind) {
    case 'stage2_instructions': {
      const r = resolveStage2InstructionsContext(nodes, edges, node.id);
      return r.ok ? { kind, context: r.value } : { error: r.reason };
    }
    case 'stage2_image_generator': {
      const r = resolveStage2ImageGeneratorContext(nodes, edges, node.id);
      return r.ok ? { kind, context: r.value } : { error: r.reason };
    }
    case 'stage2_set_dressing': {
      const r = resolveStage2SetDressingContext(nodes, edges, node.id);
      return r.ok ? { kind, context: r.value } : { error: r.reason };
    }
    case 'stage3_angle_variations': {
      const layout = getGridLayout(node.id);
      const r = resolveStage3Context(nodes, edges, node.id, layout);
      return r.ok ? { kind, context: r.value } : { error: r.reason };
    }
    case 'stage4_lighting_batch': {
      const r = resolveStage4Context(nodes, edges, node.id);
      return r.ok ? { kind, context: r.value } : { error: r.reason };
    }
    case 'stage5_atmosphere_text': {
      const r = resolveStage5Context(nodes, edges, node.id, 'text');
      return r.ok ? { kind, context: r.value } : { error: r.reason };
    }
    case 'stage5_atmosphere_reference': {
      const r = resolveStage5Context(nodes, edges, node.id, 'reference');
      return r.ok ? { kind, context: r.value } : { error: r.reason };
    }
    default:
      return null;
  }
}

/**
 * Execute a Scout pipeline node: resolve graph context → edge function → map results into node data.
 * Falls back to deterministic mock output if the edge function fails (local dev / missing key).
 */
export async function executeScoutNode(deps: ScoutCoordinatorDeps): Promise<{ ok: boolean; reason?: string }> {
  const node = deps.nodes.find((n) => n.id === deps.nodeId);
  if (!node) return { ok: false, reason: 'Node not found' };

  scoutDebugLog('executeScoutNode start', {
    nodeId: deps.nodeId,
    nodeType: node.type,
    atmosphereBranch: deps.options?.atmosphereBranch,
  });

  if (node.type === 'imageGeneratorNode') {
    deps.updateNodeData(node.id, { status: 'generating' });
  }

  const resolved = resolveContextAndKind(node, deps);
  if (resolved === null) {
    scoutDebugLog('executeScoutNode skip', { reason: 'Not a Scout execution node', nodeId: deps.nodeId });
    if (node.type === 'imageGeneratorNode') deps.updateNodeData(node.id, { status: 'idle' });
    return { ok: false, reason: 'Not a Scout execution node' };
  }
  if ('error' in resolved) {
    scoutDebugLog('executeScoutNode resolve failed', { nodeId: deps.nodeId, reason: resolved.error });
    if (node.type === 'imageGeneratorNode') deps.updateNodeData(node.id, { status: 'idle' });
    return { ok: false, reason: resolved.error };
  }

  const { kind, context } = resolved;
  scoutDebugLog('executeScoutNode context', {
    kind,
    context: summarizeForScoutLog(context),
  });
  const targets = targetsFor(kind, node.id, context);

  const api = await invokeScoutExecute(kind, context as unknown as Record<string, unknown>);
  let result: ScoutExecutionResult | undefined = api.ok ? api.result : undefined;
  let usedMock = Boolean(api.mock);

  if (!api.ok || !result) {
    result = buildMockResult(kind, context);
    usedMock = true;
  } else if (api.mock) {
    usedMock = true;
  }

  /* Merge accumulators (list + lighting) */
  if (result.kind === 'stage3_angle_variations' && targets.angleListNodeId) {
    const listId = targets.angleListNodeId;
    const prevNode = deps.nodes.find((n) => n.id === listId);
    const prev =
      ((prevNode?.data as { accumulatedAngles?: { id: string; src: string; resolution?: string }[] })
        ?.accumulatedAngles ?? []) as { id: string; src: string; resolution?: string }[];
    const merged = [...prev, ...result.angles.map((a) => ({ id: a.id, src: a.src, resolution: a.resolution ?? '4K' }))];
    deps.updateNodeData(listId, { accumulatedAngles: merged });
  }

  if (result.kind === 'stage4_lighting_batch') {
    const ln = deps.nodes.find((n) => n.id === node.id);
    const prev =
      ((ln?.data as { accumulatedLighting?: { id: string; label: string; src: string }[] })?.accumulatedLighting ??
        []) as { id: string; label: string; src: string }[];
    const merged = [...prev, ...result.results];
    deps.updateNodeData(node.id, {
      lastBatchResults: result.results,
      accumulatedLighting: merged,
    });
  }

  if (result.kind !== 'stage4_lighting_batch' && !(result.kind === 'stage3_angle_variations' && targets.angleListNodeId)) {
    const patches = mapScoutResultToNodePatches(result, targets);
    for (const [nid, data] of Object.entries(patches)) {
      deps.updateNodeData(nid, data);
    }
  }

  runScoutComplianceChecks({
    executionKind: kind,
    context,
    result,
    usedMock,
  });

  scoutDebugLog('executeScoutNode done', {
    kind,
    nodeId: deps.nodeId,
    usedMockFallback: usedMock,
    resultKind: result.kind,
  });

  return { ok: true };
}
