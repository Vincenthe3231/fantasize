import { describe, it, expect } from 'vitest';
import {
  buildStage2InstructionsContent,
  isPlacementRefImageUrl,
} from '../../supabase/functions/scout-execute/stage2Multimodal.ts';

describe('scoutStage2Multimodal (edge)', () => {
  it('isPlacementRefImageUrl rejects blob and video', () => {
    expect(isPlacementRefImageUrl('blob:http://x')).toBe(false);
    expect(isPlacementRefImageUrl('https://x.com/a.mp4')).toBe(false);
    expect(isPlacementRefImageUrl('https://x.com/board.jpg')).toBe(true);
  });

  it('buildStage2InstructionsContent orders text, media, and operator notes', () => {
    const parts = buildStage2InstructionsContent({
      placementAndNotes: 'Room layout',
      userPrompt: 'Warm light',
      placementRefImageUrl: 'https://example.com/ref.png',
      locationImages: [
        { url: 'https://example.com/loc.jpg', label: 'Main', mediaKind: 'image' },
      ],
      props: [{ label: 'Sofa', imageUrl: 'https://example.com/prop.jpg' }],
    });

    const types = parts.map((p) => p.type);
    expect(types.filter((t) => t === 'text').length).toBeGreaterThanOrEqual(3);
    expect(types.includes('image_url')).toBe(true);
    const texts = parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map((p) => p.text);
    expect(texts.some((t) => t.includes('Operator notes'))).toBe(true);
    expect(texts.some((t) => t.includes('Warm light'))).toBe(true);
  });

  it('uses video_url for location video', () => {
    const parts = buildStage2InstructionsContent({
      placementAndNotes: 'x',
      userPrompt: '',
      locationImages: [{ url: 'https://example.com/v.mp4', mediaKind: 'video' }],
      props: [],
    });
    expect(parts.some((p) => p.type === 'video_url')).toBe(true);
  });
});
