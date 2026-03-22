import { useState } from 'react';
import {
  Type, Clapperboard, Video, Sparkles, ArrowUpCircle, List,
  Upload, FolderOpen, ShoppingBag, Search, Clock, Grid3X3, Image,
  Music, Mic, AudioLines, StickyNote, Smile, Square, Wand2,
  FileImage, Layers, Scissors as ScissorsIcon, ArrowUpFromLine,
  Film,
} from 'lucide-react';
import type { NodeType } from '@/stores/workflowStore';

interface AddNodePanelProps {
  onAddNode: (type: string) => void;
}

type Category =
  | 'all'
  | 'recent'
  | 'media'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'utilities'
  | 'basics';

const categories: { id: Category; icon: typeof Grid3X3; label: string }[] = [
  { id: 'recent', icon: Clock, label: 'Recent' },
  { id: 'all', icon: Grid3X3, label: 'All' },
  { id: 'media', icon: Upload, label: 'Media' },
  { id: 'image', icon: Image, label: 'Image' },
  { id: 'video', icon: Video, label: 'Video' },
  { id: 'audio', icon: Music, label: 'Audio' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'utilities', icon: Layers, label: 'Utilities' },
];

interface NodeEntry {
  type: NodeType | string;
  label: string;
  icon: typeof Type;
  color: string;
  category: Category[];
  enabled: boolean;
  isNew?: boolean;
}

const allNodes: NodeEntry[] = [
  // Text
  { type: 'textNode', label: 'Text', icon: Type, color: '#4ade80', category: ['text', 'all', 'basics'], enabled: true },
  { type: 'assistantNode', label: 'Assistant', icon: Sparkles, color: '#2dd4bf', category: ['text', 'all', 'basics'], enabled: true },

  // Image
  { type: 'imageGeneratorNode', label: 'Image Generator', icon: Clapperboard, color: '#a78bfa', category: ['image', 'all', 'basics'], enabled: true },
  { type: 'imageUpscalerNode', label: 'Image Upscaler', icon: ArrowUpCircle, color: '#fb923c', category: ['image', 'all', 'basics'], enabled: true },
  { type: 'imageEditor', label: 'Image Editor', icon: Wand2, color: '#f472b6', category: ['image', 'all'], enabled: false, isNew: true },
  { type: 'imageVariationsNode', label: 'Variations', icon: Layers, color: '#c084fc', category: ['image', 'all'], enabled: true, isNew: true },
  { type: 'imageToSvg', label: 'Image to SVG', icon: FileImage, color: '#fbbf24', category: ['image', 'all'], enabled: false, isNew: true },
  { type: 'svgGenerator', label: 'SVG Generator', icon: ScissorsIcon, color: '#34d399', category: ['image', 'all'], enabled: false, isNew: true },

  // Video
  { type: 'videoGeneratorNode', label: 'Video Generator', icon: Video, color: '#60a5fa', category: ['video', 'all', 'basics'], enabled: true },
  { type: 'videoCombiner', label: 'Video Combiner', icon: Film, color: '#818cf8', category: ['video', 'all'], enabled: false, isNew: true },
  { type: 'videoUpscaler', label: 'Video Upscaler', icon: ArrowUpFromLine, color: '#38bdf8', category: ['video', 'all'], enabled: false, isNew: true },

  // Audio
  { type: 'voiceover', label: 'Voiceover', icon: Mic, color: '#f97316', category: ['audio', 'all'], enabled: false, isNew: true },
  { type: 'soundEffects', label: 'Sound Effects', icon: AudioLines, color: '#a3e635', category: ['audio', 'all'], enabled: false, isNew: true },
  { type: 'musicGenerator', label: 'Music Generator', icon: Music, color: '#e879f9', category: ['audio', 'all'], enabled: false, isNew: true },

  // Media
  { type: 'uploadNode', label: 'Upload', icon: Upload, color: '#e2e8f0', category: ['media', 'all'], enabled: true },
  { type: 'assets', label: 'Assets', icon: FolderOpen, color: '#94a3b8', category: ['media', 'all'], enabled: false },
  { type: 'stock', label: 'Stock', icon: ShoppingBag, color: '#94a3b8', category: ['media', 'all'], enabled: false },

  // Utilities
  { type: 'listNode', label: 'List', icon: List, color: '#94a3b8', category: ['utilities', 'all', 'basics'], enabled: true },
  { type: 'stickyNote', label: 'Sticky Note', icon: StickyNote, color: '#fbbf24', category: ['utilities', 'all'], enabled: false, isNew: true },
  { type: 'stickers', label: 'Stickers', icon: Smile, color: '#fb923c', category: ['utilities', 'all'], enabled: false, isNew: true },
  { type: 'group', label: 'Group', icon: Square, color: '#64748b', category: ['utilities', 'all'], enabled: true, isNew: true },
];

/** BASICS section order (Image 2): Text, Image Generator, Video Generator, Assistant, Image Upscaler, List */
const BASICS_ORDER: string[] = [
  'textNode',
  'imageGeneratorNode',
  'videoGeneratorNode',
  'assistantNode',
  'imageUpscalerNode',
  'listNode',
];

const sectionOrder: { key: string; label: string; cats: Category[] }[] = [
  { key: 'basics', label: 'BASICS', cats: ['basics'] },
  { key: 'text', label: 'Text', cats: ['text'] },
  { key: 'image', label: 'Image', cats: ['image'] },
  { key: 'video', label: 'Video', cats: ['video'] },
  { key: 'audio', label: 'Audio', cats: ['audio'] },
  { key: 'media', label: 'Media', cats: ['media'] },
  { key: 'utilities', label: 'Utilities', cats: ['utilities'] },
];

const AddNodePanel = ({ onAddNode }: AddNodePanelProps) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const filteredNodes = allNodes.filter((n) => {
    const matchSearch = n.label.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      activeCategory === 'all' ||
      activeCategory === 'recent' ||
      n.category.includes(activeCategory);
    return matchSearch && matchCategory;
  });

  const renderNodeButton = (n: NodeEntry) => (
    <button
      key={n.type}
      onClick={() => n.enabled && onAddNode(n.type)}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors ${
        n.enabled
          ? 'text-foreground hover:bg-muted/80 cursor-pointer'
          : 'text-muted-foreground cursor-not-allowed opacity-50'
      }`}
      style={{ fontFamily: 'Inter, sans-serif' }}
      disabled={!n.enabled}
    >
      <n.icon size={16} style={{ color: n.enabled ? n.color : undefined }} />
      <span className="flex-1 text-left">{n.label}</span>
      {n.isNew && (
        <span className="text-[9px] font-mono-display uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-color)]/20 text-[var(--accent-color)]">
          New
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col max-h-[460px] min-h-0">
      {/* Search */}
      <div className="shrink-0 p-3 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="w-full bg-muted/50 border border-border rounded-lg pl-8 pr-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontFamily: 'Inter, sans-serif' }}
            autoFocus
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="shrink-0 px-3 pb-2 flex gap-0.5 overflow-x-auto scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono-display uppercase tracking-wider whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <cat.icon size={11} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Node list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 space-y-3">
        {activeCategory === 'all' || activeCategory === 'recent' ? (
          sectionOrder.map((section) => {
            let sectionNodes = filteredNodes.filter((n) =>
              n.category.some((c) => section.cats.includes(c))
            );
            if (section.key === 'basics') {
              sectionNodes = [...sectionNodes].sort(
                (a, b) =>
                  BASICS_ORDER.indexOf(String(a.type)) - BASICS_ORDER.indexOf(String(b.type))
              );
            }
            if (sectionNodes.length === 0) return null;
            return (
              <div key={section.key}>
                <span className="text-[9px] font-mono-display text-muted-foreground uppercase tracking-widest px-1">
                  {section.label}
                </span>
                <div className="mt-1 space-y-0.5">
                  {sectionNodes.map(renderNodeButton)}
                </div>
              </div>
            );
          })
        ) : (
          <div className="space-y-0.5">
            {filteredNodes.map(renderNodeButton)}
          </div>
        )}
      </div>

      {/* Bottom hints */}
      <div className="shrink-0 px-3 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground font-mono-display">
        <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border">N</kbd> Open</span>
        <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border">↕</kbd> Navigate</span>
        <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border">↵</kbd> Insert</span>
      </div>
    </div>
  );
};

export default AddNodePanel;
