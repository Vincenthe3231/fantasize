import type { Edge, Node } from 'reactflow';
import type {
  ScoutExecutionKind,
  ScoutExecutionResult,
  ScoutRemoteContext,
  Stage2ImageGeneratorContext,
  Stage3AngleVariationsContext,
  Stage4LightingBatchContext,
  Stage5AtmosphereContext,
} from '@/lib/scoutContextContracts';
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
import { normalizeImageReferenceUrl, normalizeImageReferenceUrls } from '@/lib/scoutMediaUrlNormalizer';
import { notifySuccess, notifyWarning } from '@/lib/systemNotify';
import { uploadGeneratedImagesWithMetadata } from '@/lib/batchImageUpload';

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
  /** When true (e.g. Settings → Experimental tools), emit UI toasts for Scout steps. */
  experimentalDebug?: boolean;
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
      if ('reason' in r) return { error: r.reason };
      return { kind, context: r.value };
    }
    case 'stage2_image_generator': {
      const r = resolveStage2ImageGeneratorContext(nodes, edges, node.id);
      if ('reason' in r) return { error: r.reason };
      return { kind, context: r.value };
    }
    case 'stage2_set_dressing': {
      const r = resolveStage2SetDressingContext(nodes, edges, node.id);
      if ('reason' in r) return { error: r.reason };
      return { kind, context: r.value };
    }
    case 'stage3_angle_variations': {
      const layout = getGridLayout(node.id);
      const r = resolveStage3Context(nodes, edges, node.id, layout);
      if ('reason' in r) return { error: r.reason };
      return { kind, context: r.value };
    }
    case 'stage4_lighting_batch': {
      const r = resolveStage4Context(nodes, edges, node.id);
      if ('reason' in r) return { error: r.reason };
      return { kind, context: r.value };
    }
    case 'stage5_atmosphere_text': {
      const r = resolveStage5Context(nodes, edges, node.id, 'text');
      if ('reason' in r) return { error: r.reason };
      return { kind, context: r.value };
    }
    case 'stage5_atmosphere_reference': {
      const r = resolveStage5Context(nodes, edges, node.id, 'reference');
      if ('reason' in r) return { error: r.reason };
      return { kind, context: r.value };
    }
    default:
      return null;
  }
}

async function normalizeContextImageReferences(
  kind: ScoutExecutionKind,
  context: ScoutRemoteContext
): Promise<ScoutRemoteContext> {
  switch (kind) {
    case 'stage2_image_generator': {
      const c = context as Stage2ImageGeneratorContext;
      const normalizedAnchors = await normalizeImageReferenceUrls(c.anchorImageUrls ?? []);
      return { ...c, anchorImageUrls: normalizedAnchors };
    }
    case 'stage3_angle_variations': {
      const c = context as Stage3AngleVariationsContext;
      const normalizedSources = await normalizeImageReferenceUrls(c.sourceImageUrls ?? [c.sourceImageUrl]);
      return {
        ...c,
        sourceImageUrls: normalizedSources,
        sourceImageUrl: normalizedSources[0] ?? c.sourceImageUrl,
      };
    }
    case 'stage4_lighting_batch': {
      const c = context as Stage4LightingBatchContext;
      const normalizedSelectedShot = await normalizeImageReferenceUrl(c.selectedShotUrl);
      return { ...c, selectedShotUrl: normalizedSelectedShot };
    }
    case 'stage5_atmosphere_reference': {
      const c = context as {
        kind: 'stage5_atmosphere_reference';
        atmosphereNodeId: string;
        referenceImageUrl: string;
        lightingVariants: Array<{ id: string; label: string; src: string }>;
      };
      const normalizedReference = await normalizeImageReferenceUrl(c.referenceImageUrl);
      const normalizedLighting = await Promise.all(
        c.lightingVariants.map(async (v) => ({
          ...v,
          src: await normalizeImageReferenceUrl(v.src),
        }))
      );
      return {
        ...c,
        referenceImageUrl: normalizedReference,
        lightingVariants: normalizedLighting,
      };
    }
    default:
      return context;
  }
}

async function applyStage2ImageResult(
  deps: ScoutCoordinatorDeps,
  nodeId: string,
  result: Extract<ScoutExecutionResult, { kind: 'stage2_image_generator' }>
) {
  const urls =
    Array.isArray(result.generatedUrls) && result.generatedUrls.length > 0 ? result.generatedUrls : [result.generatedUrl];
  const referer = window.location.origin;
  let generatedImageMetaByUrl: Record<
    string,
    { referer?: string; generatedBy?: string; timestamp?: number; supabaseUrl?: string }
  > = {};
  try {
    generatedImageMetaByUrl = await uploadGeneratedImagesWithMetadata(urls, {
      referer,
      generatedBy: nodeId,
    });
  } catch (e: unknown) {
    console.warn('[Scout] generated image upload failed', e);
  }
  deps.updateNodeData(nodeId, {
    generatedUrl: urls[0],
    generatedUrls: urls,
    generatedImageMetaByUrl,
    status: 'success',
  });
}

/**
 * Execute a Scout pipeline node: resolve graph context → edge function → map results into node data.
 * On invoke failure or missing result, returns `{ ok: false }` and does not mutate nodes with placeholder output.
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
  let normalizedContext: ScoutRemoteContext;
  try {
    normalizedContext = await normalizeContextImageReferences(kind, context);
  } catch (e: unknown) {
    if (node.type === 'imageGeneratorNode') deps.updateNodeData(node.id, { status: 'idle' });
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `Image reference normalization failed: ${msg}` };
  }
  scoutDebugLog('executeScoutNode context', {
    kind,
    context: summarizeForScoutLog(normalizedContext),
  });
  if (kind === 'stage3_angle_variations' && import.meta.env.DEV) {
    const c = normalizedContext as Stage3AngleVariationsContext;
    console.debug('[Scout][Stage3] resolved context', {
      count: c.count,
      perspectiveIds: c.perspectiveIds,
      sceneContextLen: c.sceneContextText.length,
      aspect: c.preferences.aspectRatio,
    });
  }
  const targets = targetsFor(kind, node.id, normalizedContext);

  if (
    kind === 'stage2_image_generator' &&
    normalizedContext.kind === 'stage2_image_generator' &&
    (normalizedContext.promptItems?.length ?? 0) > 0
  ) {
    const promptItems = normalizedContext.promptItems ?? [];
    let failures = 0;
    let successes = 0;
    let lastSuccessResult: Extract<ScoutExecutionResult, { kind: 'stage2_image_generator' }> | null = null;
    deps.updateNodeData(node.id, {
      status: 'generating',
      queueMode: 'perPromptSequential',
      queueTotal: promptItems.length,
      queueCompleted: 0,
      queueFailures: 0,
      queueCurrentPrompt: 1,
      queueRetrying: false,
    });

    for (let i = 0; i < promptItems.length; i++) {
      const promptText = promptItems[i]!;
      let done = false;
      let attempt = 0;
      while (!done && attempt < 2) {
        attempt += 1;
        deps.updateNodeData(node.id, {
          queueCurrentPrompt: i + 1,
          queuePromptText: promptText,
          queueRetrying: attempt > 1,
          status: 'generating',
        });
        const subContext: Stage2ImageGeneratorContext = {
          ...normalizedContext,
          prompt: promptText,
          wiredTextFromEdges: undefined,
          promptItems: undefined,
          queueMode: 'single',
        };
        const api = await invokeScoutExecute(kind, subContext as unknown as Record<string, unknown>, {
          experimentalDebug: deps.experimentalDebug,
        });
        if (api.ok && api.result && api.result.kind === 'stage2_image_generator') {
          await applyStage2ImageResult(deps, node.id, api.result);
          lastSuccessResult = api.result;
          successes += 1;
          done = true;
        } else if (attempt < 2) {
          notifyWarning('Prompt generation failed', `Retrying prompt ${i + 1}/${promptItems.length} once.`);
        } else {
          failures += 1;
          done = true;
        }
      }
      deps.updateNodeData(node.id, {
        queueCompleted: i + 1,
        queueFailures: failures,
        queueRetrying: false,
      });
    }

    if (lastSuccessResult) {
      runScoutComplianceChecks({
        executionKind: kind,
        context: normalizedContext,
        result: lastSuccessResult,
        usedMock: false,
      });
    }
    deps.updateNodeData(node.id, {
      status: successes > 0 ? 'success' : 'idle',
      queueDone: true,
      queueFailures: failures,
    });
    if (successes === 0) {
      return { ok: false, reason: 'All prompt queue items failed.' };
    }
    return { ok: true };
  }

  const api = await invokeScoutExecute(kind, normalizedContext as unknown as Record<string, unknown>, {
    experimentalDebug: deps.experimentalDebug,
  });
  if (!api.ok || !api.result) {
    if (node.type === 'imageGeneratorNode') deps.updateNodeData(node.id, { status: 'idle' });
    return {
      ok: false,
      reason: api.error ?? 'scout-execute returned no result',
    };
  }

  const result = api.result;
  const usedMock = Boolean(api.mock);

  if (result.kind === 'stage2_image_generator') {
    await applyStage2ImageResult(deps, node.id, result);
  }

  if (kind === 'stage3_angle_variations' && result.kind === 'stage3_angle_variations') {
    const requested = normalizedContext.kind === 'stage3_angle_variations' ? normalizedContext.count : 0;
    const returned = result.angles.length;
    const subtitle = `Requested ${requested} angle${requested === 1 ? '' : 's'} • Returned ${returned} angle${returned === 1 ? '' : 's'}${usedMock ? ' • mock response' : ''}`;
    if (requested !== returned) {
      notifyWarning('Stage 3 angle mismatch', subtitle);
    } else {
      notifySuccess('Stage 3 angles generated', subtitle);
    }
  }

  /* Merge accumulators (list + lighting) */
  if (result.kind === 'stage3_angle_variations') {
    deps.updateNodeData(node.id, {
      lastAngles: result.angles,
      lastAngleRunAt: Date.now(),
    });
  }

  if (result.kind === 'stage3_angle_variations' && targets.angleListNodeId) {
    const listId = targets.angleListNodeId;
    const prevNode = deps.nodes.find((n) => n.id === listId);
    const prev =
      ((prevNode?.data as { accumulatedAngles?: { id: string; src: string; resolution?: string }[] })
        ?.accumulatedAngles ?? []) as { id: string; src: string; resolution?: string }[];
    const merged = [
      ...prev,
      ...result.angles.map((a) => ({
        id: a.id,
        src: a.src,
        resolution: a.resolution ?? '4K',
        ...(a.perspectiveId != null ? { perspectiveId: a.perspectiveId } : {}),
        ...(a.label != null ? { label: a.label } : {}),
      })),
    ];
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

  if (
    result.kind !== 'stage4_lighting_batch' &&
    result.kind !== 'stage2_image_generator' &&
    !(result.kind === 'stage3_angle_variations' && targets.angleListNodeId)
  ) {
    const patches = mapScoutResultToNodePatches(result, targets);
    for (const [nid, data] of Object.entries(patches)) {
      deps.updateNodeData(nid, data);
    }
    if (deps.experimentalDebug && result.kind === 'stage2_instructions') {
      const rp = 'refinedPrompt' in result ? String(result.refinedPrompt ?? '') : '';
      console.debug('[Scout]', 'Stage 2 instructions applied', {
        refinedPromptChars: rp.length,
        nodeId: deps.nodeId,
      });
    }
  }

  runScoutComplianceChecks({
    executionKind: kind,
    context: normalizedContext,
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
