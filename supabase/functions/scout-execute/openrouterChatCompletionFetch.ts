/// <reference path="./env.d.ts" />
/**
 * Direct OpenRouter chat/completions HTTP call (bypasses @openrouter/sdk response Zod).
 * Some providers return JSON with unescaped newlines inside long data: URLs, which
 * breaks strict JSON.parse and fails SDK inbound validation; error bodies may also
 * omit the `{ error: { code, message } }` shape the SDK expects.
 */

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

export function openRouterApiBase(): string {
  const raw = Deno.env.get('OPENROUTER_API_BASE')?.trim();
  if (!raw) return DEFAULT_BASE;
  return raw.replace(/\/$/, '');
}

/**
 * Remove raw ASCII control characters (U+0000–U+001F) when they appear *inside*
 * JSON string values without a backslash escape. Valid JSON never contains these
 * unescaped; some APIs still emit them inside base64 data URLs.
 */
export function stripUnescapedAsciiControlsInJsonStrings(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (!inString) {
      if (c === '"') inString = true;
      out += c;
      continue;
    }
    if (escaped) {
      out += c;
      escaped = false;
      continue;
    }
    if (c === '\\') {
      out += c;
      escaped = true;
      continue;
    }
    if (c === '"') {
      inString = false;
      out += c;
      continue;
    }
    const code = c.charCodeAt(0);
    if (code < 0x20) {
      continue;
    }
    out += c;
  }
  return out;
}

export function parseOpenRouterChatResponseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (first) {
    if (!(first instanceof SyntaxError)) throw first;
    const repaired = stripUnescapedAsciiControlsInJsonStrings(raw);
    return JSON.parse(repaired);
  }
}

export function summarizeOpenRouterErrorBody(raw: string, maxLen = 800): string {
  const slice = raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const err = o.error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    if (typeof o.message === 'string') return o.message;
  } catch {
    /* fall through */
  }
  return slice.trim() || `HTTP error (body not JSON)`;
}

export async function postOpenRouterChatCompletions(params: {
  apiKey: string;
  httpReferer: string;
  appTitle: string;
  /** Wire JSON body (OpenAI-compatible chat completion object). */
  body: Record<string, unknown>;
}): Promise<{ ok: true; data: unknown } | { ok: false; status: number; raw: string }> {
  const url = `${openRouterApiBase()}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': params.httpReferer,
      'X-OpenRouter-Title': params.appTitle,
    },
    body: JSON.stringify(params.body),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, raw };
  }

  try {
    const data = parseOpenRouterChatResponseJson(raw);
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: res.status, raw: `JSON parse failed (${msg}): ${raw.slice(0, 400)}` };
  }
}
