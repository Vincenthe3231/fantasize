import { memo, type ReactNode } from 'react';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

interface ResizableNodeWrapperProps {
  selected: boolean;
  minWidth?: number;
  minHeight?: number;
  children: ReactNode;
  className?: string;
}

const ResizableNodeWrapper = memo(({ selected, minWidth = 200, minHeight = 80, children, className = '' }: ResizableNodeWrapperProps) => {
  return (
    <div className={`w-full h-full ${className}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
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
