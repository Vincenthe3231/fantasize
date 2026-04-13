import { memo, useMemo, useCallback, useState } from 'react';
import { type NodeProps } from 'reactflow';
import { RefreshCw, Grid3X3 } from 'lucide-react';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextField } from '@/components/rich-text/RichTextField';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ASPECT_RATIOS,
  PERSPECTIVE_CHOICES,
  RESOLUTIONS,
  resolvePerspectiveIds,
  normalizeResolution,
  getPerspectiveLabel,
} from '@/lib/imageVariationsOptions';

const CAMERA_SRC = [MOCK.camera1, MOCK.camera2, MOCK.camera3, MOCK.camera4];

type Panel = 'none' | 'perspectives' | 'preferences';

const AngleVariationsNode = memo(({ id, data, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const gridLayout = useWorkflowStore((s) => s.nodeGridLayouts[id] || '2x2');
  const toggleGrid = useWorkflowStore((s) => s.toggleGridLayout);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const [panel, setPanel] = useState<Panel>('none');

  /** Persisted on the node for IndexedDB + cloud save (see useSpaceLocalPersistence snapshot). */
  const splitImages = Boolean(data.splitImages);
  const selectedCount = Math.min(4, Math.max(1, Number(data.selectedCount) || 4));
  const perspectiveIds = useMemo(() => resolvePerspectiveIds(data.perspectives), [data.perspectives]);
  const aspect = (ASPECT_RATIOS as readonly string[]).includes(String(data.angleAspectRatio))
    ? String(data.angleAspectRatio)
    : '16:9';
  const resolution = normalizeResolution(data.angleResolution);
  const localPrompt = String((data.prompt as string) ?? '');

  const runAndAccumulate = useCallback(() => {
    if (import.meta.env.DEV) {
      console.debug('[Scout][Stage3] run angle variations', {
        nodeId: id,
        perspectiveCount: perspectiveIds.length,
        perspectiveIds,
        aspect,
        resolution,
      });
    }
    runFromNode(id);
  }, [id, runFromNode, perspectiveIds, aspect, resolution]);

  const togglePerspective = useCallback(
    (pid: string) => {
      const next = new Set(perspectiveIds);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      updateNodeData(id, { perspectives: [...next] });
    },
    [id, perspectiveIds, updateNodeData]
  );

  const cols = gridLayout === '1x1' ? 1 : gridLayout === '2x2' ? 2 : 3;
  const cellCount = cols * cols;
  const cells = Array.from({ length: Math.min(cellCount, 4) }, (_, i) => i);

  return (
    <FlowNodeResizeRoot
      minWidth={280}
      minHeight={160}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="angleVariationsNode" labelPrefix="Angle variations" icon={<Grid3X3 size={12} />} />
      <div
        className={`glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          hidden={Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden)}
          variant="multiImage"
          runBusy={isRunning}
          onRun={runAndAccumulate}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          showDownload
          onGridToggle={() => toggleGrid(id)}
          connectMenuItems={connectMenuItems}
          onOpenPerspectives={() => setPanel((p) => (p === 'perspectives' ? 'none' : 'perspectives'))}
          onOpenPreferences={() => setPanel((p) => (p === 'preferences' ? 'none' : 'preferences'))}
        />

        {panel !== 'none' && (
          <ScrollArea
            className="node-canvas-dropdown absolute left-1/2 top-9 z-[60] max-h-64 w-[min(280px,calc(100%-1rem))] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[hsl(var(--popover))] p-0 text-[11px] text-[hsl(var(--popover-foreground))] shadow-xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {panel === 'perspectives' && (
              <div className="space-y-2 p-3">
                <div className="font-mono-display text-[10px] uppercase tracking-wider text-muted-foreground">
                  Perspectives ({perspectiveIds.length} selected)
                </div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1.5 pr-2">
                  {PERSPECTIVE_CHOICES.map(({ id: pid, label }) => (
                    <label key={pid} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50">
                      <Checkbox
                        checked={perspectiveIds.includes(pid)}
                        onCheckedChange={() => togglePerspective(pid)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  </div>
                </ScrollArea>
                <button
                  type="button"
                  className="mt-2 w-full rounded border border-border py-1 text-[10px] hover:bg-muted/50"
                  onClick={() => setPanel('none')}
                >
                  Done
                </button>
              </div>
            )}
            {panel === 'preferences' && (
              <div className="space-y-3 p-3">
                <div className="font-mono-display text-[10px] uppercase tracking-wider text-muted-foreground">
                  Output preferences
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Aspect</label>
                  <select
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
                    value={aspect}
                    onChange={(e) => updateNodeData(id, { angleAspectRatio: e.target.value })}
                  >
                    {ASPECT_RATIOS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Resolution label</label>
                  <select
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
                    value={resolution}
                    onChange={(e) => updateNodeData(id, { angleResolution: e.target.value })}
                  >
                    {RESOLUTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="w-full rounded border border-border py-1 text-[10px] hover:bg-muted/50"
                  onClick={() => setPanel('none')}
                >
                  Done
                </button>
              </div>
            )}
          </ScrollArea>
        )}

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-col gap-1 px-3 py-2 text-[10px] text-[var(--text-muted)]">
              <span>
                variations · {perspectiveIds.length} perspective{perspectiveIds.length === 1 ? '' : 's'} · wire text/image
                in
              </span>
              <p className="text-[9px] leading-snug opacity-90">
                Open Perspectives in the bar to choose camera angles. Preferences sets aspect for generation. Connect Set
                dressing (or image sources) for the reference frame.
              </p>
            </div>

            <div className="px-3 pb-2" onPointerDown={(e) => e.stopPropagation()}>
              <RichTextField
                value={localPrompt}
                onChange={(html) => updateNodeData(id, { prompt: html })}
                placeholder="Optional notes for this node (also merges with wired text from edges)…"
                excludeNodeId={id}
                toolbarVariant="floating-above"
                className="max-h-[100px]"
                editorContentClassName="w-full min-h-[36px] max-h-[80px] text-[11px] text-[var(--text-primary)] outline-none prose prose-invert prose-sm max-w-none"
              />
            </div>

            <div className="absolute right-3 top-24 z-10 rounded bg-[var(--node-badge-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--node-overlay-text)]">
              {aspect} · {resolution}
            </div>

            <ScrollArea className="nowheel min-h-0 flex-1">
              <div className="grid min-h-0 gap-2 p-3 pr-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {cells.map((i) => (
                  <ImageCellOverlay
                    key={i}
                    src={CAMERA_SRC[i] ?? MOCK.camera1}
                    index={i}
                    nodeId={id}
                    resolution="4K"
                  />
                ))}
              </div>
            </ScrollArea>

            <div
              className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 items-center justify-between border-t border-border px-3 py-2 text-[10px]`}
            >
              <div className="flex flex-wrap items-center gap-2 text-[var(--node-control-muted)]">
                <span className="text-[var(--accent-color)]">Reframe</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5">{aspect}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5">{resolution}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5">{gridLayout}</span>
                {perspectiveIds.slice(0, 3).map((pid) => (
                  <span key={pid} className="rounded bg-white/5 px-1 py-0.5 text-[9px]">
                    {getPerspectiveLabel(pid) ?? pid}
                  </span>
                ))}
                {perspectiveIds.length > 3 ? <span className="text-[9px]">+{perspectiveIds.length - 3}</span> : null}
              </div>
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <span>{selectedCount} Selected</span>
                <label className="flex cursor-pointer items-center gap-1">
                  <span className="text-[9px]">Split</span>
                  <div
                    role="switch"
                    aria-checked={splitImages}
                    className={`relative h-3.5 w-7 cursor-pointer rounded-full transition-colors ${splitImages ? 'bg-blue-500' : 'bg-white/20'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateNodeData(id, { splitImages: !splitImages });
                    }}
                  >
                    <div
                      className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${splitImages ? 'translate-x-3.5' : 'translate-x-0.5'}`}
                    />
                  </div>
                </label>
                <button type="button" className="rounded p-1 transition-colors hover:bg-white/10">
                  <RefreshCw size={10} />
                </button>
              </div>
            </div>
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

AngleVariationsNode.displayName = 'AngleVariationsNode';
export default AngleVariationsNode;
