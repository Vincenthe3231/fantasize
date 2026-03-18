import { ZoomIn, ZoomOut, Maximize2, Map, Zap } from 'lucide-react';
import { useReactFlow, useViewport } from 'reactflow';
import { useWorkflowStore } from '@/stores/workflowStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const BottomBar = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const settings = useWorkflowStore((s) => s.settings);
  const updateSettings = useWorkflowStore((s) => s.updateSettings);
  const pct = Math.round(zoom * 100);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl glass-toolbar px-2 py-1.5">
      <span className="text-[11px] text-[var(--text-muted)] font-mono-display px-2 hidden sm:inline">
        {settings.performanceMode ? 'Perf' : 'Std'}
      </span>
      {settings.performanceMode && <Zap size={12} className="text-amber-400/80" aria-hidden />}

      <button
        type="button"
        onClick={() => updateSettings({ showMinimap: !settings.showMinimap })}
        className={`p-2 rounded-lg transition-colors ${
          settings.showMinimap ? 'bg-white/15 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-white/10'
        }`}
        title="Toggle minimap"
      >
        <Map size={16} />
      </button>

      <div className="w-px h-5 bg-white/10" />

      <button
        type="button"
        onClick={() => zoomOut({ duration: 200 })}
        className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]"
        title="Zoom out"
      >
        <ZoomOut size={16} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="min-w-[52px] text-center text-[12px] font-mono-display text-[var(--text-primary)] tabular-nums px-2 py-1 rounded-lg hover:bg-white/10"
          >
            {pct}%
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#1a1a1e] border-white/10 text-white/90 text-xs">
          <DropdownMenuItem onClick={() => fitView({ padding: 0.25, duration: 300 })}>Fit to view</DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomIn({ duration: 200 })}>Zoom in</DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomOut({ duration: 200 })}>Zoom out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => zoomIn({ duration: 200 })}
        className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]"
        title="Zoom in"
      >
        <ZoomIn size={16} />
      </button>

      <button
        type="button"
        onClick={() => fitView({ padding: 0.25, duration: 300 })}
        className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]"
        title="Fit view"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
};

export default BottomBar;
