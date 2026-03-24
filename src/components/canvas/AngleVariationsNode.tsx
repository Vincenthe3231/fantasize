import { memo, useState, useMemo, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import { RefreshCw, Grid3X3 } from 'lucide-react';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';

const CAMERA_SRC = [MOCK.camera1, MOCK.camera2, MOCK.camera3, MOCK.camera4];

const AngleVariationsNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const gridLayout = useWorkflowStore((s) => s.nodeGridLayouts[id] || '2x2');
  const toggleGrid = useWorkflowStore((s) => s.toggleGridLayout);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);
  const [splitImages, setSplitImages] = useState(false);
  const [selectedCount] = useState(4);

  const runAndAccumulate = useCallback(() => {
    runFromNode(id);
  }, [id, runFromNode]);

  const cols = gridLayout === '1x1' ? 1 : gridLayout === '2x2' ? 2 : 3;
  const cellCount = cols * cols;
  const cells = Array.from({ length: Math.min(cellCount, 4) }, (_, i) => i);

  return (
    <FlowNodeResizeRoot
      minWidth={280}
      minHeight={160}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="angleVariationsNode" labelPrefix="Angle variations" icon={<Grid3X3 size={12} />} />
      <div
        className={`glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          variant="multiImage"
          onRun={runAndAccumulate}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          showDownload
          onGridToggle={() => toggleGrid(id)}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-end px-3 py-2 text-[10px] text-[var(--text-muted)]">
              <span>variations</span>
              <span className="mx-1">•</span>
              <span>1 image</span>
            </div>

            <div className="absolute right-3 top-12 z-10 rounded bg-[var(--node-badge-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--node-overlay-text)]">
              5504 × 3072
            </div>

            <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {cells.map((i) => (
                <ImageCellOverlay
                  key={i}
                  src={CAMERA_SRC[i] ?? MOCK.camera1}
                  index={i}
                  nodeId={id}
                  resolution="4K"
                />
              ))}
            </div>

            <div
              className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 items-center justify-between border-t border-border px-3 py-2 text-[10px]`}
            >
              <div className="flex items-center gap-2 text-[var(--node-control-muted)]">
                <span className="cursor-pointer text-[var(--accent-color)] hover:underline">Reframe</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5">16:9</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5">4K</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5">{gridLayout}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <span>{selectedCount} Selected</span>
                <label className="flex cursor-pointer items-center gap-1">
                  <span className="text-[9px]">Split</span>
                  <div
                    className={`relative h-3.5 w-7 cursor-pointer rounded-full transition-colors ${splitImages ? 'bg-blue-500' : 'bg-white/20'}`}
                    onClick={() => setSplitImages(!splitImages)}
                  >
                    <div
                      className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${splitImages ? 'translate-x-3.5' : 'translate-x-0.5'}`}
                    />
                  </div>
                </label>
                <button type="button" className="rounded p-1 transition-colors hover:bg-white/10">
                  <RefreshCw size={10} />
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

AngleVariationsNode.displayName = 'AngleVariationsNode';
export default AngleVariationsNode;
