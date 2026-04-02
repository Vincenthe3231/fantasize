export const SCOUT_REMOTE_EXECUTION_TYPES = new Set<string>([
  'assistantNode',
  'imageGeneratorNode',
  'setDressingNode',
  'angleVariationsNode',
  'imageVariationsNode',
  'lightingScenarioNode',
  'atmosphereTestNode',
]);

/**
 * Idle delay before coalesced `node.data` edits become one undo step (per node).
 * Blur / undo / redo flush immediately via `flushNodeDataHistory`.
 */
export const UPDATE_NODE_DATA_DEBOUNCE_MS = 300;
export const MAX_STACK = 50;
/** Default canvas node box (React Flow `width` / `height` + `style`). */
export const DEFAULT_NODE_W = 450;
export const DEFAULT_NODE_H = 450;
/** Default group frame size for new groups and store fallbacks. */
export const DEFAULT_GROUP_W = 1200;
export const DEFAULT_GROUP_H = 1200;
