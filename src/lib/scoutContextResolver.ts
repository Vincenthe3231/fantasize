import type { Edge, Node } from 'reactflow';
import {
  effectiveScoutPropSlots,
  pickStage1PlacementNode,
  pickStage1UploadNode,
  plainTextFromHtml,
  stage1Complete,
} from '@/lib/scoutPipeline';
import { richTextToPlainForScout } from '@/lib/richTextForScout';
import {
  Stage1ContextSchema,
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

/** Plain text from any connected text-like node. */
function textFromNode(n: Node | undefined): string {
  if (!n) return '';
  if (n.type === 'textNode') {
    const c = String((n.data as { content?: string })?.content ?? '');
    return plainTextFromHtml(c);
  }
  if (n.type === 'placementRefNode') {
    const html = String((n.data as { placementText?: string })?.placementText ?? '');
    return plainTextFromHtml(html);
  }
  return '';
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

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
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

  const extraTextParts: string[] = [];
  for (const e of incomingSources(edges, assistantNodeId)) {
    const src = nodes.find((n) => n.id === e.source);
    const t = textFromNode(src);
    if (t) extraTextParts.push(t);
  }

  const placementAndNotes = [s1.value.placementPlain, ...extraTextParts].filter(Boolean).join('\n\n');

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
    placementRefImageUrl,
    locationImages: s1.value.locationImages,
    props: s1.value.props,
  });
}

/**
 * Stage 2 — Image generator: prompt + optional anchor image from an incoming upload connection.
 */
export function resolveStage2ImageGeneratorContext(
  nodes: Node[],
  edges: Edge[],
  imageGeneratorNodeId: string
): ResolveResult<Stage2ImageGeneratorContext> {
  const n = nodes.find((x) => x.id === imageGeneratorNodeId && x.type === 'imageGeneratorNode');
  if (!n) return fail('Image generator node not found.');

  const prompt = richTextToPlainForScout(String((n.data as { prompt?: string })?.prompt ?? '')).trim();
  if (!prompt) return fail('Image generator needs a non-empty prompt.');

  const negativePrompt = richTextToPlainForScout(String((n.data as { negativePrompt?: string })?.negativePrompt ?? ''));
  const mode = String((n.data as { mode?: string })?.mode ?? '');
  const aspect = String((n.data as { aspect?: string })?.aspect ?? '');

  let anchorImageUrl: string | undefined;
  const imgIn = incomingSources(edges, imageGeneratorNodeId).find(
    (e) => e.targetHandle === 'image-in' || e.targetHandle === undefined
  );
  if (imgIn) {
    const srcNode = nodes.find((x) => x.id === imgIn.source);
    if (srcNode?.type === 'uploadNode') {
      anchorImageUrl = String((srcNode.data as { mediaUrl?: string })?.mediaUrl ?? '').trim() || undefined;
    }
  }

  return ok({
    kind: 'stage2_image_generator',
    imageGeneratorNodeId: imageGeneratorNodeId,
    prompt,
    negativePrompt: negativePrompt || undefined,
    mode: mode || undefined,
    aspect: aspect || undefined,
    anchorImageUrl,
  });
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

function gridToCount(layout: GridLayout): number {
  const cols = layout === '1x1' ? 1 : layout === '2x2' ? 2 : 3;
  return cols * cols;
}

/**
 * Stage 3 — Angle variations: dressed-room image from upstream Set dressing.
 */
export function resolveStage3Context(
  nodes: Node[],
  edges: Edge[],
  angleVariationsNodeId: string,
  gridLayout: ScoutGridLayout
): ResolveResult<Stage3AngleVariationsContext> {
  const av = nodes.find((n) => n.id === angleVariationsNodeId && n.type === 'angleVariationsNode');
  if (!av) return fail('Angle variations node not found.');

  const inc = incomingSources(edges, angleVariationsNodeId);
  if (inc.length === 0) return fail('Connect Set dressing (or prior stage) into Angle variations.');

  let sourceImageUrl = '';
  for (const e of inc) {
    const src = nodes.find((n) => n.id === e.source);
    if (src?.type === 'setDressingNode') {
      const url = String((src.data as { previewUrl?: string })?.previewUrl ?? '').trim();
      if (url) sourceImageUrl = url;
    }
  }
  if (!sourceImageUrl) {
    return fail('Upstream set dressing preview image is missing — run Set dressing first.');
  }

  const listEdge = edges.find(
    (e) => e.source === angleVariationsNodeId && nodes.find((n) => n.id === e.target)?.type === 'angleVariationsListNode'
  );
  const listNodeId = listEdge?.target;

  const count = Math.min(9, gridToCount(gridLayout));

  return ok({
    kind: 'stage3_angle_variations',
    angleVariationsNodeId,
    listNodeId,
    sourceImageUrl,
    gridLayout,
    count,
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
      return 'stage3_angle_variations';
    case 'lightingScenarioNode':
      return 'stage4_lighting_batch';
    case 'atmosphereTestNode':
      return atmosphereBranch === 'reference' ? 'stage5_atmosphere_reference' : 'stage5_atmosphere_text';
    default:
      return null;
  }
}
