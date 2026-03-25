import type { Edge, Node } from 'reactflow';
import {
  effectiveScoutPropSlots,
  handleKind,
  pickStage1PlacementNode,
  pickStage1UploadNode,
  plainTextFromHtml,
  stage1Complete,
} from '@/lib/scoutPipeline';
import { richTextToPlainForScout } from '@/lib/richTextForScout';
import {
  isVideoUrl,
  mergeTextPartsDedupe,
  upstreamImageItemsFromNode,
  upstreamPrimaryMediaLikeAssistant,
  upstreamTextFromNode,
  upstreamVideoItemsFromNode,
} from '@/lib/graphUpstreamPayload';
import {
  ASPECT_RATIOS,
  GRID_SIZES,
  getPerspectiveLabel,
  normalizeResolution,
  resolvePerspectiveIds,
} from '@/lib/imageVariationsOptions';
import {
  Stage1ContextSchema,
  Stage2ImageGeneratorContextSchema,
  type AssistantEdgeInput,
  type Stage1Context,
  type Stage2InstructionsContext,
  type Stage2ImageGeneratorContext,
  type Stage2SetDressingContext,
  type Stage3AngleVariationsContext,
  type Stage4LightingBatchContext,
  type ScoutRemoteContext,
} from '@/lib/scoutContextContracts';
export type ScoutGridLayout = '1x1' | '2x2' | '3x3';

export type ResolveOk<T> = { ok: true; value: T };
export type ResolveErr = { ok: false; reason: string };
export type ResolveResult<T> = ResolveOk<T> | ResolveErr;

function fail(reason: string): ResolveErr {
  return { ok: false, reason };
}

function ok<T>(value: T): ResolveOk<T> {
  return { ok: true, value };
}

/** Build structured Stage 1 context from node types (matches `stage1Complete` rules). */
export function resolveStage1Context(nodes: Node[]): ResolveResult<Stage1Context> {
  const s1 = stage1Complete(nodes);
  if (!s1.ok) {
    return fail(
      'Stage 1 incomplete: need location image, placement text, and at least one labelled prop.'
    );
  }

  const upload = pickStage1UploadNode(nodes);
  const placement = pickStage1PlacementNode(nodes);
  const propsNodes = nodes.filter((n) => n.type === 'propsInputNode');
  const propsInputNode =
    propsNodes.find((pn) => {
      const slots = effectiveScoutPropSlots((pn.data ?? {}) as Record<string, unknown>);
      return slots.some((p) => p.label?.trim() && p.src?.trim());
    }) ?? propsNodes[0];

  const mediaUrl = upload ? uploadMediaUrl(upload) : '';
  const placementHtml =
    placement?.type === 'placementRefNode' ?
      String((placement.data as { placementText?: string })?.placementText ?? '')
    : placement?.type === 'textNode' ? String((placement.data as { content?: string })?.content ?? '')
    : '';
  const placementRefUrl =
    placement?.type === 'placementRefNode' ?
      String((placement.data as { placementRefUrl?: string })?.placementRefUrl ?? '').trim()
    : '';
  const placementPlainRaw = plainTextFromHtml(placementHtml);
  const placementPlain =
    placementPlainRaw.trim().length > 0 ? placementPlainRaw : placementRefUrl ? `Reference: ${placementRefUrl}` : '';

  const propsFromInputs = propsInputNode ?
      effectiveScoutPropSlots((propsInputNode.data ?? {}) as Record<string, unknown>)
        .filter((p) => p.label?.trim() && p.src?.trim())
        .map((p) => ({
          nodeId: propsInputNode.id,
          label: p.label!.trim(),
          imageUrl: p.src!.trim(),
        }))
    : [];
  const propsFromUploads = nodes
    .filter((n) => n.type === 'uploadNode')
    .map((n) => {
      const imageUrl = uploadMediaUrl(n);
      const label = uploadLabelText(n);
      return {
        nodeId: n.id,
        label,
        imageUrl,
      };
    })
    .filter((p) => p.imageUrl && p.label && !isLikelyLocationLabel(p.label));
  const propsOut = propsFromInputs.length > 0 ? propsFromInputs : propsFromUploads;

  const locationImages = [
    {
      nodeId: upload?.id ?? 'upload',
      label: String((upload?.data as { labelText?: string })?.labelText ?? ''),
      url: mediaUrl,
      mediaKind: (isVideoUrl(mediaUrl) ? 'video' : 'image') as 'image' | 'video',
    },
  ];

  const htmlCombined =
    placementPlainRaw.trim().length > 0 ? placementHtml : placementRefUrl ? `<p>${placementRefUrl}</p>` : placementHtml;

  const parsed = Stage1ContextSchema.safeParse({
    locationImages,
    placementHtml: htmlCombined.length > 0 ? htmlCombined : '<p></p>',
    placementPlain: placementPlain || placementRefUrl || ' ',
    props: propsOut,
  });

  if (!parsed.success) {
    return fail(parsed.error.message);
  }

  return ok(parsed.data);
}

function edgeInputMeta(edge: Edge, src: Node): {
  edgeId: string;
  sourceNodeId: string;
  sourceType: string;
  targetHandle?: string;
  sourceHandle?: string;
} {
  return {
    edgeId: edge.id,
    sourceNodeId: src.id,
    sourceType: String(src.type ?? 'node'),
    targetHandle: edge.targetHandle ?? undefined,
    sourceHandle: edge.sourceHandle ?? undefined,
  };
}

/**
 * Resolve one incoming edge to the assistant into a structured edge input (handle-aware).
 * Uses the same handle kind semantics as `validateScoutConnection` / DefaultNodePortHandles.
 */
export function resolveAssistantEdgeInput(edge: Edge, nodes: Node[]): AssistantEdgeInput | null {
  const src = nodes.find((n) => n.id === edge.source);
  if (!src) return null;
  const meta = edgeInputMeta(edge, src);
  const th = edge.targetHandle ?? 'default';
  const tk = handleKind(th);

  if (tk === 'image') {
    const media = upstreamPrimaryMediaLikeAssistant(src, nodes);
    if (!media) return null;
    if (isVideoUrl(media.url)) {
      return { kind: 'video', ...meta, url: media.url, label: media.label };
    }
    return { kind: 'image', ...meta, url: media.url, label: media.label };
  }

  if (tk === 'video') {
    const vids = upstreamVideoItemsFromNode(src, nodes);
    const first = vids[0];
    if (!first) return null;
    return { kind: 'video', ...meta, url: first.url, label: first.label };
  }

  if (tk === 'text') {
    const t = upstreamTextFromNode(src, nodes);
    if (!t) return null;
    return { kind: 'text', ...meta, text: t };
  }

  const media = upstreamPrimaryMediaLikeAssistant(src, nodes);
  if (media) {
    if (isVideoUrl(media.url)) {
      return { kind: 'video', ...meta, url: media.url, label: media.label };
    }
    return { kind: 'image', ...meta, url: media.url, label: media.label };
  }
  const t = upstreamTextFromNode(src, nodes);
  if (!t) return null;
  return { kind: 'text', ...meta, text: t };
}

function incomingSources(edges: Edge[], targetId: string): Edge[] {
  return edges.filter((e) => e.target === targetId);
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

/** HTTPS placement reference suitable as an image part (not a video file). */
function isPlacementRefImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u || u.startsWith('blob:') || !/^https?:\/\//i.test(u)) return false;
  if (isVideoUrl(u)) return false;
  return true;
}

/**
 * Stage 2 — Assistant / instructions: all Stage 1 outputs + optional extra text wired into the assistant.
 */
export function resolveStage2InstructionsContext(
  nodes: Node[],
  edges: Edge[],
  assistantNodeId: string
): ResolveResult<Stage2InstructionsContext> {
  const s1 = resolveStage1Context(nodes);
  if (!s1.ok) return s1;

  const assistant = nodes.find((n) => n.id === assistantNodeId && n.type === 'assistantNode');
  if (!assistant) return fail('Assistant node not found.');

  const userPrompt = richTextToPlainForScout(String((assistant.data as { prompt?: string })?.prompt ?? ''));

  const incoming = incomingSources(edges, assistantNodeId).sort((a, b) => a.id.localeCompare(b.id));
  const edgeInputs: AssistantEdgeInput[] = [];
  for (const e of incoming) {
    const item = resolveAssistantEdgeInput(e, nodes);
    if (item) edgeInputs.push(item);
  }

  /** Stage 1 placement only — edge-sourced text/media live in `edgeInputs`. */
  const placementAndNotes = s1.value.placementPlain;

  const placementNode = nodes.find((n) => n.type === 'placementRefNode');
  const placementRefUrl = String(
    (placementNode?.data as { placementRefUrl?: string })?.placementRefUrl ?? ''
  ).trim();
  const placementRefImageUrl =
    placementRefUrl && isPlacementRefImageUrl(placementRefUrl) ? placementRefUrl : undefined;

  return ok({
    kind: 'stage2_instructions',
    assistantNodeId,
    userPrompt,
    placementAndNotes,
    edgeInputs,
    placementRefImageUrl,
    locationImages: s1.value.locationImages,
    props: s1.value.props,
  });
}

/**
 * Stage 2 — Image generator: node prompt plus handle-aware `incomingSources` (text / image / video / generic).
 */
export function resolveStage2ImageGeneratorContext(
  nodes: Node[],
  edges: Edge[],
  imageGeneratorNodeId: string
): ResolveResult<Stage2ImageGeneratorContext> {
  const n = nodes.find((x) => x.id === imageGeneratorNodeId && x.type === 'imageGeneratorNode');
  if (!n) return fail('Image generator node not found.');

  const basePrompt = richTextToPlainForScout(String((n.data as { prompt?: string })?.prompt ?? '')).trim();
  const negativePrompt = richTextToPlainForScout(String((n.data as { negativePrompt?: string })?.negativePrompt ?? ''));
  const mode = String((n.data as { mode?: string })?.mode ?? '');
  const aspect = String((n.data as { aspect?: string })?.aspect ?? '');

  const incoming = incomingSources(edges, imageGeneratorNodeId).sort((a, b) => a.id.localeCompare(b.id));
  const wiredParts: string[] = [];
  const anchorImageUrls: string[] = [];
  const anchorVideoUrls: string[] = [];
  const seenImg = new Set<string>();
  const seenVid = new Set<string>();

  const pushImages = (src: Node) => {
    for (const it of upstreamImageItemsFromNode(src, nodes)) {
      const u = it.url.trim();
      if (!u || seenImg.has(u)) continue;
      seenImg.add(u);
      anchorImageUrls.push(u);
    }
  };

  const pushVideos = (src: Node) => {
    for (const it of upstreamVideoItemsFromNode(src, nodes)) {
      const u = it.url.trim();
      if (!u || seenVid.has(u)) continue;
      seenVid.add(u);
      anchorVideoUrls.push(u);
    }
  };

  const pushVideoFromPrimaryIfNeeded = (src: Node) => {
    const primary = upstreamPrimaryMediaLikeAssistant(src, nodes);
    if (!primary || !isVideoUrl(primary.url)) return;
    const u = primary.url.trim();
    if (!u || seenVid.has(u)) return;
    seenVid.add(u);
    anchorVideoUrls.push(u);
  };

  for (const e of incoming) {
    const src = nodes.find((x) => x.id === e.source);
    if (!src) continue;
    const tk = handleKind(e.targetHandle);

    if (tk === 'text') {
      const t = upstreamTextFromNode(src, nodes).trim();
      if (t) wiredParts.push(t);
      continue;
    }

    if (tk === 'image') {
      const img0 = anchorImageUrls.length;
      pushImages(src);
      if (anchorImageUrls.length === img0) {
        pushVideoFromPrimaryIfNeeded(src);
      }
      continue;
    }

    if (tk === 'video') {
      pushVideos(src);
      pushVideoFromPrimaryIfNeeded(src);
      continue;
    }

    const img0 = anchorImageUrls.length;
    const vid0 = anchorVideoUrls.length;
    pushImages(src);
    if (anchorImageUrls.length === img0) {
      pushVideos(src);
      if (anchorVideoUrls.length === vid0) {
        pushVideoFromPrimaryIfNeeded(src);
      }
    }
    const gotMedia = anchorImageUrls.length > img0 || anchorVideoUrls.length > vid0;
    if (!gotMedia) {
      const t = upstreamTextFromNode(src, nodes).trim();
      if (t) wiredParts.push(t);
    }
  }

  const wiredTextFromEdges = mergeTextPartsDedupe(wiredParts);

  const raw = {
    kind: 'stage2_image_generator' as const,
    imageGeneratorNodeId,
    prompt: basePrompt,
    wiredTextFromEdges: wiredTextFromEdges || undefined,
    anchorImageUrls,
    anchorVideoUrls,
    negativePrompt: negativePrompt || undefined,
    mode: mode || undefined,
    aspect: aspect || undefined,
  };

  const parsed = Stage2ImageGeneratorContextSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((x) => x.message).join('; ') || 'Invalid image generator context.');
  }

  return ok(parsed.data);
}

/**
 * Stage 2 — Set dressing composite: all handles wired on the Set dressing node.
 */
export function resolveStage2SetDressingContext(
  nodes: Node[],
  edges: Edge[],
  setDressingNodeId: string
): ResolveResult<Stage2SetDressingContext> {
  const s1 = resolveStage1Context(nodes);
  if (!s1.ok) return s1;

  const setNode = nodes.find((n) => n.id === setDressingNodeId && n.type === 'setDressingNode');
  if (!setNode) return fail('Set dressing node not found.');

  const inc = incomingSources(edges, setDressingNodeId);
  const byHandle = (h: string) => inc.find((e) => (e.targetHandle ?? 'default') === h);

  const locEdge = byHandle('location-in');
  if (!locEdge) return fail('Connect location (Stage 1 upload) to Set dressing `location-in`.');
  const locNode = nodes.find((n) => n.id === locEdge.source);
  const anchorUrl =
    locNode?.type === 'uploadNode' ?
      String((locNode.data as { mediaUrl?: string })?.mediaUrl ?? '').trim()
    : '';
  if (!anchorUrl) return fail('Location image is missing on the connected upload node.');

  const sceneEdge = byHandle('scene-in');
  if (!sceneEdge) return fail('Connect the image generator to Set dressing `scene-in`.');
  const gen = nodes.find((n) => n.id === sceneEdge.source && n.type === 'imageGeneratorNode');
  if (!gen) return fail('Scene input must come from an image generator node.');
  const scenePrompt = richTextToPlainForScout(String((gen.data as { prompt?: string })?.prompt ?? '')).trim();
  if (!scenePrompt) return fail('Image generator prompt is empty — run instructions first or enter a prompt.');

  return ok({
    kind: 'stage2_set_dressing',
    setDressingNodeId,
    locationImages: s1.value.locationImages,
    placementPlain: s1.value.placementPlain,
    props: s1.value.props,
    scenePrompt,
    anchorImageUrl: anchorUrl,
  });
}

/** Stage 3 anchor: HTTPS, HTTP, or inline data:image (not blob: — edge cannot fetch blob URLs). */
function isUsableStage3ReferenceUrl(url: string): boolean {
  const u = url.trim();
  if (!u || u.startsWith('blob:')) return false;
  if (/^https?:\/\//i.test(u)) return true;
  if (u.startsWith('data:image/')) return true;
  return false;
}

/**
 * Stage 3 — Angle variations: reference image from upstream + selected perspectives / preferences on the node.
 */
export function resolveStage3Context(
  nodes: Node[],
  edges: Edge[],
  angleVariationsNodeId: string,
  gridLayout: ScoutGridLayout
): ResolveResult<Stage3AngleVariationsContext> {
  const av = nodes.find(
    (n) =>
      n.id === angleVariationsNodeId &&
      (n.type === 'angleVariationsNode' || n.type === 'imageVariationsNode')
  );
  if (!av) return fail('Variations node not found.');

  const inc = incomingSources(edges, angleVariationsNodeId);
  if (inc.length === 0) {
    return fail(
      'Connect upstream nodes (e.g. Set dressing, upload, image generator) into this Variations node.'
    );
  }

  let sourceImageUrl = '';
  for (const e of inc) {
    const src = nodes.find((n) => n.id === e.source);
    if (src?.type === 'setDressingNode') {
      const url = String((src.data as { previewUrl?: string })?.previewUrl ?? '').trim();
      if (isUsableStage3ReferenceUrl(url)) sourceImageUrl = url;
    }
  }
  if (!sourceImageUrl) {
    for (const e of inc) {
      const src = nodes.find((n) => n.id === e.source);
      if (!src) continue;
      const items = upstreamImageItemsFromNode(src, nodes);
      for (const it of items) {
        if (isUsableStage3ReferenceUrl(it.url)) {
          sourceImageUrl = it.url.trim();
          break;
        }
      }
      if (sourceImageUrl) break;
    }
  }
  if (!sourceImageUrl) {
    return fail(
      'No usable reference image from upstream — use an https image URL, or a data:image/… preview from the generator. Blob URLs cannot be used from the server.'
    );
  }

  const listEdge = edges.find(
    (e) => e.source === angleVariationsNodeId && nodes.find((n) => n.id === e.target)?.type === 'angleVariationsListNode'
  );
  const listNodeId = listEdge?.target;

  const gsFromData = String((av.data as { gridSize?: string })?.gridSize ?? '').trim();
  const gridFromNode: ScoutGridLayout =
    (GRID_SIZES as readonly string[]).includes(gsFromData) ? (gsFromData as ScoutGridLayout) : gridLayout;

  const avData = av.data as {
    prompt?: string;
    perspectives?: unknown;
    angleAspectRatio?: string;
    angleResolution?: unknown;
    aspect?: string;
    resolution?: unknown;
  };
  const perspectiveIds = resolvePerspectiveIds(avData.perspectives);
  if (perspectiveIds.length === 0) {
    return fail('Select at least one camera perspective — open Perspectives in the node action bar.');
  }

  const count = Math.min(9, perspectiveIds.length);
  const ids = perspectiveIds.slice(0, count);

  const aspectRaw =
    av.type === 'imageVariationsNode' ?
      String(avData.aspect ?? '').trim()
    : String(avData.angleAspectRatio ?? '').trim();
  const aspectRatio = (ASPECT_RATIOS as readonly string[]).includes(aspectRaw) ? aspectRaw : '16:9';
  const resolutionLabel = normalizeResolution(
    av.type === 'imageVariationsNode' ? avData.resolution : avData.angleResolution
  );

  const localPrompt = richTextToPlainForScout(String(avData.prompt ?? '')).trim();
  const textParts: string[] = [];
  if (localPrompt) textParts.push(localPrompt);
  for (const e of inc) {
    const src = nodes.find((n) => n.id === e.source);
    if (!src) continue;
    const hk = handleKind(e.targetHandle);
    if (hk === 'text') {
      const t = upstreamTextFromNode(src, nodes).trim();
      if (t) textParts.push(t);
    }
  }
  const sceneContextText = mergeTextPartsDedupe(textParts);

  if (import.meta.env.DEV) {
    console.debug('[Scout][Stage3] resolveStage3Context', {
      nodeType: av.type,
      angleVariationsNodeId,
      gridLayout: gridFromNode,
      perspectiveCount: ids.length,
      sourceImageUrl: sourceImageUrl.slice(0, 80),
      sceneContextTextLen: sceneContextText.length,
    });
  }

  const perspectiveLabels = ids.map((pid) => getPerspectiveLabel(pid) ?? pid);

  return ok({
    kind: 'stage3_angle_variations',
    angleVariationsNodeId,
    listNodeId,
    sourceImageUrl,
    gridLayout: gridFromNode,
    perspectiveIds: ids,
    perspectiveLabels,
    preferences: {
      aspectRatio,
      resolutionLabel,
    },
    sceneContextText,
    count: ids.length,
  });
}

/**
 * Stage 4 — Lighting batch: hero shot from Selected shot → Lighting node + non-empty labels.
 */
export function resolveStage4Context(
  nodes: Node[],
  edges: Edge[],
  lightingScenarioNodeId: string
): ResolveResult<Stage4LightingBatchContext> {
  const ln = nodes.find((n) => n.id === lightingScenarioNodeId && n.type === 'lightingScenarioNode');
  if (!ln) return fail('Lighting scenario node not found.');

  const raw = (ln.data as { lightingStrings?: string[] })?.lightingStrings;
  const lightingLabels = Array.isArray(raw) ? raw.map((s) => String(s).trim()).filter(Boolean) : [];
  if (lightingLabels.length === 0) return fail('Add at least one non-empty lighting condition.');

  const inc = incomingSources(edges, lightingScenarioNodeId);
  const imgEdge = inc.find((e) => e.targetHandle === 'image-in' || !e.targetHandle);
  if (!imgEdge) return fail('Connect Selected shot to Lighting `image-in`.');

  const shot = nodes.find((n) => n.id === imgEdge.source && n.type === 'selectedShotNode');
  if (!shot) return fail('Lighting input must be a Selected shot node.');
  const selectedShotUrl = String((shot.data as { mediaUrl?: string })?.mediaUrl ?? '').trim();
  if (!selectedShotUrl) return fail('Selected shot image is empty — pick a hero frame first.');

  return ok({
    kind: 'stage4_lighting_batch',
    lightingScenarioNodeId,
    selectedShotUrl,
    lightingLabels,
  });
}

/**
 * Stage 5 — Atmosphere (text or reference branch).
 */
export function resolveStage5Context(
  nodes: Node[],
  edges: Edge[],
  atmosphereNodeId: string,
  branch: 'text' | 'reference'
): ResolveResult<Extract<ScoutRemoteContext, { kind: 'stage5_atmosphere_text' | 'stage5_atmosphere_reference' }>> {
  const at = nodes.find((n) => n.id === atmosphereNodeId && n.type === 'atmosphereTestNode');
  if (!at) return fail('Atmosphere node not found.');

  const inc = incomingSources(edges, atmosphereNodeId);
  const lightEdge = inc.find((e) => {
    const src = nodes.find((n) => n.id === e.source);
    return src?.type === 'lightingScenarioNode';
  });
  if (!lightEdge) return fail('Connect Lighting scenario into Atmosphere test.');
  const lightingNode = nodes.find((n) => n.id === lightEdge.source);
  const rawAcc = (lightingNode?.data as { accumulatedLighting?: { id: string; label: string; src: string }[] })
    ?.accumulatedLighting;
  const rawBatch = (lightingNode?.data as { lastBatchResults?: { id: string; label: string; src: string }[] })
    ?.lastBatchResults;
  const lightingVariants =
    Array.isArray(rawAcc) && rawAcc.length > 0 ? rawAcc
    : Array.isArray(rawBatch) && rawBatch.length > 0 ? rawBatch
    : [];
  if (lightingVariants.length === 0) {
    return fail('No lighting variants — run a lighting batch first.');
  }

  if (branch === 'text') {
    const moodText = richTextToPlainForScout(String((at.data as { moodText?: string })?.moodText ?? '')).trim();
    if (!moodText) return fail('Enter a mood / colour description for the text pipeline.');
    return ok({
      kind: 'stage5_atmosphere_text',
      atmosphereNodeId,
      moodText,
      lightingVariants,
    });
  }

  const referenceImageUrl = String((at.data as { referenceUrl?: string })?.referenceUrl ?? '').trim();
  if (!referenceImageUrl) return fail('Upload a look-reference still for the reference pipeline.');

  return ok({
    kind: 'stage5_atmosphere_reference',
    atmosphereNodeId,
    referenceImageUrl,
    lightingVariants,
  });
}

/** Map React Flow node type → execution kind (when unique). */
export function scoutExecutionKindForNodeType(
  nodeType: string | undefined,
  atmosphereBranch?: 'text' | 'reference'
): import('@/lib/scoutContextContracts').ScoutExecutionKind | null {
  switch (nodeType) {
    case 'assistantNode':
      return 'stage2_instructions';
    case 'imageGeneratorNode':
      return 'stage2_image_generator';
    case 'setDressingNode':
      return 'stage2_set_dressing';
    case 'angleVariationsNode':
    case 'imageVariationsNode':
      return 'stage3_angle_variations';
    case 'lightingScenarioNode':
      return 'stage4_lighting_batch';
    case 'atmosphereTestNode':
      return atmosphereBranch === 'reference' ? 'stage5_atmosphere_reference' : 'stage5_atmosphere_text';
    default:
      return null;
  }
}
