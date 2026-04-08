import { memo, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { Sofa, AlertTriangle, Loader2 } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import { TooltipWrap } from '@/components/ui/tooltip';
import { stage1Complete } from '@/lib/scoutPipeline';

const SetDressingNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const scoutPipeline = useWorkflowStore((s) => s.scoutPipeline);
  const approveStage2Pipeline = useWorkflowStore((s) => s.approveStage2Pipeline);
  const nodes = useWorkflowStore((s) => s.nodes);
  const previewUrl = (data?.previewUrl as string) || MOCK.setDressing;
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const s1 = useMemo(() => stage1Complete(nodes), [nodes]);
  const canApprove = s1.ok && (!scoutPipeline.stage2Approved || scoutPipeline.stage2Stale);
  const approveLabel =
    scoutPipeline.stage2Approved && !scoutPipeline.stage2Stale
      ? 'Stage 2 approved'
      : scoutPipeline.stage2Stale
        ? 'Re-approve Stage 2'
        : 'Approve Stage 2';

  return (
    <FlowNodeResizeRoot
      minWidth={320}
      minHeight={200}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="setDressingNode" labelPrefix="Set dressing preview" icon={<Sofa size={12} />} />
      <div
        className={`glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          hidden={Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden)}
          variant="image"
          runBusy={isRunning}
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          showDownload
          onDownload={() => window.open(previewUrl, '_blank')}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div className="space-y-2 p-3 pt-2">
            {!s1.ok && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>Complete Stage 1: location upload, placement brief, and labelled props.</span>
              </div>
            )}
            {scoutPipeline.stage2Stale && scoutPipeline.stage2Approved && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>Upstream inputs changed — approve Stage 2 again after review.</span>
              </div>
            )}
            <ImageCellOverlay
              src={previewUrl}
              resolution="3840 × 2160"
              index={0}
              nodeId={id}
              className="!rounded-lg"
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-3 py-2 text-[10px] text-[var(--text-muted)]">
            <span>Composite from location · placement · props · generator</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isRunning}
                className={`${NODE_INTERACTIVE_CLASS} rounded-lg border border-[var(--node-control-border)] bg-[var(--node-control-bg)] px-2 py-1 font-mono-display uppercase tracking-wider text-[var(--accent-color)] hover:bg-[var(--node-action-bar-hover-bg)] disabled:cursor-not-allowed disabled:opacity-50`}
                onClick={(e) => {
                  e.stopPropagation();
                  runFromNode(id);
                }}
              >
                {isRunning ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    Running…
                  </span>
                ) : (
                  'Regenerate'
                )}
              </button>
              <TooltipWrap
                label="Locks Stage 2 so generators and downstream stages can run"
                side="top"
                contentClassName="z-[100] max-w-[min(280px,calc(100vw-24px))]"
              >
                <span className="inline-flex">
                  <button
                    type="button"
                    disabled={!canApprove}
                    className={`${NODE_INTERACTIVE_CLASS} rounded-lg bg-[var(--accent-color)] px-2 py-1 font-mono-display uppercase tracking-wider text-[var(--node-on-accent)] disabled:cursor-not-allowed disabled:opacity-40`}
                    onClick={(e) => {
                      e.stopPropagation();
                      approveStage2Pipeline();
                    }}
                  >
                    {approveLabel}
                  </button>
                </span>
              </TooltipWrap>
            </div>
          </div>
        </NodeContentFocus>

        <EnhancedHandle
          type="target"
          position={Position.Left}
          id="text-in"
          className="port-input"
          style={{ top: '10%' }}
          dataType="text"
        />
        <EnhancedHandle
          type="target"
          position={Position.Left}
          id="image-in"
          className="port-input"
          style={{ top: '22%' }}
          dataType="image"
        />
        <EnhancedHandle
          type="target"
          position={Position.Left}
          id="location-in"
          className="port-input"
          style={{ top: '34%' }}
          dataType="image"
        />
        <EnhancedHandle
          type="target"
          position={Position.Left}
          id="placement-in"
          className="port-input"
          style={{ top: '46%' }}
          dataType="text"
        />
        <EnhancedHandle
          type="target"
          position={Position.Left}
          id="props-in"
          className="port-input"
          style={{ top: '58%' }}
          dataType="image"
        />
        <EnhancedHandle
          type="target"
          position={Position.Left}
          id="scene-in"
          className="port-input"
          style={{ top: '70%' }}
          dataType="generic"
        />
        <EnhancedHandle
          type="source"
          position={Position.Right}
          id="text-out"
          className="port-output port-output-accent"
          style={{ top: '42%' }}
          dataType="text"
        />
        <EnhancedHandle
          type="source"
          position={Position.Right}
          id="image-out"
          className="port-output"
          style={{ top: '58%' }}
          dataType="image"
        />
      </div>
    </FlowNodeResizeRoot>
  );
});

SetDressingNode.displayName = 'SetDressingNode';
export default SetDressingNode;
