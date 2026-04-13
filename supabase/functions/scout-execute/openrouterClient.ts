/// <reference path="./env.d.ts" />
/** OpenRouter via @openrouter/sdk — Stage 2 instructions, streaming aggregated server-side (Deno). */

import { OpenRouter } from '@openrouter/sdk';
import { formatOpenRouterSdkError } from './openRouterSdkError.ts';
import type { Stage2MultimodalPart } from './stage2Multimodal.ts';

/**
 * Default: fast vision model. `openrouter/auto` often routes through heavy paths and is prone to
 * Cloudflare 503 "Worker exceeded resource limits" on large multimodal requests.
 * Override with `OPENROUTER_STAGE2_MODEL` on the edge function (e.g. back to `openrouter/auto`).
 */
/** Exported for response `meta` and logs (same default as chat `model`). */
export function getOpenRouterStage2Model(): string {
  return Deno.env.get('OPENROUTER_STAGE2_MODEL') ?? 'google/gemini-2.0-flash-001';
}

function stage2Model(): string {
  return getOpenRouterStage2Model();
}

function stage2MaxTokens(): number {
  const raw = Deno.env.get('OPENROUTER_STAGE2_MAX_TOKENS');
  const n = raw != null ? parseInt(raw, 10) : 4096;
  return Number.isFinite(n) && n > 0 ? n : 4096;
}

/** Output shape only; graph content is in the user multimodal message. */
const SYSTEM_DEFAULT =
  'Reply with a single image-generation prompt only. No preamble, no markdown fences, no bullet lists unless they are part of the prompt text. The user message may include Token-Oriented Object Notation (TOON) for canvas context — use `edgeTexts`, `placement`, `operatorNotes`, and `attachments` (slot order matches following image/video parts).';

function toUserContent(parts: Stage2MultimodalPart[]) {
  return parts.map((p) => {
    if (p.type === 'text') return { type: 'text' as const, text: p.text };
    if (p.type === 'image_url') return { type: 'image_url' as const, imageUrl: p.imageUrl };
    return { type: 'video_url' as const, videoUrl: p.videoUrl };
  });
}

function openRouterMeta() {
  const httpReferer = Deno.env.get('OPENROUTER_HTTP_REFERER') ?? 'https://vision-forge.local';
  const appTitle = Deno.env.get('OPENROUTER_APP_TITLE') ?? 'Vision Forge Scout';
  return { httpReferer, appTitle };
}

/**
 * Stream chat completion for Stage 2 instructions; concatenate assistant text deltas.
 */
export async function streamOpenRouterAuto(params: {
  apiKey: string;
  systemPrompt?: string;
  userContentParts: Stage2MultimodalPart[];
}): Promise<string> {
  const { httpReferer, appTitle } = openRouterMeta();
  const openrouter = new OpenRouter({
    apiKey: params.apiKey,
    httpReferer,
    appTitle,
  });

  try {
    const stream = await openrouter.chat.send({
      httpReferer,
      appTitle,
      chatRequest: {
        model: stage2Model(),
        messages: [
          { role: 'system', content: params.systemPrompt ?? SYSTEM_DEFAULT },
          { role: 'user', content: toUserContent(params.userContentParts) },
        ],
        stream: true,
        temperature: 0.4,
        maxTokens: stage2MaxTokens(),
      },
    });

    let out = '';
    let chunkCount = 0;
    let deltaChunks = 0;
    for await (const chunk of stream) {
      chunkCount += 1;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        deltaChunks += 1;
        out += delta;
      }
    }

    const trimmed = out.trim();
    console.log(
      `[scout-execute] stage2 OpenRouter stream model=${stage2Model()} chunks=${chunkCount} deltaChunks=${deltaChunks} outLen=${trimmed.length}`
    );
    if (!trimmed) throw new Error('OpenRouter returned empty content');
    return trimmed;
  } catch (e) {
    const detail = formatOpenRouterSdkError(e);
    console.error('[scout-execute] streamOpenRouterAuto failed', detail);
    throw new Error(
      `OpenRouter SDK rejected the model response (schema mismatch). Try another OPENROUTER_STAGE2_MODEL or upgrade @openrouter/sdk. ${detail}`
    );
  }
}
