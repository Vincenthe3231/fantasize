/// <reference path="./env.d.ts" />
/** Stage 3 angle variations — one OpenRouter image generation per selected perspective. */

import { generateStage2ImageViaOpenRouter } from './stage2ImageOpenRouter.ts';
import { encode } from '@toon-format/toon';

export async function generateStage3AngleVariationsViaOpenRouter(
  context: Record<string, unknown>,
  apiKey: string
): Promise<{
  angles: Array<{
    id: string;
    src: string;
    resolution?: string;
    perspectiveId?: string;
    label?: string;
  }>;
  meta: Record<string, unknown>;
}> {
  const perspectiveIds = (context.perspectiveIds as string[] | undefined) ?? [];
  const perspectiveLabels = (context.perspectiveLabels as string[] | undefined) ?? [];
  const perspectivePrompts = (context.perspectivePrompts as string[] | undefined) ?? [];
  const sourceImageUrl = String(context.sourceImageUrl ?? '').trim();
  const sourceImageUrls = Array.isArray(context.sourceImageUrls) ?
      (context.sourceImageUrls as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean)
    : [];
  const sceneContextTextRaw = String(context.sceneContextText ?? '').trim();
  const prefs = context.preferences as { aspectRatio?: string; resolutionLabel?: string } | undefined;
  const aspect = String(prefs?.aspectRatio ?? '16:9');
  const resolutionLabel = String(prefs?.resolutionLabel ?? '4K');

  const anchorImageUrls = sourceImageUrls.length > 0 ? sourceImageUrls : sourceImageUrl ? [sourceImageUrl] : [];
  if (anchorImageUrls.length === 0) {
    throw new Error('Stage 3: sourceImageUrl/sourceImageUrls is required');
  }
  if (perspectiveIds.length === 0) {
    throw new Error('Stage 3: perspectiveIds is empty');
  }
  if (perspectiveIds.length !== perspectiveLabels.length) {
    throw new Error('Stage 3: perspectiveIds and perspectiveLabels length mismatch');
  }
  if (perspectivePrompts.length > 0 && perspectivePrompts.length !== perspectiveIds.length) {
    throw new Error('Stage 3: perspectiveIds and perspectivePrompts length mismatch');
  }

  const angles: Array<{
    id: string;
    src: string;
    resolution?: string;
    perspectiveId?: string;
    label?: string;
  }> = [];
  const perShotMeta: Record<string, unknown>[] = [];

  for (let i = 0; i < perspectiveIds.length; i++) {
    const pid = perspectiveIds[i]!;
    const label = perspectiveLabels[i] ?? pid;
    const perspectivePrompt = String(perspectivePrompts[i] ?? '').trim();
    const shotIndex = i + 1;
    const shotTotal = perspectiveIds.length;
    /** Slightly higher + staggered temperature per shot to reduce near-duplicate frames (stateless requests). */
    const temperature = Math.min(0.88, 0.52 + i * 0.06);
    const toonContext = encode({
      stage: 'stage3_angle_variations',
      shot: { index: shotIndex, total: shotTotal, perspectiveId: pid },
      perspective: { id: pid, label },
      preferences: {
        aspectRatio: aspect,
        resolutionLabel,
      },
      continuity: {
        sceneContext: sceneContextTextRaw,
      },
      constraints: [
        'preserve furniture identity, materials, and set dressing',
        'keep lighting intent coherent with the scene',
        `This is an independent shot ${shotIndex}/${shotTotal} — reframe camera and composition to match this perspective; do not copy the reference image's viewpoint, crop, or lens feel.`,
      ],
    });
    const prompt = [
      `Virtual production scout — angle pass ${shotIndex} of ${shotTotal}. Each pass is a separate generation request (no shared chat history with other shots).`,
      'Context (TOON):',
      toonContext,
      perspectivePrompt ? `Perspective direction:\n${perspectivePrompt}` : '',
      `CRITICAL — Output a single ${label} shot. The camera position, height, distance, and framing must read clearly different from the reference image(s). Treat reference(s) as identity and layout only, not as the final camera angle.`,
      'Use the reference image(s) as the scene anchor for continuity, then generate a new still that matches this camera angle.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const subContext: Record<string, unknown> = {
      prompt,
      negativePrompt: '',
      aspect,
      anchorImageUrls,
      mode: 'Auto',
      temperature,
    };

    console.log(
      `[scout-execute] stage3_angle_variations shot ${i + 1}/${perspectiveIds.length} perspective=${pid} aspect=${aspect}`
    );

    const { generatedUrl, meta } = await generateStage2ImageViaOpenRouter(subContext, apiKey);
    perShotMeta.push(meta);
    angles.push({
      id: `ang-${crypto.randomUUID()}`,
      src: generatedUrl,
      resolution: resolutionLabel,
      perspectiveId: pid,
      label,
    });
  }

  return {
    angles,
    meta: {
      executionKind: 'stage3_angle_variations',
      shotCount: angles.length,
      perShotMeta,
    },
  };
}
