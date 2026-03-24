import type { Connection, Edge, Node } from 'reactflow';
import { DEFAULT_SCOUT_PROP_SLOTS } from '@/lib/mockPipelineAssets';

/** Global Virtual Production Scout orchestration (gates, stale, final output). */
export interface ScoutPipelineState {
  stage2Approved: boolean;
  selectedShotCommitted: boolean;
  finalAtmosphereSelected: boolean;
  stage2Stale: boolean;
  stage4Stale: boolean;
  stage5Stale: boolean;
  finalDeliverable: null | ScoutFinalDeliverable;
}

export interface ScoutFinalDeliverable {
  setDressingUrl: string;
  selectedShotUrl: string;
  lightingLabel: string;
  atmosphereBranch: 'text' | 'reference';
  atmosphereLabel: string;
  atmosphereImageUrl: string;
  exportedAt: number;
}

export const DEFAULT_SCOUT_PIPELINE: ScoutPipelineState = {
  stage2Approved: false,
  selectedShotCommitted: false,
  finalAtmosphereSelected: false,
  stage2Stale: false,
  stage4Stale: false,
  stage5Stale: false,
  finalDeliverable: null,
};

/** Map React Flow handle id → logical port kind for compatibility checks. */
const HANDLE_KIND: Record<string, 'text' | 'image' | 'generic'> = {
  'text-in': 'text',
  'text-out': 'text',
  'image-in': 'image',
  'image-out': 'image',
  'location-in': 'image',
  'placement-in': 'text',
  'props-in': 'image',
  'scene-in': 'generic',
};

export function handleKind(handleId: string | null | undefined): 'text' | 'image' | 'generic' {
  if (!handleId) return 'generic';
  return HANDLE_KIND[handleId] ?? 'generic';
}

/** Same kind or generic accepts anything; text↔image rejected. */
export function handlesCompatible(sourceHandle?: string | null, targetHandle?: string | null): boolean {
  const s = handleKind(sourceHandle);
  const t = handleKind(targetHandle);
  if (s === 'generic' || t === 'generic') return true;
  return s === t;
}

export function isTargetHandleOccupied(
  edges: Edge[],
  target: string,
  targetHandle: string | null | undefined
): boolean {
  const th = targetHandle ?? 'default';
  return edges.some((e) => e.target === target && (e.targetHandle ?? 'default') === th);
}

export function validateScoutConnection(
  connection: Connection,
  edges: Edge[]
): { ok: boolean; reason?: string } {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target) return { ok: false, reason: 'Missing source or target' };
  if (source === target) return { ok: false, reason: 'Cannot connect node to itself' };
  if (!handlesCompatible(sourceHandle, targetHandle)) {
    return { ok: false, reason: 'Incompatible port types' };
  }
  return { ok: true };
}

/** Strip HTML tags for length check. */
export function plainTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Props list for Stage 1: persisted `data.props`, or default slots (same as Props Input UI). */
export function effectiveScoutPropSlots(data: Record<string, unknown>): { id?: string; label?: string; src?: string }[] {
  const raw = data.props;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as { id?: string; label: string; src: string }[];
  }
  return DEFAULT_SCOUT_PROP_SLOTS;
}

function uploadMediaUrl(n: Node): string {
  const d = n.data as { mediaUrl?: string; media_url?: string };
  return String(d?.mediaUrl?.trim() || d?.media_url?.trim() || '');
}

function uploadLabelText(n: Node): string {
  const d = n.data as { labelText?: string; label?: string; title?: string };
  return String(d?.labelText ?? d?.label ?? d?.title ?? '').trim();
}

function isLikelyLocationLabel(label: string): boolean {
  const l = label.toLowerCase();
  return l.includes('location') || /^image\s*\d*$/i.test(label);
}

function hasTextNodePlacementContent(n: Node): boolean {
  if (n.type !== 'textNode') return false;
  const textContent = String((n.data as { content?: string })?.content ?? '');
  return plainTextFromHtml(textContent).length > 0;
}

/** First upload node that has a usable location media URL (matches `stage1Complete` “any upload”). */
export function pickStage1UploadNode(nodes: Node[]): Node | undefined {
  return nodes.find((n) => {
    if (n.type !== 'uploadNode') return false;
    return Boolean(uploadMediaUrl(n));
  });
}

/** First placement node with non-empty rich text or reference URL (matches `stage1Complete` “any placement”). */
export function pickStage1PlacementNode(nodes: Node[]): Node | undefined {
  const placementRef = nodes.find((n) => {
    if (n.type === 'placementRefNode') {
      const placementText = String((n.data as { placementText?: string })?.placementText ?? '');
      const placementRefUrl = String((n.data as { placementRefUrl?: string })?.placementRefUrl ?? '').trim();
      return plainTextFromHtml(placementText).length > 0 || Boolean(placementRefUrl);
    }
  });
  if (placementRef) return placementRef;
  return nodes.find((n) => hasTextNodePlacementContent(n));
}

export function stage1Complete(nodes: Node[]): {
  ok: boolean;
  hasLocation: boolean;
  hasPlacement: boolean;
  hasProps: boolean;
} {
  const uploads = nodes.filter((n) => n.type === 'uploadNode');
  const placements = nodes.filter((n) => n.type === 'placementRefNode' || n.type === 'textNode');
  const propsNodes = nodes.filter((n) => n.type === 'propsInputNode');

  const hasLocation = uploads.some((u) => {
    return Boolean(uploadMediaUrl(u));
  });

  const hasPlacement = placements.some((p) => {
    if (p.type === 'placementRefNode') {
      const placementText = String((p.data as { placementText?: string })?.placementText ?? '');
      const placementRefUrl = String((p.data as { placementRefUrl?: string })?.placementRefUrl ?? '').trim();
      return plainTextFromHtml(placementText).length > 0 || Boolean(placementRefUrl);
    }
    return hasTextNodePlacementContent(p);
  });

  const hasPropsFromPropsInput = propsNodes.some((pn) => {
    const list = effectiveScoutPropSlots((pn.data ?? {}) as Record<string, unknown>);
    return list.some((p) => p.label?.trim() && p.src?.trim());
  });
  const hasPropsFromUploads = uploads.some((u) => {
    const mediaUrl = uploadMediaUrl(u);
    if (!mediaUrl) return false;
    const label = uploadLabelText(u);
    return Boolean(label) && !isLikelyLocationLabel(label);
  });
  const hasProps = hasPropsFromPropsInput || hasPropsFromUploads;

  return {
    ok: hasLocation && hasPlacement && hasProps,
    hasLocation,
    hasPlacement,
    hasProps,
  };
}

function stage1MissingReason(s1: ReturnType<typeof stage1Complete>): string {
  const missing: string[] = [];
  if (!s1.hasLocation) missing.push('location image');
  if (!s1.hasPlacement) missing.push('placement text/reference');
  if (!s1.hasProps) missing.push('at least one labelled prop image');
  return missing.length > 0 ? `Stage 1 incomplete: missing ${missing.join(', ')}.` : 'Complete Stage 1 inputs first.';
}

export function findFirstNodeId(nodes: Node[], type: string): string | undefined {
  return nodes.find((n) => n.type === type)?.id;
}

export function canRunScoutNode(
  nodes: Node[],
  pipeline: ScoutPipelineState,
  nodeId: string
): { ok: boolean; reason?: string } {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: 'Node not found' };

  const s1 = stage1Complete(nodes);

  if (node.type === 'assistantNode') {
    if (!s1.ok) return { ok: false, reason: stage1MissingReason(s1) };
    return { ok: true };
  }

  if (node.type === 'imageGeneratorNode') {
    if (!s1.ok) return { ok: false, reason: stage1MissingReason(s1) };
    if (!pipeline.stage2Approved) return { ok: false, reason: 'Approve Stage 2 before running the image generator.' };
    if (pipeline.stage2Stale) return { ok: false, reason: 'Stage 2 is stale — approve again after upstream changes.' };
    return { ok: true };
  }

  if (node.type === 'setDressingNode') {
    if (!s1.ok) return { ok: false, reason: stage1MissingReason(s1) };
    if (!pipeline.stage2Approved) return { ok: false, reason: 'Approve Stage 2 before regenerating composite.' };
    if (pipeline.stage2Stale) return { ok: false, reason: 'Stage 2 is stale — approve again after upstream changes.' };
    return { ok: true };
  }

  if (node.type === 'angleVariationsNode' || node.type === 'angleVariationsListNode') {
    if (!pipeline.stage2Approved || pipeline.stage2Stale) {
      return { ok: false, reason: 'Set dressing must be approved and current.' };
    }
  }

  if (node.type === 'selectedShotNode') {
    if (!pipeline.stage2Approved || pipeline.stage2Stale) {
      return { ok: false, reason: 'Complete Stage 2 first.' };
    }
  }

  if (node.type === 'lightingScenarioNode') {
    if (!pipeline.selectedShotCommitted) {
      return { ok: false, reason: 'Commit a hero shot in Selected shot before lighting.' };
    }
    if (pipeline.stage4Stale || pipeline.stage5Stale) {
      /* allow lighting run if only stage5 stale - actually allow */
    }
  }

  if (node.type === 'atmosphereTestNode') {
    if (!pipeline.selectedShotCommitted) {
      return { ok: false, reason: 'Commit a hero shot first.' };
    }
    const ln = nodes.find((n) => n.type === 'lightingScenarioNode');
    const d = ln?.data as { accumulatedLighting?: unknown[]; lastBatchResults?: unknown[] };
    const acc = d?.accumulatedLighting;
    const batch = d?.lastBatchResults;
    const hasLighting =
      (Array.isArray(acc) && acc.length > 0) || (Array.isArray(batch) && batch.length > 0);
    if (!hasLighting) {
      return { ok: false, reason: 'Run lighting batch to produce variants first.' };
    }
  }

  return { ok: true };
}

/** After node data changes, update stale flags per Virtual Production Scout rules. */
export function applyScoutStaleOnDataChange(
  pipeline: ScoutPipelineState,
  nodeType: string | undefined,
  keys: string[]
): ScoutPipelineState {
  const next = { ...pipeline };
  const t = nodeType ?? '';

  const stage1Types = new Set(['uploadNode', 'placementRefNode', 'propsInputNode', 'textNode']);
  if (
    pipeline.stage2Approved &&
    stage1Types.has(t) &&
    keys.some((k) =>
      ['mediaUrl', 'content', 'placementText', 'placementRefUrl', 'props', 'label'].includes(k)
    )
  ) {
    next.stage2Stale = true;
  }
  if (
    pipeline.stage2Approved &&
    (t === 'assistantNode' || t === 'imageGeneratorNode') &&
    keys.some((k) =>
      ['prompt', 'result', 'refinedPrompt', 'generatedUrl', 'status', 'negativePrompt', 'mode'].includes(k)
    )
  ) {
    next.stage2Stale = true;
  }
  if (
    pipeline.selectedShotCommitted &&
    t === 'selectedShotNode' &&
    keys.some((k) => ['mediaUrl'].includes(k))
  ) {
    next.stage4Stale = true;
    next.stage5Stale = true;
  }

  if (
    t === 'lightingScenarioNode' &&
    keys.some((k) =>
      ['lightingStrings', 'accumulatedLighting', 'lastBatchResults'].includes(k)
    )
  ) {
    if (pipeline.selectedShotCommitted) next.stage5Stale = true;
  }

  if (t === 'atmosphereTestNode' && keys.some((k) => ['moodText', 'referenceUrl', 'textResults', 'referenceResults'].includes(k))) {
    next.finalAtmosphereSelected = false;
  }

  return next;
}

/** Structured graph resolution and server-backed execution live in `scoutContextResolver` / `scoutRunCoordinator`. */
