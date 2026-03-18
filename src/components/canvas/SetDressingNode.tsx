import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Sofa } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';

const SetDressingNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const previewUrl = (data?.previewUrl as string) || MOCK.setDressing;

  return (
    <div
      className={`glass-node w-[420px] relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
    >
      <NodeActionBar
        variant="image"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onDownload={() => window.open(previewUrl, '_blank')}
      />

      <div className="glass-node-header px-3 py-2.5 flex items-center gap-2 text-[var(--text-primary)]">
        <Sofa size={13} />
        <span>Set dressing preview</span>
      </div>

      <div className="p-3">
        <ImageCellOverlay
          src={previewUrl}
          resolution="3840 × 2160"
          index={0}
          nodeId={id}
          className="!rounded-lg"
        />
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.06] text-[10px] text-[var(--text-muted)]">
        <span>Composite from location · placement · props · generator</span>
        <button
          type="button"
          className="text-[var(--accent-color)] hover:underline font-mono-display uppercase tracking-wider"
          onClick={(e) => {
            e.stopPropagation();
            runFromNode(id);
          }}
        >
          Regenerate
        </button>
      </div>

      <Handle type="target" position={Position.Left} id="location-in" className="port-input" style={{ top: '22%' }} />
      <Handle type="target" position={Position.Left} id="placement-in" className="port-input" style={{ top: '38%' }} />
      <Handle type="target" position={Position.Left} id="props-in" className="port-input" style={{ top: '54%' }} />
      <Handle type="target" position={Position.Left} id="scene-in" className="port-input" style={{ top: '70%' }} />
      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

SetDressingNode.displayName = 'SetDressingNode';
export default SetDressingNode;
