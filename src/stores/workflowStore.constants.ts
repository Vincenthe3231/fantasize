export const SCOUT_REMOTE_EXECUTION_TYPES = new Set<string>([
  'assistantNode',
  'imageGeneratorNode',
  'setDressingNode',
  'angleVariationsNode',
  'imageVariationsNode',
  'lightingScenarioNode',
  'atmosphereTestNode',
]);

export const UPDATE_NODE_DATA_DEBOUNCE_MS = 1000;
export const MAX_STACK = 50;
/** Default canvas node box (React Flow `width` / `height` + `style`). */
export const DEFAULT_NODE_W = 450;
export const DEFAULT_NODE_H = 450;
/** Default group frame size for new groups and store fallbacks. */
export const DEFAULT_GROUP_W = 1200;
export const DEFAULT_GROUP_H = 1200;
