import { memo, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import NodeCornerResizer from './NodeCornerResizer';
import { useResizableNodeShell } from './nodeResizeUtils';
import { Video, Loader2, Play, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';

const DEFAULT_WIDTH = 300;

const VideoGeneratorNode = memo(({ id, data, selected }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const { shellStyle, fillHeight } = useResizableNodeShell(id, DEFAULT_WIDTH);

  const mode = (data.mode as string) || 'text-to-video';
  const duration = (data.duration as string) || '5s';
  const model = (data.model as string) || 'kling';
  const prompt = (data.prompt as string) || '';
  const status = (data.status as string) || 'idle';

  const handleRun = () => {
    updateNodeData(id, { status: 'generating' });
    setTimeout(() => {
      updateNodeData(id, { status: 'success' });
    }, 3000);
  };

  return (
    <div
      style={shellStyle}
      className={`vf-resizable-root relative ${fillHeight ? 'flex flex-col min-h-0 h-full' : ''}`}
    >
      <NodeCornerResizer nodeId={id} isVisible={selected} minWidth={200} minHeight={180} />
      <NodeLabelRow nodeId={id} nodeType="videoGeneratorNode" labelPrefix="Video Generator" icon={<Video size={12} />} />
      <div
        className={`glass-node w-full relative ${fillHeight ? 'flex flex-1 flex-col min-h-0' : ''} ${isRunning || status === 'generating' ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div
          className={`p-3 space-y-3 ${fillHeight ? 'flex flex-1 min-h-0 flex-col overflow-y-auto' : ''}`}
        >
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Mode</label>
            <select value={mode} onChange={(e) => updateNodeData(id, { mode: e.target.value })} className="node-select w-full">
              <option value="text-to-video">T2V</option>
              <option value="image-to-video">I2V</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Duration</label>
            <select value={duration} onChange={(e) => updateNodeData(id, { duration: e.target.value })} className="node-select w-full">
              <option value="3s">3s</option>
              <option value="5s">5s</option>
              <option value="10s">10s</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Model</label>
            <select value={model} onChange={(e) => updateNodeData(id, { model: e.target.value })} className="node-select w-full">
              <option value="kling">Kling</option>
              <option value="runway">Runway</option>
              <option value="hailuo">Hailuo</option>
            </select>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="Describe the scene motion…"
          className={`w-full rounded-lg p-2 text-[12px] text-[var(--text-primary)] resize-none outline-none min-h-[50px] border border-[var(--node-control-border)] bg-[var(--node-control-bg)] placeholder:text-[var(--text-muted)] ${fillHeight ? 'flex-1 min-h-[50px]' : ''}`}
          style={{ fontFamily: 'Inter, sans-serif' }}
        />

        <AnimatePresence>
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-lg overflow-hidden relative group ${fillHeight ? 'min-h-[120px] flex-1 flex flex-col' : ''}`}
            >
              <div
                className={`bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center ${fillHeight ? 'flex-1 min-h-[120px]' : 'h-[120px]'}`}
              >
                <Play size={28} className="text-[var(--node-on-accent)] opacity-70" />
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Download size={13} className="text-[var(--node-on-accent)]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'generating' && (
          <div
            className={`rounded-lg bg-[var(--node-control-bg)] border border-[var(--node-panel-border)] flex flex-col items-center justify-center gap-2 ${fillHeight ? 'min-h-[120px] flex-1' : 'h-[120px]'}`}
          >
            <Loader2 size={20} className="animate-spin text-[var(--accent-color)]" />
            <span className="text-[11px] font-mono-display text-[var(--text-muted)]">Generating video…</span>
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={status === 'generating'}
          className="w-full shrink-0 py-2.5 rounded-lg bg-[var(--accent-color)] text-[var(--node-on-accent)] text-[12px] font-mono-display uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'generating' ? (
            <><Loader2 size={13} className="animate-spin" /> Generating…</>
          ) : (
            <><Play size={13} /> {status === 'success' ? 'Re-generate' : 'Run'}</>
          )}
        </button>
        </div>
      </NodeContentFocus>

      <EnhancedHandle
        type="target"
        position={Position.Left}
        id="text-in"
        className="port-input"
        style={{ top: '35%' }}
        dataType="text"
      />
      <EnhancedHandle
        type="target"
        position={Position.Left}
        id="image-in"
        className="port-input"
        style={{ top: '65%' }}
        dataType="image"
      />
      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="video" />
      </div>
    </div>
  );
});

VideoGeneratorNode.displayName = 'VideoGeneratorNode';
export default VideoGeneratorNode;
