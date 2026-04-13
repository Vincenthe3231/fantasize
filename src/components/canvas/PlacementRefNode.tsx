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
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import { stage1Complete } from '@/lib/scoutPipeline';
import { RichTextField } from '@/components/rich-text/RichTextField';

const PlacementRefNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
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

  const placementText = String((data?.placementText as string) ?? '');
  const placementRefUrl = String((data?.placementRefUrl as string) ?? MOCK.placement);

  const s1 = useMemo(() => stage1Complete(nodes), [nodes]);
  const placementOk = s1.hasPlacement;

  return (
    <FlowNodeResizeRoot
      minWidth={260}
      minHeight={160}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="placementRefNode" labelPrefix="Placement" icon={<LayoutGrid size={12} />} />
      <div
        className={`glass-node-input glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/50' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          hidden={Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden)}
          variant="group"
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          connectMenuItems={connectMenuItems}
        />
        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono-display uppercase tracking-wider text-[var(--text-muted)]">
                Placement brief
              </span>
              {placementOk ? (
                <span className="text-[9px] rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">Ready</span>
              ) : (
                <span className="text-[9px] rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">Add text</span>
              )}
            </div>
            <div onPointerDown={(e) => e.stopPropagation()} className="min-h-[100px] w-full rounded-lg border border-[var(--node-control-border)] bg-[var(--node-inner-mid)] p-1">
              <RichTextField
                value={placementText}
                onChange={(html) => updateNodeData(id, { placementText: html })}
                placeholder="Furniture positions, architecture, lighting notes…"
                excludeNodeId={id}
                toolbarVariant="floating-above"
                editorContentClassName="w-full min-h-[88px] text-[12px] text-[var(--text-primary)] outline-none leading-relaxed prose prose-invert prose-sm max-w-none px-2 py-1"
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
            <div className="text-[10px] text-[var(--text-muted)]">Optional spatial reference still:</div>
            <div className="max-h-[140px] overflow-hidden rounded-lg">
              <ImageCellOverlay src={placementRefUrl} resolution="Ref" index={0} nodeId={id} />
            </div>
          </div>
        </NodeContentFocus>
        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

PlacementRefNode.displayName = 'PlacementRefNode';
export default PlacementRefNode;
