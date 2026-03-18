import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { List, Plus, X } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';

interface ListItem {
  id: string;
  text: string;
}

const ListNode = memo(({ id, data }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);

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
    <div className={`glass-node w-[260px] relative ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}>
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      />

      <div className="glass-node-header px-3 py-2.5 flex items-center gap-2 text-[var(--text-primary)]">
        <List size={13} />
        <span>List</span>
      </div>

      <div className="p-3 space-y-1">
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(newItems) => updateNodeData(id, { items: newItems })}
          className="space-y-1"
        >
          {items.map((item) => (
            <Reorder.Item key={item.id} value={item} className="flex items-center gap-2 group cursor-grab active:cursor-grabbing">
              <span className="text-[var(--text-muted)] text-[10px]">•</span>
              <input
                value={item.text}
                onChange={(e) => updateItem(item.id, e.target.value)}
                className="flex-1 bg-transparent text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="List item…"
              />
              <button
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-red-400"
              >
                <X size={11} />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <button
          onClick={addItem}
          className="flex items-center gap-1 text-[10px] font-mono-display text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-2"
        >
          <Plus size={10} /> Add item
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

ListNode.displayName = 'ListNode';
export default ListNode;
