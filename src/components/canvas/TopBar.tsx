import { useState } from 'react';
import { ChevronRight, Share2, LayoutTemplate } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import TemplateGallery from './TemplateGallery';

const TopBar = () => {
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass-toolbar">
          <span className="text-[12px] text-[var(--text-muted)] font-mono-display">Project</span>
          <ChevronRight size={12} className="text-[var(--text-muted)] opacity-50" />
          <span className="text-[12px] text-[var(--text-primary)] font-mono-display">Virtual Production Scout</span>
          <ChevronRight size={12} className="text-[var(--text-muted)] opacity-50" />
          <span className="text-[12px] text-[var(--text-muted)] font-mono-display">Space</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Templates */}
          <button
            onClick={() => setTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-toolbar text-[12px] font-mono-display text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <LayoutTemplate size={13} />
            Templates
          </button>

          {/* Avatar stack */}
          <div className="flex -space-x-2">
            <Avatar className="h-7 w-7 border-2 border-[var(--canvas-bg)]">
              <AvatarFallback className="bg-[var(--accent-color)] text-[10px] font-mono-display text-white">CD</AvatarFallback>
            </Avatar>
            <Avatar className="h-7 w-7 border-2 border-[var(--canvas-bg)]">
              <AvatarFallback className="bg-emerald-600 text-[10px] font-mono-display text-white">PD</AvatarFallback>
            </Avatar>
            <Avatar className="h-7 w-7 border-2 border-[var(--canvas-bg)]">
              <AvatarFallback className="bg-amber-600 text-[10px] font-mono-display text-white">DP</AvatarFallback>
            </Avatar>
          </div>

          <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--accent-color)] text-white text-[12px] font-mono-display hover:bg-[var(--accent-hover)] transition-colors">
            <Share2 size={13} />
            Share
          </button>
        </div>
      </div>

      <TemplateGallery open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </>
  );
};

export default TopBar;
