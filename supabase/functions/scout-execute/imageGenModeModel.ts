/**
 * Maps Image Generator UI `mode` labels to OpenRouter model IDs.
 * Keep labels in sync with `IMAGE_GENERATOR_MODE_LABELS` in `src/lib/imageGeneratorModes.ts`.
 *
 * Override per mode: OPENROUTER_IMAGE_GEN_MODEL_<SUFFIX> (e.g. FLUX_1, CLASSIC_FAST).
 * Auto / default: OPENROUTER_IMAGE_GEN_MODEL or google/gemini-2.5-flash-image.
 */

export const IMAGE_GENERATOR_MODE_LABELS = [
  'Auto',
  'Cinematic',
  'Classic',
  'Classic Fast',
  'Flux.1',
  'Flux.1 Fast',
  'SDXL',
  'Mystic',
] as const;

export type ImageGeneratorModeLabel = (typeof IMAGE_GENERATOR_MODE_LABELS)[number];

/** Env key suffix for OPENROUTER_IMAGE_GEN_MODEL_<SUFFIX> */
export function imageGenModeEnvSuffix(modeLabel: string): string {
  const s = modeLabel.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return s || 'AUTO';
}

function defaultImageModel(getEnv: (key: string) => string | undefined): string {
  return getEnv('OPENROUTER_IMAGE_GEN_MODEL')?.trim() || 'google/gemini-2.5-flash-image';
}

/**
 * Built-in OpenRouter slugs; use env overrides if a model does not support your modalities.
 */
const DEFAULT_MODE_TO_MODEL: Partial<Record<ImageGeneratorModeLabel, string>> = {
  Cinematic: 'black-forest-labs/flux-1.1-pro',
  Classic: 'google/gemini-2.5-flash-image',
  'Classic Fast': 'black-forest-labs/flux-schnell',
  'Flux.1': 'black-forest-labs/flux-1.1-pro',
  'Flux.1 Fast': 'black-forest-labs/flux-schnell',
  SDXL: 'stabilityai/stable-diffusion-xl-base-1.0',
  Mystic: 'google/gemini-2.5-flash-image',
};

export function normalizeImageGenModeLabel(mode: string | undefined): ImageGeneratorModeLabel {
  const t = String(mode ?? '').trim();
  if (!t) return 'Auto';
  const found = IMAGE_GENERATOR_MODE_LABELS.find((m) => m === t);
  if (found) return found;
  return 'Auto';
}

export function resolveImageGenModelForMode(
  mode: string | undefined,
  getEnv: (key: string) => string | undefined
): { model: string; modeLabel: ImageGeneratorModeLabel } {
  const modeLabel = normalizeImageGenModeLabel(mode);

  if (modeLabel === 'Auto') {
    return { model: defaultImageModel(getEnv), modeLabel: 'Auto' };
  }

  const suffix = imageGenModeEnvSuffix(modeLabel);
  const envOverride = getEnv(`OPENROUTER_IMAGE_GEN_MODEL_${suffix}`)?.trim();
  if (envOverride) {
    return { model: envOverride, modeLabel };
  }

  const mapped = DEFAULT_MODE_TO_MODEL[modeLabel];
  if (mapped) {
    return { model: mapped, modeLabel };
  }

  return { model: defaultImageModel(getEnv), modeLabel: 'Auto' };
}
