import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { LayoutGrid } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';

const PlacementRefNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));

  return (
    <div
      className={`glass-node-input glass-node w-[280px] relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/50' : ''}`}
    >
      <NodeActionBar
        variant="group"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
      />
      <div className="glass-node-header px-3 py-2 flex items-center gap-2 text-[var(--text-primary)]">
        <LayoutGrid size={12} />
        <span>Placement ref</span>
      </div>
      <div className="p-2">
        <ImageCellOverlay src={MOCK.placement} resolution="1920 × 1080" index={0} nodeId={id} />
      </div>
      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

PlacementRefNode.displayName = 'PlacementRefNode';
export default PlacementRefNode;
