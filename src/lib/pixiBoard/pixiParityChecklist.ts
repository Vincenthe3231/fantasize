/**
 * React Flow → Pixi cutover parity (Phase 4). Track in reviews; not all items apply to the dev spike.
 */
export const PIXI_BOARD_PARITY_ITEMS = [
  'Pan / zoom / wheel sensitivity matches RF defaults',
  'Node selection (click) and clear selection (pane click / Escape)',
  'Edge selection + visual highlight',
  'Connect / disconnect edges (handles)',
  'Node drag + group reparent',
  'Marquee selection',
  'Minimap (optional second view or RenderTexture)',
  'Context menu (canvas + node)',
  'Keyboard: delete, duplicate, copy/paste, fit view',
  'Comments positioned in flow space (or screen — document choice)',
  'Persistence: viewport + graph to Supabase / IndexedDB drafts',
  'Scout pipeline + running edge animation parity',
  'Reduced motion + performance mode flags',
  'WebGL context loss recovery + fallback message',
] as const;
