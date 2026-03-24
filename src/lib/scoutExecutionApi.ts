import { supabase } from '@/integrations/supabase/client';
import {
  ScoutExecuteRequestSchema,
  type ScoutExecuteRequest,
  ScoutExecuteResponseSchema,
  type ScoutExecuteResponse,
  type ScoutExecutionKind,
} from '@/lib/scoutContextContracts';
import { scoutDebugLog, scoutDebugTime, summarizeForScoutLog } from '@/lib/scoutDebugLog';

const DEFAULT_TIMEOUT_MS: Record<ScoutExecutionKind, number> = {
  stage2_instructions: 90_000,
  stage2_image_generator: 120_000,
  stage2_set_dressing: 120_000,
  stage3_angle_variations: 120_000,
  stage4_lighting_batch: 180_000,
  stage5_atmosphere_text: 180_000,
  stage5_atmosphere_reference: 180_000,
};

export interface InvokeScoutExecuteOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Invoke the `scout-execute` Supabase Edge Function with typed request/response.
 * OpenRouter credentials stay server-side; the browser only sends stage context.
 */
export async function invokeScoutExecute(
  executionKind: ScoutExecutionKind,
  context: Record<string, unknown>,
  options: InvokeScoutExecuteOptions = {}
): Promise<ScoutExecuteResponse> {
  const body: ScoutExecuteRequest = ScoutExecuteRequestSchema.parse({
    executionKind,
    context,
  });

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS[executionKind];

  scoutDebugLog('invoke scout-execute → request', {
    executionKind,
    context: summarizeForScoutLog(context),
    timeoutMs,
  });
  const endTimer = scoutDebugTime(`invoke scout-execute ← ${executionKind}`);

  const invokePromise = supabase.functions.invoke('scout-execute', { body });

  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = window.setTimeout(() => reject(new Error(`TIMEOUT_${timeoutMs}`)), timeoutMs);
    options.signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(t);
        reject(new Error('Aborted'));
      },
      { once: true }
    );
  });

  try {
    const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

    if (error) {
      endTimer();
      scoutDebugLog('invoke scout-execute ← error', { message: error.message });
      return {
        ok: false,
        error: error.message ?? 'Edge function error',
      };
    }

    const parsed = ScoutExecuteResponseSchema.safeParse(data);
    if (!parsed.success) {
      endTimer();
      scoutDebugLog('invoke scout-execute ← invalid response', { issues: parsed.error.flatten() });
      return { ok: false, error: `Invalid response: ${parsed.error.message}` };
    }
    endTimer();
    scoutDebugLog('invoke scout-execute ← response', {
      ok: parsed.data.ok,
      mock: parsed.data.mock,
      error: parsed.data.error,
      resultKind: parsed.data.result?.kind,
      result: parsed.data.result ? summarizeForScoutLog(parsed.data.result) : undefined,
    });
    return parsed.data;
  } catch (e: unknown) {
    endTimer();
    const msg = e instanceof Error ? e.message : String(e);
    scoutDebugLog('invoke scout-execute ← exception', { message: msg });
    if (msg.startsWith('TIMEOUT_')) {
      return { ok: false, error: `Request timed out after ${timeoutMs}ms` };
    }
    return { ok: false, error: msg };
  }
}
