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
      onPointerDown={(e) => {
        // Bubble phase only: capture + stopPropagation would run before the target and block
        // Radix triggers / inputs from receiving pointerdown inside this shell.
        e.stopPropagation();
        setFocused(nodeId);
      }}
    >
      {children}
    </div>
  );
}
