import { memo, useState, useMemo, useCallback } from 'react';
import { Position, type NodeProps } from 'reactflow';
import NodeCornerResizer from './NodeCornerResizer';
import { NODE_INTERACTIVE_CLASS, useResizableNodeShell } from './nodeResizeUtils';
import { Sparkles, Loader2, Type, Image as ImageIcon, Settings, Play } from 'lucide-react';
import { NodeLabelRow } from './NodeLabelRow';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NodeContentFocus } from './NodeContentFocus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ASSISTANT_MODELS = [
  'GPT-5 Mini',
  'GPT-4.1 Mini',
  'GPT-5.2',
  'Gemini 3 Pro',
  'Gemini 3 Flash',
  'Claude Sonnet 4.5',
];

const PLACEHOLDER =
  'Assistant is your creative sidekick—powered by a large language model. You can type a prompt, or even use images for context. It understands what you mean, builds on your ideas, and helps you move faster.';

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

const DEFAULT_WIDTH = 300;

const AssistantNode = memo(({ id, data, selected }: NodeProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const isStoreRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const addNode = useWorkflowStore((s) => s.addNode);
  const connectEdgeWithHistory = useWorkflowStore((s) => s.connectEdgeWithHistory);
  const nodes = useWorkflowStore((s) => s.nodes);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);

  const { shellStyle, fillHeight } = useResizableNodeShell(id, DEFAULT_WIDTH);

  const prompt = (data.prompt as string) || '';
  const result = (data.result as string) || (data.refinedPrompt as string) || '';
  const view = (data.view as 'prompt' | 'result') || 'prompt';
  const model = (data.assistantModel as string) || ASSISTANT_MODELS[0];

  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);

  const wireEdge = useCallback(
    (newEdge: ReturnType<typeof makeEdge>) => {
      const s = useWorkflowStore.getState();
      connectEdgeWithHistory([...s.edges, newEdge], newEdge);
    },
    [connectEdgeWithHistory]
  );

  const quickAddTextLeft = useCallback(() => {
    const nid = addNode('textNode', { x: selfPos.x - 300, y: selfPos.y });
    wireEdge(makeEdge(nid, id, undefined, 'text-in'));
  }, [addNode, selfPos.x, selfPos.y, id, wireEdge]);

  const quickAddImageLeft = useCallback(() => {
    const nid = addNode('imageGeneratorNode', { x: selfPos.x - 320, y: selfPos.y + 24 });
    wireEdge(makeEdge(nid, id, undefined, 'image-in'));
  }, [addNode, selfPos, id, wireEdge]);

  const quickAddTextRight = useCallback(() => {
    const nid = addNode('textNode', { x: selfPos.x + 320, y: selfPos.y });
    wireEdge(makeEdge(id, nid, undefined, 'text-in'));
  }, [addNode, selfPos, id, wireEdge]);

  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => {
      updateNodeData(id, {
        result:
          prompt.trim() ||
          'Refined output: expanded creative direction based on your prompt and any connected context.',
        view: 'result',
      });
      setIsRunning(false);
    }, 1200);
  }, [id, prompt, updateNodeData]);

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
    <div
      style={shellStyle}
      className={`vf-resizable-root relative ${fillHeight ? 'flex flex-col min-h-0 h-full' : ''}`}
    >
      <NodeCornerResizer nodeId={id} isVisible={selected} minWidth={200} minHeight={180} />
      <NodeLabelRow nodeId={id} nodeType="assistantNode" labelPrefix="Assistant" icon={<Sparkles size={12} />} />
      <div
        className={`glass-node w-full relative ${fillHeight ? 'flex flex-1 flex-col min-h-0' : ''} ${isStoreRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="assistant"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onExpand={() => {}}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div
          className={`rounded-xl border-2 transition-colors ${
            fillHeight ? 'flex flex-1 flex-col min-h-0' : ''
          } ${
            contentFocused
              ? 'border-[hsl(217_91%_60%)] shadow-[0_0_0_3px_hsla(217,91%,60%,0.15)]'
              : 'border-transparent'
          }`}
        >
          <div
            className={`rounded-[10px] overflow-hidden bg-[var(--node-inner-mid)] ${
              fillHeight ? 'flex flex-1 flex-col min-h-0' : ''
            }`}
          >
            <div
              className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 items-center gap-1 p-2 border-b border-[var(--node-panel-border)]`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(id, { view: 'prompt' });
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-mono-display uppercase tracking-wider transition-colors ${
                  view === 'prompt'
                    ? 'bg-[var(--node-tab-active-bg)] text-[var(--text-primary)]'
                    : 'text-[var(--node-tab-inactive)] hover:text-[var(--node-control-text)]'
                }`}
              >
                <span className="opacity-80">Prompt</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(id, { view: 'result' });
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-mono-display uppercase tracking-wider transition-colors ${
                  view === 'result'
                    ? 'bg-[var(--node-tab-active-bg)] text-[var(--text-primary)]'
                    : 'text-[var(--node-tab-inactive)] hover:text-[var(--node-control-text)]'
                }`}
              >
                <Sparkles size={12} />
                Result
              </button>
            </div>

            <div
              className={`p-3 min-h-[140px] ${fillHeight ? 'flex flex-1 min-h-0 flex-col overflow-hidden' : ''}`}
            >
              {view === 'prompt' ? (
                <textarea
                  value={prompt}
                  onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder={PLACEHOLDER}
                  className={`${NODE_INTERACTIVE_CLASS} w-full min-h-[120px] bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none leading-relaxed ${
                    fillHeight ? 'flex-1 min-h-0' : ''
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
              ) : (
                <div
                  className={`min-h-[120px] text-[12px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap ${
                    fillHeight ? 'flex-1 min-h-0 overflow-y-auto' : ''
                  }`}
                >
                  {result || <span className="text-[var(--text-muted)]">Run the assistant to see results here.</span>}
                </div>
              )}
            </div>

            <div
              className={`${NODE_INTERACTIVE_CLASS} flex shrink-0 flex-wrap items-center gap-2 px-3 py-2.5 border-t border-[var(--node-panel-border)] bg-[var(--node-control-bg)]`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[11px] text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)] max-w-[120px] truncate"
                  >
                    {model}
                    <span className="text-[var(--node-control-muted)] text-[9px]">▼</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="node-canvas-dropdown text-xs max-h-56 overflow-y-auto">
                  {ASSISTANT_MODELS.map((m) => (
                    <DropdownMenuItem key={m} onClick={() => updateNodeData(id, { assistantModel: m })}>
                      {m}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                className="p-2 rounded-lg text-[var(--node-control-muted)] hover:text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                title="Settings"
              >
                <Settings size={14} />
              </button>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--node-inner-mid)] border border-[var(--node-control-border)] text-[11px] text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                  >
                    Export as text
                    <span className="text-[var(--node-control-muted)] text-[9px]">▼</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="node-canvas-dropdown text-xs w-52">
                  <DropdownMenuItem
                    onClick={() => {
                      const nid = addNode('listNode', { x: selfPos.x + 40, y: selfPos.y + 200 });
                      const text = (result || prompt).trim() || 'Item';
                      updateNodeData(nid, { items: [{ id: `item-${Date.now()}`, text }] });
                    }}
                  >
                    <div>
                      <div>Export as list</div>
                      <div className="text-[10px] text-[var(--node-popover-muted)]">Export results as a list node</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const nid = addNode('textNode', { x: selfPos.x + 40, y: selfPos.y + 200 });
                      updateNodeData(nid, { content: `<p>${(result || prompt).replace(/</g, '')}</p>` });
                    }}
                  >
                    <div>
                      <div>Export as text</div>
                      <div className="text-[10px] text-[var(--node-popover-muted)]">Export results as text</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                disabled={isRunning}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRun();
                }}
                className="w-10 h-10 rounded-full bg-[var(--accent-color)] text-[var(--node-on-accent)] flex items-center justify-center hover:bg-[var(--accent-hover)] disabled:opacity-50 shadow-lg shrink-0"
              >
                {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} className="ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </NodeContentFocus>

      {contentFocused && (
        <>
          <div className={`${NODE_INTERACTIVE_CLASS} absolute -left-11 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40`}>
            <FloatBtn onClick={quickAddTextLeft}>
              <Type size={14} />
            </FloatBtn>
            <FloatBtn onClick={quickAddImageLeft}>
              <ImageIcon size={14} />
            </FloatBtn>
          </div>
          <div className={`${NODE_INTERACTIVE_CLASS} absolute -right-11 top-1/2 -translate-y-1/2 z-40`}>
            <FloatBtn onClick={quickAddTextRight}>
              <Type size={14} />
            </FloatBtn>
          </div>
        </>
      )}

      <EnhancedHandle
        type="target"
        position={Position.Left}
        id="text-in"
        className="port-input"
        style={{ top: '35%' }}
        dataType="text"
      />
      <EnhancedHandle
        type="target"
        position={Position.Left}
        id="image-in"
        className="port-input"
        style={{ top: '65%' }}
        dataType="image"
      />
      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="text" />
      </div>
    </div>
  );
});

AssistantNode.displayName = 'AssistantNode';
export default AssistantNode;
