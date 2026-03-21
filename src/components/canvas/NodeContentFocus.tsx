import { useWorkflowStore } from '@/stores/workflowStore';
import { cn } from '@/lib/utils';
import { isCanvasNodeInteractivePointerTarget } from './nodeResizeUtils';

/** Wrap node header + body; clicking here shows the action bar (see index.css). */
export function NodeContentFocus({
  nodeId,
  children,
  className,
}: {
  nodeId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const setFocused = useWorkflowStore((s) => s.setFocusedNodeContentId);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === nodeId);

  return (
    <div
      className={cn(
        'node-content-focus-root flex min-h-0 w-full min-w-0 flex-1 flex-col',
        contentFocused && 'node-content-focus-draggable',
        className
      )}
      onPointerDown={(e) => {
        setFocused(nodeId);
        // Let pointerdown bubble to the React Flow node so the node can be dragged from the
        // focused body. Stop only for real controls (.nodrag handles the rest in RF, but we
        // still stop for inputs/contenteditable so drag doesn't steal text selection).
        if (isCanvasNodeInteractivePointerTarget(e.target)) {
          e.stopPropagation();
        }
      }}
    >
      {children}
    </div>
  );
}
