import { useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useCanvasCursor } from '@/hooks/useCanvasCursor';
import { canvasPerfFlags } from '@/lib/canvasPerf';
import { effectiveCursorTrails } from '@/lib/canvasEffectiveSettings';

/** Full-screen pointer trail overlay; disable via Settings → Canvas cursor trails, or in Hand (pan) mode. */
export function CanvasCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useWorkflowStore((s) => s.settings);
  const trailsAllowed = effectiveCursorTrails(settings);
  const isDragging = useWorkflowStore((s) => s.isDragging);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const enabled =
    trailsAllowed &&
    selectedTool !== 'hand' &&
    selectedTool !== 'draw' &&
    !(canvasPerfFlags.reduceMotionDuringDrag && (settings.performanceMode || isDragging));
  useCanvasCursor(canvasRef, enabled);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[24] h-full w-full"
      aria-hidden
    />
  );
}
