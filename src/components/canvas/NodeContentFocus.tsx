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
}: {
  nodeId: string;
  children: React.ReactNode;
  className?: string;
  toggleContentFocus?: boolean;
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
