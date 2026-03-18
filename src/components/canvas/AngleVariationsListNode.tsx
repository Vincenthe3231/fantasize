import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Plus, Grid3X3, List, Settings, CircleDot } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import ImageCellOverlay from './ImageCellOverlay';

const AngleVariationsListNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
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
        <button className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/15 transition-colors">
          <Plus size={11} />
          Replace Items
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-white/40">{totalImages}</span>
          <button className="p-1 rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white/80">
            <CircleDot size={12} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-white/20 text-white/90' : 'text-white/50 hover:bg-white/10 hover:text-white/80'}`}
            onClick={() => setViewMode('list')}
          >
            <List size={12} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-white/20 text-white/90' : 'text-white/50 hover:bg-white/10 hover:text-white/80'}`}
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 size={12} />
          </button>
          <button className="p-1 rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white/80">
            <Settings size={12} />
          </button>
        </div>
      </div>
      </NodeContentFocus>

      <Handle type="target" position={Position.Left} className="port-input" />
      <Handle type="source" position={Position.Right} className="port-output" />
      </div>
    </div>
  );
});

AngleVariationsListNode.displayName = 'AngleVariationsListNode';
export default AngleVariationsListNode;
