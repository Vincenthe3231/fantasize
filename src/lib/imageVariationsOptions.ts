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
export type PerspectiveChoice = { id: string; label: string; prompt?: string };

export const PERSPECTIVE_CHOICES: PerspectiveChoice[] = [
  { id: '3-4-view', label: '3/4 View' },
  { id: 'aerial', label: 'Aerial' },
  { id: 'back-view', label: 'Back View' },
  { id: 'closeup', label: 'Closeup' },
  {
    id: 'extreme-long-shot',
    label: 'Extreme Long Shot',
    prompt:
      'Extreme long shot of a bright living room: polished wood floors, neutral sectional with matching ottoman, wall-mounted TV, minimalist shelving; large windows open to lush greenery outside. Camera straight-on at eye level—like standing in the space, square to the main seating and entertainment wall (no tilt left/right, no look-up or look-down). Very wide field of view: most of the room visible from the TV wall across to the full run of glass on the left; room edges in frame; generous outdoor background. X-axis: left—floor-to-ceiling windows and daylight; center—sectional in midground; right—wall, lamp, corner; emphasize horizontal breadth. Y-axis: floor through ceiling and recessed lighting; TV and upper shelving in the mid-upper frame. Z-axis: foreground ottoman and sofa leading edge; midground seating and console; background depth through glass into layered green exterior; wide lens feel to exaggerate depth and expansiveness.',
  },
  { id: 'extreme-closeup', label: 'Extreme Closeup' },
  { id: 'eye-level', label: 'Eye Level' },
  {
    id: 'high-angle',
    label: 'High Angle',
    prompt:
      'High-angle interior of a modern living room: camera elevated, looking down with a wide (not ultra-wide) field of view—observational, slightly dominant. Left side: floor-to-ceiling windows and greenery outside. Right: interior wall with a floor lamp and a doorway or opening deeper into the space. A large sectional runs left-center toward the right across the frame. Depth: foreground—ottoman and coffee table closest to camera; midground—main seating; background—shelving with artwork on the wall furthest from camera. Emphasize clear floor plan read from above, natural light from the glass wall, and distinct zones from foreground table to background unit.',
  },
  {
    id: 'long-shot',
    label: 'Long Shot',
    prompt:
      'Long shot of a spacious modern living room or large common area: polished wood floors, light walls, minimalist. Camera at low-to-medium eye level—natural and grounded, not extreme floor-level or steep high angle. Wide field of view: overall layout, furniture rhythm, and architecture read clearly; no single element dominates. Left: large speaker and long built-in shelving with a TV above. Center and right: sofa, coffee table, two large ottomans; horizontal breadth of the space visible. Vertical span: floor through furniture heights to wall and ceiling. Depth: foreground—floorboards and speaker edge; midground—seating cluster; background—far wall and full room depth; emphasize scale and environment.',
  },
  {
    id: 'low-angle',
    label: 'Low Angle',
    prompt:
      'Slightly low-angle interior of a modern, bright living room: camera near the floor, tilted upward toward the main wall so ceiling height reads expansive. Wide-angle lens—broad sweep of the layout, mild edge distortion, immersive. Left: a light pouf or ottoman, then floor-to-ceiling glass with lush greenery outside. Center and right: L-shaped sectional, coffee table, long low cabinet or entertainment unit on the back wall; far right, a floor lamp with a white shade. Vertical read: polished wood floor and soft furniture shadows below; mid-height seating and table; upper frame—framed black-and-white tree artwork and ceiling with recessed lights. Depth: foreground wood floor and leading edges of pouf and sofa; midground table and sofa mass; background wall unit, art, lamp, and window depth into the garden.',
  },
  { id: 'med-closeup', label: 'Med. Closeup' },
  { id: 'medium-long', label: 'Medium Long' },
  { id: 'ots', label: 'OTS' },
  { id: 'pov', label: 'POV' },
  { id: 'profile', label: 'Profile' },
  { id: 'wide', label: 'Wide' },
];

const perspectiveLabelById = new Map(PERSPECTIVE_CHOICES.map((p) => [p.id, p.label]));
const perspectivePromptById = new Map(
  PERSPECTIVE_CHOICES.filter((p): p is PerspectiveChoice & { prompt: string } => Boolean(p.prompt)).map((p) => [
    p.id,
    p.prompt,
  ])
);

export function getPerspectiveLabel(id: string): string | undefined {
  return perspectiveLabelById.get(id);
}

/** Optional camera-direction prompt for Stage 3 generation (aligned with `id`). */
export function getPerspectivePrompt(id: string): string | undefined {
  return perspectivePromptById.get(id);
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
