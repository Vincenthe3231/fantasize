import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Cloud, Download } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import { toast } from 'sonner';

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

  return (
    <div
      className={`glass-node-output glass-node w-[420px] relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
    >
      <NodeActionBar
        variant="multiImage"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onDownload={() => toast.success('Export queued (mock)')}
      />

      <div className="glass-node-header px-3 py-2.5 flex items-center gap-2 text-[var(--text-primary)]">
        <Cloud size={13} />
        <span>Atmosphere test</span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {MOODS.map((m, i) => (
          <div key={m.label} className="rounded-lg overflow-hidden border border-white/10">
            <ImageCellOverlay src={m.src} label={m.label} resolution="4K" index={i} nodeId={id} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.06]">
        <div className="flex flex-wrap gap-1 text-[9px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider">
          {MOODS.map((m) => (
            <span key={m.label} className="px-1.5 py-0.5 rounded bg-white/5">
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

      <Handle type="target" position={Position.Left} className="port-input" />
      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

AtmosphereTestNode.displayName = 'AtmosphereTestNode';
export default AtmosphereTestNode;
