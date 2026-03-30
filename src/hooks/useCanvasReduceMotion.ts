import { useWorkflowStore } from '@/stores/workflowStore';
import { canvasPerfFlags } from '@/lib/canvasPerf';

/** True when canvas UI should skip heavy motion: Performance mode, or drag + flag. */
export function useCanvasReduceMotion(): boolean {
  const performanceMode = useWorkflowStore((s) => s.settings.performanceMode);
  const isDraggingCanvas = useWorkflowStore((s) => s.isDragging);
  return (
    performanceMode || (canvasPerfFlags.reduceMotionDuringDrag && isDraggingCanvas)
  );
}
