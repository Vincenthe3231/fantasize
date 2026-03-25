import { useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useCanvasCursor } from '@/hooks/useCanvasCursor';

/** Full-screen pointer trail overlay; disable via Settings → Canvas cursor trails, or in Hand (pan) mode. */
export function CanvasCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCursorTrails = useWorkflowStore((s) => s.settings.canvasCursorTrails);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const enabled = canvasCursorTrails && selectedTool !== 'hand';
  useCanvasCursor(canvasRef, enabled);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[24] h-full w-full"
      aria-hidden
    />
  );
}
