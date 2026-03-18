import { memo, useState } from 'react';
import { getBezierPath, type EdgeProps } from 'reactflow';
import { X } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';

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

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const handleClick = () => {
    if (selectedTool === 'cut') {
      removeEdgeById(id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeEdgeById(id);
  };

  const midX = labelX;
  const midY = labelY;

  const strokeColor = selected ? '#3b82f6' : hovered ? '#7c6ff7' : 'var(--edge-stroke)';
  const strokeW = hovered || selected ? 2 : 1.5;
  const opacity = isRunning ? 1 : hovered || selected ? 0.9 : 0.7;

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        className={selectedTool === 'cut' ? 'cursor-scissors' : 'cursor-pointer'}
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
      {selected && (
        <foreignObject x={midX - 8} y={midY - 8} width={16} height={16} className="overflow-visible">
          <button
            type="button"
            onClick={handleDelete}
            className="w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            <X size={8} className="text-white" />
          </button>
        </foreignObject>
      )}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
export default CustomEdge;
