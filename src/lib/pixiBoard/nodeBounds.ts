import type { Node } from 'reactflow';

/** Default shell sizes when RF has not measured width/height yet (Pixi board). */
const DEFAULT_BY_TYPE: Record<string, { w: number; h: number }> = {
  textNode: { w: 280, h: 160 },
  uploadNode: { w: 280, h: 220 },
  assistantNode: { w: 320, h: 280 },
  imageGeneratorNode: { w: 280, h: 320 },
  videoGeneratorNode: { w: 280, h: 280 },
  imageUpscalerNode: { w: 260, h: 240 },
  listNode: { w: 300, h: 200 },
  propsInputNode: { w: 360, h: 200 },
  angleVariationsNode: { w: 300, h: 240 },
  angleVariationsListNode: { w: 300, h: 260 },
  selectedShotNode: { w: 280, h: 260 },
  annotationNode: { w: 200, h: 100 },
  setDressingNode: { w: 360, h: 280 },
  lightingScenarioNode: { w: 340, h: 260 },
  atmosphereTestNode: { w: 400, h: 320 },
  placementRefNode: { w: 300, h: 220 },
  imageVariationsNode: { w: 340, h: 280 },
  group: { w: 400, h: 300 },
};

export function getDefaultShellSize(nodeType: string | undefined): { w: number; h: number } {
  if (!nodeType) return { w: 280, h: 140 };
  return DEFAULT_BY_TYPE[nodeType] ?? { w: 280, h: 140 };
}

export type FlowRect = { x: number; y: number; w: number; h: number };

export function getNodeFlowRect(node: Node): FlowRect {
  const { w, h } = getDefaultShellSize(node.type);
  const width = typeof node.width === 'number' && node.width > 0 ? node.width : w;
  const height = typeof node.height === 'number' && node.height > 0 ? node.height : h;
  const pos = node.positionAbsolute ?? node.position;
  return { x: pos.x, y: pos.y, w: width, h: height };
}

/** Source handle: right center; target: left center (matches common RF horizontal flow). */
export function getEdgeEndpoints(
  nodes: Node[],
  sourceId: string,
  targetId: string
): { sx: number; sy: number; tx: number; ty: number } | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const s = byId.get(sourceId);
  const t = byId.get(targetId);
  if (!s || !t) return null;
  const rs = getNodeFlowRect(s);
  const rt = getNodeFlowRect(t);
  return {
    sx: rs.x + rs.w,
    sy: rs.y + rs.h / 2,
    tx: rt.x,
    ty: rt.y + rt.h / 2,
  };
}
