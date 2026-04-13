import { describe, expect, it } from 'vitest';
import {
  parseOpenRouterChatResponseJson,
  stripUnescapedAsciiControlsInJsonStrings,
} from '../../supabase/functions/scout-execute/openrouterChatCompletionFetch.ts';

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

describe('parseOpenRouterChatResponseJson', () => {
  it('parses strict JSON', () => {
    expect(parseOpenRouterChatResponseJson('{"ok":true}')).toEqual({ ok: true });
  });

  it('repairs then parses when unescaped newline in string', () => {
    const broken = '{"choices":[{"message":{"images":[{"image_url":{"url":"data:x;base64,ab\ncd"}}]}}]}';
    const o = parseOpenRouterChatResponseJson(broken) as {
      choices: Array<{ message: { images: Array<{ image_url: { url: string } }> } }>;
    };
    expect(o.choices[0]!.message.images[0]!.image_url.url).toBe('data:x;base64,abcd');
  });
});
