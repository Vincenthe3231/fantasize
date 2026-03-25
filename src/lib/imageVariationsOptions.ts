/** Variation “mode” (Reframe menu) — ids are persisted in `node.data.variationMode`. */
export const VARIATION_MODES: { id: string; label: string }[] = [
  { id: 'age', label: 'Age' },
  { id: 'custom', label: 'Custom' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'expressions', label: 'Expressions' },
  { id: 'reframe', label: 'Reframe' },
  { id: 'storyboard', label: 'Storyboard' },
];

export const DEFAULT_VARIATION_MODE_ID = 'reframe';

/** Order aligned with proscen-flux AngleVariationsNode. */
export const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '9:16', '3:2'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** proscen parity: 2K / 4K only (1K removed). */
export const RESOLUTIONS = ['2K', '4K'] as const;
export type ResolutionId = (typeof RESOLUTIONS)[number];

/** Default multi-select when `data.perspectives` is unset (proscen default four). */
export const DEFAULT_PERSPECTIVE_IDS: string[] = [
  '3-4-view',
  'high-angle',
  'low-angle',
  'profile',
];

export const GRID_SIZES = ['1x1', '2x2', '3x3'] as const;
export type GridSizeId = (typeof GRID_SIZES)[number];

/** Canonical perspective options — ids are persisted in `node.data.perspectives`. */
export const PERSPECTIVE_CHOICES: { id: string; label: string }[] = [
  { id: '3-4-view', label: '3/4 View' },
  { id: 'aerial', label: 'Aerial' },
  { id: 'back-view', label: 'Back View' },
  { id: 'closeup', label: 'Closeup' },
  { id: 'extreme-long-shot', label: 'Extreme Long Shot' },
  { id: 'extreme-closeup', label: 'Extreme Closeup' },
  { id: 'eye-level', label: 'Eye Level' },
  { id: 'high-angle', label: 'High Angle' },
  { id: 'long-shot', label: 'Long Shot' },
  { id: 'low-angle', label: 'Low Angle' },
  { id: 'med-closeup', label: 'Med. Closeup' },
  { id: 'medium-long', label: 'Medium Long' },
  { id: 'ots', label: 'OTS' },
  { id: 'pov', label: 'POV' },
  { id: 'profile', label: 'Profile' },
  { id: 'wide', label: 'Wide' },
];

const perspectiveLabelById = new Map(PERSPECTIVE_CHOICES.map((p) => [p.id, p.label]));

export function getPerspectiveLabel(id: string): string | undefined {
  return perspectiveLabelById.get(id);
}

export function normalizePerspectiveIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const allowed = new Set(PERSPECTIVE_CHOICES.map((p) => p.id));
  return ids.filter((x): x is string => typeof x === 'string' && allowed.has(x));
}

export function resolvePerspectiveIds(dataPerspectives: unknown): string[] {
  if (dataPerspectives === undefined) return [...DEFAULT_PERSPECTIVE_IDS];
  return normalizePerspectiveIds(dataPerspectives);
}

export function normalizeResolution(value: unknown): ResolutionId {
  const v = typeof value === 'string' ? value : '';
  if ((RESOLUTIONS as readonly string[]).includes(v)) return v as ResolutionId;
  return '2K';
}
