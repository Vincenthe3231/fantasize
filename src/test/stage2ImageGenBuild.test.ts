import { describe, it, expect } from 'vitest';
import {
  aspectToOpenRouterImageConfig,
  buildStage2ImageGenFinalPrompt,
  buildStage2ImageGenUserContentParts,
  filterAnchorImageUrls,
  isUsableHttpImageUrl,
  isUsableMultimodalImageUrl,
} from '../../supabase/functions/scout-execute/stage2ImageGenBuild.ts';

describe('stage2ImageGenBuild', () => {
  it('merges prompt, wired text, and negative prompt', () => {
    const out = buildStage2ImageGenFinalPrompt({
      prompt: 'Main brief.',
      wiredTextFromEdges: 'From assistant.',
      negativePrompt: 'blur',
    });
    expect(out).toContain('TOON');
    expect(out).toContain('Main brief.');
    expect(out).toContain('From assistant.');
    expect(out).toContain('blur');
    expect(out).toContain('stage2_image_generator');
  });

  it('filters blob and dedupes anchor URLs (all distinct anchors kept)', () => {
    const u = 'https://example.com/a.jpg';
    const many = Array.from({ length: 8 }, (_, i) => `https://example.com/ref${i}.jpg`);
    const urls = filterAnchorImageUrls([
      ...many,
      many[0],
      u,
      u,
      'blob:http://local/x',
      'not-a-url',
      ...Array.from({ length: 10 }, () => `${u}?x`),
    ]);
    expect(urls).toEqual([...many, u, `${u}?x`]);
    expect(isUsableHttpImageUrl('blob:x')).toBe(false);
    expect(isUsableMultimodalImageUrl('blob:x')).toBe(false);
  });

  it('allows data:image URLs as multimodal anchors', () => {
    const data = 'data:image/png;base64,AAAA';
    expect(isUsableMultimodalImageUrl(data)).toBe(true);
    expect(filterAnchorImageUrls(['blob:x', data])).toEqual([data]);
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
