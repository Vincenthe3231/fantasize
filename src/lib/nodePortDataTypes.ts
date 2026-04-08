import type { HandleDataType } from '@/components/canvas/EnhancedHandle';
import type { Node } from 'reactflow';
import { logicalPortId } from '@/lib/portHandles';
import {
  aggregateGroupOutputPacket,
  listNodeImageItemsFromNode,
  listNodeTextFromNode,
  mergeTextPartsDedupe,
} from '@/lib/graphUpstreamPayload';
import { richTextToPlainForScout } from '@/lib/richTextForScout';

/** Order handles consistently on group nodes. */
export const PORT_TYPE_ORDER: HandleDataType[] = ['text', 'image', 'video', 'generic'];

/** Port kinds each node type participates in (inputs/outputs collapsed to one set for group aggregation). */
const NODE_PORT_TYPES: Record<string, HandleDataType[]> = {
  textNode: ['text'],
  assistantNode: ['text', 'image'],
  uploadNode: ['image'],
  imageGeneratorNode: ['text', 'image'],
  imageVariationsNode: ['text', 'image'],
  imageUpscalerNode: ['text', 'image'],
  videoGeneratorNode: ['text', 'video'],
  listNode: ['text', 'image'],
  propsInputNode: ['image'],
  annotationNode: ['text'],
  placementRefNode: ['text', 'image'],
  setDressingNode: ['text', 'image'],
  angleVariationsNode: ['image'],
  angleVariationsListNode: ['image'],
  selectedShotNode: ['image'],
  lightingScenarioNode: ['image'],
  atmosphereTestNode: ['image'],
  group: [],
};

const FALLBACK: HandleDataType[] = ['text', 'image'];

export function portDataTypesForNodeType(nodeType: string | undefined): HandleDataType[] {
  if (!nodeType) return [...FALLBACK];
  return NODE_PORT_TYPES[nodeType] ? [...NODE_PORT_TYPES[nodeType]] : [...FALLBACK];
}

/** Union of port types for direct child node types, sorted for stable handle order. */
export function aggregatePortTypesForChildTypes(childTypes: string[]): HandleDataType[] {
  const set = new Set<HandleDataType>();
  for (const t of childTypes) {
    if (t === 'group') continue;
    for (const dt of portDataTypesForNodeType(t)) {
      set.add(dt);
    }
  }
  return PORT_TYPE_ORDER.filter((dt) => set.has(dt));
}

export type NodeDataflowPacket =
  | { kind: 'text'; value: string }
  | {
      kind: 'image';
      value: {
        url: string;
        label?: string;
        referer?: string;
        generatedBy?: string;
        timestamp?: number;
        /** ISO-8601 from server or client when the asset was created */
        created_at?: string;
        supabaseUrl?: string;
      }[];
    }
  | { kind: 'video'; value: { url: string; label?: string }[] }
  | { kind: 'generic'; value: unknown };

export type NodeDataflowMergeMode = 'textConcatDedupe' | 'imageListByUrl' | 'videoListByUrl' | 'lastNonNull';

export interface NodeHandleInputContract {
  dataType: HandleDataType;
  merge: NodeDataflowMergeMode;
  apply: (target: Node, merged: NodeDataflowPacket) => Partial<Record<string, unknown>> | null;
}

/** Passed to `read` when the source needs the full graph (e.g. `group` aggregating children). */
export type NodeOutputReadContext = { nodes: Node[] };

export interface NodeHandleOutputContract {
  dataType: HandleDataType;
  read: (source: Node, ctx?: NodeOutputReadContext) => NodeDataflowPacket | null;
}

export interface NodeDataflowContract {
  inputs: Partial<Record<string, NodeHandleInputContract>>;
  outputs: Partial<Record<string, NodeHandleOutputContract>>;
}

const EMPTY_CONTRACT: NodeDataflowContract = {
  inputs: {},
  outputs: {},
};

function plainTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function textPacketFromNode(source: Node): NodeDataflowPacket | null {
  const d = (source.data ?? {}) as Record<string, unknown>;
  const refined = String(d.refinedPrompt ?? '').trim();
  if (refined) return { kind: 'text', value: refined };
  const result = String(d.result ?? '').trim();
  if (result) return { kind: 'text', value: result };
  const prompt = String(d.prompt ?? '').trim();
  if (prompt) return { kind: 'text', value: plainTextFromHtml(prompt) };
  const placementText = String(d.placementText ?? '').trim();
  if (placementText) return { kind: 'text', value: plainTextFromHtml(placementText) };
  const content = String(d.content ?? '').trim();
  if (content) return { kind: 'text', value: plainTextFromHtml(content) };
  return null;
}

/** Assistant: user-owned `prompt` + graph `wiredTextFromEdges`; refined/result win for downstream. */
function assistantTextPacketFromNode(source: Node): NodeDataflowPacket | null {
  const d = (source.data ?? {}) as Record<string, unknown>;
  const refined = String(d.refinedPrompt ?? '').trim();
  if (refined) return { kind: 'text', value: refined };
  const result = String(d.result ?? '').trim();
  if (result) return { kind: 'text', value: result };
  const wired = String(d.wiredTextFromEdges ?? '').trim();
  const promptPlain = richTextToPlainForScout(String(d.prompt ?? '')).trim();
  const merged = mergeTextPartsDedupe([wired, promptPlain].filter(Boolean));
  if (merged) return { kind: 'text', value: merged };
  return null;
}

function imagePacketFromNode(source: Node): NodeDataflowPacket | null {
  const d = (source.data ?? {}) as Record<string, unknown>;
  const urls = [
    ...(((d.generatedUrls as unknown[]) ?? [])
      .map((x) => String(x ?? '').trim())
      .filter(Boolean) as string[]),
    String(d.generatedUrl ?? '').trim(),
    String(d.previewUrl ?? '').trim(),
    String(d.mediaUrl ?? '').trim(),
    String(d.media_url ?? '').trim(),
    String(d.referenceUrl ?? '').trim(),
  ].filter(Boolean);
  const unique = [...new Set(urls)];
  const imageMetaByUrl = (d.generatedImageMetaByUrl ?? {}) as Record<
    string,
    {
      referer?: string;
      generatedBy?: string;
      timestamp?: number;
      created_at?: string;
      supabaseUrl?: string;
    }
  >;
  if (unique.length === 0) return null;
  return {
    kind: 'image',
    value: unique.map((url, idx) => {
      const meta = imageMetaByUrl[url] ?? {};
      const hasTime = meta.created_at != null || meta.timestamp != null;
      return {
        url,
        ...meta,
        ...(!hasTime ? { timestamp: Date.now() - idx } : {}),
      };
    }),
  };
}

function videoPacketFromNode(source: Node): NodeDataflowPacket | null {
  const d = (source.data ?? {}) as Record<string, unknown>;
  const url = String(d.videoUrl ?? '').trim();
  if (!url) return null;
  return { kind: 'video', value: [{ url }] };
}

/**
 * Do not copy upstream packets into the target node's `data`. Edges remain the graph link;
 * execution context (Scout, `scoutContextResolver`, `graphUpstreamPayload`) reads **sources** via edges.
 */
const dataflowApplyNoOp: NodeHandleInputContract['apply'] = (_target, _merged) => null;

const CONTRACTS: Record<string, NodeDataflowContract> = {
  textNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: dataflowApplyNoOp },
    },
    outputs: {
      'text-out': { dataType: 'text', read: textPacketFromNode },
    },
  },
  assistantNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: dataflowApplyNoOp },
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: dataflowApplyNoOp },
    },
    outputs: {
      'text-out': { dataType: 'text', read: assistantTextPacketFromNode },
    },
  },
  imageGeneratorNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: dataflowApplyNoOp },
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: dataflowApplyNoOp },
    },
    outputs: {
      'image-out': { dataType: 'image', read: imagePacketFromNode },
      'text-out': { dataType: 'text', read: textPacketFromNode },
    },
  },
  placementRefNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: dataflowApplyNoOp },
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: dataflowApplyNoOp },
    },
    outputs: {
      'text-out': { dataType: 'text', read: textPacketFromNode },
      'image-out': { dataType: 'image', read: imagePacketFromNode },
    },
  },
  uploadNode: {
    inputs: {
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: dataflowApplyNoOp },
      'video-in': { dataType: 'video', merge: 'videoListByUrl', apply: dataflowApplyNoOp },
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: dataflowApplyNoOp },
    },
    outputs: {
      'image-out': { dataType: 'image', read: imagePacketFromNode },
      'video-out': { dataType: 'video', read: videoPacketFromNode },
      'text-out': { dataType: 'text', read: textPacketFromNode },
    },
  },
  listNode: {
    inputs: {
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: dataflowApplyNoOp },
    },
    outputs: {
      'text-out': {
        dataType: 'text',
        read: (source) => {
          const v = listNodeTextFromNode(source).trim();
          return v ? { kind: 'text', value: v } : null;
        },
      },
      'image-out': {
        dataType: 'image',
        read: (source) => {
          const items = listNodeImageItemsFromNode(source);
          if (items.length === 0) return null;
          return { kind: 'image', value: items };
        },
      },
    },
  },
  group: {
    inputs: {},
    outputs: {
      'group-out-text': {
        dataType: 'text',
        read: (source, ctx) =>
          ctx ? aggregateGroupOutputPacket(source, ctx.nodes, 'text') : null,
      },
      'group-out-image': {
        dataType: 'image',
        read: (source, ctx) =>
          ctx ? aggregateGroupOutputPacket(source, ctx.nodes, 'image') : null,
      },
      'group-out-video': {
        dataType: 'video',
        read: (source, ctx) =>
          ctx ? aggregateGroupOutputPacket(source, ctx.nodes, 'video') : null,
      },
    },
  },
};

const DEFAULT_TEXT_INPUT: NodeHandleInputContract = {
  dataType: 'text',
  merge: 'textConcatDedupe',
  apply: dataflowApplyNoOp,
};
const DEFAULT_IMAGE_INPUT: NodeHandleInputContract = {
  dataType: 'image',
  merge: 'imageListByUrl',
  apply: dataflowApplyNoOp,
};
const DEFAULT_TEXT_OUTPUT: NodeHandleOutputContract = {
  dataType: 'text',
  read: textPacketFromNode,
};
const DEFAULT_IMAGE_OUTPUT: NodeHandleOutputContract = {
  dataType: 'image',
  read: imagePacketFromNode,
};

export function contractForNodeType(nodeType: string | undefined): NodeDataflowContract {
  if (!nodeType) return EMPTY_CONTRACT;
  return CONTRACTS[nodeType] ?? EMPTY_CONTRACT;
}

export function inputContractForHandle(
  nodeType: string | undefined,
  handleId: string | null | undefined
): NodeHandleInputContract | null {
  const id = logicalPortId(handleId);
  const c = contractForNodeType(nodeType);
  const explicit = c.inputs[id];
  if (explicit) return explicit;
  if (id.includes('text')) return DEFAULT_TEXT_INPUT;
  if (id.includes('image') || id.includes('location') || id.includes('props')) return DEFAULT_IMAGE_INPUT;
  return null;
}

export function outputContractForHandle(
  nodeType: string | undefined,
  handleId: string | null | undefined
): NodeHandleOutputContract | null {
  const id = logicalPortId(handleId);
  const c = contractForNodeType(nodeType);
  const explicit = c.outputs[id];
  if (explicit) return explicit;
  if (id.includes('text')) return DEFAULT_TEXT_OUTPUT;
  if (id.includes('image') || id.includes('location') || id.includes('props')) return DEFAULT_IMAGE_OUTPUT;
  return null;
}

/**
 * Resolves source output contract for an edge. When `sourceHandle` is missing or `default`,
 * picks `text-out` / `image-out` / `video-out` based on the target input handle so quick-connect
 * edges without an explicit source handle still propagate data.
 */
export function resolveOutputContractForEdge(
  sourceType: string | undefined,
  sourceHandle: string | null | undefined,
  targetNodeType: string | undefined,
  targetHandle: string | null | undefined
): NodeHandleOutputContract | null {
  const sid = sourceHandle ?? 'default';
  let resolved = outputContractForHandle(sourceType, sid);
  if (resolved) return resolved;
  if (sid !== 'default') return null;

  const inContract = inputContractForHandle(targetNodeType, targetHandle);
  if (!inContract) return null;

  const tryHandles: string[] = [];
  switch (inContract.dataType) {
    case 'text':
      tryHandles.push('text-out');
      break;
    case 'image':
      tryHandles.push('image-out');
      break;
    case 'video':
      tryHandles.push('video-out');
      break;
    case 'generic':
    default:
      tryHandles.push('text-out', 'image-out', 'video-out');
      break;
  }

  for (const h of tryHandles) {
    resolved = outputContractForHandle(sourceType, h);
    if (resolved) return resolved;
  }
  return null;
}
