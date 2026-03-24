import type { ScoutExecutionResult } from '@/lib/scoutContextContracts';

/** Partial node data patches keyed by node id for store `updateNodeData`. */
export type NodeDataPatch = Record<string, Record<string, unknown>>;

export interface StageResultTargets {
  assistantNodeId?: string;
  imageGeneratorNodeId?: string;
  setDressingNodeId?: string;
  angleVariationsNodeId?: string;
  angleListNodeId?: string;
  lightingScenarioNodeId?: string;
  atmosphereNodeId?: string;
}

/**
 * Map a typed execution result into `updateNodeData` payloads.
 * Node ids come from the resolver context (not the edge response).
 */
export function mapScoutResultToNodePatches(
  result: ScoutExecutionResult,
  targets: StageResultTargets
): NodeDataPatch {
  const patches: NodeDataPatch = {};

  switch (result.kind) {
    case 'stage2_instructions': {
      const id = targets.assistantNodeId;
      if (id) {
        patches[id] = {
          result: result.refinedPrompt,
          refinedPrompt: result.refinedPrompt,
          view: 'result',
        };
      }
      break;
    }
    case 'stage2_image_generator': {
      const id = targets.imageGeneratorNodeId;
      if (id) {
        patches[id] = {
          status: 'success',
          generatedUrl: result.generatedUrl,
        };
      }
      break;
    }
    case 'stage2_set_dressing': {
      const id = targets.setDressingNodeId;
      if (id) {
        patches[id] = { previewUrl: result.previewUrl };
      }
      break;
    }
    case 'stage3_angle_variations': {
      const listId = targets.angleListNodeId;
      if (listId) {
        const add = result.angles.map((a) => ({
          id: a.id,
          src: a.src,
          resolution: a.resolution ?? '4K',
        }));
        patches[listId] = {
          accumulatedAngles: add,
        };
      }
      break;
    }
    case 'stage4_lighting_batch': {
      const id = targets.lightingScenarioNodeId;
      if (id) {
        patches[id] = {
          lastBatchResults: result.results,
        };
      }
      break;
    }
    case 'stage5_atmosphere_text': {
      const id = targets.atmosphereNodeId;
      if (id) {
        patches[id] = { textResults: result.results };
      }
      break;
    }
    case 'stage5_atmosphere_reference': {
      const id = targets.atmosphereNodeId;
      if (id) {
        patches[id] = { referenceResults: result.results };
      }
      break;
    }
    default:
      break;
  }

  return patches;
}
