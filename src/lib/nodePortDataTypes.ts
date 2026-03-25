import type { HandleDataType } from '@/components/canvas/EnhancedHandle';
import type { Node } from 'reactflow';

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
  listNode: ['text'],
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
  | { kind: 'image'; value: { url: string; label?: string }[] }
  | { kind: 'video'; value: { url: string; label?: string }[] }
  | { kind: 'generic'; value: unknown };

export type NodeDataflowMergeMode = 'textConcatDedupe' | 'imageListByUrl' | 'videoListByUrl' | 'lastNonNull';

export interface NodeHandleInputContract {
  dataType: HandleDataType;
  merge: NodeDataflowMergeMode;
  apply: (target: Node, merged: NodeDataflowPacket) => Partial<Record<string, unknown>> | null;
}

export interface NodeHandleOutputContract {
  dataType: HandleDataType;
  read: (source: Node) => NodeDataflowPacket | null;
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

function imagePacketFromNode(source: Node): NodeDataflowPacket | null {
  const d = (source.data ?? {}) as Record<string, unknown>;
  const urls = [
    String(d.generatedUrl ?? '').trim(),
    String(d.previewUrl ?? '').trim(),
    String(d.mediaUrl ?? '').trim(),
    String(d.media_url ?? '').trim(),
    String(d.referenceUrl ?? '').trim(),
  ].filter(Boolean);
  if (urls.length === 0) return null;
  return {
    kind: 'image',
    value: urls.map((url) => ({ url })),
  };
}

function videoPacketFromNode(source: Node): NodeDataflowPacket | null {
  const d = (source.data ?? {}) as Record<string, unknown>;
  const url = String(d.videoUrl ?? '').trim();
  if (!url) return null;
  return { kind: 'video', value: [{ url }] };
}

function textInputApply(targetField: string) {
  return (_target: Node, merged: NodeDataflowPacket): Partial<Record<string, unknown>> | null => {
    if (merged.kind !== 'text') return null;
    const next = merged.value.trim();
    if (!next) return null;
    return { [targetField]: next };
  };
}

function imageInputApply(targetField: string) {
  return (_target: Node, merged: NodeDataflowPacket): Partial<Record<string, unknown>> | null => {
    if (merged.kind !== 'image') return null;
    const first = merged.value[0]?.url?.trim();
    if (!first) return null;
    return { [targetField]: first };
  };
}

const CONTRACTS: Record<string, NodeDataflowContract> = {
  textNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: textInputApply('content') },
    },
    outputs: {
      'text-out': { dataType: 'text', read: textPacketFromNode },
    },
  },
  assistantNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: textInputApply('prompt') },
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: imageInputApply('referenceUrl') },
    },
    outputs: {
      'text-out': { dataType: 'text', read: textPacketFromNode },
    },
  },
  imageGeneratorNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: textInputApply('prompt') },
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: imageInputApply('mediaUrl') },
    },
    outputs: {
      'image-out': { dataType: 'image', read: imagePacketFromNode },
      'text-out': { dataType: 'text', read: textPacketFromNode },
    },
  },
  placementRefNode: {
    inputs: {
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: textInputApply('placementText') },
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: imageInputApply('placementRefUrl') },
    },
    outputs: {
      'text-out': { dataType: 'text', read: textPacketFromNode },
      'image-out': { dataType: 'image', read: imagePacketFromNode },
    },
  },
  uploadNode: {
    inputs: {
      'image-in': { dataType: 'image', merge: 'imageListByUrl', apply: imageInputApply('mediaUrl') },
      'video-in': { dataType: 'video', merge: 'videoListByUrl', apply: imageInputApply('mediaUrl') },
      'text-in': { dataType: 'text', merge: 'textConcatDedupe', apply: textInputApply('labelText') },
    },
    outputs: {
      'image-out': { dataType: 'image', read: imagePacketFromNode },
      'video-out': { dataType: 'video', read: videoPacketFromNode },
      'text-out': { dataType: 'text', read: textPacketFromNode },
    },
  },
};

const DEFAULT_TEXT_INPUT: NodeHandleInputContract = {
  dataType: 'text',
  merge: 'textConcatDedupe',
  apply: textInputApply('prompt'),
};
const DEFAULT_IMAGE_INPUT: NodeHandleInputContract = {
  dataType: 'image',
  merge: 'imageListByUrl',
  apply: imageInputApply('mediaUrl'),
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
  const id = handleId ?? 'default';
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
  const id = handleId ?? 'default';
  const c = contractForNodeType(nodeType);
  const explicit = c.outputs[id];
  if (explicit) return explicit;
  if (id.includes('text')) return DEFAULT_TEXT_OUTPUT;
  if (id.includes('image') || id.includes('location') || id.includes('props')) return DEFAULT_IMAGE_OUTPUT;
  return null;
}
