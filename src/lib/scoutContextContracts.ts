import { z } from 'zod';

/** Discriminator for edge function + client execution. */
export const ScoutExecutionKindSchema = z.enum([
  'stage2_instructions',
  'stage2_image_generator',
  'stage2_set_dressing',
  'stage3_angle_variations',
  'stage4_lighting_batch',
  'stage5_atmosphere_text',
  'stage5_atmosphere_reference',
]);

export type ScoutExecutionKind = z.infer<typeof ScoutExecutionKindSchema>;

// ── Stage 1 (validation / transport only; no remote AI) ─────────────────────

export const Stage1LocationImageSchema = z.object({
  nodeId: z.string(),
  label: z.string().optional(),
  url: z.string().min(1),
  /** From upload media: image vs video URL for multimodal edge routing */
  mediaKind: z.enum(['image', 'video']).optional(),
});

export const Stage1PropSchema = z.object({
  nodeId: z.string(),
  label: z.string().min(1),
  imageUrl: z.string().min(1),
});

export const Stage1ContextSchema = z.object({
  locationImages: z.array(Stage1LocationImageSchema).min(1),
  placementHtml: z.string().min(1),
  placementPlain: z.string().min(1),
  props: z.array(Stage1PropSchema).min(1),
});

export type Stage1Context = z.infer<typeof Stage1ContextSchema>;

// ── Stage 2 ────────────────────────────────────────────────────────────────

export const Stage2InstructionsContextSchema = z.object({
  kind: z.literal('stage2_instructions'),
  assistantNodeId: z.string(),
  /** Optional user prompt on the assistant node */
  userPrompt: z.string(),
  /** Aggregated text from connected text/placement sources */
  placementAndNotes: z.string(),
  /** Optional placement board image URL (HTTPS, non-video) for vision */
  placementRefImageUrl: z.string().optional(),
  locationImages: z.array(Stage1LocationImageSchema),
  props: z.array(Stage1PropSchema),
});

export type Stage2InstructionsContext = z.infer<typeof Stage2InstructionsContextSchema>;

export const Stage2ImageGeneratorContextSchema = z.object({
  kind: z.literal('stage2_image_generator'),
  imageGeneratorNodeId: z.string(),
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  mode: z.string().optional(),
  aspect: z.string().optional(),
  /** Anchor location image from upstream upload connection */
  anchorImageUrl: z.string().optional(),
});

export type Stage2ImageGeneratorContext = z.infer<typeof Stage2ImageGeneratorContextSchema>;

export const Stage2SetDressingContextSchema = z.object({
  kind: z.literal('stage2_set_dressing'),
  setDressingNodeId: z.string(),
  locationImages: z.array(Stage1LocationImageSchema).min(1),
  placementPlain: z.string().min(1),
  props: z.array(Stage1PropSchema).min(1),
  /** Prompt from connected image generator / assistant chain */
  scenePrompt: z.string().min(1),
  anchorImageUrl: z.string().min(1),
});

export type Stage2SetDressingContext = z.infer<typeof Stage2SetDressingContextSchema>;

// ── Stage 3 ────────────────────────────────────────────────────────────────

export const Stage3AngleVariationsContextSchema = z.object({
  kind: z.literal('stage3_angle_variations'),
  angleVariationsNodeId: z.string(),
  listNodeId: z.string().optional(),
  sourceImageUrl: z.string().min(1),
  gridLayout: z.enum(['1x1', '2x2', '3x3']),
  /** How many cells / angles to generate */
  count: z.number().int().min(1).max(9),
});

export type Stage3AngleVariationsContext = z.infer<typeof Stage3AngleVariationsContextSchema>;

// ── Stage 4 ────────────────────────────────────────────────────────────────

export const Stage4LightingBatchContextSchema = z.object({
  kind: z.literal('stage4_lighting_batch'),
  lightingScenarioNodeId: z.string(),
  selectedShotUrl: z.string().min(1),
  lightingLabels: z.array(z.string().min(1)).min(1),
});

export type Stage4LightingBatchContext = z.infer<typeof Stage4LightingBatchContextSchema>;

// ── Stage 5 ────────────────────────────────────────────────────────────────

export const Stage5AtmosphereContextSchema = z.discriminatedUnion('branch', [
  z.object({
    branch: z.literal('text'),
    atmosphereNodeId: z.string(),
    moodText: z.string().min(1),
    lightingVariants: z
      .array(z.object({ id: z.string(), label: z.string(), src: z.string() }))
      .min(1),
  }),
  z.object({
    branch: z.literal('reference'),
    atmosphereNodeId: z.string(),
    referenceImageUrl: z.string().min(1),
    lightingVariants: z
      .array(z.object({ id: z.string(), label: z.string(), src: z.string() }))
      .min(1),
  }),
]);

export type Stage5AtmosphereContext = z.infer<typeof Stage5AtmosphereContextSchema>;

/** Union of all remote payload contexts */
export const ScoutRemoteContextSchema = z.union([
  Stage2InstructionsContextSchema,
  Stage2ImageGeneratorContextSchema,
  Stage2SetDressingContextSchema,
  Stage3AngleVariationsContextSchema,
  Stage4LightingBatchContextSchema,
  z.object({
    kind: z.literal('stage5_atmosphere_text'),
    atmosphereNodeId: z.string(),
    moodText: z.string().min(1),
    lightingVariants: z
      .array(z.object({ id: z.string(), label: z.string(), src: z.string() }))
      .min(1),
  }),
  z.object({
    kind: z.literal('stage5_atmosphere_reference'),
    atmosphereNodeId: z.string(),
    referenceImageUrl: z.string().min(1),
    lightingVariants: z
      .array(z.object({ id: z.string(), label: z.string(), src: z.string() }))
      .min(1),
  }),
]);

export type ScoutRemoteContext = z.infer<typeof ScoutRemoteContextSchema>;

// ── Responses (edge → client) ─────────────────────────────────────────────

export const LightingResultItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  src: z.string(),
});

export const AngleItemSchema = z.object({
  id: z.string(),
  src: z.string(),
  resolution: z.string().optional(),
});

export const ScoutExecutionResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stage2_instructions'),
    refinedPrompt: z.string(),
    model: z.string().optional(),
  }),
  z.object({
    kind: z.literal('stage2_image_generator'),
    generatedUrl: z.string(),
    status: z.enum(['success', 'idle']).optional(),
  }),
  z.object({
    kind: z.literal('stage2_set_dressing'),
    previewUrl: z.string(),
  }),
  z.object({
    kind: z.literal('stage3_angle_variations'),
    angles: z.array(AngleItemSchema).min(1),
  }),
  z.object({
    kind: z.literal('stage4_lighting_batch'),
    results: z.array(LightingResultItemSchema).min(1),
  }),
  z.object({
    kind: z.literal('stage5_atmosphere_text'),
    results: z.array(LightingResultItemSchema).min(1),
  }),
  z.object({
    kind: z.literal('stage5_atmosphere_reference'),
    results: z.array(LightingResultItemSchema).min(1),
  }),
]);

export type ScoutExecutionResult = z.infer<typeof ScoutExecutionResultSchema>;

export const ScoutExecuteRequestSchema = z.object({
  executionKind: ScoutExecutionKindSchema,
  context: z.record(z.unknown()),
});

export type ScoutExecuteRequest = z.infer<typeof ScoutExecuteRequestSchema>;

export const ScoutExecuteResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  result: ScoutExecutionResultSchema.optional(),
  mock: z.boolean().optional(),
});

export type ScoutExecuteResponse = z.infer<typeof ScoutExecuteResponseSchema>;

