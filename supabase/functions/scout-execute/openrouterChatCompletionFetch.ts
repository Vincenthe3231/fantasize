/// <reference path="./env.d.ts" />
/**
 * Direct OpenRouter chat/completions HTTP call (bypasses @openrouter/sdk response Zod).
 * Some providers return JSON with unescaped newlines inside long data: URLs, which
 * breaks strict JSON.parse and fails SDK inbound validation; error bodies may also
 * omit the `{ error: { code, message } }` shape the SDK expects.
 */

import { parseJsonLenient } from './jsonLenientParse.ts';

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

export function openRouterApiBase(): string {
  const raw = Deno.env.get('OPENROUTER_API_BASE')?.trim();
  if (!raw) return DEFAULT_BASE;
  return raw.replace(/\/$/, '');
}

/** @deprecated use parseJsonLenient from jsonLenientParse.ts */
export function parseOpenRouterChatResponseJson(raw: string): unknown {
  return parseJsonLenient(raw);
}

export function summarizeOpenRouterErrorBody(raw: string, maxLen = 800): string {
  const slice = raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.detail === 'string' && o.detail.length > 0) {
      const title = typeof o.title === 'string' ? `${o.title}: ` : '';
      return `${title}${o.detail}`;
    }
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

/** User-facing line for failed OpenRouter HTTP responses (incl. Cloudflare 1102 on openrouter.ai). */
export function formatOpenRouterImageHttpError(status: number, raw: string): string {
  const summary = summarizeOpenRouterErrorBody(raw);
  try {
    const o = JSON.parse(raw) as {
      error_code?: number;
      error_name?: string;
      cloudflare_error?: boolean;
      retryable?: boolean;
    };
    const cf =
      o.cloudflare_error === true ||
      o.error_code === 1102 ||
      o.error_name === 'worker_exceeded_resources';
    if (status === 503 && cf) {
      return (
        `OpenRouter returned HTTP ${status} (edge resource limit / Cloudflare 1102). ` +
        `Send a smaller request: fewer reference images (see OPENROUTER_IMAGE_GEN_MAX_ANCHORS), ` +
        `shorter prompt, or a lighter image model. ${summary}`
      );
    }
  } catch {
    /* use generic */
  }
  return `OpenRouter image request failed (HTTP ${status}). Check OPENROUTER_IMAGE_GEN_MODEL / modalities / API key. ${summary}`;
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
    const data = parseJsonLenient(raw);
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: res.status, raw: `JSON parse failed (${msg}): ${raw.slice(0, 400)}` };
  }
}
