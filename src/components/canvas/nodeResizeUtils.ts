/**
 * React Flow’s node drag uses a d3 filter: pointer targets inside `.nodrag` (default name) do not start a drag.
 * `nopan` avoids pan gestures eating the same interaction. Use on buttons, inputs, and selects inside custom nodes.
 */
export const NODE_INTERACTIVE_CLASS = 'nodrag nopan';

const INTERACTIVE_NODE_TARGET_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'a[href]',
  '[role="button"]',
  '[contenteditable="true"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="tab"]',
  '.nodrag',
  '.nopan',
  '.react-flow__resize-control',
  '.react-flow__handle',
].join(',');

/** True when pointer target should not bubble pointerdown to the React Flow node (editing controls, handles, etc.). */
export function isCanvasNodeInteractivePointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(INTERACTIVE_NODE_TARGET_SELECTOR) != null;
}
