/// <reference path="./env.d.ts" />
/** OpenRouter image generation for Stage 2 Image Generator (non-streaming chat + modalities). */

import { OpenRouter } from '@openrouter/sdk';
import {
  aspectToOpenRouterImageConfig,
  buildStage2ImageGenUserContentParts,
  type ImageGenUserContentPart,
} from './stage2ImageGenBuild.ts';
import { resolveImageGenModelForMode } from './imageGenModeModel.ts';

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

  const openrouter = new OpenRouter({
    apiKey: apiKey.trim(),
    httpReferer,
    xTitle,
  });

  const result = await openrouter.chat.send({
    httpReferer,
    xTitle,
    chatGenerationParams: {
      model,
      messages: [{ role: 'user', content: toSdkUserContent(userParts) as unknown }],
      modalities,
      stream: false,
      temperature,
      ...(aspect ? { imageConfig: aspect } : {}),
    },
  });

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
    },
  };
}
