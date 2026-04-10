/// <reference path="./env.d.ts" />
/** OpenRouter image generation for Stage 2 Image Generator (non-streaming chat + modalities). */

import { OpenRouter } from '@openrouter/sdk';
import {
  aspectToOpenRouterImageConfig,
  buildStage2ImageGenUserContentParts,
  type ImageGenUserContentPart,
} from './stage2ImageGenBuild.ts';
import { resolveImageGenModelForMode } from './imageGenModeModel.ts';
import { formatOpenRouterSdkError } from './openRouterSdkError.ts';

function openRouterMeta() {
  const httpReferer = Deno.env.get('OPENROUTER_HTTP_REFERER') ?? 'https://vision-forge.local';
  const xTitle = Deno.env.get('OPENROUTER_APP_TITLE') ?? 'Vision Forge Scout';
  return { httpReferer, xTitle };
}

export function getOpenRouterImageGenModel(): string {
  return resolveImageGenModelForMode('Auto', (k) => Deno.env.get(k)).model;
}

function parseModalities(): Array<'text' | 'image'> {
  const raw = Deno.env.get('OPENROUTER_IMAGE_GEN_MODALITIES')?.trim();
  if (!raw) return ['image', 'text'];
  const lower = raw.toLowerCase().replace(/\s/g, '');
  if (lower === 'image') return ['image'];
  if (lower === 'image,text' || lower === 'text,image') return ['image', 'text'];
  return ['image', 'text'];
}

/** Map our lightweight parts to SDK user message content (OpenAI-compatible multimodal). */
function toSdkUserContent(parts: ImageGenUserContentPart[]): unknown[] {
  return parts.map((p) => {
    if (p.type === 'text') {
      return { type: 'text', text: p.text };
    }
    return {
      type: 'image_url',
      imageUrl: p.imageUrl,
    };
  });
}

function resolveTemperature(context: Record<string, unknown>, defaultTemp: number): number {
  const raw = context.temperature;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(2, Math.max(0, raw));
  }
  return defaultTemp;
}

function resolveSeed(context: Record<string, unknown>): number | undefined {
  const raw = context.seed;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function extractFirstImageDataUrl(message: Record<string, unknown>): string | null {
  const imgs = message.images as Array<Record<string, unknown>> | undefined;
  if (!imgs?.length) return null;
  const first = imgs[0];
  const camel = (first.imageUrl as { url?: string } | undefined)?.url;
  if (typeof camel === 'string' && camel.length > 0) return camel;
  const snake = (first.image_url as { url?: string } | undefined)?.url;
  if (typeof snake === 'string' && snake.length > 0) return snake;
  return null;
}

export async function generateStage2ImageViaOpenRouter(
  context: Record<string, unknown>,
  apiKey: string
): Promise<{ generatedUrl: string; meta: Record<string, unknown> }> {
  const { httpReferer, xTitle } = openRouterMeta();
  const { model, modeLabel } = resolveImageGenModelForMode(String(context.mode ?? ''), (k) => Deno.env.get(k));
  const modalities = parseModalities();
  const userParts = buildStage2ImageGenUserContentParts(context);
  const aspect = aspectToOpenRouterImageConfig(String(context.aspect ?? ''));
  const temperature = resolveTemperature(context, 0.4);
  const seed = resolveSeed(context);

  const openrouter = new OpenRouter({
    apiKey: apiKey.trim(),
    httpReferer,
    xTitle,
  });

  let result: unknown;
  try {
    result = await openrouter.chat.send({
      httpReferer,
      xTitle,
      chatGenerationParams: {
        model,
        messages: [{ role: 'user', content: toSdkUserContent(userParts) as unknown }],
        modalities,
        stream: false,
        temperature,
        ...(seed != null ? { seed } : {}),
        ...(aspect ? { imageConfig: aspect } : {}),
      },
    });
  } catch (e) {
    const detail = formatOpenRouterSdkError(e);
    console.error('[scout-execute] stage2_image_generator chat.send failed', detail);
    throw new Error(
      `OpenRouter SDK rejected the image response (schema mismatch). Check OPENROUTER_IMAGE_GEN_MODEL / modalities. ${detail}`
    );
  }

  if (!result || typeof result !== 'object' || !('choices' in result)) {
    throw new Error('OpenRouter image generation returned an empty or invalid response');
  }

  const chat = result as { choices?: Array<{ message?: unknown }> };
  const message = chat.choices?.[0]?.message as Record<string, unknown> | undefined;

  if (!message) {
    throw new Error('OpenRouter image generation returned no message choice');
  }

  const generatedUrl = extractFirstImageDataUrl(message);
  if (!generatedUrl) {
    throw new Error(
      'OpenRouter returned no images in the assistant message. Check OPENROUTER_IMAGE_GEN_MODEL supports image output and modalities match the model (try OPENROUTER_IMAGE_GEN_MODALITIES=image,text).'
    );
  }

  const anchorCount = userParts.filter((p) => p.type === 'image_url').length;
  const textPart = userParts.find((p): p is ImageGenUserContentPart & { type: 'text' } => p.type === 'text');
  const promptLen = textPart?.text.length ?? 0;

  console.log(
    `[scout-execute] stage2_image_generator model=${model} modalities=${modalities.join(',')} anchorImages=${anchorCount} temperature=${temperature} dataUrlLen=${generatedUrl.length}`
  );

  return {
    generatedUrl,
    meta: {
      executionKind: 'stage2_image_generator',
      model,
      mode: String(context.mode ?? '') || undefined,
      modeLabel,
      modalities,
      anchorImageCount: anchorCount,
      promptTextLength: promptLen,
      aspect: String(context.aspect ?? '') || undefined,
      temperature,
      seed,
    },
  };
}

export async function generateStage2ImagesViaOpenRouter(
  context: Record<string, unknown>,
  apiKey: string
): Promise<{ generatedUrls: string[]; meta: Record<string, unknown> }> {
  const requested = Math.min(8, Math.max(1, Number(context.images ?? 1)));
  const baseSeed =
    typeof context.seed === 'number' && Number.isInteger(context.seed) && context.seed >= 0 ?
      context.seed
    : Number(Date.now() % 1000000);
  const generatedUrls: string[] = [];
  const generatedCreatedAt: string[] = [];
  const perImageMeta: Record<string, unknown>[] = [];
  for (let idx = 0; idx < requested; idx++) {
    const nextContext: Record<string, unknown> = {
      ...context,
      temperature:
        typeof context.temperature === 'number' ?
          Math.min(2, Math.max(0, Number(context.temperature) + idx * 0.05))
        : 0.4 + idx * 0.05,
      prompt:
        requested > 1 ?
          `${String(context.prompt ?? '').trim()}\n\nVariation ${idx + 1} of ${requested}: keep scene identity while making composition and detail choices distinct.`
        : String(context.prompt ?? ''),
      seed: baseSeed + idx,
    };
    const { generatedUrl, meta } = await generateStage2ImageViaOpenRouter(nextContext, apiKey);
    generatedUrls.push(generatedUrl);
    generatedCreatedAt.push(new Date().toISOString());
    perImageMeta.push(meta);
  }
  return {
    generatedUrls,
    generatedCreatedAt,
    meta: {
      executionKind: 'stage2_image_generator',
      requested,
      returned: generatedUrls.length,
      perImageMeta,
    },
  };
}
