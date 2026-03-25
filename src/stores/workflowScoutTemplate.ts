import type { Edge, Node } from 'reactflow';
import { MOCK, SCENE_DESCRIPTION, DEFAULT_SCOUT_PROP_SLOTS } from '@/lib/mockPipelineAssets';

const defaultNodes: Node[] = [
  { id: 'text-1', type: 'textNode', position: { x: 80, y: 80 }, data: { content: `<p>${SCENE_DESCRIPTION}</p>` } },
  {
    id: 'upload-1',
    type: 'uploadNode',
    position: { x: 80, y: 280 },
    data: { mediaUrl: MOCK.location1, label: 'Location reference', labelText: 'Location reference' },
  },
  {
    id: 'placement-1',
    type: 'placementRefNode',
    position: { x: 80, y: 520 },
    data: { placementText: `<p>${SCENE_DESCRIPTION}</p>`, placementRefUrl: MOCK.placement },
  },
  { id: 'props-input-1', type: 'propsInputNode', position: { x: 80, y: 700 }, data: { props: [...DEFAULT_SCOUT_PROP_SLOTS] } },
  {
    id: 'assistant-1',
    type: 'assistantNode',
    position: { x: 400, y: 200 },
    data: { refinedPrompt: '', prompt: '', view: 'prompt', result: '', assistantModel: 'GPT-5 Mini', labelText: 'Assistant' },
  },
  {
    id: 'generator-1',
    type: 'imageGeneratorNode',
    position: { x: 720, y: 200 },
    data: {
      model: 'mystic',
      mode: 'Auto',
      aspect: '16:9',
      images: 1,
      prompt: '',
      negativePrompt: '',
      status: 'idle',
      generatedUrl: MOCK.setDressing,
      labelText: 'Image Generator',
    },
  },
  { id: 'set-dressing-1', type: 'setDressingNode', position: { x: 1060, y: 180 }, data: { previewUrl: MOCK.setDressing } },
  { id: 'angle-var-1', type: 'angleVariationsNode', position: { x: 1520, y: 400 }, data: {} },
  {
    id: 'lighting-1',
    type: 'lightingScenarioNode',
    position: { x: 1960, y: 400 },
    data: {
      lightingStrings: ['Golden hour', 'Studio', 'Natural light'],
      accumulatedLighting: [] as { id: string; label: string; src: string }[],
      lastBatchResults: [] as { id: string; label: string; src: string }[],
    },
  },
  {
    id: 'atmosphere-1',
    type: 'atmosphereTestNode',
    position: { x: 2400, y: 400 },
    data: {
      moodText: '',
      referenceUrl: '',
      textResults: [] as { id: string; label: string; src: string }[],
      referenceResults: [] as { id: string; label: string; src: string }[],
      selectedBranch: null as 'text' | 'reference' | null,
      selectedIndex: null as number | null,
    },
  },
  {
    id: 'angle-list-1',
    type: 'angleVariationsListNode',
    position: { x: 1520, y: 700 },
    data: { accumulatedAngles: [] as { id: string; src: string; resolution?: string }[], selectedAngleId: null as string | null },
  },
  {
    id: 'selected-shot-1',
    type: 'selectedShotNode',
    position: { x: 1920, y: 700 },
    data: { mediaUrl: MOCK.selectedShot, resolution: '3840 × 2133', committed: false },
  },
  {
    id: 'annotation-1',
    type: 'annotationNode',
    position: { x: 1520, y: 960 },
    data: {
      text: '💡 Scout: Approve Stage 2 → run angles → pick in list → Commit hero shot → Lighting batch → Text/Reference atmosphere → Finalize.',
    },
    selectable: false,
    draggable: false,
  },
];

const defaultEdges: Edge[] = [
  { id: 'e-text-assistant', source: 'text-1', target: 'assistant-1', targetHandle: 'text-in', type: 'custom' },
  { id: 'e-upload-assistant', source: 'upload-1', target: 'assistant-1', targetHandle: 'image-in', type: 'custom' },
  { id: 'e-assistant-generator', source: 'assistant-1', target: 'generator-1', type: 'custom' },
  { id: 'e-upload-set', source: 'upload-1', target: 'set-dressing-1', targetHandle: 'location-in', type: 'custom' },
  { id: 'e-placement-set', source: 'placement-1', target: 'set-dressing-1', targetHandle: 'placement-in', sourceHandle: 'text-out', type: 'custom' },
  { id: 'e-props-set', source: 'props-input-1', target: 'set-dressing-1', targetHandle: 'props-in', sourceHandle: 'image-out', type: 'custom' },
  { id: 'e-gen-set', source: 'generator-1', target: 'set-dressing-1', targetHandle: 'scene-in', type: 'custom' },
  { id: 'e-set-angle', source: 'set-dressing-1', target: 'angle-var-1', type: 'custom' },
  { id: 'e-shot-light', source: 'selected-shot-1', target: 'lighting-1', targetHandle: 'image-in', sourceHandle: 'image-out', type: 'custom' },
  { id: 'e-light-atmo', source: 'lighting-1', target: 'atmosphere-1', type: 'custom' },
  { id: 'e-angle-list', source: 'angle-var-1', target: 'angle-list-1', type: 'custom' },
  { id: 'e-list-shot', source: 'angle-list-1', target: 'selected-shot-1', targetHandle: 'image-in', type: 'custom' },
];

export function createVirtualProductionScoutTemplate(): { nodes: Node[]; edges: Edge[] } {
  return { nodes: structuredClone(defaultNodes), edges: structuredClone(defaultEdges) };
}
