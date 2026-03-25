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
  const sourceImageUrl = String(context.sourceImageUrl ?? '').trim();
  const sceneContextTextRaw = String(context.sceneContextText ?? '').trim();
  const prefs = context.preferences as { aspectRatio?: string; resolutionLabel?: string } | undefined;
  const aspect = String(prefs?.aspectRatio ?? '16:9');
  const resolutionLabel = String(prefs?.resolutionLabel ?? '4K');

  if (!sourceImageUrl) {
    throw new Error('Stage 3: sourceImageUrl is required');
  }
  if (perspectiveIds.length === 0) {
    throw new Error('Stage 3: perspectiveIds is empty');
  }
  if (perspectiveIds.length !== perspectiveLabels.length) {
    throw new Error('Stage 3: perspectiveIds and perspectiveLabels length mismatch');
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
    const toonContext = encode({
      stage: 'stage3_angle_variations',
      perspective: { id: pid, label },
      preferences: {
        aspectRatio: aspect,
        resolutionLabel,
      },
      continuity: {
        sceneContext: sceneContextTextRaw,
      },
      constraints: [
        'preserve set continuity',
        'preserve furniture identity and materials',
        'keep lighting intent coherent',
      ],
    });
    const prompt = [
      'Virtual production scout — multi-angle pass.',
      'Context (TOON):',
      toonContext,
      'Use the reference image as the scene anchor. Generate a new still that matches this camera angle while preserving set continuity, materials, and lighting intent.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const subContext: Record<string, unknown> = {
      prompt,
      negativePrompt: '',
      aspect,
      anchorImageUrls: [sourceImageUrl],
      mode: 'Auto',
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
