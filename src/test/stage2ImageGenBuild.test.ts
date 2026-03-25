import { describe, it, expect } from 'vitest';
import {
  aspectToOpenRouterImageConfig,
  buildStage2ImageGenFinalPrompt,
  buildStage2ImageGenUserContentParts,
  filterAnchorImageUrls,
  isUsableHttpImageUrl,
  MAX_STAGE2_IMAGE_GEN_ANCHORS,
} from '../../supabase/functions/scout-execute/stage2ImageGenBuild.ts';

describe('stage2ImageGenBuild', () => {
  it('merges prompt, wired text, and negative prompt', () => {
    const out = buildStage2ImageGenFinalPrompt({
      prompt: 'Main brief.',
      wiredTextFromEdges: 'From assistant.',
      negativePrompt: 'blur',
    });
    expect(out).toContain('Main brief.');
    expect(out).toContain('From assistant.');
    expect(out).toContain('Negative prompt');
    expect(out).toContain('blur');
  });

  it('filters blob and dedupes anchor URLs with cap', () => {
    const u = 'https://example.com/a.jpg';
    const urls = filterAnchorImageUrls([
      u,
      u,
      'blob:http://local/x',
      'not-a-url',
      ...Array.from({ length: 10 }, () => `${u}?x`),
    ]);
    expect(urls.length).toBeLessThanOrEqual(MAX_STAGE2_IMAGE_GEN_ANCHORS);
    expect(urls[0]).toBe(u);
    expect(isUsableHttpImageUrl('blob:x')).toBe(false);
  });

  it('maps aspect to OpenRouter image_config when allowed', () => {
    expect(aspectToOpenRouterImageConfig('16:9')).toEqual({ aspect_ratio: '16:9' });
    expect(aspectToOpenRouterImageConfig('custom')).toBeUndefined();
    expect(aspectToOpenRouterImageConfig('99:1')).toBeUndefined();
  });

  it('builds user content with text then image parts', () => {
    const parts = buildStage2ImageGenUserContentParts({
      prompt: 'Paint the room.',
      wiredTextFromEdges: '',
      negativePrompt: '',
      anchorImageUrls: ['https://example.com/ref.jpg'],
    });
    expect(parts[0].type).toBe('text');
    expect(parts[1]).toMatchObject({ type: 'image_url', imageUrl: { url: 'https://example.com/ref.jpg' } });
  });
});
