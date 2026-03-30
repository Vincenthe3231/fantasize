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

/** One incoming edge → assistant, resolved to typed payload for multimodal build (edge-first). */
export const AssistantEdgeInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    edgeId: z.string(),
    sourceNodeId: z.string(),
    sourceType: z.string(),
    targetHandle: z.string().optional(),
    sourceHandle: z.string().optional(),
    text: z.string(),
  }),
  z.object({
    kind: z.literal('image'),
    edgeId: z.string(),
    sourceNodeId: z.string(),
    sourceType: z.string(),
    targetHandle: z.string().optional(),
    sourceHandle: z.string().optional(),
    url: z.string().min(1),
    label: z.string().optional(),
  }),
  z.object({
    kind: z.literal('video'),
    edgeId: z.string(),
    sourceNodeId: z.string(),
    sourceType: z.string(),
    targetHandle: z.string().optional(),
    sourceHandle: z.string().optional(),
    url: z.string().min(1),
    label: z.string().optional(),
  }),
]);

export type AssistantEdgeInput = z.infer<typeof AssistantEdgeInputSchema>;

// ── Stage 2 ────────────────────────────────────────────────────────────────

export const Stage2InstructionsContextSchema = z.object({
  kind: z.literal('stage2_instructions'),
  assistantNodeId: z.string(),
  /** Optional user prompt on the assistant node */
  userPrompt: z.string(),
  /** Stage 1 placement plain text only (not duplicated edge-sourced text). */
  placementAndNotes: z.string(),
  /** Structured inputs per incoming edge to the assistant (handle-aware). */
  edgeInputs: z.array(AssistantEdgeInputSchema).default([]),
  /** Optional placement board image URL (HTTPS, non-video) for vision */
  placementRefImageUrl: z.string().optional(),
  locationImages: z.array(Stage1LocationImageSchema),
  props: z.array(Stage1PropSchema),
});

export type Stage2InstructionsContext = z.infer<typeof Stage2InstructionsContextSchema>;

export const Stage2ImageGeneratorContextSchema = z
  .object({
    kind: z.literal('stage2_image_generator'),
    imageGeneratorNodeId: z.string(),
    /** Rich-text prompt on the image generator node (plain). */
    prompt: z.string(),
    /** Merged plain text from all `text-in` edges (handle-aware; groups aggregated). */
    wiredTextFromEdges: z.string().optional(),
    /** Image URLs from `image-in` edges, deduped, stable order. */
    anchorImageUrls: z.array(z.string()).default([]),
    /** Video URLs from `video-in` / video sources on image-in when applicable. */
    anchorVideoUrls: z.array(z.string()).default([]),
    negativePrompt: z.string().optional(),
    mode: z.string().optional(),
    aspect: z.string().optional(),
    images: z.number().int().min(1).max(8).optional(),
    promptItems: z.array(z.string().min(1)).optional(),
    queueMode: z.enum(['single', 'perPromptSequential']).optional(),
  })
  .refine(
    (d) =>
      d.prompt.trim().length > 0 ||
      (d.wiredTextFromEdges?.trim().length ?? 0) > 0 ||
      ((d.promptItems?.length ?? 0) > 0),
    {
      message: 'Image generator needs a prompt on the node, non-empty text from edges, or prompt items.',
    }
  );

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

export const Stage3AnglePreferencesSchema = z.object({
  aspectRatio: z.string().min(1),
  resolutionLabel: z.string().min(1),
  splitImages: z.boolean().optional(),
});

export const Stage3AngleVariationsContextSchema = z.object({
  kind: z.literal('stage3_angle_variations'),
  angleVariationsNodeId: z.string(),
  listNodeId: z.string().optional(),
  /** Primary/legacy source image (first from sourceImageUrls). */
  sourceImageUrl: z.string().min(1),
  /** All usable upstream image anchors (stable order, deduped). */
  sourceImageUrls: z.array(z.string().min(1)).min(1),
  gridLayout: z.enum(['1x1', '2x2', '3x3']),
  /** Selected camera perspective ids (order preserved). */
  perspectiveIds: z.array(z.string().min(1)).min(1).max(9),
  /** Human labels aligned with perspectiveIds. */
  perspectiveLabels: z.array(z.string().min(1)).min(1).max(9),
  /** Optional camera-direction prompts aligned with perspectiveIds (empty string when none). */
  perspectivePrompts: z.array(z.string()).min(1).max(9),
  /** Output preferences (aspect for OpenRouter image_config, resolution for labeling). */
  preferences: Stage3AnglePreferencesSchema,
  /** Scene / creative context: local prompt + wired upstream text. */
  sceneContextText: z.string(),
  /** Must equal perspectiveIds.length */
  count: z.number().int().min(1).max(9),
}).superRefine((d, ctx) => {
  if (d.perspectiveIds.length !== d.perspectiveLabels.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'stage3: perspectiveIds and perspectiveLabels length mismatch',
    });
  }
  if (d.perspectivePrompts.length !== d.perspectiveIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'stage3: perspectiveIds and perspectivePrompts length mismatch',
    });
  }
  if (d.sourceImageUrls[0] !== d.sourceImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'stage3: sourceImageUrl must be first item of sourceImageUrls',
    });
  }
  if (d.count !== d.perspectiveIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'stage3: count must match perspectiveIds length',
    });
  }
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
  perspectiveId: z.string().optional(),
  label: z.string().optional(),
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
    generatedUrls: z.array(z.string()).optional(),
    /** ISO-8601 per image, same order as `generatedUrls` (from scout-execute) */
    generatedCreatedAt: z.array(z.string()).optional(),
    generatedImageMetaByUrl: z
      .record(
        z.object({
          referer: z.string().optional(),
          generatedBy: z.string().optional(),
          timestamp: z.number().optional(),
          created_at: z.string().optional(),
          supabaseUrl: z.string().optional(),
        })
      )
      .optional(),
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
  /** Optional diagnostics from scout-execute (model id, lengths, etc.). */
  meta: z.record(z.unknown()).optional(),
});

export type ScoutExecuteResponse = z.infer<typeof ScoutExecuteResponseSchema>;

