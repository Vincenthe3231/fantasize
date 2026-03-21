/**
 * React Flow’s node drag uses a d3 filter: pointer targets inside `.nodrag` (default name) do not start a drag.
 * `nopan` avoids pan gestures eating the same interaction. Use on buttons, inputs, and selects inside custom nodes.
 */
export const NODE_INTERACTIVE_CLASS = 'nodrag nopan';
