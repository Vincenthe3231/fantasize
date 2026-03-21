import { memo, useState, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { RefreshCw, Grid3X3 } from 'lucide-react';
import NodeCornerResizer from './NodeCornerResizer';
import { NODE_INTERACTIVE_CLASS, useResizableNodeShell } from './nodeResizeUtils';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';

const CAMERA_SRC = [MOCK.camera1, MOCK.camera2, MOCK.camera3, MOCK.camera4];
const DEFAULT_WIDTH = 380;

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

  const { shellStyle, fillHeight } = useResizableNodeShell(id, DEFAULT_WIDTH);

  const cols = gridLayout === '1x1' ? 1 : gridLayout === '2x2' ? 2 : 3;
  const cellCount = cols * cols;
  const cells = Array.from({ length: Math.min(cellCount, 4) }, (_, i) => i);

  return (
    <div
      style={shellStyle}
      className={`vf-resizable-root relative ${fillHeight ? 'flex flex-col min-h-0 h-full' : ''}`}
    >
      <NodeCornerResizer nodeId={id} isVisible={selected} minWidth={280} minHeight={160} />
      <NodeLabelRow nodeId={id} nodeType="angleVariationsNode" labelPrefix="Angle variations" icon={<Grid3X3 size={12} />} />
      <div
        className={`glass-node w-full relative ${fillHeight ? 'flex flex-1 flex-col min-h-0' : ''} ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="multiImage"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onGridToggle={() => toggleGrid(id)}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className={`relative flex flex-col ${fillHeight ? 'flex-1 min-h-0' : ''}`}>
        <div className="px-3 py-2 flex items-center justify-end text-[10px] text-[var(--text-muted)] shrink-0">
          <span>variations</span>
          <span className="mx-1">•</span>
          <span>1 image</span>
        </div>

      {/* Resolution badge */}
      <div className="absolute top-12 right-3 rounded px-1.5 py-0.5 text-[10px] font-mono z-10 text-[var(--node-overlay-text)] bg-[var(--node-badge-bg)]">
        5504 × 3072
      </div>

      <div className={`grid gap-2 p-3 ${fillHeight ? 'min-h-0 flex-1 overflow-auto' : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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

      {/* Footer */}
      <div className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 items-center justify-between px-3 py-2 border-t border-border text-[10px]`}>
        <div className="flex items-center gap-2 text-[var(--node-control-muted)]">
          <span className="text-[var(--accent-color)] cursor-pointer hover:underline">Reframe</span>
          <span className="bg-white/10 rounded px-1.5 py-0.5">16:9</span>
          <span className="bg-white/10 rounded px-1.5 py-0.5">4K</span>
          <span className="bg-white/10 rounded px-1.5 py-0.5">{gridLayout}</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span>{selectedCount} Selected</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <span className="text-[9px]">Split</span>
            <div
              className={`w-7 h-3.5 rounded-full transition-colors ${splitImages ? 'bg-blue-500' : 'bg-white/20'} relative cursor-pointer`}
              onClick={() => setSplitImages(!splitImages)}
            >
              <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${splitImages ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </div>
          </label>
          <button type="button" className="p-1 rounded hover:bg-white/10 transition-colors">
            <RefreshCw size={10} />
          </button>
        </div>
      </div>
        </div>
      </NodeContentFocus>

      <EnhancedHandle type="target" position={Position.Left} className="port-input" dataType="image" />
      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="image" />
      </div>
    </div>
  );
});

AngleVariationsNode.displayName = 'AngleVariationsNode';
export default AngleVariationsNode;
