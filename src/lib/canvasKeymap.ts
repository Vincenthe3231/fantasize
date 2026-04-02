import type { WorkflowSettings } from '@/stores/workflowStore';

/** Cycle order matches General → Canvas background options in Settings. */
export const CANVAS_PATTERN_ORDER: WorkflowSettings['canvasPattern'][] = [
  'dots',
  'grid',
  'lines',
  'none',
];

export function nextCanvasPattern(
  current: WorkflowSettings['canvasPattern']
): WorkflowSettings['canvasPattern'] {
  const i = CANVAS_PATTERN_ORDER.indexOf(current);
  const next = CANVAS_PATTERN_ORDER[(i + 1) % CANVAS_PATTERN_ORDER.length];
  return next ?? 'dots';
}

/**
 * Skip canvas-wide shortcuts when focus is in text fields, TipTap, or Radix comboboxes
 * (matches Index.tsx behavior; use from Toolbar undo/tool keys too).
 */
export function isCanvasShortcutTargetBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target.closest('.ProseMirror')) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  if (target.closest('[role="combobox"]')) return true;
  return false;
}

/** Display strings for Settings → Shortcuts (single source of truth for documentation UI). */
export type ShortcutDisplayRow = { action: string; keys: string[] };

export const CANVAS_SHORTCUT_SECTIONS: { title: string; rows: ShortcutDisplayRow[] }[] = [
  {
    title: 'Basics',
    rows: [
      { action: 'Select tool', keys: ['V'] },
      { action: 'Hand tool', keys: ['H'] },
      { action: 'Snip tool', keys: ['X'] },
      { action: 'Connection tool', keys: ['L'] },
      { action: 'Draw tool', keys: ['P'] },
      { action: 'Stickers', keys: ['S'] },
      { action: 'Sticky Note', keys: ['T'] },
      { action: 'Comment', keys: ['C'] },
    ],
  },
  {
    title: 'Control',
    rows: [
      { action: 'Run workflow', keys: ['Ctrl/⌘', 'Enter'] },
      { action: 'Undo', keys: ['Ctrl/⌘', 'Z'] },
      { action: 'Redo', keys: ['Ctrl/⌘', 'Shift', 'Z'] },
      { action: 'Redo (Windows)', keys: ['Ctrl', 'Y'] },
      { action: 'Delete node', keys: ['Delete', 'Backspace'] },
      { action: 'Duplicate node', keys: ['Ctrl/⌘', 'D'] },
      { action: 'Select all', keys: ['Ctrl/⌘', 'A'] },
      { action: 'Copy', keys: ['Ctrl/⌘', 'C'] },
      { action: 'Paste', keys: ['Ctrl/⌘', 'V'] },
    ],
  },
  {
    title: 'Navigation + Board',
    rows: [
      { action: 'Zoom in', keys: ['Ctrl/⌘', '+'] },
      { action: 'Zoom out', keys: ['Ctrl/⌘', '−'] },
      { action: 'Fit view', keys: ['Ctrl/⌘', '1'] },
      { action: 'Add node', keys: ['N'] },
      { action: 'Cycle canvas background', keys: ['G'] },
    ],
  },
];
