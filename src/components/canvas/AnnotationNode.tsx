import { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';

const AnnotationNode = memo(({ id, data, selected }: NodeProps) => {
  const text = (data.text as string) || '';
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const nodes = useWorkflowStore((s) => s.nodes);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  // Parse *word* as italic
  const parts = text.split(/(\*[^*]+\*)/g);

  return (
    <FlowNodeResizeRoot
      selected={!!selected}
      minWidth={120}
      minHeight={48}
      className="rf-node-resize-root relative min-w-0"
    >
    <div
      className="glass-node relative min-h-0 w-full min-w-0 select-none rounded-[var(--radius-node)] border border-[var(--node-control-border)] bg-[var(--node-control-bg)] px-2 py-1"
      data-content-focused={selected || contentFocused || undefined}
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        connectMenuItems={connectMenuItems}
      />
      <NodeContentFocus nodeId={id}>
        <p className="text-[13px] text-[var(--text-muted)] leading-relaxed pt-1">
          {parts.map((part, i) => {
            if (part.startsWith('*') && part.endsWith('*')) {
              return (
                <span
                  key={i}
                  className="italic text-[var(--text-primary)] underline cursor-pointer hover:opacity-90"
                >
                  {part.slice(1, -1)}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      </NodeContentFocus>
      <DefaultNodePortHandles />
    </div>
    </FlowNodeResizeRoot>
  );
});

AnnotationNode.displayName = 'AnnotationNode';
export default AnnotationNode;
