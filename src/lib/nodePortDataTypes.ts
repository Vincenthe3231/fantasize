import type { HandleDataType } from '@/components/canvas/EnhancedHandle';

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
