import { memo, useState, useCallback, useRef } from 'react';
import type { NodeProps } from 'reactflow';

import { useWorkflowStore } from '@/stores/workflowStore';

const isValidColor = (s: unknown): s is string =>
  typeof s === 'string' && (s.startsWith('#') || s.startsWith('rgb'));

const DEFAULT_LABEL = 'Group';

type GroupNodeProps = NodeProps & { style?: { width?: number; height?: number } };

/**
 * Visual-only wrapper for React Flow parent/child grouping.
 * Children are positioned relative to the parent and stay inside via `extent: 'parent'`.
 * Uses data.color if set (hex/rgba), else var(--accent-color) for theme alignment.
 */
const GroupNode = memo(({ id, selected, style, data }: GroupNodeProps) => {
  const width = typeof style?.width === 'number' ? style.width : undefined;
  const height = typeof style?.height === 'number' ? style.height : undefined;

  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
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

  const storedLabel = String((data as { labelText?: unknown })?.labelText ?? '').trim();
  const labelText = storedLabel || DEFAULT_LABEL;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(labelText);
  const cancellingRef = useRef(false);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(labelText);
    setEditing(true);
  }, [labelText]);

  const commitEdit = useCallback(() => {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      setEditing(false);
      return;
    }
    const value = draft.trim();
    updateNodeData(id, { labelText: value || DEFAULT_LABEL });
    setEditing(false);
  }, [id, draft, updateNodeData]);

  const cancelEdit = useCallback(() => {
    cancellingRef.current = true;
    setDraft(labelText);
    setEditing(false);
  }, [labelText]);

  const boxStyle = {
    width: width ?? style?.width ?? '100%',
    height: height ?? style?.height ?? '100%',
  };

  return (
    <div className="relative w-full h-full" style={boxStyle}>
      <div
        className="absolute bottom-full left-0 z-10 min-h-8 w-max flex items-center text-[11px] font-mono-display tracking-wider text-[var(--text-muted)] mb-0.5"
        style={{ pointerEvents: 'auto' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {editing ? (
          <input
            autoFocus
            className="min-w-[4rem] w-full rounded px-1.5 py-0.5 text-[11px] font-mono-display tracking-wider text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[hsl(217_91%_60%)] bg-[var(--node-control-bg)] border border-[var(--node-control-border)]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="text-left w-full whitespace-nowrap rounded px-1 -mx-1 py-0.5 -my-0.5 text-[var(--text-primary)] hover:opacity-90 hover:bg-[var(--node-action-bar-hover-bg)]"
            onClick={startEdit}
          >
            {labelText}
          </button>
        )}
      </div>
      <div
        className="vf-group-node relative rounded-lg overflow-hidden"
        style={{
          ...boxStyle,
          position: 'absolute',
          inset: 0,
          background,
          border: `1px solid ${borderColor}`,
          boxSizing: 'border-box',
          cursor: 'move',
          backdropFilter: 'blur(0px)',
          pointerEvents,
        }}
        data-group-node-selected={selected || undefined}
      />
    </div>
  );
});

export default GroupNode;

