import { memo, useMemo, useState, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import {
  Layers,
  Play,
  User,
  Wand2,
  Users,
  Smile,
  Scan,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import ImageCellOverlay from './ImageCellOverlay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextField } from '@/components/rich-text/RichTextField';
import {
  VARIATION_MODES,
  DEFAULT_VARIATION_MODE_ID,
  ASPECT_RATIOS,
  RESOLUTIONS,
  GRID_SIZES,
  PERSPECTIVE_CHOICES,
  resolvePerspectiveIds,
  normalizeResolution,
  type GridSizeId,
} from '@/lib/imageVariationsOptions';

const MODE_ICON: Record<string, LucideIcon> = {
  age: User,
  custom: Wand2,
  demographics: Users,
  expressions: Smile,
  reframe: Scan,
  storyboard: LayoutGrid,
};

const BUSINESS_COPY =
  'You can adjust or add new camera angles using Reframe mode. Open Perspectives in the bar to refine the shot for this stage of your project.';

type Stage3AngleLike = {
  id: string;
  src: string;
  resolution?: string;
  perspectiveId?: string;
  label?: string;
};

const ImageVariationsNode = memo(({ id, data, selected }: NodeProps) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const [perspectivesOpen, setPerspectivesOpen] = useState(false);

  const variationMode =
    (data.variationMode as string) && VARIATION_MODES.some((m) => m.id === (data.variationMode as string))
      ? (data.variationMode as string)
      : DEFAULT_VARIATION_MODE_ID;
  const aspect = (ASPECT_RATIOS as readonly string[]).includes(data.aspect as string)
    ? (data.aspect as string)
    : '16:9';
  const resolution = normalizeResolution(data.resolution);
  const gridSize = (GRID_SIZES as readonly string[]).includes(data.gridSize as string)
    ? (data.gridSize as GridSizeId)
    : '3x3';
  const perspectiveIds = useMemo(() => resolvePerspectiveIds(data.perspectives), [data.perspectives]);
  const splitImages = Boolean(data.splitImages);
  const localPrompt = String((data.prompt as string) ?? '');

  const modeLabel = VARIATION_MODES.find((m) => m.id === variationMode)?.label ?? 'Reframe';

  const lastAngles: Stage3AngleLike[] = Array.isArray((data as { lastAngles?: unknown })?.lastAngles)
    ? (((data as { lastAngles: unknown[] }).lastAngles as unknown[]) as Stage3AngleLike[]).filter(
        (a) => a && typeof a === 'object' && typeof (a as { src?: unknown }).src === 'string'
      )
    : [];

  const cols = gridSize === '1x1' ? 1 : gridSize === '2x2' ? 2 : 3;

  const runAndAccumulate = useCallback(() => {
    if (import.meta.env.DEV) {
      console.debug('[Scout][Stage3] run image variations', {
        nodeId: id,
        perspectiveCount: perspectiveIds.length,
        perspectiveIds,
        aspect,
        resolution,
        variationMode,
        gridSize,
      });
    }
    runFromNode(id);
  }, [id, runFromNode, perspectiveIds, aspect, resolution, variationMode, gridSize]);

  const togglePerspective = useCallback(
    (pid: string) => {
      const next = new Set(perspectiveIds);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      updateNodeData(id, { perspectives: [...next] });
    },
    [id, perspectiveIds, updateNodeData]
  );

  return (
    <FlowNodeResizeRoot
      minWidth={320}
      minHeight={240}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="imageVariationsNode" labelPrefix="Variations" icon={<Layers size={12} />} />
      <div
        className={`glass-node w-full relative flex flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          variant="multiImage"
          onRun={runAndAccumulate}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          connectMenuItems={connectMenuItems}
          onOpenPerspectives={() => setPerspectivesOpen(true)}
          onOpenPreferences={() => {
            /* Aspect / resolution / grid live in footer dropdowns */
          }}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div
            className={`rounded-xl border-2 transition-colors flex flex-1 flex-col min-h-0 ${
              contentFocused
                ? 'border-[hsl(217_91%_60%)] shadow-[0_0_0_3px_hsla(217,91%,60%,0.15)]'
                : 'border-transparent'
            }`}
          >
            <div className="relative rounded-[10px] overflow-hidden bg-[var(--node-inner-deep)] flex flex-col flex-1 min-h-0">
              <div className="flex shrink-0 flex-col gap-1 px-3 py-2 text-[10px] text-[var(--text-muted)]">
                <span>
                  Stage 3 · {perspectiveIds.length} perspective{perspectiveIds.length === 1 ? '' : 's'} · wire image/text
                  in
                </span>
                <p className="text-[9px] leading-snug opacity-90">{BUSINESS_COPY}</p>
              </div>

              {lastAngles.length > 0 ? (
                <div
                  className={`${NODE_INTERACTIVE_CLASS} custom-scrollbar grid min-h-0 flex-1 gap-2 overflow-auto p-3`}
                  style={{ gridTemplateColumns: `repeat(${Math.min(cols, Math.max(1, lastAngles.length))}, 1fr)` }}
                >
                  {lastAngles.map((a, i) => (
                    <ImageCellOverlay
                      key={a.id ?? `${i}`}
                      src={a.src}
                      label={a.label}
                      index={i}
                      nodeId={id}
                      resolution={a.resolution ?? resolution}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-6 text-center min-h-[100px]">
                  <div className="rounded-2xl bg-[var(--node-inner-mid)] p-4 text-[var(--node-control-muted)]">
                    <Layers size={40} strokeWidth={1.25} />
                  </div>
                  <p className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">
                    Explore new possibilities
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)]">Generate variations from your images</p>
                </div>
              )}

              <div className="px-3 pb-2" onPointerDown={(e) => e.stopPropagation()}>
                <RichTextField
                  value={localPrompt}
                  onChange={(html) => updateNodeData(id, { prompt: html })}
                  placeholder="Optional notes (merges with wired text from edges)…"
                  excludeNodeId={id}
                  toolbarVariant="top"
                  className="max-h-[100px]"
                  editorContentClassName="w-full min-h-[36px] max-h-[80px] overflow-y-auto text-[11px] text-[var(--text-primary)] outline-none prose prose-invert prose-sm max-w-none"
                />
              </div>

              <div className="absolute right-3 top-28 z-10 rounded bg-[var(--node-badge-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--node-overlay-text)]">
                {aspect} · {resolution} · {gridSize}
              </div>

              <div
                className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 flex-col gap-1.5 px-2.5 py-2 border-t border-[var(--node-panel-border)] bg-[var(--node-control-bg)]`}
              >
                <div className="flex flex-col gap-1.5 w-fit">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[10px] text-[var(--node-control-text)] max-w-[120px] truncate hover:bg-[var(--node-action-bar-hover-bg)]"
                        >
                          {(() => {
                            const Icon = MODE_ICON[variationMode] ?? Scan;
                            return <Icon size={12} className="shrink-0 text-[var(--node-control-muted)]" />;
                          })()}
                          <span className="truncate">{modeLabel}</span>
                          <span className="text-[var(--node-control-muted)]">▼</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="node-canvas-dropdown text-xs max-h-56 overflow-y-auto min-w-[200px]">
                        {VARIATION_MODES.map(({ id: mid, label }) => {
                          const Icon = MODE_ICON[mid] ?? Scan;
                          return (
                            <DropdownMenuItem
                              key={mid}
                              className={variationMode === mid ? 'bg-muted/60' : ''}
                              onClick={() => updateNodeData(id, { variationMode: mid })}
                            >
                              <Icon size={14} className="mr-2 text-[var(--node-control-muted)] shrink-0" />
                              {label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[11px] text-[var(--node-control-text)] min-w-[2.5rem] justify-center hover:bg-[var(--node-action-bar-hover-bg)]"
                        >
                          {aspect}
                          <span className="text-[var(--node-control-muted)] text-[9px]">▼</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="node-canvas-dropdown text-xs">
                        {ASPECT_RATIOS.map((a) => (
                          <DropdownMenuItem key={a} onClick={() => updateNodeData(id, { aspect: a })}>
                            {a}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[11px] text-[var(--node-control-text)] min-w-[2.25rem] justify-center hover:bg-[var(--node-action-bar-hover-bg)]"
                        >
                          {resolution}
                          <span className="text-[var(--node-control-muted)] text-[9px]">▼</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="node-canvas-dropdown text-xs">
                        {RESOLUTIONS.map((r) => (
                          <DropdownMenuItem key={r} onClick={() => updateNodeData(id, { resolution: r })}>
                            {r}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[11px] text-[var(--node-control-text)] min-w-[2.5rem] justify-center hover:bg-[var(--node-action-bar-hover-bg)]"
                        >
                          {gridSize}
                          <span className="text-[var(--node-control-muted)] text-[9px]">▼</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="node-canvas-dropdown text-xs">
                        {GRID_SIZES.map((g) => (
                          <DropdownMenuItem key={g} onClick={() => updateNodeData(id, { gridSize: g })}>
                            {g}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Popover open={perspectivesOpen} onOpenChange={setPerspectivesOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[10px] text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                        >
                          {perspectiveIds.length} Selected
                          <span className="text-[var(--node-control-muted)]">▼</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="node-canvas-popover w-[240px] p-2"
                        align="start"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <p className="text-[10px] font-mono-display text-[var(--node-popover-muted)] uppercase mb-2 px-1">
                          Perspectives
                        </p>
                        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-0.5">
                          {PERSPECTIVE_CHOICES.map(({ id: pid, label }) => {
                            const checked = perspectiveIds.includes(pid);
                            return (
                              <label
                                key={pid}
                                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-left text-[12px] text-[var(--node-popover-text)] transition-colors ${
                                  checked ? 'bg-[var(--muted)]/50' : 'hover:bg-[var(--muted)]/30'
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => togglePerspective(pid)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="font-medium">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                      <span className="text-[10px] text-[var(--node-control-muted)]">Split images</span>
                      <div
                        role="switch"
                        aria-checked={splitImages}
                        className={`w-7 h-3.5 rounded-full transition-colors ${splitImages ? 'bg-blue-500' : 'bg-[var(--node-inner-mid)]'} relative border border-[var(--node-control-border)]`}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateNodeData(id, { splitImages: !splitImages });
                        }}
                      >
                        <div
                          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${splitImages ? 'translate-x-3.5' : 'translate-x-0.5'}`}
                        />
                      </div>
                    </label>

                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-[var(--accent-color)] text-[var(--node-on-accent)] flex items-center justify-center hover:bg-[var(--accent-hover)] shrink-0"
                      title="Run"
                      onClick={(e) => {
                        e.stopPropagation();
                        runAndAccumulate();
                      }}
                    >
                      <Play size={18} className="ml-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

ImageVariationsNode.displayName = 'ImageVariationsNode';
export default ImageVariationsNode;
