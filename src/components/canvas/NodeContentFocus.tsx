import { useWorkflowStore } from '@/stores/workflowStore';

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
  return (
    <div
      className={className}
      onPointerDownCapture={(e) => {
        e.stopPropagation();
        setFocused(nodeId);
      }}
    >
      {children}
    </div>
  );
}
