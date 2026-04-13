import { describe, expect, it } from 'vitest';
import { formatOpenRouterImageHttpError } from '../../supabase/functions/scout-execute/openrouterChatCompletionFetch.ts';
import {
  parseJsonLenient,
  stripUnescapedAsciiControlsInJsonStrings,
} from '../../supabase/functions/scout-execute/jsonLenientParse.ts';

describe('stripUnescapedAsciiControlsInJsonStrings', () => {
  it('leaves valid JSON unchanged', () => {
    const j = '{"a":"line\\nbreak"}';
    expect(stripUnescapedAsciiControlsInJsonStrings(j)).toBe(j);
  });

  it('removes raw newline inside a string value', () => {
    const broken = '{"url":"data:x;base64,abc\ndef"}';
    const fixed = stripUnescapedAsciiControlsInJsonStrings(broken);
    expect(fixed).toBe('{"url":"data:x;base64,abcdef"}');
    expect(JSON.parse(fixed)).toEqual({ url: 'data:x;base64,abcdef' });
  });
});

describe('parseJsonLenient', () => {
  it('parses strict JSON', () => {
    expect(parseJsonLenient('{"ok":true}')).toEqual({ ok: true });
  });

  it('repairs then parses when unescaped newline in string', () => {
    const broken = '{"choices":[{"message":{"images":[{"image_url":{"url":"data:x;base64,ab\ncd"}}]}}]}';
    const o = parseJsonLenient(broken) as {
      choices: Array<{ message: { images: Array<{ image_url: { url: string } }> } }>;
    };
    expect(o.choices[0]!.message.images[0]!.image_url.url).toBe('data:x;base64,abcd');
  });
});

describe('formatOpenRouterImageHttpError', () => {
  it('surfaces Cloudflare 1102 / edge limit guidance', () => {
    const raw = JSON.stringify({
      error_code: 1102,
      cloudflare_error: true,
      title: 'Error 1102',
      detail: 'Worker exceeded resource limits',
    });
    const msg = formatOpenRouterImageHttpError(503, raw);
    expect(msg).toContain('fewer reference images');
    expect(msg).toContain('OPENROUTER_IMAGE_GEN_MAX_ANCHORS');
  });
});
