import { memo, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { Video, Loader2, Play, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { RichTextField } from '@/components/rich-text/RichTextField';

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
    <FlowNodeResizeRoot
      minWidth={200}
      minHeight={180}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="videoGeneratorNode" labelPrefix="Video Generator" icon={<Video size={12} />} />
      <div
        className={`glass-node relative flex w-full flex-1 flex-col min-h-0 ${isRunning || status === 'generating' ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id} shellMoveCursor>
        <div className="flex flex-1 min-h-0 flex-col space-y-3 overflow-y-auto p-3">
        <div className={`${NODE_INTERACTIVE_CLASS} grid shrink-0 grid-cols-3 gap-2`}>
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

        <div className="min-h-[50px] w-full flex-1 rounded-lg border border-[var(--node-control-border)] bg-[var(--node-control-bg)] p-1">
          <RichTextField
            value={prompt}
            onChange={(html) => updateNodeData(id, { prompt: html })}
            placeholder="Describe the scene motion…"
            excludeNodeId={id}
            toolbarVariant="top"
            className="min-h-[40px]"
            editorContentClassName="w-full min-h-[40px] text-[12px] text-[var(--text-primary)] outline-none prose prose-invert prose-sm max-w-none"
            editorProps={{
              handleDOMEvents: {
                mousedown: (_, e) => {
                  e.stopPropagation();
                  return false;
                },
                keydown: (_, e) => {
                  e.stopPropagation();
                  return false;
                },
              },
            }}
          />
        </div>

        <AnimatePresence>
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative min-h-[120px] flex-1 flex flex-col overflow-hidden rounded-lg"
            >
              <div className="flex min-h-[120px] flex-1 items-center justify-center bg-gradient-to-br from-blue-900/30 to-purple-900/30">
                <Play size={28} className="text-[var(--node-on-accent)] opacity-70" />
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  className={`${NODE_INTERACTIVE_CLASS} p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors`}
                >
                  <Download size={13} className="text-[var(--node-on-accent)]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'generating' && (
          <div
            className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-[var(--node-panel-border)] bg-[var(--node-control-bg)]"
          >
            <Loader2 size={20} className="animate-spin text-[var(--accent-color)]" />
            <span className="text-[11px] font-mono-display text-[var(--text-muted)]">Generating video…</span>
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={status === 'generating'}
          className={`${NODE_INTERACTIVE_CLASS} w-full shrink-0 py-2.5 rounded-lg bg-[var(--accent-color)] text-[var(--node-on-accent)] text-[12px] font-mono-display uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {status === 'generating' ? (
            <><Loader2 size={13} className="animate-spin" /> Generating…</>
          ) : (
            <><Play size={13} /> {status === 'success' ? 'Re-generate' : 'Run'}</>
          )}
        </button>
        </div>
      </NodeContentFocus>

      <DefaultNodePortHandles />
      <EnhancedHandle
        type="source"
        position={Position.Right}
        id="video-out"
        className="port-output"
        style={{ top: '78%' }}
        dataType="video"
      />
      </div>
    </FlowNodeResizeRoot>
  );
});

VideoGeneratorNode.displayName = 'VideoGeneratorNode';
export default VideoGeneratorNode;
