/**
 * Multimodal user message parts for Stage 2 instructions (OpenRouter chat format).
 * Shapes align with @openrouter/sdk ChatMessageContentItem (plain JSON for Deno).
 */

export type Stage2MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'video_url'; videoUrl: { url: string } };

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

function isProbablyHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Placement board / reference: treat as image if HTTPS and not a video file. */
export function isPlacementRefImageUrl(url: string): boolean {
  if (!url.trim() || isBlobUrl(url) || !isProbablyHttp(url)) return false;
  if (isVideoUrl(url)) return false;
  return true;
}

/**
 * Build multimodal content from the JSON context produced by the app resolver.
 */
export function buildStage2InstructionsContent(context: Record<string, unknown>): Stage2MultimodalPart[] {
  const parts: Stage2MultimodalPart[] = [];

  const placementAndNotes = String(context.placementAndNotes ?? '');
  const userPrompt = String(context.userPrompt ?? '');
  const placementRefImageUrl = context.placementRefImageUrl ? String(context.placementRefImageUrl) : '';

  parts.push({
    type: 'text',
    text: '## Placement and notes\n' + placementAndNotes,
  });

  if (placementRefImageUrl && isPlacementRefImageUrl(placementRefImageUrl) && !isBlobUrl(placementRefImageUrl)) {
    parts.push({ type: 'text', text: '## Placement reference image' });
    parts.push({
      type: 'image_url',
      imageUrl: { url: placementRefImageUrl, detail: 'auto' },
    });
  }

  const locationImages = (
    context.locationImages as
      | Array<{ url?: string; label?: string; mediaKind?: 'image' | 'video' }>
      | undefined
  ) ?? [];

  for (const loc of locationImages) {
    const url = String(loc?.url ?? '').trim();
    if (!url) continue;
    if (isBlobUrl(url)) {
      console.warn('[scout-execute] Skipping blob: URL (not reachable from edge). Upload to storage for LLM access.');
      continue;
    }
    const label = String(loc?.label ?? '').trim();
    const kind =
      loc?.mediaKind ?? (isVideoUrl(url) ? 'video' : 'image');

    parts.push({
      type: 'text',
      text: `## Location${label ? ` (${label})` : ''}`,
    });

    if (kind === 'video' || isVideoUrl(url)) {
      parts.push({ type: 'video_url', videoUrl: { url } });
    } else {
      parts.push({
        type: 'image_url',
        imageUrl: { url, detail: 'auto' },
      });
    }
  }

  const props = (context.props as Array<{ label: string; imageUrl: string }> | undefined) ?? [];
  for (const p of props) {
    const url = String(p.imageUrl ?? '').trim();
    const label = String(p.label ?? '').trim();
    if (!url) continue;
    if (isBlobUrl(url)) {
      console.warn('[scout-execute] Skipping blob: prop image for', label);
      continue;
    }
    parts.push({
      type: 'text',
      text: `## Prop: ${label || 'unnamed'}`,
    });
    parts.push({
      type: 'image_url',
      imageUrl: { url, detail: 'auto' },
    });
  }

  parts.push({
    type: 'text',
    text: '## Operator notes\n' + (userPrompt || '(none)'),
  });

  return parts;
}
