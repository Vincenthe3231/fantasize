/**
 * Image Generator node mode dropdown labels.
 * Keep in sync with `IMAGE_GENERATOR_MODE_LABELS` in
 * `supabase/functions/scout-execute/imageGenModeModel.ts` (edge resolves OpenRouter model from these strings).
 */
export const IMAGE_GENERATOR_MODES = [
  'Auto',
  'Cinematic',
  'Classic',
  'Classic Fast',
  'Flux.1',
  'Flux.1 Fast',
  'SDXL',
  'Mystic',
] as const;

export type ImageGeneratorMode = (typeof IMAGE_GENERATOR_MODES)[number];
