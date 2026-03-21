import { memo } from 'react';
import { Position } from 'reactflow';
import { EnhancedHandle } from './EnhancedHandle';

/**
 * Standard ports for every canvas node: text + image inputs (left), text + image outputs (right).
 * Keeps connection UX and handle ids consistent across node types (`text-in`, `image-in`, `text-out`, `image-out`).
 */
export const DefaultNodePortHandles = memo(function DefaultNodePortHandles() {
  return (
    <>
      <EnhancedHandle
        type="target"
        position={Position.Left}
        id="text-in"
        className="port-input"
        style={{ top: '32%' }}
        dataType="text"
      />
      <EnhancedHandle
        type="target"
        position={Position.Left}
        id="image-in"
        className="port-input"
        style={{ top: '58%' }}
        dataType="image"
      />
      <EnhancedHandle
        type="source"
        position={Position.Right}
        id="text-out"
        className="port-output port-output-accent"
        style={{ top: '45%' }}
        dataType="text"
      />
      <EnhancedHandle
        type="source"
        position={Position.Right}
        id="image-out"
        className="port-output"
        style={{ top: '62%' }}
        dataType="image"
      />
    </>
  );
});

DefaultNodePortHandles.displayName = 'DefaultNodePortHandles';
