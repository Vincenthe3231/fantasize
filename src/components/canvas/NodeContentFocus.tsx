import { useCallback } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { cn } from '@/lib/utils';
import { isCanvasNodeInteractivePointerTarget } from './nodeResizeUtils';

/** Wrap node header + body; clicking here shows the action bar (see index.css). */
export function NodeContentFocus({
  nodeId,
  children,
  className,
  /**
   * When true, clicks on interactive children still focus this node immediately; only clicks on
   * non-interactive shell toggle focus off (second click) so the outline can dismiss without
   * leaving the node.
   */
  toggleContentFocus = false,
  /**
   * When true, the shell uses `cursor: move` whenever the pointer is over non-interactive
   * descendants (see `index.css` `.node-content-focus-draggable`), not only while content-focused.
   */
  shellMoveCursor = false,
}: {
  nodeId: string;
  children: React.ReactNode;
  className?: string;
  toggleContentFocus?: boolean;
  shellMoveCursor?: boolean;
}) {
  const setFocused = useWorkflowStore((s) => s.setFocusedNodeContentId);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === nodeId);
  const contentLocked = useWorkflowStore(
    useCallback((s) => s.nodes.find((n) => n.id === nodeId)?.draggable === false, [nodeId])
  );

  return (
    <div
      className={cn(
        'node-content-focus-root flex min-h-0 w-full min-w-0 flex-1 flex-col',
        (contentFocused || shellMoveCursor) && 'node-content-focus-draggable',
        contentLocked && 'pointer-events-none select-none',
        className
      )}
      data-canvas-content-locked={contentLocked || undefined}
      onPointerDown={(e) => {
        if (contentLocked) return;
        const interactive = isCanvasNodeInteractivePointerTarget(e.target);
        if (interactive) {
          if (toggleContentFocus) {
            setFocused(nodeId);
          }
          e.stopPropagation();
          return;
        }
        if (toggleContentFocus) {
          setFocused(contentFocused ? null : nodeId);
        } else {
          setFocused(nodeId);
        }
      }}
    >
      {children}
    </div>
  );
}
