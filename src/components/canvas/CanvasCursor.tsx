import { useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useCanvasCursor } from '@/hooks/useCanvasCursor';

/** Full-screen pointer trail overlay; disable via Settings → Canvas cursor trails. */
export function CanvasCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enabled = useWorkflowStore((s) => s.settings.canvasCursorTrails);
  useCanvasCursor(canvasRef, enabled);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[24] h-full w-full"
      aria-hidden
    />
  );
}
