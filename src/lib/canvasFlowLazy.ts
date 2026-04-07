import { lazy } from 'react';
import type { EdgeTypes, NodeTypes } from 'reactflow';

/**
 * Lazy canvas node / edge modules so Vite emits per-type chunks and initial parse stays smaller.
 * Wrapped in `<Suspense fallback={null}>` around `<ReactFlow>` in `Index.tsx`.
 */
export const canvasLazyNodeTypes = {
  textNode: lazy(() => import('@/components/canvas/TextNode')),
  uploadNode: lazy(() => import('@/components/canvas/UploadNode')),
  assistantNode: lazy(() => import('@/components/canvas/AssistantNode')),
  imageGeneratorNode: lazy(() => import('@/components/canvas/ImageGeneratorNode')),
  videoGeneratorNode: lazy(() => import('@/components/canvas/VideoGeneratorNode')),
  imageUpscalerNode: lazy(() => import('@/components/canvas/ImageUpscalerNode')),
  listNode: lazy(() => import('@/components/canvas/ListNode')),
  propsInputNode: lazy(() => import('@/components/canvas/PropsInputNode')),
  angleVariationsNode: lazy(() => import('@/components/canvas/AngleVariationsNode')),
  angleVariationsListNode: lazy(() => import('@/components/canvas/AngleVariationsListNode')),
  selectedShotNode: lazy(() => import('@/components/canvas/SelectedShotNode')),
  annotationNode: lazy(() => import('@/components/canvas/AnnotationNode')),
  setDressingNode: lazy(() => import('@/components/canvas/SetDressingNode')),
  lightingScenarioNode: lazy(() => import('@/components/canvas/LightingScenarioNode')),
  atmosphereTestNode: lazy(() => import('@/components/canvas/AtmosphereTestNode')),
  placementRefNode: lazy(() => import('@/components/canvas/PlacementRefNode')),
  imageVariationsNode: lazy(() => import('@/components/canvas/ImageVariationsNode')),
  group: lazy(() => import('@/components/canvas/GroupNode')),
} as NodeTypes;

export const canvasLazyEdgeTypes = {
  custom: lazy(() => import('@/components/canvas/CustomEdge')),
} as EdgeTypes;

export const SettingsPanelLazy = lazy(() => import('@/components/canvas/SettingsPanel'));

export const SelectionOverlayLazy = lazy(() => import('@/components/canvas/SelectionOverlay'));
