import { streamOpenRouterAuto } from './openrouterClient.ts';
import { buildStage2InstructionsContent } from './stage2Multimodal.ts';
import type { ScoutExecutionKind } from './types.ts';

function picsum(seed: string, w = 800, h = 450): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed.slice(0, 48))}/${w}/${h}`;
}

export async function handleScoutStage(
  kind: ScoutExecutionKind,
  context: Record<string, unknown>,
  apiKey: string | undefined
): Promise<{ result: Record<string, unknown>; mock: boolean }> {
  const useLlm = Boolean(apiKey);

  switch (kind) {
    case 'stage2_instructions': {
      const placementAndNotes = String(context.placementAndNotes ?? '');
      const userPrompt = String(context.userPrompt ?? '');

      let refinedPrompt: string;
      if (useLlm) {
        const userContentParts = buildStage2InstructionsContent(context);
        refinedPrompt = await streamOpenRouterAuto({
          apiKey: apiKey!,
          userContentParts,
        });
      } else {
        refinedPrompt = [
          '[Mock — set OPENROUTER_API_KEY] Photorealistic interior set dressing.',
          placementAndNotes.slice(0, 1200),
          userPrompt ? `Notes: ${userPrompt}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }

      return {
        mock: !useLlm,
        result: { kind: 'stage2_instructions', refinedPrompt },
      };
    }

    case 'stage2_image_generator': {
      const prompt = String(context.prompt ?? '');
      const url = picsum(`img-${prompt.slice(0, 20)}-${Date.now()}`);
      return {
        mock: true,
        result: { kind: 'stage2_image_generator', generatedUrl: url, status: 'success' as const },
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
      const count = Math.min(9, Math.max(1, Number(context.count ?? 4)));
      const angles = Array.from({ length: count }, (_, i) => ({
        id: `ang-${crypto.randomUUID()}`,
        src: picsum(`ang-${i}-${Date.now()}`),
        resolution: '4K',
      }));
      return {
        mock: true,
        result: { kind: 'stage3_angle_variations', angles },
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
      return {
        mock: true,
        result: { kind: 'stage2_instructions', refinedPrompt: '[Mock] Unknown stage' },
      };
  }
}
