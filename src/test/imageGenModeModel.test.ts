import { describe, it, expect } from 'vitest';
import {
  imageGenModeEnvSuffix,
  normalizeImageGenModeLabel,
  resolveImageGenModelForMode,
} from '../../supabase/functions/scout-execute/imageGenModeModel.ts';

function envFrom(map: Record<string, string>): (k: string) => string | undefined {
  return (k) => map[k];
}

describe('imageGenModeModel', () => {
  it('maps env suffix for dotted and spaced labels', () => {
    expect(imageGenModeEnvSuffix('Flux.1')).toBe('FLUX_1');
    expect(imageGenModeEnvSuffix('Classic Fast')).toBe('CLASSIC_FAST');
    expect(imageGenModeEnvSuffix('Auto')).toBe('AUTO');
  });

  it('normalizes empty and unknown to Auto', () => {
    expect(normalizeImageGenModeLabel(undefined)).toBe('Auto');
    expect(normalizeImageGenModeLabel('')).toBe('Auto');
    expect(normalizeImageGenModeLabel('  ')).toBe('Auto');
    expect(normalizeImageGenModeLabel('nope')).toBe('Auto');
  });

  it('Auto uses OPENROUTER_IMAGE_GEN_MODEL or gemini default', () => {
    const r = resolveImageGenModelForMode('Auto', envFrom({}));
    expect(r.modeLabel).toBe('Auto');
    expect(r.model).toBe('google/gemini-2.5-flash-image');

    const r2 = resolveImageGenModelForMode('Auto', envFrom({ OPENROUTER_IMAGE_GEN_MODEL: 'custom/default' }));
    expect(r2.model).toBe('custom/default');
  });

  it('named mode uses built-in OpenRouter slug', () => {
    const r = resolveImageGenModelForMode('Flux.1', envFrom({}));
    expect(r.modeLabel).toBe('Flux.1');
    expect(r.model).toBe('black-forest-labs/flux-1.1-pro');
  });

  it('per-mode env overrides built-in map', () => {
    const r = resolveImageGenModelForMode(
      'Flux.1',
      envFrom({ OPENROUTER_IMAGE_GEN_MODEL_FLUX_1: 'my/flux-override' })
    );
    expect(r.modeLabel).toBe('Flux.1');
    expect(r.model).toBe('my/flux-override');
  });
});
