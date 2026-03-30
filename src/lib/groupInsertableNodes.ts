import type { LucideIcon } from 'lucide-react';
import {
  Type,
  Upload,
  Sparkles,
  Clapperboard,
  Video,
  ArrowUpCircle,
  Layers,
  List,
  Package,
  Grid3X3,
  Image,
  StickyNote,
  Sun,
  Cloud,
  MapPin,
} from 'lucide-react';
import type { NodeType } from '@/stores/workflowStore';

/** Node types that can be added inside a group (excludes nested `group`). Order: basics first, then pipeline nodes. */
export const GROUP_INSERTABLE_NODES: {
  type: Exclude<NodeType, 'group'>;
  label: string;
  icon: LucideIcon;
}[] = [
  { type: 'textNode', label: 'Text', icon: Type },
  { type: 'imageGeneratorNode', label: 'Image Generator', icon: Clapperboard },
  { type: 'videoGeneratorNode', label: 'Video Generator', icon: Video },
  { type: 'assistantNode', label: 'Assistant', icon: Sparkles },
  { type: 'imageUpscalerNode', label: 'Image Upscaler', icon: ArrowUpCircle },
  { type: 'imageVariationsNode', label: 'Variations', icon: Layers },
  { type: 'listNode', label: 'List', icon: List },
  { type: 'uploadNode', label: 'Upload', icon: Upload },
  { type: 'propsInputNode', label: 'Props', icon: Package },
  { type: 'angleVariationsNode', label: 'Angle Variations', icon: Grid3X3 },
  { type: 'angleVariationsListNode', label: 'Angle List', icon: Grid3X3 },
  { type: 'selectedShotNode', label: 'Selected Shot', icon: Image },
  { type: 'annotationNode', label: 'Annotation', icon: StickyNote },
  { type: 'setDressingNode', label: 'Set Dressing', icon: Sun },
  { type: 'lightingScenarioNode', label: 'Lighting', icon: Sun },
  { type: 'atmosphereTestNode', label: 'Atmosphere', icon: Cloud },
  { type: 'placementRefNode', label: 'Placement', icon: MapPin },
];

/** Human-readable label for a node type (for pickers when `data.labelText` is unset). */
export function getNodeTypeDisplayLabel(type: NodeType): string {
  if (type === 'group') return 'Group';
  const found = GROUP_INSERTABLE_NODES.find((e) => e.type === type);
  return found?.label ?? String(type);
}
