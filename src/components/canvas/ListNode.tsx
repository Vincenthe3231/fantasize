import { memo, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { List, Plus, X } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';

interface ListItem {
  id: string;
  text: string;
}

const ListNode = memo(({ id, data, selected }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const items: ListItem[] = (data.items as ListItem[]) || [
    { id: '1', text: 'Scene description' },
    { id: '2', text: 'Lighting setup' },
  ];

  const addItem = () => {
    updateNodeData(id, {
      items: [...items, { id: `item-${Date.now()}`, text: '' }],
    });
  };

  const removeItem = (itemId: string) => {
    updateNodeData(id, { items: items.filter((i) => i.id !== itemId) });
  };

  const updateItem = (itemId: string, text: string) => {
    updateNodeData(id, {
      items: items.map((i) => (i.id === itemId ? { ...i, text } : i)),
    });
  };

  return (
    <FlowNodeResizeRoot
      selected={!!selected}
      minWidth={200}
      minHeight={140}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="listNode" labelPrefix="List" icon={<List size={12} />} />
      <div
        className={`glass-node relative flex w-full flex-1 flex-col min-h-0 ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className="flex flex-1 min-h-0 flex-col space-y-1 overflow-hidden p-3">
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(newItems) => updateNodeData(id, { items: newItems })}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto"
        >
          {items.map((item) => (
            <Reorder.Item
              key={item.id}
              value={item}
              className={`${NODE_INTERACTIVE_CLASS} flex items-center gap-2 group cursor-grab active:cursor-grabbing`}
            >
              <span className="text-[var(--text-muted)] text-[10px]">•</span>
              <input
                value={item.text}
                onChange={(e) => updateItem(item.id, e.target.value)}
                className="flex-1 bg-transparent text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="List item…"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className={`${NODE_INTERACTIVE_CLASS} opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-red-400`}
              >
                <X size={11} />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <button
          type="button"
          onClick={addItem}
          className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 items-center gap-1 text-[10px] font-mono-display text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-2`}
        >
          <Plus size={10} /> Add item
        </button>
        </div>
      </NodeContentFocus>

      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="text" />
      </div>
    </FlowNodeResizeRoot>
  );
});

ListNode.displayName = 'ListNode';
export default ListNode;
