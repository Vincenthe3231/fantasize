import { memo, useCallback, useRef, type ReactNode } from 'react';
import { NodeResizer } from '@reactflow/node-resizer';
import { useNodeId, useUpdateNodeInternals } from 'reactflow';
import '@reactflow/node-resizer/dist/style.css';

interface ResizableNodeWrapperProps {
  selected: boolean;
  minWidth?: number;
  minHeight?: number;
  children: ReactNode;
  className?: string;
}

const ResizableNodeWrapper = memo(({ selected, minWidth = 200, minHeight = 80, children, className = '' }: ResizableNodeWrapperProps) => {
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const resizeInternalsRaf = useRef<number | null>(null);

  const scheduleResizeInternalsUpdate = useCallback(() => {
    if (!nodeId || resizeInternalsRaf.current != null) return;
    resizeInternalsRaf.current = requestAnimationFrame(() => {
      resizeInternalsRaf.current = null;
      updateNodeInternals(nodeId);
    });
  }, [nodeId, updateNodeInternals]);

  const onResizeEnd = useCallback(() => {
    if (resizeInternalsRaf.current != null) {
      cancelAnimationFrame(resizeInternalsRaf.current);
      resizeInternalsRaf.current = null;
    }
    if (nodeId) updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals]);

  return (
    <div className={`w-full h-full ${className}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        onResize={scheduleResizeInternalsUpdate}
        onResizeEnd={onResizeEnd}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: '#3b82f6',
        }}
      />
      {children}
    </div>
  );
});

ResizableNodeWrapper.displayName = 'ResizableNodeWrapper';
export default ResizableNodeWrapper;
