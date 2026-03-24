import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { getBezierPath, type EdgeProps } from 'reactflow';
import { Scissors } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';

const HOVER_LEAVE_MS = 140;

function pointerToSvgPoint(
  e: React.PointerEvent<SVGPathElement>
): { x: number; y: number } | null {
  const svg = e.currentTarget.ownerSVGElement;
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

const CustomEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningEdges.has(id));
  const edgeAnimation = useWorkflowStore((s) => s.settings.edgeAnimation);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const removeEdgeById = useWorkflowStore((s) => s.removeEdgeById);
  const [hovered, setHovered] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const onEdgePointerEnter = useCallback((e: React.PointerEvent<SVGPathElement>) => {
    clearLeaveTimer();
    const p = pointerToSvgPoint(e);
    if (p) setHoverPoint(p);
    setHovered(true);
  }, [clearLeaveTimer]);

  const onEdgePointerMove = useCallback((e: React.PointerEvent<SVGPathElement>) => {
    const p = pointerToSvgPoint(e);
    if (p) setHoverPoint(p);
  }, []);

  const onEdgePointerLeave = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false);
      setHoverPoint(null);
      leaveTimerRef.current = null;
    }, HOVER_LEAVE_MS);
  }, [clearLeaveTimer]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  /** Cut/snips on pointer down so we win over pane drag/selection; `stroke` hit target fixes transparent-stroke + visibleStroke glitches from React Flow defaults. */
  const handleInteractionPointerDown = (e: React.PointerEvent) => {
    if (selectedTool !== 'cut' || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    removeEdgeById(id);
  };

  const handleSnipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    removeEdgeById(id);
  };

  const handleSnipPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const midX = labelX;
  const midY = labelY;

  const strokeColor = selected ? '#3b82f6' : hovered ? '#7c6ff7' : 'var(--edge-stroke)';
  const strokeW = hovered || selected ? 2 : 1.5;
  const opacity = isRunning ? 1 : hovered || selected ? 0.9 : 0.7;

  const showSnipControl = hovered || selected;
  /** foreignObject top-left so button is centered on midpoint */
  const foSize = 32;
  const foHalf = foSize / 2;
  const anchorX = hovered && hoverPoint ? hoverPoint.x : midX;
  const anchorY = hovered && hoverPoint ? hoverPoint.y : midY;

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ touchAction: 'none' }}
        onPointerEnter={onEdgePointerEnter}
        onPointerMove={onEdgePointerMove}
        onPointerLeave={onEdgePointerLeave}
        onPointerDown={handleInteractionPointerDown}
        className={`custom-edge-hit-area ${selectedTool === 'cut' ? 'cursor-scissors' : 'cursor-pointer'}`}
      />
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        className={isRunning && edgeAnimation ? 'animated-edge' : ''}
        style={{ opacity, pointerEvents: 'none' }}
      />
      {showSnipControl && (
        <foreignObject
          x={anchorX - foHalf}
          y={anchorY - foHalf}
          width={foSize}
          height={foSize}
          className="overflow-visible"
        >
          <div
            className="flex h-full w-full items-center justify-center"
            onPointerEnter={onEdgePointerEnter}
            onPointerLeave={onEdgePointerLeave}
          >
            <button
              type="button"
              title="Remove connection"
              onClick={handleSnipClick}
              onPointerDown={handleSnipPointerDown}
              className={`${NODE_INTERACTIVE_CLASS} flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-md transition-colors ${
                selected
                  ? 'border-red-400/50 bg-red-500/90 text-[var(--node-on-accent)] hover:bg-red-500'
                  : 'border-[var(--node-control-border)] bg-[var(--node-action-bar-bg)] text-[var(--node-action-bar-icon)] hover:border-[var(--accent-color)] hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-action-bar-icon-hover)]'
              }`}
            >
              <Scissors size={14} strokeWidth={2} />
            </button>
          </div>
        </foreignObject>
      )}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
export default CustomEdge;
