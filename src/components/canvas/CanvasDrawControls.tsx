import { memo } from 'react';
import { Pen, Eraser } from 'lucide-react';
import { useWorkflowStore, type DrawSubTool } from '@/stores/workflowStore';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

const SWATCHES = ['#ffffff', '#22d3ee', '#a855f7', '#f43f5e', '#eab308', '#22c55e', '#3b82f6', '#0f172a'];

export const CanvasDrawControls = memo(function CanvasDrawControls() {
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const drawColor = useWorkflowStore((s) => s.drawColor);
  const drawWidthPx = useWorkflowStore((s) => s.drawWidthPx);
  const drawSubTool = useWorkflowStore((s) => s.drawSubTool);
  const setDrawColor = useWorkflowStore((s) => s.setDrawColor);
  const setDrawWidthPx = useWorkflowStore((s) => s.setDrawWidthPx);
  const setDrawSubTool = useWorkflowStore((s) => s.setDrawSubTool);

  if (selectedTool !== 'draw') return null;

  const pickSub = (sub: DrawSubTool) => () => setDrawSubTool(sub);

  return (
    <div
      data-vf-no-draw
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[60] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#1a1a1e]/92 px-3 py-2 shadow-xl backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
    >
      <div className="flex items-center gap-0.5 rounded-full bg-black/25 p-0.5">
        <button
          type="button"
          onClick={pickSub('pencil')}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
            drawSubTool === 'pencil'
              ? 'bg-[var(--accent-color)]/25 text-[var(--accent-color)]'
              : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
          )}
          aria-pressed={drawSubTool === 'pencil'}
          aria-label="Pencil"
        >
          <Pen className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={pickSub('eraser')}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
            drawSubTool === 'eraser'
              ? 'bg-[var(--accent-color)]/25 text-[var(--accent-color)]'
              : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
          )}
          aria-pressed={drawSubTool === 'eraser'}
          aria-label="Eraser"
        >
          <Eraser className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>

      <div className="h-7 w-px shrink-0 bg-white/10" aria-hidden />

      <div className="flex items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                'h-6 w-6 shrink-0 rounded-full border-2 transition-transform hover:scale-110',
                drawColor.toLowerCase() === c.toLowerCase()
                  ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/50'
                  : 'border-white/20'
              )}
              style={{ backgroundColor: c }}
              onClick={() => setDrawColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
          <span className="sr-only">Custom color</span>
          <input
            type="color"
            value={drawColor.startsWith('#') && drawColor.length >= 7 ? drawColor.slice(0, 7) : '#22d3ee'}
            onChange={(e) => setDrawColor(e.target.value)}
            className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
          />
          <span
            className="pointer-events-none h-5 w-5 rounded-full border border-white/20"
            style={{
              backgroundColor: drawColor.startsWith('#') ? drawColor : '#22d3ee',
            }}
          />
        </label>
      </div>

      <div className="h-7 w-px shrink-0 bg-white/10" aria-hidden />

      <div className="flex min-w-[120px] max-w-[40vw] flex-col gap-1 px-1">
        <span className="text-[10px] font-mono-display uppercase tracking-wider text-muted-foreground">
          Size {Math.round(drawWidthPx)}px
        </span>
        <Slider
          value={[drawWidthPx]}
          min={1}
          max={24}
          step={0.5}
          onValueChange={(v) => setDrawWidthPx(v[0] ?? 2.25)}
          className="py-1"
        />
      </div>
    </div>
  );
});

CanvasDrawControls.displayName = 'CanvasDrawControls';
