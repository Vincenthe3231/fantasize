import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { LayoutGrid } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';

const PlacementRefNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);

  return (
    <div className="w-[280px] relative">
      <NodeLabelRow nodeId={id} nodeType="placementRefNode" labelPrefix="Placement ref" icon={<LayoutGrid size={12} />} />
      <div
        className={`glass-node-input glass-node w-full relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/50' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="group"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
      />
      <NodeContentFocus nodeId={id}>
        <div className="p-2 pt-2">
          <ImageCellOverlay src={MOCK.placement} resolution="1920 × 1080" index={0} nodeId={id} />
        </div>
      </NodeContentFocus>
      <Handle type="source" position={Position.Right} className="port-output" />
      </div>
    </div>
  );
});

PlacementRefNode.displayName = 'PlacementRefNode';
export default PlacementRefNode;
