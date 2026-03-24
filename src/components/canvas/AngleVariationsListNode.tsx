import { memo, useState, useMemo, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import { Plus, Grid3X3, List, Settings, CircleDot } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';

export type AccumulatedAngle = { id: string; src: string; resolution?: string };

const AngleVariationsListNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const accumulatedAngles: AccumulatedAngle[] = Array.isArray((data as { accumulatedAngles?: AccumulatedAngle[] })?.accumulatedAngles)
    ? ((data as { accumulatedAngles: AccumulatedAngle[] }).accumulatedAngles as AccumulatedAngle[])
    : [];
  const selectedAngleId = (data as { selectedAngleId?: string | null })?.selectedAngleId ?? null;

  const shotId = useMemo(() => {
    return edges.find((e) => e.source === id && nodes.find((n) => n.id === e.target)?.type === 'selectedShotNode')?.target;
  }, [edges, nodes, id]);

  const selectAngle = useCallback(
    (angleId: string) => {
      updateNodeData(id, { selectedAngleId: angleId });
    },
    [id, updateNodeData]
  );

  const sendToSelectedShot = useCallback(() => {
    if (!shotId || !selectedAngleId) return;
    const shot = accumulatedAngles.find((a) => a.id === selectedAngleId);
    if (!shot) return;
    updateNodeData(shotId, {
      mediaUrl: shot.src,
      resolution: shot.resolution ?? '3840 × 2160',
      committed: false,
    });
  }, [accumulatedAngles, selectedAngleId, shotId, updateNodeData]);

  const totalImages = accumulatedAngles.length;

  return (
    <FlowNodeResizeRoot
      minWidth={280}
      minHeight={160}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="angleVariationsListNode" labelPrefix="Angle variations list" icon={<Grid3X3 size={12} />} />
      <div
        className={`glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
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

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 justify-end px-3 py-2">
              <span className="text-[11px] text-[var(--text-muted)]">{totalImages} images</span>
            </div>

            <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto p-3">
              {accumulatedAngles.length === 0 ? (
                <div className="col-span-3 py-8 text-center text-[11px] text-[var(--text-muted)]">
                  Run Angle variations to accumulate shots here.
                </div>
              ) : (
                accumulatedAngles.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => selectAngle(a.id)}
                    className={`relative rounded-lg ring-2 ring-transparent transition-all ${
                      selectedAngleId === a.id ? 'ring-[var(--accent-color)]' : 'hover:ring-white/20'
                    }`}
                  >
                    <ImageCellOverlay
                      src={a.src}
                      index={i}
                      nodeId={id}
                      resolution={a.resolution ?? 'HD'}
                    />
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <button
                type="button"
                disabled={!selectedAngleId || !shotId}
                className={`${NODE_INTERACTIVE_CLASS} flex items-center gap-1.5 rounded-lg border border-[var(--node-control-border)] bg-[var(--node-control-bg)] px-3 py-1.5 text-[12px] text-[var(--node-control-text)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)] disabled:cursor-not-allowed disabled:opacity-40`}
                onClick={(e) => {
                  e.stopPropagation();
                  sendToSelectedShot();
                }}
              >
                <Plus size={11} />
                To Selected shot
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--node-control-muted)]">{totalImages}</span>
                <button type="button" className="rounded p-1 text-[var(--node-control-muted)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-control-text)]">
                  <CircleDot size={12} />
                </button>
                <button
                  className={`rounded p-1 transition-colors ${viewMode === 'list' ? 'bg-[var(--node-tab-active-bg)] text-[var(--text-primary)]' : 'text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-control-text)]'}`}
                  onClick={() => setViewMode('list')}
                >
                  <List size={12} />
                </button>
                <button
                  className={`rounded p-1 transition-colors ${viewMode === 'grid' ? 'bg-[var(--node-tab-active-bg)] text-[var(--text-primary)]' : 'text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-control-text)]'}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 size={12} />
                </button>
                <button type="button" className="rounded p-1 text-[var(--node-control-muted)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-control-text)]">
                  <Settings size={12} />
                </button>
              </div>
            </div>
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

AngleVariationsListNode.displayName = 'AngleVariationsListNode';
export default AngleVariationsListNode;
