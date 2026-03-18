import { memo, useState } from 'react';
import { Handle, Position, type NodeProps, useEdges } from 'reactflow';
import { Sparkles, Loader2 } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';

const AssistantNode = memo(({ id, data }: NodeProps) => {
  const [isRefining, setIsRefining] = useState(false);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const allNodes = useWorkflowStore((s) => s.nodes);
  const edges = useEdges();

  const refinedPrompt = (data.refinedPrompt as string) || '';

  // Find connected source node names
  const textSource = edges.find((e) => e.target === id && e.targetHandle === 'text-in');
  const imageSource = edges.find((e) => e.target === id && e.targetHandle === 'image-in');
  const textNodeName = textSource ? allNodes.find((n) => n.id === textSource.source)?.type?.replace('Node', '') || 'Source' : null;
  const imageNodeName = imageSource ? allNodes.find((n) => n.id === imageSource.source)?.type?.replace('Node', '') || 'Source' : null;

  const handleRefine = () => {
    setIsRefining(true);
    setTimeout(() => {
      updateNodeData(id, {
        refinedPrompt:
          'A cinematic hotel suite interior — king bed centered with an LED-backlit headboard niche, bento-style floating shelves with curated ceramic props, warm diffused ambient lighting from recessed ceiling strips, wall-mounted AC unit recessed into millwork, editorial mood, 35mm lens, golden hour fill light',
      });
      setIsRefining(false);
    }, 1500);
  };

  return (
    <div className={`glass-node w-[300px] relative ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}>
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      />

      <div className="glass-node-header px-3 py-2.5 flex items-center gap-2 text-[var(--text-primary)]">
        <Sparkles size={13} />
        <span>Assistant</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Input slot pills */}
        <div className="flex gap-2">
          <div
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono-display uppercase tracking-wider border ${
              textNodeName ? 'border-[var(--port-input)]/40 text-[var(--port-input)]' : 'border-white/10 text-[var(--text-muted)]'
            }`}
          >
            Text ↗ {textNodeName && <span className="normal-case ml-1 opacity-70">{textNodeName}</span>}
          </div>
          <div
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono-display uppercase tracking-wider border ${
              imageNodeName ? 'border-[var(--port-input)]/40 text-[var(--port-input)]' : 'border-white/10 text-[var(--text-muted)]'
            }`}
          >
            Image ↗ {imageNodeName && <span className="normal-case ml-1 opacity-70">{imageNodeName}</span>}
          </div>
        </div>

        {/* Refine button */}
        <button
          onClick={handleRefine}
          disabled={isRefining}
          className="w-full py-2 rounded-lg border border-[var(--accent-color)] text-[var(--accent-color)] text-[12px] font-mono-display uppercase tracking-wider hover:bg-[var(--accent-color)]/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isRefining ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Refining...
            </>
          ) : (
            'Refine Prompt'
          )}
        </button>

        {/* Output */}
        {refinedPrompt && (
          <textarea
            readOnly
            value={refinedPrompt}
            className="w-full bg-white/5 rounded-lg p-2 text-[12px] text-[var(--text-primary)] resize-none outline-none min-h-[60px] leading-relaxed border border-white/5"
            style={{ fontFamily: 'Inter, sans-serif' }}
          />
        )}
      </div>

      <Handle type="target" position={Position.Left} id="text-in" className="port-input" style={{ top: '35%' }} />
      <Handle type="target" position={Position.Left} id="image-in" className="port-input" style={{ top: '65%' }} />
      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

AssistantNode.displayName = 'AssistantNode';
export default AssistantNode;
