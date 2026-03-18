import { memo, useState } from 'react';
import { getSmoothStepPath, type EdgeProps } from 'reactflow';
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
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const edges = useWorkflowStore((s) => s.edges);
  const [hovered, setHovered] = useState(false);

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 16,
  });

  const handleClick = () => {
    if (selectedTool === 'cut') {
      setEdges(edges.filter((e) => e.id !== id));
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(edges.filter((edge) => edge.id !== id));
  };

  // Midpoint for delete button
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const strokeColor = selected ? '#3b82f6' : hovered ? '#7c6ff7' : 'var(--edge-stroke)';
  const strokeW = hovered || selected ? 2 : 1.5;
  const opacity = isRunning ? 1 : hovered || selected ? 0.9 : 0.7;

  return (
    <>
      {/* Invisible wider hit area */}
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
      {/* Delete button at midpoint when selected */}
      {selected && (
        <foreignObject x={midX - 8} y={midY - 8} width={16} height={16} className="overflow-visible">
          <button
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
