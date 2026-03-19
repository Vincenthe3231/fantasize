import { memo } from 'react';
import { NodeResizeControl } from '@reactflow/node-resizer';

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

type Props = {
  /** Required: RF 11 may not resolve useNodeId inside memoized subtrees reliably. */
  nodeId: string;
  minWidth?: number;
  minHeight?: number;
  isVisible?: boolean;
};

/**
 * Corner-only resize handles (no edge lines). Requires `@reactflow/node-resizer/dist/style.css` imported once (e.g. in Index).
 */
const NodeCornerResizer = memo(function NodeCornerResizer({
  nodeId,
  minWidth = 200,
  minHeight = 150,
  isVisible = true,
}: Props) {
  if (!isVisible) return null;
  return (
    <>
      {CORNERS.map((position) => (
        <NodeResizeControl
          key={position}
          nodeId={nodeId}
          position={position}
          minWidth={minWidth}
          minHeight={minHeight}
          className="nodrag nopan"
          style={{
            width: 12,
            height: 12,
            borderRadius: 2,
            background: 'var(--node-inner-mid)',
            border: '1px solid var(--node-control-border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            zIndex: 30,
          }}
        />
      ))}
    </>
  );
});

export default NodeCornerResizer;
