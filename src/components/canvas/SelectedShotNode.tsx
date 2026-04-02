import { memo, useState, useMemo, useCallback, useRef } from 'react';
import { type NodeProps } from 'reactflow';
import { ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';
import CanvasNodeImage from '@/components/canvas/CanvasNodeImage';

const SelectedShotNode = memo(({ id, data, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const setSelectedShotCommitted = useWorkflowStore((s) => s.setSelectedShotCommitted);
  const scoutPipeline = useWorkflowStore((s) => s.scoutPipeline);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const quickOverrides = useMemo(
    () => ({
      imageGenerator: { targetHandle: 'image-in' as const },
      videoGenerator: { targetHandle: 'image-in' as const },
      assistant: { targetHandle: 'image-in' as const },
    }),
    []
  );
  const { connectMenuItems } = useQuickConnect(id, selfPos, quickOverrides);
  const [hovered, setHovered] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const heroMeasureRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useCanvasReduceMotion();

  const mediaUrl =
    (data.mediaUrl as string) || 'https://picsum.photos/seed/vps-final/800/444';
  const resolution = (data.resolution as string) || '2738 × 1524';
  const committed = Boolean((data as { committed?: boolean }).committed);

  const commitHero = useCallback(() => {
    updateNodeData(id, { committed: true });
    setSelectedShotCommitted(true);
  }, [id, setSelectedShotCommitted, updateNodeData]);

  const onReplaceFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      updateNodeData(id, { mediaUrl: url, committed: false, resolution: 'Custom' });
      setSelectedShotCommitted(false);
    },
    [id, setSelectedShotCommitted, updateNodeData]
  );

  return (
    <FlowNodeResizeRoot
      minWidth={220}
      minHeight={120}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="selectedShotNode" labelPrefix="Selected shot" icon={<ImageIcon size={12} />} />
      <div
        className={`glass-node glass-node-output relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          hidden={Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden)}
          variant="image"
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          showDownload
          onDownload={() => window.open(mediaUrl, '_blank')}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div ref={heroMeasureRef} className="relative aspect-[16/9] w-full">
            <CanvasNodeImage
              mediaUrl={mediaUrl}
              measureRef={heroMeasureRef}
              fallbackCssWidth={640}
              fallbackCssHeight={360}
              quality={66}
              resize="cover"
              alt="Selected shot"
              loading="lazy"
              className="h-full w-full rounded-b-[12px] object-cover"
            />

            <div className="absolute right-2 top-2 rounded bg-[var(--node-badge-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--node-overlay-text)]">
              {resolution}
            </div>

            {scoutPipeline.stage4Stale && (
              <div className="absolute left-2 top-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] text-black">
                Stale
              </div>
            )}

            <AnimatePresence>
              {hovered && (
                <motion.button
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.12 }}
                  type="button"
                  className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-[var(--node-overlay-dark)] px-2.5 py-1 text-[11px] text-[var(--node-overlay-text)] transition-colors hover:opacity-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    replaceInputRef.current?.click();
                  }}
                >
                  <ImageIcon size={10} />
                  Replace
                </motion.button>
              )}
            </AnimatePresence>
            <input ref={replaceInputRef} type="file" accept="image/*" className="sr-only" onChange={onReplaceFile} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[var(--text-muted)]">Hero angle for lighting & atmosphere</span>
              {committed && scoutPipeline.selectedShotCommitted ? (
                <span className="text-[9px] rounded bg-emerald-500/25 px-1.5 py-0.5 text-emerald-300">Committed</span>
              ) : (
                <span className="text-[9px] rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">Pending</span>
              )}
            </div>
            <button
              type="button"
              disabled={!mediaUrl}
              className={`${NODE_INTERACTIVE_CLASS} w-full rounded-lg bg-[var(--accent-color)] py-2 text-[11px] font-mono-display uppercase tracking-wider text-[var(--node-on-accent)] disabled:opacity-40`}
              onClick={(e) => {
                e.stopPropagation();
                commitHero();
              }}
            >
              Commit hero shot
            </button>
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

SelectedShotNode.displayName = 'SelectedShotNode';
export default SelectedShotNode;
