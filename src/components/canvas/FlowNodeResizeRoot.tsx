import { memo, type ReactNode } from 'react';
import { NodeResizer } from '@reactflow/node-resizer';

type Props = {
  selected: boolean;
  minWidth?: number;
  minHeight?: number;
  children: ReactNode;
  /** Outer shell: fills the RF node box (label + card + footer all share this height). */
  className?: string;
};

/**
 * NodeResizer updates the React Flow node’s width/height; this root must be `h-full` flex
 * column so the glass shell and NodeContentFocus (`flex-1`) fill that box together.
 */
const FlowNodeResizeRoot = memo(function FlowNodeResizeRoot({
  selected,
  minWidth = 200,
  minHeight = 80,
  children,
  className = '',
}: Props) {
  return (
    <div className={`h-full w-full min-h-0 min-w-0 ${className}`}>
      <NodeResizer
        isVisible={selected}
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
