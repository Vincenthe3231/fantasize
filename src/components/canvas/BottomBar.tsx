import { ZoomIn, ZoomOut, Maximize2, Map, Zap } from 'lucide-react';
import { useReactFlow, useStore } from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import { useWorkflowStore } from '@/stores/workflowStore';
import { DEFAULT_FIT_VIEW_OPTIONS } from '@/lib/canvasViewport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipWrap } from '@/components/ui/tooltip';

const BottomBar = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  /** Zoom only — `useViewport()` subscribes to x/y and re-renders the whole bar every pan frame. */
  const zoom = useStore((s) => s.transform[2]);
  const { performanceMode, showMinimap } = useWorkflowStore(
    useShallow((s) => ({
      performanceMode: s.settings.performanceMode,
      showMinimap: s.settings.showMinimap,
    }))
  );
  const updateSettings = useWorkflowStore((s) => s.updateSettings);
  const pct = Math.round(zoom * 100);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl glass-toolbar px-2 py-1.5">
      <span className="text-[11px] text-muted-foreground font-mono-display px-2 hidden sm:inline">
        {performanceMode ? 'Perf' : 'Std'}
      </span>
      {performanceMode && <Zap size={12} className="text-amber-400/80" aria-hidden />}

      <TooltipWrap label="Toggle minimap" side="top" contentClassName="z-[200]">
        <button
          type="button"
          onClick={() => updateSettings({ showMinimap: !showMinimap })}
          className={`p-2 rounded-lg transition-colors ${
            showMinimap ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Map size={16} />
        </button>
      </TooltipWrap>

      <div className="w-px h-5 bg-border" />

      <TooltipWrap label="Zoom out" side="top" contentClassName="z-[200]">
        <button
          type="button"
          onClick={() => zoomOut({ duration: 200 })}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        >
          <ZoomOut size={16} />
        </button>
      </TooltipWrap>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="min-w-[52px] text-center text-[12px] font-mono-display text-foreground tabular-nums px-2 py-1 rounded-lg hover:bg-muted/80"
          >
            {pct}%
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-popover text-popover-foreground border-border text-xs">
          <DropdownMenuItem onClick={() => fitView(DEFAULT_FIT_VIEW_OPTIONS)}>Fit to view</DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomIn({ duration: 200 })}>Zoom in</DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomOut({ duration: 200 })}>Zoom out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipWrap label="Zoom in" side="top" contentClassName="z-[200]">
        <button
          type="button"
          onClick={() => zoomIn({ duration: 200 })}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        >
          <ZoomIn size={16} />
        </button>
      </TooltipWrap>

      <TooltipWrap label="Fit view" side="top" contentClassName="z-[200]">
        <button
          type="button"
          onClick={() => fitView(DEFAULT_FIT_VIEW_OPTIONS)}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        >
          <Maximize2 size={16} />
        </button>
      </TooltipWrap>
    </div>
  );
};

export default BottomBar;
