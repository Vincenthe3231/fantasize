import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Sun } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';

const PRESETS = [
  { id: 'golden', label: 'Golden hour', src: MOCK.lightWarm },
  { id: 'studio', label: 'Studio', src: MOCK.lightDrama },
  { id: 'natural', label: 'Natural', src: MOCK.lightNatural },
  { id: 'dramatic', label: 'Dramatic', src: MOCK.lightCool },
] as const;

const LightingScenarioNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const [active, setActive] = useState<string>('golden');

  return (
    <div
      className={`glass-node w-[400px] relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
    >
      <NodeActionBar
        variant="multiImage"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onDownload={() => window.open(PRESETS.find((p) => p.id === active)?.src || MOCK.lightWarm, '_blank')}
      />

      <div className="glass-node-header px-3 py-2.5 flex items-center gap-2 text-[var(--text-primary)]">
        <Sun size={13} />
        <span>Lighting scenario</span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {PRESETS.map((p, i) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setActive(p.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(p.id);
              }
            }}
            className={`text-left rounded-lg overflow-hidden border transition-colors cursor-pointer ${
              active === p.id ? 'border-amber-500/70 ring-1 ring-amber-500/30' : 'border-white/10'
            }`}
          >
            <ImageCellOverlay src={p.src} label={p.label} resolution="4K" index={i} nodeId={id} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-3 border-t border-white/[0.06] pt-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActive(p.id);
            }}
            className={`text-[10px] font-mono-display uppercase tracking-wider px-2 py-1 rounded-md transition-colors ${
              active === p.id ? 'bg-amber-500/20 text-amber-200' : 'bg-white/5 text-[var(--text-muted)] hover:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Handle type="target" position={Position.Left} className="port-input" />
      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

LightingScenarioNode.displayName = 'LightingScenarioNode';
export default LightingScenarioNode;
