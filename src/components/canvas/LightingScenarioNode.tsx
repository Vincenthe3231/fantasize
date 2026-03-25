import { memo, useMemo, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import { Sun, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import { notifyInfo } from '@/lib/systemNotify';

export type LightingResult = { id: string; label: string; src: string };

const LightingScenarioNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const scoutPipeline = useWorkflowStore((s) => s.scoutPipeline);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const lightingStrings: string[] = Array.isArray((data as { lightingStrings?: string[] })?.lightingStrings)
    ? ((data as { lightingStrings: string[] }).lightingStrings as string[])
    : ['Golden hour', 'Studio', 'Natural light'];
  const accumulatedLighting: LightingResult[] = Array.isArray(
    (data as { accumulatedLighting?: LightingResult[] })?.accumulatedLighting
  )
    ? ((data as { accumulatedLighting: LightingResult[] }).accumulatedLighting as LightingResult[])
    : [];
  const lastBatchResults: LightingResult[] = Array.isArray(
    (data as { lastBatchResults?: LightingResult[] })?.lastBatchResults
  )
    ? ((data as { lastBatchResults: LightingResult[] }).lastBatchResults as LightingResult[])
    : [];

  const setStrings = useCallback(
    (next: string[]) => {
      updateNodeData(id, { lightingStrings: next });
    },
    [id, updateNodeData]
  );

  const addRow = useCallback(() => {
    setStrings([...lightingStrings, 'New condition']);
  }, [lightingStrings, setStrings]);

  const updateRow = useCallback(
    (index: number, value: string) => {
      const next = [...lightingStrings];
      next[index] = value;
      setStrings(next);
    },
    [lightingStrings, setStrings]
  );

  const removeRow = useCallback(
    (index: number) => {
      setStrings(lightingStrings.filter((_, i) => i !== index));
    },
    [lightingStrings, setStrings]
  );

  const clearAccumulated = useCallback(() => {
    updateNodeData(id, { accumulatedLighting: [] });
  }, [id, updateNodeData]);

  const runBatch = useCallback(() => {
    if (!scoutPipeline.selectedShotCommitted) {
      notifyInfo('Lighting scenario', 'Commit a hero shot in Selected shot first.');
      return;
    }
    const trimmed = lightingStrings.map((s) => s.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      notifyInfo('Lighting scenario', 'Add at least one non-empty lighting condition.');
      return;
    }
    runFromNode(id);
  }, [scoutPipeline.selectedShotCommitted, lightingStrings, runFromNode, id]);

  const rawPreview = (data as { activeLightingPreviewSrc?: string | null }).activeLightingPreviewSrc;
  const activePreview = typeof rawPreview === 'string' ? rawPreview : null;

  const setActivePreview = useCallback(
    (src: string) => {
      updateNodeData(id, { activeLightingPreviewSrc: src });
    },
    [id, updateNodeData]
  );

  return (
    <FlowNodeResizeRoot
      minWidth={320}
      minHeight={200}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="lightingScenarioNode" labelPrefix="Lighting scenario" icon={<Sun size={12} />} />
      <div
        className={`glass-node relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          variant="multiImage"
          onRun={runBatch}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          showDownload
          onDownload={() => window.open(activePreview ?? MOCK.lightWarm, '_blank')}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          {!scoutPipeline.selectedShotCommitted && (
            <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>Connect and commit a hero shot before running lighting.</span>
            </div>
          )}
          {scoutPipeline.stage5Stale && scoutPipeline.selectedShotCommitted && (
            <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-100/90">
              Lighting or upstream changed — re-run atmosphere after updating lighting.
            </div>
          )}

          <div className="space-y-2 p-3">
            <div className="text-[10px] font-mono-display uppercase tracking-wider text-[var(--text-muted)]">
              Lighting conditions (batch size = {lightingStrings.filter((s) => s.trim()).length})
            </div>
            {lightingStrings.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => updateRow(i, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`${NODE_INTERACTIVE_CLASS} min-w-0 flex-1 rounded border border-[var(--node-control-border)] bg-[var(--node-inner-mid)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]`}
                  placeholder="Non-empty lighting description"
                />
                <button
                  type="button"
                  className="rounded p-1 text-[var(--node-control-muted)] hover:bg-white/10 hover:text-red-400"
                  onClick={() => removeRow(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className={`${NODE_INTERACTIVE_CLASS} flex items-center gap-1 text-[11px] text-[var(--accent-color)]`}
            >
              <Plus size={12} /> Add condition
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border p-3 pt-2">
            {(lastBatchResults.length ? lastBatchResults : accumulatedLighting.slice(-4)).map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`text-left ${activePreview === p.src ? 'ring-1 ring-amber-400' : ''}`}
                onClick={() => setActivePreview(p.src)}
              >
                <ImageCellOverlay src={p.src} label={p.label} resolution="4K" index={i} nodeId={id} />
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
            <span className="text-[10px] text-[var(--text-muted)]">
              Accumulated: {accumulatedLighting.length} · Last batch: {lastBatchResults.length}
            </span>
            <button
              type="button"
              className={`${NODE_INTERACTIVE_CLASS} text-[10px] uppercase tracking-wider text-[var(--accent-color)]`}
              onClick={clearAccumulated}
            >
              Clear list
            </button>
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

LightingScenarioNode.displayName = 'LightingScenarioNode';
export default LightingScenarioNode;
