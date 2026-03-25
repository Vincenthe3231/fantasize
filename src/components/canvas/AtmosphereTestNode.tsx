import { memo, useMemo, useCallback, useRef } from 'react';
import { type NodeProps } from 'reactflow';
import { Cloud, Download, ImageIcon } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import { notifyInfo, notifySuccess } from '@/lib/systemNotify';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import { RichTextField } from '@/components/rich-text/RichTextField';
import { richTextToPlainForScout } from '@/lib/richTextForScout';
import type { LightingResult } from './LightingScenarioNode';
import type { ScoutFinalDeliverable } from '@/lib/scoutPipeline';

const AtmosphereTestNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const finalizeScoutDeliverable = useWorkflowStore((s) => s.finalizeScoutDeliverable);
  const scoutPipeline = useWorkflowStore((s) => s.scoutPipeline);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);
  const refInputRef = useRef<HTMLInputElement>(null);

  const moodText = String((data as { moodText?: string }).moodText ?? '');
  const referenceUrl = String((data as { referenceUrl?: string }).referenceUrl ?? '');
  const textResults = ((data as { textResults?: { id: string; label: string; src: string }[] }).textResults ??
    []) as { id: string; label: string; src: string }[];
  const referenceResults = ((data as { referenceResults?: { id: string; label: string; src: string }[] })
    .referenceResults ?? []) as { id: string; label: string; src: string }[];
  const selectedBranch = (data as { selectedBranch?: 'text' | 'reference' | null }).selectedBranch ?? null;
  const selectedIndex = (data as { selectedIndex?: number | null }).selectedIndex ?? null;

  const lightingNode = useMemo(() => {
    const inc = edges.find((e) => e.target === id && nodes.find((n) => n.id === e.source)?.type === 'lightingScenarioNode');
    return inc ? nodes.find((n) => n.id === inc.source) : undefined;
  }, [edges, nodes, id]);

  const lightingAccumulated: LightingResult[] = useMemo(() => {
    const raw = (lightingNode?.data as { accumulatedLighting?: LightingResult[] })?.accumulatedLighting;
    return Array.isArray(raw) ? raw : [];
  }, [lightingNode]);

  const setDressingNode = useMemo(() => nodes.find((n) => n.type === 'setDressingNode'), [nodes]);
  const selectedShotNode = useMemo(() => nodes.find((n) => n.type === 'selectedShotNode'), [nodes]);

  const setMood = useCallback(
    (v: string) => updateNodeData(id, { moodText: v }),
    [id, updateNodeData]
  );

  const onRefFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f?.type.startsWith('image/')) return;
      updateNodeData(id, { referenceUrl: URL.createObjectURL(f) });
    },
    [id, updateNodeData]
  );

  const runTextBatch = useCallback(() => {
    if (!richTextToPlainForScout(moodText).trim()) {
      notifyInfo('Atmosphere test', 'Enter a mood / colour description for the text pipeline.');
      return;
    }
    runFromNode(id, { atmosphereBranch: 'text' });
  }, [moodText, id, runFromNode]);

  const runReferenceBatch = useCallback(() => {
    if (!referenceUrl.trim()) {
      notifyInfo('Atmosphere test', 'Upload a look-reference still for the reference pipeline.');
      return;
    }
    runFromNode(id, { atmosphereBranch: 'reference' });
  }, [referenceUrl, id, runFromNode]);

  const pickCell = useCallback(
    (branch: 'text' | 'reference', index: number) => {
      updateNodeData(id, { selectedBranch: branch, selectedIndex: index });
    },
    [id, updateNodeData]
  );

  const finalize = useCallback(() => {
    if (selectedBranch == null || selectedIndex == null) {
      notifyInfo('Atmosphere test', 'Select one atmosphere result (text or reference column).');
      return;
    }
    const list = selectedBranch === 'text' ? textResults : referenceResults;
    const picked = list[selectedIndex];
    if (!picked) return;

    const setUrl = String((setDressingNode?.data as { previewUrl?: string })?.previewUrl ?? MOCK.setDressing);
    const shotUrl = String((selectedShotNode?.data as { mediaUrl?: string })?.mediaUrl ?? MOCK.selectedShot);
    const lightingLabel =
      lightingAccumulated[selectedIndex]?.label ?? picked.label ?? 'Lighting';

    const payload: ScoutFinalDeliverable = {
      setDressingUrl: setUrl,
      selectedShotUrl: shotUrl,
      lightingLabel,
      atmosphereBranch: selectedBranch,
      atmosphereLabel: picked.label,
      atmosphereImageUrl: picked.src,
      exportedAt: Date.now(),
    };
    finalizeScoutDeliverable(payload);
    notifySuccess('Atmosphere test', 'Deliverable finalized in pipeline state.');
  }, [
    selectedBranch,
    selectedIndex,
    textResults,
    referenceResults,
    setDressingNode,
    selectedShotNode,
    lightingAccumulated,
    finalizeScoutDeliverable,
  ]);

  const exportBoard = useCallback(() => {
    if (!scoutPipeline.finalDeliverable) {
      notifyInfo('Atmosphere test', 'Finalize a direction first.');
      return;
    }
    notifySuccess('Atmosphere test', 'Export package ready (mock download).');
  }, [scoutPipeline.finalDeliverable]);

  return (
    <FlowNodeResizeRoot
      minWidth={380}
      minHeight={240}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="atmosphereTestNode" labelPrefix="Atmosphere test" icon={<Cloud size={12} />} />
      <div
        className={`glass-node-output glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          variant="multiImage"
          onRun={() => runFromNode(id, { atmosphereBranch: 'text' })}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          showDownload
          onDownload={exportBoard}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div className="grid grid-cols-2 gap-2 border-b border-border p-3">
            <div className="space-y-2">
              <div className="text-[10px] font-mono-display uppercase text-[var(--text-muted)]">Text pipeline</div>
              <div className="w-full rounded-lg border border-[var(--node-control-border)] bg-[var(--node-inner-mid)] p-1">
                <RichTextField
                  value={moodText}
                  onChange={setMood}
                  placeholder="Mood & colour tone (batched across lighting variants)…"
                  excludeNodeId={id}
                  toolbarVariant="top"
                  className="max-h-[140px]"
                  editorContentClassName="w-full min-h-[56px] max-h-[120px] overflow-y-auto text-[11px] text-[var(--text-primary)] outline-none prose prose-invert prose-sm max-w-none"
                  editorProps={{
                    handleDOMEvents: {
                      mousedown: (_, e) => {
                        e.stopPropagation();
                        return false;
                      },
                      keydown: (_, e) => {
                        e.stopPropagation();
                        return false;
                      },
                    },
                  }}
                />
              </div>
              <button
                type="button"
                className={`${NODE_INTERACTIVE_CLASS} w-full rounded-lg bg-[var(--accent-color)]/20 py-1.5 text-[11px] font-mono-display uppercase text-[var(--accent-color)]`}
                onClick={runTextBatch}
              >
                Run text batch
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-mono-display uppercase text-[var(--text-muted)]">Reference pipeline</div>
              <div
                className={`${NODE_INTERACTIVE_CLASS} flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--node-control-border)] p-2`}
                onClick={() => refInputRef.current?.click()}
              >
                {referenceUrl ? (
                  <img src={referenceUrl} alt="" className="max-h-20 rounded object-contain" />
                ) : (
                  <>
                    <ImageIcon size={20} className="text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)]">Upload look reference</span>
                  </>
                )}
              </div>
              <input ref={refInputRef} type="file" accept="image/*" className="sr-only" onChange={onRefFile} />
              <button
                type="button"
                className={`${NODE_INTERACTIVE_CLASS} w-full rounded-lg bg-violet-500/20 py-1.5 text-[11px] font-mono-display uppercase text-violet-300`}
                onClick={runReferenceBatch}
              >
                Run reference batch
              </button>
            </div>
          </div>

          <div className="grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto p-3">
            <div>
              <div className="mb-1 text-[9px] uppercase text-[var(--text-muted)]">Text-driven</div>
              <div className="grid grid-cols-2 gap-1.5">
                {textResults.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`rounded-md ring-2 ring-transparent ${selectedBranch === 'text' && selectedIndex === i ? 'ring-[var(--accent-color)]' : ''}`}
                    onClick={() => pickCell('text', i)}
                  >
                    <ImageCellOverlay src={r.src} label={r.label} resolution="4K" index={i} nodeId={id} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[9px] uppercase text-[var(--text-muted)]">Reference-driven</div>
              <div className="grid grid-cols-2 gap-1.5">
                {referenceResults.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`rounded-md ring-2 ring-transparent ${selectedBranch === 'reference' && selectedIndex === i ? 'ring-violet-400' : ''}`}
                    onClick={() => pickCell('reference', i)}
                  >
                    <ImageCellOverlay src={r.src} label={r.label} resolution="4K" index={i} nodeId={id} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {scoutPipeline.finalDeliverable && (
            <div className="mx-3 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-[10px] text-emerald-100">
              <div className="font-mono-display uppercase tracking-wider text-emerald-300">Final deliverable</div>
              <div className="mt-1 grid gap-0.5 text-[9px] opacity-90">
                <div>Branch: {scoutPipeline.finalDeliverable.atmosphereBranch}</div>
                <div>Atmosphere: {scoutPipeline.finalDeliverable.atmosphereLabel}</div>
                <div>Lighting: {scoutPipeline.finalDeliverable.lightingLabel}</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={finalize}
              className={`${NODE_INTERACTIVE_CLASS} flex items-center gap-1.5 rounded-lg bg-[var(--accent-color)]/30 px-3 py-1.5 text-[11px] font-mono-display uppercase tracking-wider text-[var(--accent-color)]`}
            >
              Finalize direction
            </button>
            <button
              type="button"
              onClick={exportBoard}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--accent-color)]/30 px-3 py-1.5 text-[11px] font-mono-display uppercase tracking-wider text-[var(--accent-color)]"
            >
              <Download size={12} />
              Export
            </button>
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

AtmosphereTestNode.displayName = 'AtmosphereTestNode';
export default AtmosphereTestNode;
