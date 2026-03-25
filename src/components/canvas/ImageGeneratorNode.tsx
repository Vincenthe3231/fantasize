import { memo, useMemo, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import {
  Clapperboard,
  Download,
  Loader2,
  Play,
  Type,
  Image as ImageIcon,
  Settings,
  Minus,
  Plus,
} from 'lucide-react';
import { NodeLabelRow } from './NodeLabelRow';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NodeContentFocus } from './NodeContentFocus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RichTextField } from '@/components/rich-text/RichTextField';
import { IMAGE_GENERATOR_MODES } from '@/lib/imageGeneratorModes';
import { notifyInfo } from '@/lib/systemNotify';

function downloadFromImageUrl(url: string, basename: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    if (trimmed.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = trimmed;
      const ext =
        trimmed.startsWith('data:image/png') ? 'png'
        : trimmed.startsWith('data:image/jpeg') || trimmed.startsWith('data:image/jpg') ? 'jpg'
        : trimmed.startsWith('data:image/webp') ? 'webp'
        : trimmed.startsWith('data:image/gif') ? 'gif'
        : 'png';
      a.download = `${basename}.${ext}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }
    window.open(trimmed, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

function makeEdge(
  source: string,
  target: string,
  sourceHandle?: string | null,
  targetHandle?: string | null
) {
  return {
    id: `e-${source}-${target}-${Date.now()}`,
    source,
    target,
    sourceHandle: sourceHandle ?? undefined,
    targetHandle: targetHandle ?? undefined,
    type: 'custom' as const,
  };
}

const ImageGeneratorNode = memo(({ id, data, selected }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const addNode = useWorkflowStore((s) => s.addNode);
  const connectEdgeWithHistory = useWorkflowStore((s) => s.connectEdgeWithHistory);
  const nodes = useWorkflowStore((s) => s.nodes);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);

  const prompt = (data.prompt as string) || '';
  const mode = (data.mode as string) || 'Auto';
  const aspect = (data.aspect as string) || '16:9';
  const images = Math.min(4, Math.max(1, (data.images as number) || 1));
  const negativePrompt = (data.negativePrompt as string) || '';
  const status = (data.status as string) || 'idle';
  const generatedUrl = (data.generatedUrl as string) || '';
  const negativePromptOpen = Boolean(data.negativePromptOpen);

  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);

  const wireEdge = useCallback(
    (newEdge: ReturnType<typeof makeEdge>) => {
      const s = useWorkflowStore.getState();
      connectEdgeWithHistory([...s.edges, newEdge], newEdge);
    },
    [connectEdgeWithHistory]
  );

  const quickTextLeft = useCallback(() => {
    const nid = addNode('textNode', { x: selfPos.x - 300, y: selfPos.y });
    wireEdge(makeEdge(nid, id, 'text-out', 'text-in'));
  }, [addNode, selfPos, id, wireEdge]);

  const quickImageLeft = useCallback(() => {
    const nid = addNode('imageGeneratorNode', { x: selfPos.x - 320, y: selfPos.y + 20 });
    wireEdge(makeEdge(nid, id, 'image-out', 'image-in'));
  }, [addNode, selfPos, id, wireEdge]);

  const quickImageRight = useCallback(() => {
    const nid = addNode('imageGeneratorNode', { x: selfPos.x + 340, y: selfPos.y });
    wireEdge(makeEdge(id, nid, 'text-out', 'text-in'));
  }, [addNode, selfPos, id, wireEdge]);

  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const handleDownloadImage = useCallback(() => {
    const url = generatedUrl.trim();
    if (!url) {
      notifyInfo('No image to download', 'Generate or load an image on this node first.');
      return;
    }
    const base = `image-${id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'export'}`;
    if (!downloadFromImageUrl(url, base)) {
      notifyInfo('Download failed', 'Could not start a download for this image.');
    }
  }, [generatedUrl, id]);

  const handleRun = () => {
    if (!prompt.trim()) return;
    updateNodeData(id, { status: 'generating' });
    setTimeout(() => {
      updateNodeData(id, { status: 'success', generatedUrl: '/placeholder.svg' });
    }, 2000);
  };

  const canRun = prompt.trim().length > 0 && status !== 'generating';

  const FloatBtn = ({
    children,
    onClick,
    className = '',
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`${NODE_INTERACTIVE_CLASS} w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-lg bg-[var(--node-float-btn-bg)] border border-[var(--node-float-btn-border)] text-[var(--node-action-bar-icon)] hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-action-bar-icon-hover)] ${className}`}
    >
      {children}
    </button>
  );

  return (
    <FlowNodeResizeRoot
      minWidth={200}
      minHeight={200}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow
        nodeId={id}
        nodeType="imageGeneratorNode"
        labelPrefix="Image Generator"
        icon={<Clapperboard size={12} />}
      />
      <div
        className={`glass-node w-full relative flex flex-1 flex-col min-h-0 ${isRunning || status === 'generating' ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="imageGen"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        connectMenuItems={connectMenuItems}
        showDownload
        onDownload={handleDownloadImage}
      />

      <NodeContentFocus nodeId={id} shellMoveCursor>
        <div
          className={`rounded-xl border-2 transition-colors flex flex-1 flex-col min-h-0 ${
            contentFocused
              ? 'border-[hsl(217_91%_60%)] shadow-[0_0_0_3px_hsla(217,91%,60%,0.15)]'
              : 'border-transparent'
          }`}
        >
          <div className="rounded-[10px] overflow-hidden bg-[var(--node-inner-deep)] flex min-h-[220px] flex-1 flex-col">
            <div className="relative flex flex-1 min-h-0 flex-col">
              <AnimatePresence>
                {status === 'success' && generatedUrl && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center p-2"
                  >
                    <img src={generatedUrl} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
                  </motion.div>
                )}
              </AnimatePresence>
              {status === 'generating' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
                  <Loader2 size={24} className="animate-spin text-[var(--accent-color)]" />
                  <span className="text-[11px] font-mono-display text-[var(--text-muted)]">Generating…</span>
                </div>
              )}
              {status !== 'generating' && status !== 'success' && (
                <div className="flex-1 min-h-0" />
              )}
              <div className="mt-auto shrink-0 p-3 pt-0" onPointerDown={(e) => e.stopPropagation()}>
                <RichTextField
                  value={prompt}
                  onChange={(html) => updateNodeData(id, { prompt: html })}
                  placeholder="Describe the image you want to generate…"
                  excludeNodeId={id}
                  toolbarVariant="top"
                  className="max-h-[140px]"
                  editorContentClassName="w-full min-h-[48px] max-h-[120px] overflow-y-auto text-[12px] text-[var(--text-primary)] outline-none leading-relaxed prose prose-invert prose-sm max-w-none"
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
            </div>

            <div
              className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 flex-wrap items-center gap-1.5 px-2.5 py-2 border-t border-[var(--node-panel-border)] bg-[var(--node-control-bg)]`}
            >
              <div className="flex items-center gap-0.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] p-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNodeData(id, { images: Math.max(1, images - 1) });
                  }}
                  className="p-1 rounded text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)]"
                >
                  <Minus size={12} />
                </button>
                <span className="text-[11px] font-mono-display text-[var(--node-control-text)] min-w-[2rem] text-center">
                  x{images}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNodeData(id, { images: Math.min(4, images + 1) });
                  }}
                  className="p-1 rounded text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)]"
                >
                  <Plus size={12} />
                </button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[10px] text-[var(--node-control-text)] max-w-[72px] truncate hover:bg-[var(--node-action-bar-hover-bg)]"
                  >
                    {mode}
                    <span className="text-[var(--node-control-muted)]">▼</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="node-canvas-dropdown text-xs max-h-48 overflow-y-auto">
                  {IMAGE_GENERATOR_MODES.map((m) => (
                    <DropdownMenuItem key={m} onClick={() => updateNodeData(id, { mode: m })}>
                      {m}
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
                    {aspect === 'custom' ? '—' : aspect}
                    <span className="text-[var(--node-control-muted)] text-[9px]">▼</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="node-canvas-dropdown text-xs">
                  {['1:1', '16:9', '4:3', '9:16', '3:2'].map((a) => (
                    <DropdownMenuItem key={a} onClick={() => updateNodeData(id, { aspect: a })}>
                      {a}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover
                open={negativePromptOpen}
                onOpenChange={(open) => updateNodeData(id, { negativePromptOpen: open })}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg text-[var(--node-control-muted)] hover:text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                    title="Negative prompt"
                  >
                    <Settings size={14} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="node-canvas-popover w-64 p-3"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <label className="text-[10px] font-mono-display text-[var(--node-popover-muted)] uppercase">
                    Negative prompt
                  </label>
                  <div className="mt-2 min-h-[72px] rounded-lg border border-[var(--node-control-border)] bg-[var(--node-control-bg)] p-1">
                    <RichTextField
                      value={negativePrompt}
                      onChange={(html) => updateNodeData(id, { negativePrompt: html })}
                      placeholder="Elements to exclude…"
                      excludeNodeId={id}
                      toolbarVariant="top"
                      editorContentClassName="w-full min-h-[56px] text-[12px] text-[var(--node-popover-text)] outline-none prose prose-invert prose-sm max-w-none"
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
                </PopoverContent>
              </Popover>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadImage();
                }}
                className="p-2 rounded-lg text-[var(--node-control-muted)] hover:text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                title="Download image"
              >
                <Download size={14} />
              </button>

              <div className="flex-1 min-w-[4px]" />

              <button
                type="button"
                disabled={!canRun}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRun();
                }}
                className="w-10 h-10 rounded-full bg-[var(--accent-color)] text-[var(--node-on-accent)] flex items-center justify-center hover:bg-[var(--accent-hover)] disabled:opacity-35 disabled:grayscale shrink-0"
              >
                {status === 'generating' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Play size={18} className="ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </NodeContentFocus>

      {contentFocused && (
        <>
          <div className={`${NODE_INTERACTIVE_CLASS} absolute -left-11 bottom-20 flex flex-col gap-2 z-40`}>
            <FloatBtn onClick={quickTextLeft}>
              <Type size={14} />
            </FloatBtn>
            <FloatBtn onClick={quickImageLeft}>
              <ImageIcon size={14} />
            </FloatBtn>
          </div>
          <div className={`${NODE_INTERACTIVE_CLASS} absolute -right-11 top-24 z-40`}>
            <FloatBtn onClick={quickImageRight}>
              <ImageIcon size={14} />
            </FloatBtn>
          </div>
        </>
      )}

      <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

ImageGeneratorNode.displayName = 'ImageGeneratorNode';
export default ImageGeneratorNode;
