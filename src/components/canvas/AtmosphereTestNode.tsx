import { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { Cloud, Download } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import { toast } from 'sonner';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';

const MOODS = [
  { label: 'Blue hour', src: MOCK.moodNight },
  { label: 'Golden glow', src: MOCK.moodGolden },
  { label: 'Cool daylight', src: MOCK.moodCool },
  { label: 'Neon mood', src: MOCK.moodNeon },
];

const AtmosphereTestNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  return (
    <FlowNodeResizeRoot
      selected={!!selected}
      minWidth={320}
      minHeight={200}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="atmosphereTestNode" labelPrefix="Atmosphere test" icon={<Cloud size={12} />} />
      <div
        className={`glass-node-output glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="multiImage"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onDownload={() => toast.success('Export queued (mock)')}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className="grid grid-cols-2 gap-2 p-3 pt-2">
        {MOODS.map((m, i) => (
          <div key={m.label} className="rounded-lg overflow-hidden border border-[var(--node-control-border)]">
            <ImageCellOverlay src={m.src} label={m.label} resolution="4K" index={i} nodeId={id} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <div className="flex flex-wrap gap-1 text-[9px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider">
          {MOODS.map((m) => (
            <span key={m.label} className="px-1.5 py-0.5 rounded bg-[var(--node-control-bg)] border border-[var(--node-panel-border)]">
              {m.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toast.success('Exported atmosphere board (mock)');
          }}
          className="flex items-center gap-1.5 text-[11px] font-mono-display uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[var(--accent-color)]/25 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/35 border border-[var(--accent-color)]/30"
        >
          <Download size={12} />
          Export
        </button>
      </div>
      </NodeContentFocus>

      <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

AtmosphereTestNode.displayName = 'AtmosphereTestNode';
export default AtmosphereTestNode;
