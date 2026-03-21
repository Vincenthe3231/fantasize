import { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { LayoutGrid } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';

const PlacementRefNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const quickOverrides = useMemo(
    () => ({
      imageGenerator: { targetHandle: 'image-in' as const },
      videoGenerator: { targetHandle: 'image-in' as const },
      assistant: { targetHandle: 'image-in' as const },
    }),
    []
  );
  const { connectMenuItems } = useQuickConnect(id, selfPos, quickOverrides);

  return (
    <FlowNodeResizeRoot
      selected={!!selected}
      minWidth={220}
      minHeight={120}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="placementRefNode" labelPrefix="Placement ref" icon={<LayoutGrid size={12} />} />
      <div
        className={`glass-node-input glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/50' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="group"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        connectMenuItems={connectMenuItems}
      />
      <NodeContentFocus nodeId={id}>
        <div className="p-2 pt-2">
          <ImageCellOverlay src={MOCK.placement} resolution="1920 × 1080" index={0} nodeId={id} />
        </div>
      </NodeContentFocus>
      <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

PlacementRefNode.displayName = 'PlacementRefNode';
export default PlacementRefNode;
