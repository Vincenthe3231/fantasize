/** OpenRouter via @openrouter/sdk — `openrouter/auto`, streaming aggregated server-side (Deno). */

import { OpenRouter } from '@openrouter/sdk';
import type { Stage2MultimodalPart } from './stage2Multimodal.ts';

const SYSTEM_DEFAULT =
  'You write a single precise image generation prompt for virtual production set dressing. Use the placement text, location media, and prop reference images. Include spatial layout, prop styles, and lighting intent. Output only the prompt text, no preamble.';

function toUserContent(parts: Stage2MultimodalPart[]) {
  return parts.map((p) => {
    if (p.type === 'text') return { type: 'text' as const, text: p.text };
    if (p.type === 'image_url') return { type: 'image_url' as const, imageUrl: p.imageUrl };
    return { type: 'video_url' as const, videoUrl: p.videoUrl };
  });
}

function openRouterMeta() {
  const httpReferer = Deno.env.get('OPENROUTER_HTTP_REFERER') ?? 'https://vision-forge.local';
  const xTitle = Deno.env.get('OPENROUTER_APP_TITLE') ?? 'Vision Forge Scout';
  return { httpReferer, xTitle };
}

/**
 * Stream chat completion with `openrouter/auto`, concatenate assistant text deltas.
 */
export async function streamOpenRouterAuto(params: {
  apiKey: string;
  systemPrompt?: string;
  userContentParts: Stage2MultimodalPart[];
}): Promise<string> {
  const { httpReferer, xTitle } = openRouterMeta();
  const openrouter = new OpenRouter({
    apiKey: params.apiKey,
    httpReferer,
    xTitle,
  });

  const stream = await openrouter.chat.send({
    httpReferer,
    xTitle,
    chatGenerationParams: {
      model: 'openrouter/auto',
      messages: [
        { role: 'system', content: params.systemPrompt ?? SYSTEM_DEFAULT },
        { role: 'user', content: toUserContent(params.userContentParts) },
      ],
      stream: true,
      temperature: 0.4,
    },
  });

  let out = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) out += delta;
  }

  const trimmed = out.trim();
  if (!trimmed) throw new Error('OpenRouter returned empty content');
  return trimmed;
}
