import { describe, it, expect } from 'vitest';
import {
  canvasPreviewImageUrl,
  canvasStableImageUrl,
  isSupabasePublicTransformUrl,
} from './imageDelivery';

const OBJECT_BASE =
  'https://abc123.supabase.co/storage/v1/object/public/my-bucket/folder/img.jpg';
const RENDER_BASE =
  'https://abc123.supabase.co/storage/v1/render/image/public/my-bucket/folder/img.jpg';

describe('imageDelivery', () => {
  it('rewrites object/public URLs to render/image before transform params (no format= for auto WebP)', () => {
    const out = canvasStableImageUrl(OBJECT_BASE, { maxWidth: 800 });
    expect(out).toContain('/storage/v1/render/image/public/');
    expect(out).not.toContain('/storage/v1/object/public/');
    expect(out).toMatch(/[?&]width=800\b/);
    expect(out).not.toMatch(/[?&]format=/);
  });

  it('does not double-rewrite already-render URLs', () => {
    const out = canvasStableImageUrl(RENDER_BASE, { maxWidth: 640, format: 'origin' });
    expect(out.match(/render\/image\/public/g)?.length).toBe(1);
    expect(out).toMatch(/[?&]width=640\b/);
    expect(out).toMatch(/[?&]format=origin\b/);
  });

  it('canvasPreviewImageUrl rewrites object path for fixed dimensions', () => {
    const out = canvasPreviewImageUrl(OBJECT_BASE, {
      width: 320,
      height: 240,
    });
    expect(out).toContain('/storage/v1/render/image/public/');
    expect(out).toMatch(/[?&]width=320\b/);
    expect(out).toMatch(/[?&]height=240\b/);
    expect(out).not.toMatch(/[?&]format=/);
  });

  it('isSupabasePublicTransformUrl is true for object and render public URLs', () => {
    expect(isSupabasePublicTransformUrl(OBJECT_BASE)).toBe(true);
    expect(isSupabasePublicTransformUrl(RENDER_BASE)).toBe(true);
    expect(isSupabasePublicTransformUrl('https://example.com/a.jpg')).toBe(false);
  });
});
