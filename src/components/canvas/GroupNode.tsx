import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import { useWorkflowStore } from '@/stores/workflowStore';

const isValidColor = (s: unknown): s is string =>
  typeof s === 'string' && (s.startsWith('#') || s.startsWith('rgb'));

/**
 * Visual-only wrapper for React Flow parent/child grouping.
 * Children are positioned relative to the parent and stay inside via `extent: 'parent'`.
 * Uses data.color if set (hex/rgba), else var(--accent-color) for theme alignment.
 */
const GroupNode = memo(({ selected, style, data }: NodeProps) => {
  const width = typeof (style as { width?: unknown })?.width === 'number' ? (style as { width: number }).width : undefined;
  const height =
    typeof (style as { height?: unknown })?.height === 'number' ? (style as { height: number }).height : undefined;

  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  // When connecting, let pointer interactions pass through the group container
  // so child nodes' handles remain clickable/connectable.
  const pointerEvents = selectedTool === 'connection' ? 'none' : 'auto';

  const rawColor = (data as { color?: unknown })?.color;
  const useCustom = isValidColor(rawColor);
  const borderColor = useCustom
    ? `color-mix(in srgb, ${rawColor} 55%, transparent)`
    : 'color-mix(in srgb, var(--accent-color) 55%, transparent)';
  const background = useCustom
    ? `color-mix(in srgb, ${rawColor} 10%, transparent)`
    : 'color-mix(in srgb, var(--accent-color) 10%, transparent)';

  return (
    <div
      className="vf-group-node relative rounded-lg overflow-hidden"
      style={{
        width: width ?? style?.width ?? '100%',
        height: height ?? style?.height ?? '100%',
        background,
        border: `1px solid ${borderColor}`,
        boxSizing: 'border-box',
        cursor: 'move',
        backdropFilter: 'blur(0px)',
        pointerEvents,
      }}
      data-group-node-selected={selected || undefined}
    />
  );
});

export default GroupNode;

