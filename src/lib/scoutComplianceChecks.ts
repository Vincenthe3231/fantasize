import type { ScoutExecutionKind, ScoutRemoteContext, ScoutExecutionResult } from '@/lib/scoutContextContracts';

export interface ComplianceCheckInput {
  executionKind: ScoutExecutionKind;
  context: ScoutRemoteContext;
  result: ScoutExecutionResult;
  /** True when edge function returned mock payload or client used local fallback */
  usedMock: boolean;
}

/**
 * Assert Virtual Production Scout invariants after a run (batch cardinality, optional dev logging).
 * Does not throw — logs warnings in development.
 */
export function runScoutComplianceChecks(input: ComplianceCheckInput): void {
  const { executionKind, context, result, usedMock } = input;

  if (executionKind === 'stage4_lighting_batch' && result.kind === 'stage4_lighting_batch') {
    const labels =
      context.kind === 'stage4_lighting_batch' ? context.lightingLabels : [];
    if (labels.length !== result.results.length) {
      console.warn(
        '[Scout compliance] Stage 4 batch cardinality mismatch — expected N lighting labels → N images.',
        { expected: labels.length, got: result.results.length }
      );
    }
  }

  if (
    (executionKind === 'stage5_atmosphere_text' && result.kind === 'stage5_atmosphere_text') ||
    (executionKind === 'stage5_atmosphere_reference' && result.kind === 'stage5_atmosphere_reference')
  ) {
    const vars =
      context.kind === 'stage5_atmosphere_text' || context.kind === 'stage5_atmosphere_reference' ?
        context.lightingVariants
      : [];
    if (vars.length !== result.results.length) {
      console.warn(
        '[Scout compliance] Stage 5 batch cardinality mismatch — expected N lighting variants → N atmosphere outputs.',
        { expected: vars.length, got: result.results.length }
      );
    }
  }

  if (executionKind === 'stage3_angle_variations' && result.kind === 'stage3_angle_variations') {
    if (
      context.kind === 'stage3_angle_variations' &&
      result.angles.length !== context.count
    ) {
      console.warn('[Scout compliance] Stage 3 angle count mismatch.', {
        expected: context.count,
        got: result.angles.length,
      });
    }
  }

  if (usedMock && import.meta.env.DEV) {
    console.info('[Scout compliance] Run used mock / fallback — verify edge function + OPENROUTER_API_KEY for production.');
  }
}
