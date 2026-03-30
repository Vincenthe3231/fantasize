import { getOpenRouterStage2Model, streamOpenRouterAuto } from './openrouterClient.ts';
import { generateStage2ImagesViaOpenRouter } from './stage2ImageOpenRouter.ts';
import { generateStage3AngleVariationsViaOpenRouter } from './stage3AngleVariationsOpenRouter.ts';
import { buildStage2InstructionsContent } from './stage2Multimodal.ts';
import type { ScoutExecutionKind } from './types.ts';

function picsum(seed: string, w = 800, h = 450): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed.slice(0, 48))}/${w}/${h}`;
}

export async function handleScoutStage(
  kind: ScoutExecutionKind,
  context: Record<string, unknown>,
  apiKey: string | undefined
): Promise<{ result: Record<string, unknown>; mock: boolean; meta?: Record<string, unknown> }> {
  const useLlm = Boolean(apiKey?.trim());

  switch (kind) {
    case 'stage2_instructions': {
      if (!useLlm) {
        throw new Error(
          'OPENROUTER_API_KEY is not set on scout-execute — Stage 2 instructions require a real model call.'
        );
      }
      const userContentParts = buildStage2InstructionsContent(context);
      const refinedPrompt = await streamOpenRouterAuto({
        apiKey: apiKey!.trim(),
        userContentParts,
      });

      console.log(
        `[scout-execute] stage2_instructions refinedPromptLen=${refinedPrompt.length} parts=${userContentParts.length} model=${getOpenRouterStage2Model()}`
      );

      return {
        mock: false,
        result: { kind: 'stage2_instructions', refinedPrompt },
        meta: {
          executionKind: 'stage2_instructions',
          model: getOpenRouterStage2Model(),
          refinedPromptLength: refinedPrompt.length,
          userContentPartsCount: userContentParts.length,
        },
      };
    }

    case 'stage2_image_generator': {
      if (!useLlm) {
        throw new Error(
          'OPENROUTER_API_KEY is not set on scout-execute — Stage 2 image generator requires OpenRouter.'
        );
      }
      const { generatedUrls, generatedCreatedAt, meta: imageGenMeta } = await generateStage2ImagesViaOpenRouter(
        context,
        apiKey!.trim()
      );
      return {
        mock: false,
        result: {
          kind: 'stage2_image_generator',
          generatedUrl: generatedUrls[0] ?? '',
          generatedUrls,
          generatedCreatedAt,
          status: 'success' as const,
        },
        meta: imageGenMeta,
      };
    }

    case 'stage2_set_dressing': {
      const scenePrompt = String(context.scenePrompt ?? '');
      const url = picsum(`set-${scenePrompt.slice(0, 16)}-${Date.now()}`);
      return {
        mock: true,
        result: { kind: 'stage2_set_dressing', previewUrl: url },
      };
    }

    case 'stage3_angle_variations': {
      if (!useLlm) {
        throw new Error(
          'OPENROUTER_API_KEY is not set on scout-execute — Stage 3 angle variations require OpenRouter image generation.'
        );
      }
      const { angles, meta } = await generateStage3AngleVariationsViaOpenRouter(context, apiKey!.trim());
      return {
        mock: false,
        result: { kind: 'stage3_angle_variations', angles },
        meta,
      };
    }

    case 'stage4_lighting_batch': {
      const labels = (context.lightingLabels as string[] | undefined) ?? [];
      const results = labels.map((label, i) => ({
        id: `lit-${crypto.randomUUID()}`,
        label,
        src: picsum(`lit-${label}-${i}`),
      }));
      return {
        mock: true,
        result: { kind: 'stage4_lighting_batch', results },
      };
    }

    case 'stage5_atmosphere_text': {
      const moodText = String(context.moodText ?? '');
      const vars =
        (context.lightingVariants as { id: string; label: string; src: string }[] | undefined) ?? [];
      const results = vars.map((v, i) => ({
        id: `atm-t-${crypto.randomUUID()}`,
        label: `${moodText.slice(0, 40)} · ${v.label}`,
        src: picsum(`atm-t-${i}`),
      }));
      return {
        mock: true,
        result: { kind: 'stage5_atmosphere_text', results },
      };
    }

    case 'stage5_atmosphere_reference': {
      const vars =
        (context.lightingVariants as { id: string; label: string; src: string }[] | undefined) ?? [];
      const results = vars.map((v, i) => ({
        id: `atm-r-${crypto.randomUUID()}`,
        label: `Ref look · ${v.label}`,
        src: picsum(`atm-r-${i}`),
      }));
      return {
        mock: true,
        result: { kind: 'stage5_atmosphere_reference', results },
      };
    }

    default:
      throw new Error(`Unsupported scout execution kind: ${String(kind)}`);
  }
}
