import { describe, it, expect } from 'vitest';
import {
  buildStage2InstructionsContent,
  getStage2ContentLimits,
  isPlacementRefImageUrl,
} from '../../supabase/functions/scout-execute/stage2Multimodal.ts';

describe('scoutStage2Multimodal (edge)', () => {
  it('isPlacementRefImageUrl rejects blob and video', () => {
    expect(isPlacementRefImageUrl('blob:http://x')).toBe(false);
    expect(isPlacementRefImageUrl('https://x.com/a.mp4')).toBe(false);
    expect(isPlacementRefImageUrl('https://x.com/board.jpg')).toBe(true);
  });

  it('buildStage2InstructionsContent orders edge inputs, Stage 1, and operator notes', () => {
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
    expect(types.filter((t) => t === 'text').length).toBe(1);
    expect(types.includes('image_url')).toBe(true);
    const toonBlock = parts.find((p): p is { type: 'text'; text: string } => p.type === 'text')?.text ?? '';
    expect(toonBlock).toContain('TOON');
    expect(toonBlock).toContain('Room layout');
    expect(toonBlock).toContain('Warm light');
    expect(toonBlock).toContain('stage2_instructions');
  });

  it('buildStage2InstructionsContent renders edgeInputs first and dedupes Stage 1 location URL', () => {
    const sharedUrl = 'https://example.com/shared.jpg';
    const parts = buildStage2InstructionsContent({
      edgeInputs: [
        {
          kind: 'image',
          edgeId: 'e1',
          sourceNodeId: 'u1',
          sourceType: 'uploadNode',
          url: sharedUrl,
          label: 'From edge',
        },
      ],
      placementAndNotes: 'Placement',
      userPrompt: '',
      locationImages: [{ url: sharedUrl, label: 'Main', mediaKind: 'image' }],
      props: [],
    });
    const toonBlock = parts.find((p): p is { type: 'text'; text: string } => p.type === 'text')?.text ?? '';
    expect(toonBlock).toContain('edge');
    expect(toonBlock).toContain('attachments');
    expect(toonBlock.includes('Main')).toBe(false);
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

  it('uses low image detail by default (slimmer vision payload)', () => {
    const parts = buildStage2InstructionsContent({
      placementAndNotes: 'x',
      userPrompt: '',
      placementRefImageUrl: 'https://example.com/ref.png',
      locationImages: [],
      props: [],
    });
    const imgs = parts.filter((p) => p.type === 'image_url');
    expect(imgs.length).toBe(1);
    expect(imgs[0].type === 'image_url' && imgs[0].imageUrl.detail).toBe('low');
  });

  it('dedupes same image URL across edge inputs (second edge skipped)', () => {
    const shared = 'https://example.com/once.jpg';
    const parts = buildStage2InstructionsContent({
      edgeInputs: [
        {
          kind: 'image',
          edgeId: 'e1',
          sourceNodeId: 'a',
          sourceType: 'uploadNode',
          url: shared,
        },
        {
          kind: 'image',
          edgeId: 'e2',
          sourceNodeId: 'b',
          sourceType: 'uploadNode',
          url: shared,
        },
      ],
      placementAndNotes: 'x',
      userPrompt: '',
    });
    expect(parts.filter((p) => p.type === 'image_url').length).toBe(1);
  });

  it('dedupes location URL when same URL appears in props (props skipped)', () => {
    const shared = 'https://example.com/shared-prop.jpg';
    const parts = buildStage2InstructionsContent({
      placementAndNotes: 'x',
      userPrompt: '',
      locationImages: [{ url: shared, label: 'Loc', mediaKind: 'image' }],
      props: [{ label: 'Chair', imageUrl: shared }],
    });
    expect(parts.filter((p) => p.type === 'image_url').length).toBe(1);
  });

  it('caps total image parts (props) when over STAGE2_MAX_IMAGE_PARTS default', () => {
    const max = getStage2ContentLimits().maxImageParts;
    const props = Array.from({ length: max + 5 }, (_, i) => ({
      label: `P${i}`,
      imageUrl: `https://example.com/p${i}.jpg`,
    }));
    const parts = buildStage2InstructionsContent({
      placementAndNotes: 'x',
      userPrompt: '',
      props,
    });
    const n = parts.filter((p) => p.type === 'image_url').length;
    expect(n).toBe(max);
  });
});
