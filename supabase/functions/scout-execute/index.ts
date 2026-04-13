import { handleScoutStage } from './stageHandlers.ts';
import { formatOpenRouterSdkError } from './openRouterSdkError.ts';
import type { ScoutExecutionKind } from './types.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  /** Required for browser preflight when POST uses apikey / Authorization / x-client-info. */
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body: { executionKind?: string; context?: Record<string, unknown> };
    try {
      body = (await req.json()) as { executionKind?: string; context?: Record<string, unknown> };
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return json({ ok: false, error: `Invalid JSON body: ${msg}` }, 400);
    }

    const executionKind = body.executionKind as ScoutExecutionKind | undefined;
    const context = body.context ?? {};

    if (!executionKind) {
      return json({ ok: false, error: 'Missing executionKind' }, 400);
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');

    const { result, mock, meta } = await handleScoutStage(executionKind, context, apiKey);

    return json({
      ok: true,
      result,
      mock,
      ...(meta ? { meta } : {}),
    });
  } catch (e) {
    const msg = formatOpenRouterSdkError(e);
    return json({ ok: false, error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
