import { memo } from 'react';
import {
  ConnectionLineType,
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  useReactFlow,
} from 'reactflow';
import type { ConnectionLineComponent } from 'reactflow';

/**
 * Drop-in replacement for React Flow's default connection preview path.
 * Uses the live DOM handle center + screenToFlowPosition for the source point each render
 * so the line stays pinned to the visible handle even if internals lag layout/transform
 * (e.g. grouped nodes, zoom, or subframe updates).
 */
const ConnectionLineDomSource: ConnectionLineComponent = memo(function ConnectionLineDomSource({
  connectionLineStyle,
  connectionLineType,
  fromNode,
  fromHandle,
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}) {
  const { screenToFlowPosition } = useReactFlow();

  let sourceX = fromX;
  let sourceY = fromY;
  const nodeId = fromNode?.id;
  const hid = fromHandle?.id != null ? String(fromHandle.id) : null;
  if (nodeId && hid) {
    const root = document.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
    );
    const handleEl = root?.querySelector<HTMLElement>(
      `.react-flow__handle[data-handleid="${CSS.escape(hid)}"]`
    );
    if (handleEl) {
      const r = handleEl.getBoundingClientRect();
      const p = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      sourceX = p.x;
      sourceY = p.y;
    }
  }

  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  };

  let dAttr = '';
  if (connectionLineType === ConnectionLineType.Bezier) {
    [dAttr] = getBezierPath({ ...pathParams, curvature: 0.35 });
  } else if (connectionLineType === ConnectionLineType.Step) {
    [dAttr] = getSmoothStepPath({
      ...pathParams,
      borderRadius: 0,
    });
  } else if (connectionLineType === ConnectionLineType.SmoothStep) {
    [dAttr] = getSmoothStepPath(pathParams);
  } else if (connectionLineType === ConnectionLineType.SimpleBezier) {
    [dAttr] = getSimpleBezierPath(pathParams);
  } else {
    dAttr = `M${sourceX},${sourceY} ${toX},${toY}`;
  }

  return (
    <path
      d={dAttr}
      fill="none"
      className="react-flow__connection-path"
      style={connectionLineStyle}
    />
  );
});

export default ConnectionLineDomSource;
