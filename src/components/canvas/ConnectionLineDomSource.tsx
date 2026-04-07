import { useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ConnectionLineType,
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  useStore,
  useStoreApi,
} from 'reactflow';
import type { ConnectionLineComponent } from 'reactflow';
import { isCanvasEdgeDebugEnabled, logCanvasEdgeConnectionAndAudit } from '@/lib/canvasEdgeDebug';
import { measureHandleFlowPositionWithViewport } from '@/lib/canvasHandlePositionCache';
import { useWorkflowStore } from '@/stores/workflowStore';

/** Keep in sync with `CustomEdge` LOD thresholds. */
const EDGE_LOD_MEDIUM_ZOOM = 0.9;

/**
 * Custom connection preview: uses React Flow’s **`fromX` / `fromY`** (same as the built-in line).
 * DOM re-projection was removed from the painted path — a parallel client→flow conversion can
 * disagree with RF’s pipeline and anchor the preview at the wrong flow point (e.g. viewport origin).
 *
 * With `?canvasEdgeDebug=1`, logs once per gesture (dev): RF source vs optional DOM-measured check
 * for comparison only (see `logCanvasEdgeConnectionAndAudit`).
 */
const ConnectionLineDomSource: ConnectionLineComponent = function ConnectionLineDomSource({
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
  const [searchParams] = useSearchParams();
  const canvasEdgeDebug = useMemo(
    () => isCanvasEdgeDebugEnabled(searchParams),
    [searchParams]
  );
  const storeApi = useStoreApi();
  const loggedGestureRef = useRef(false);
  const zoom = useStore((s) => s.transform[2]);
  const bezierCurvature = zoom < EDGE_LOD_MEDIUM_ZOOM ? 0.2 : 0.35;

  const nodeId = fromNode?.id;
  const hid = fromHandle?.id != null ? String(fromHandle.id) : null;

  useLayoutEffect(() => {
    if (!import.meta.env.DEV || !canvasEdgeDebug || !nodeId || loggedGestureRef.current) return;
    loggedGestureRef.current = true;

    const s = storeApi.getState();
    const domNode = s.domNode;
    const transform = s.transform as [number, number, number];
    const snapToGrid = s.snapToGrid;
    const snapGrid = s.snapGrid;

    let fromMeasured = { x: fromX, y: fromY };
    let measureSucceeded = false;
    if (domNode && hid) {
      const p = measureHandleFlowPositionWithViewport(
        nodeId,
        hid,
        domNode,
        domNode,
        transform,
        snapToGrid,
        snapGrid
      );
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        fromMeasured = { x: p.x, y: p.y };
        measureSucceeded = true;
      }
    }

    logCanvasEdgeConnectionAndAudit({
      tag: 'connection-line',
      nodeId,
      rfGetState: () => storeApi.getState(),
      workflowNodes: useWorkflowStore.getState().nodes,
      connectionLine: {
        fromRf: { x: fromX, y: fromY },
        fromMeasured,
        to: { x: toX, y: toY },
        measureSucceeded,
        domNodePresent: domNode != null,
        transform: [...transform],
      },
    });
  }, [
    canvasEdgeDebug,
    nodeId,
    hid,
    fromX,
    fromY,
    toX,
    toY,
    storeApi,
  ]);

  const pathParams = {
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  };

  let dAttr = '';
  if (connectionLineType === ConnectionLineType.Bezier) {
    [dAttr] = getBezierPath({ ...pathParams, curvature: bezierCurvature });
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
    dAttr = `M${fromX},${fromY} ${toX},${toY}`;
  }

  return (
    <path
      d={dAttr}
      fill="none"
      className="react-flow__connection-path"
      style={connectionLineStyle}
    />
  );
};

export default ConnectionLineDomSource;
