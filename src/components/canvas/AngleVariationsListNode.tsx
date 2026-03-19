import { memo, useState, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { Plus, Grid3X3, List, Settings, CircleDot } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';

const AngleVariationsListNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const images = Array.from({ length: 9 }, (_, i) => i);
  const totalImages = 20;

  return (
    <div className="w-[340px] relative">
      <NodeLabelRow nodeId={id} nodeType="angleVariationsListNode" labelPrefix="Angle variations list" icon={<Grid3X3 size={12} />} />
      <div
        className={`glass-node w-full relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="multiImage"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        showDownload
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className="px-3 py-2 flex justify-end">
          <span className="text-[11px] text-[var(--text-muted)]">{totalImages} images</span>
        </div>

      <div className="grid grid-cols-3 gap-2 p-3 max-h-[280px] overflow-y-auto custom-scrollbar">
        {images.map((i) => (
          <ImageCellOverlay
            key={i}
            src={`https://picsum.photos/seed/vps-ang${i}/120/80`}
            index={i}
            nodeId={id}
            resolution="HD"
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition-colors bg-[var(--node-control-bg)] border border-[var(--node-control-border)] text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
        >
          <Plus size={11} />
          Replace Items
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--node-control-muted)]">{totalImages}</span>
          <button
            type="button"
            className="p-1 rounded transition-colors text-[var(--node-control-muted)] hover:text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
          >
            <CircleDot size={12} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-[var(--node-tab-active-bg)] text-[var(--text-primary)]' : 'text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-control-text)]'}`}
            onClick={() => setViewMode('list')}
          >
            <List size={12} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-[var(--node-tab-active-bg)] text-[var(--text-primary)]' : 'text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-control-text)]'}`}
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 size={12} />
          </button>
          <button
            type="button"
            className="p-1 rounded transition-colors text-[var(--node-control-muted)] hover:text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
          >
            <Settings size={12} />
          </button>
        </div>
      </div>
      </NodeContentFocus>

      <EnhancedHandle type="target" position={Position.Left} className="port-input" dataType="image" />
      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="image" />
      </div>
    </div>
  );
});

AngleVariationsListNode.displayName = 'AngleVariationsListNode';
export default AngleVariationsListNode;
