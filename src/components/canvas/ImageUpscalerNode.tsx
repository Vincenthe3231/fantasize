import { memo, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import NodeCornerResizer from './NodeCornerResizer';
import { useResizableNodeShell } from './nodeResizeUtils';
import { ArrowUpCircle, Loader2, Play, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';

const DEFAULT_WIDTH = 280;

const ImageUpscalerNode = memo(({ id, data, selected }: NodeProps) => {
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

  const mode = (data.mode as string) || 'creative';
  const scale = (data.scale as string) || '2x';
  const status = (data.status as string) || 'idle';
  const progress = (data.progress as number) || 0;

  const handleRun = () => {
    updateNodeData(id, { status: 'processing', progress: 0 });
    const steps = 20;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      updateNodeData(id, { progress: Math.round((step / steps) * 100) });
      if (step >= steps) {
        clearInterval(interval);
        updateNodeData(id, { status: 'success', progress: 100 });
      }
    }, 100);
  };

  return (
    <div
      style={shellStyle}
      className={`vf-resizable-root relative ${fillHeight ? 'flex flex-col min-h-0 h-full' : ''}`}
    >
      <NodeCornerResizer nodeId={id} isVisible={selected} minWidth={200} minHeight={160} />
      <NodeLabelRow nodeId={id} nodeType="imageUpscalerNode" labelPrefix="Image Upscaler" icon={<ArrowUpCircle size={12} />} />
      <div
        className={`glass-node w-full relative ${fillHeight ? 'flex flex-1 flex-col min-h-0' : ''} ${isRunning || status === 'processing' ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className={`p-3 space-y-3 ${fillHeight ? 'flex flex-1 min-h-0 flex-col overflow-y-auto' : ''}`}>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Mode</label>
            <select value={mode} onChange={(e) => updateNodeData(id, { mode: e.target.value })} className="node-select w-full">
              <option value="creative">Creative</option>
              <option value="precision">Precision</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Scale</label>
            <select value={scale} onChange={(e) => updateNodeData(id, { scale: e.target.value })} className="node-select w-full">
              <option value="2x">2×</option>
              <option value="4x">4×</option>
            </select>
          </div>
        </div>

        {status === 'processing' && (
          <div className="shrink-0 space-y-1">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--accent-color)]"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-[10px] font-mono-display text-[var(--text-muted)]">{progress}%</span>
          </div>
        )}

        <AnimatePresence>
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-lg overflow-hidden relative group ${fillHeight ? 'min-h-[100px] flex-1 flex flex-col' : ''}`}
            >
              <div
                className={`bg-gradient-to-br from-orange-900/20 to-amber-900/20 flex items-center justify-center ${fillHeight ? 'flex-1 min-h-[100px]' : 'h-[100px]'}`}
              >
                <span className="text-[11px] font-mono-display text-[var(--text-muted)]">Upscaled preview</span>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                  <Download size={13} className="text-[var(--node-on-accent)]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleRun}
          disabled={status === 'processing'}
          className="w-full shrink-0 py-2.5 rounded-lg bg-[var(--accent-color)] text-[var(--node-on-accent)] text-[12px] font-mono-display uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'processing' ? (
            <><Loader2 size={13} className="animate-spin" /> Upscaling…</>
          ) : (
            <><Play size={13} /> {status === 'success' ? 'Re-upscale' : 'Run'}</>
          )}
        </button>
        </div>
      </NodeContentFocus>

      <EnhancedHandle type="target" position={Position.Left} className="port-input" dataType="image" />
      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="image" />
      </div>
    </div>
  );
});

ImageUpscalerNode.displayName = 'ImageUpscalerNode';
export default ImageUpscalerNode;
