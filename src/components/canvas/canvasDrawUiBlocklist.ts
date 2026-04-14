/**
 * True when the event target is part of the graph or chrome where freehand draw should not start.
 */
export function isCanvasDrawUiBlocklisted(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return !!(
    target.closest('.react-flow__node') ||
    target.closest('.react-flow__handle') ||
    target.closest('.react-flow__edge') ||
    target.closest('.react-flow__connectionline') ||
    target.closest('.react-flow__selection') ||
    target.closest('.react-flow__panel') ||
    target.closest('[data-vf-comment-ui]') ||
    target.closest('[data-vf-no-draw]')
  );
}
