import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Clapperboard, Loader2, Play, Download, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';

const ImageGeneratorNode = memo(({ id, data }: NodeProps) => {
  const [showNegPrompt, setShowNegPrompt] = useState(false);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);

  const model = (data.model as string) || 'mystic';
  const aspect = (data.aspect as string) || '16:9';
  const images = (data.images as number) || 1;
  const negativePrompt = (data.negativePrompt as string) || '';
  const status = (data.status as string) || 'idle';
  const generatedUrl = (data.generatedUrl as string) || '';

  const handleRun = () => {
    updateNodeData(id, { status: 'generating' });
    setTimeout(() => {
      updateNodeData(id, { status: 'success', generatedUrl: '/placeholder.svg' });
    }, 2000);
  };

  return (
    <div className={`glass-node w-[300px] relative ${isRunning || status === 'generating' ? 'ring-1 ring-[var(--accent-color)]' : ''}`}>
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      />

      <div className="glass-node-header px-3 py-2.5 flex items-center gap-2 text-[var(--text-primary)]">
        <Clapperboard size={13} />
        <span>Image Generator</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Dropdowns row */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Model</label>
            <select value={model} onChange={(e) => updateNodeData(id, { model: e.target.value })} className="node-select w-full">
              <option value="mystic">Mystic</option>
              <option value="flux">Flux</option>
              <option value="sdxl">SDXL</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Aspect</label>
            <select value={aspect} onChange={(e) => updateNodeData(id, { aspect: e.target.value })} className="node-select w-full">
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
              <option value="9:16">9:16</option>
              <option value="3:2">3:2</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Images</label>
            <select value={images} onChange={(e) => updateNodeData(id, { images: Number(e.target.value) })} className="node-select w-full">
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
        </div>

        {/* Negative prompt collapsible */}
        <button
          onClick={() => setShowNegPrompt(!showNegPrompt)}
          className="flex items-center gap-1 text-[10px] font-mono-display text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors"
        >
          {showNegPrompt ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          Negative Prompt
        </button>
        <AnimatePresence>
          {showNegPrompt && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <textarea
                value={negativePrompt}
                onChange={(e) => updateNodeData(id, { negativePrompt: e.target.value })}
                placeholder="Elements to exclude…"
                className="w-full bg-white/5 rounded-lg p-2 text-[12px] text-[var(--text-primary)] resize-none outline-none min-h-[40px] border border-white/5 placeholder:text-[var(--text-muted)]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated image */}
        <AnimatePresence>
          {status === 'success' && generatedUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg overflow-hidden relative group"
            >
              <img src={generatedUrl} alt="Generated scene" className="w-full h-[140px] object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                  <Download size={14} className="text-white" />
                </button>
                <button className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                  <Maximize2 size={14} className="text-white" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'generating' && (
          <div className="h-[140px] rounded-lg bg-white/5 flex flex-col items-center justify-center gap-2">
            <div className="relative">
              <Loader2 size={20} className="animate-spin text-[var(--accent-color)]" />
              <div className="absolute inset-0 rounded-full bg-[var(--accent-color)]/20 pulse-ring" />
            </div>
            <span className="text-[11px] font-mono-display text-[var(--text-muted)]">Generating scene…</span>
          </div>
        )}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={status === 'generating'}
          className="w-full py-2.5 rounded-lg bg-[var(--accent-color)] text-white text-[12px] font-mono-display uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'generating' ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Play size={13} />
              {status === 'success' ? 'Re-generate' : 'Run'}
            </>
          )}
        </button>
      </div>

      <Handle type="target" position={Position.Left} id="text-in" className="port-input" style={{ top: '35%' }} />
      <Handle type="target" position={Position.Left} id="image-in" className="port-input" style={{ top: '65%' }} />
      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

ImageGeneratorNode.displayName = 'ImageGeneratorNode';
export default ImageGeneratorNode;
