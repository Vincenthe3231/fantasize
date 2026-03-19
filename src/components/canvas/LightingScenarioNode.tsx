import { memo, useState, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { Sun } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';
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
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const [active, setActive] = useState<string>('golden');
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  return (
    <div className="w-[400px] relative">
      <NodeLabelRow nodeId={id} nodeType="lightingScenarioNode" labelPrefix="Lighting scenario" icon={<Sun size={12} />} />
      <div
        className={`glass-node w-full relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="multiImage"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onDownload={() => window.open(PRESETS.find((p) => p.id === active)?.src || MOCK.lightWarm, '_blank')}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className="grid grid-cols-2 gap-2 p-3 pt-2">
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
              active === p.id ? 'border-amber-500/70 ring-1 ring-amber-500/30' : 'border-[var(--node-control-border)]'
            }`}
          >
            <ImageCellOverlay src={p.src} label={p.label} resolution="4K" index={i} nodeId={id} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-3 border-t border-border pt-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActive(p.id);
            }}
            className={`text-[10px] font-mono-display uppercase tracking-wider px-2 py-1 rounded-md transition-colors ${
              active === p.id ? 'bg-amber-500/20 text-amber-200' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      </NodeContentFocus>

      <EnhancedHandle type="target" position={Position.Left} className="port-input" dataType="image" />
      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="image" />
      </div>
    </div>
  );
});

LightingScenarioNode.displayName = 'LightingScenarioNode';
export default LightingScenarioNode;
