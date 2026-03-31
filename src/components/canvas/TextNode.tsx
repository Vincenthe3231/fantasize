import { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { Type } from 'lucide-react';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { RichTextField } from '@/components/rich-text/RichTextField';
const TextNode = memo(({ id, data, selected }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const content = (data.content as string) || '';

  return (
    <FlowNodeResizeRoot
      minWidth={200}
      minHeight={120}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="textNode" labelPrefix="Text" icon={<Type size={12} />} />
      <div
        className={`glass-node glass-node-input relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/40' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          hidden={Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden)}
          variant="text"
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div
            className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 pt-2"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <RichTextField
              value={content}
              onChange={(html) => updateNodeData(id, { content: html })}
              placeholder="Write your prompt, notes, or comments…"
              excludeNodeId={id}
              toolbarVariant="floating-above"
              editorProps={{
                handleDOMEvents: {
                  mousedown: (_, e) => {
                    e.stopPropagation();
                    return false;
                  },
                  keydown: (_, e) => {
                    e.stopPropagation();
                    return false;
                  },
                },
              }}
            />
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

TextNode.displayName = 'TextNode';
export default TextNode;
