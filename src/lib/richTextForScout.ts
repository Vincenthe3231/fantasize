import { plainTextFromHtml } from '@/lib/scoutPipeline';

/**
 * Convert stored rich HTML (TipTap) to plain text for Scout / LLM payloads.
 * Mention nodes render as visible `@label` in the document; tags are stripped like other HTML.
 */
export function richTextToPlainForScout(html: string): string {
  return plainTextFromHtml(html ?? '');
}
