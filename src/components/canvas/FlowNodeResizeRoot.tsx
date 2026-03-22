import { memo, useCallback, type ReactNode } from 'react';
import { NodeResizer } from '@reactflow/node-resizer';
import { useNodeId, useStore } from 'reactflow';

type Props = {
  minWidth?: number;
  minHeight?: number;
  children: ReactNode;
  /** Outer shell: fills the RF node box (label + card + footer all share this height). */
  className?: string;
};

/**
 * NodeResizer updates the React Flow node’s width/height; this root must be `h-full` flex
 * column so the glass shell and NodeContentFocus (`flex-1`) fill that box together.
 *
 * Visibility is read from the React Flow store (`nodeInternals`) so it stays in sync with
 * selection — custom `selected` props from `NodeProps` can lag behind RF when state is merged
 * with an external store (e.g. workflow zustand).
 */
const FlowNodeResizeRoot = memo(function FlowNodeResizeRoot({
  minWidth = 200,
  minHeight = 80,
  children,
  className = '',
}: Props) {
  const nodeId = useNodeId();

  const showResizeHandles = useStore(
    useCallback(
      (s) => {
        if (!nodeId) return false;
        const n = s.nodeInternals.get(nodeId);
        if (!n?.selected) return false;
        // Locked nodes (`draggable: false`): no resize UI (same idea as GroupNode).
        if (n.draggable === false) return false;
        return true;
      },
      [nodeId]
    )
  );

  return (
    <div className={`h-full w-full min-h-0 min-w-0 bg-transparent ${className}`}>
      <NodeResizer
        isVisible={showResizeHandles}
        minWidth={minWidth}
        minHeight={minHeight}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: 'hsl(217 91% 60%)',
        }}
      />
      {children}
    </div>
  );
});

export default FlowNodeResizeRoot;
