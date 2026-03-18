import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useWorkflowStore, createVirtualProductionScoutTemplate } from '@/stores/workflowStore';
import type { Node, Edge } from 'reactflow';

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
}

interface Template {
  name: string;
  description: string;
  gradient: string;
  nodes: Node[];
  edges: Edge[];
  /** When true, load canonical graph from createVirtualProductionScoutTemplate() */
  loadFullScout?: boolean;
}

const templates: Template[] = [
  {
    name: 'Virtual Production Scout',
    description:
      'Full flow: scene + location + placement + props → assistant → generator → set dressing → camera → lighting → atmosphere + shot pick',
    gradient: 'from-amber-950/55 via-violet-900/45 to-slate-950/50',
    nodes: [],
    edges: [],
    loadFullScout: true,
  },
  {
    name: 'Product Photoshoot',
    description: 'Upload + Text + 3× Image Generators + Upscaler',
    gradient: 'from-rose-900/40 to-orange-900/40',
    nodes: [
      { id: 'upload-1', type: 'uploadNode', position: { x: 80, y: 200 }, data: { mediaUrl: '', label: '' } },
      { id: 'text-1', type: 'textNode', position: { x: 80, y: 420 }, data: { content: 'Hero product on marble surface, soft key light, clean editorial backdrop' } },
      { id: 'gen-1', type: 'imageGeneratorNode', position: { x: 420, y: 100 }, data: { model: 'flux', aspect: '1:1', images: 1, status: 'idle' } },
      { id: 'gen-2', type: 'imageGeneratorNode', position: { x: 420, y: 300 }, data: { model: 'mystic', aspect: '16:9', images: 1, status: 'idle' } },
      { id: 'gen-3', type: 'imageGeneratorNode', position: { x: 420, y: 500 }, data: { model: 'sdxl', aspect: '4:3', images: 1, status: 'idle' } },
      { id: 'upscaler-1', type: 'imageUpscalerNode', position: { x: 760, y: 300 }, data: { mode: 'creative', scale: '4x', status: 'idle' } },
    ],
    edges: [
      { id: 'e1', source: 'upload-1', target: 'gen-1', type: 'custom' },
      { id: 'e2', source: 'text-1', target: 'gen-2', type: 'custom' },
      { id: 'e3', source: 'text-1', target: 'gen-3', type: 'custom' },
      { id: 'e4', source: 'gen-2', target: 'upscaler-1', type: 'custom' },
    ],
  },
  {
    name: 'Social Campaign',
    description: 'Text + Assistant + Image Gen + Video Gen',
    gradient: 'from-cyan-900/40 to-blue-900/40',
    nodes: [
      { id: 'text-1', type: 'textNode', position: { x: 80, y: 260 }, data: { content: 'Summer campaign hero visual — vibrant, cinematic, aspirational lifestyle' } },
      { id: 'assistant-1', type: 'assistantNode', position: { x: 400, y: 260 }, data: { refinedPrompt: '' } },
      { id: 'gen-1', type: 'imageGeneratorNode', position: { x: 720, y: 160 }, data: { model: 'mystic', aspect: '1:1', images: 2, status: 'idle' } },
      { id: 'video-1', type: 'videoGeneratorNode', position: { x: 720, y: 400 }, data: { mode: 'text-to-video', duration: '5s', model: 'kling', status: 'idle' } },
    ],
    edges: [
      { id: 'e1', source: 'text-1', target: 'assistant-1', targetHandle: 'text-in', type: 'custom' },
      { id: 'e2', source: 'assistant-1', target: 'gen-1', type: 'custom' },
      { id: 'e3', source: 'assistant-1', target: 'video-1', type: 'custom' },
    ],
  },
];

const TemplateGallery = ({ open, onClose }: TemplateGalleryProps) => {
  const loadTemplate = useWorkflowStore((s) => s.loadTemplate);

  const handleSelect = (template: Template) => {
    if (template.loadFullScout) {
      const { nodes, edges } = createVirtualProductionScoutTemplate();
      loadTemplate(nodes, edges);
    } else {
      loadTemplate(template.nodes, template.edges);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-toolbar rounded-2xl p-6 w-[700px] max-w-[90vw] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-mono-display uppercase tracking-widest text-[var(--text-primary)]">
                Templates
              </span>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {templates.map((t, i) => (
                <motion.button
                  key={t.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => handleSelect(t)}
                  className="text-left rounded-xl overflow-hidden border border-white/[0.08] hover:border-[var(--accent-color)]/40 transition-colors group"
                >
                  <div className={`h-[120px] bg-gradient-to-br ${t.gradient} flex items-center justify-center`}>
                    <span className="text-[11px] font-mono-display text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-wider">
                      Preview
                    </span>
                  </div>
                  <div className="p-3 bg-white/[0.03]">
                    <div className="text-[12px] font-mono-display text-[var(--text-primary)]">{t.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>{t.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TemplateGallery;
