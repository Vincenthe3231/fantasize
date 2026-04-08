import { useMemo, useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import { Link2, ChevronDown, ChevronLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipWrap } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkflowStore } from '@/stores/workflowStore';
import { notifyError } from '@/lib/systemNotify';
import {
  formatCanvasNodeLabelForConnect,
  listViableTargetPorts,
  buildConnectEdge,
  resolveConnectSourceNode,
} from '@/lib/selectionOverlayConnect';
import { validateScoutConnection } from '@/lib/scoutPipeline';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';

type Step = 'nodes' | 'handles';

interface SelectionConnectMenuProps {
  nodes: Node[];
  selectedNodes: Node[];
  selectedNodeIds: Set<string>;
  focusedNodeContentId: string | null;
}

export function SelectionConnectMenu({
  nodes,
  selectedNodes,
  selectedNodeIds,
  focusedNodeContentId,
}: SelectionConnectMenuProps) {
  const connectEdgeWithHistory = useWorkflowStore((s) => s.connectEdgeWithHistory);
  const storeEdges = useWorkflowStore((s) => s.edges);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('nodes');
  const [targetPick, setTargetPick] = useState<Node | null>(null);

  const sourceNode = useMemo(
    () => resolveConnectSourceNode(selectedNodes, focusedNodeContentId, nodes, selectedNodeIds),
    [selectedNodes, focusedNodeContentId, nodes, selectedNodeIds]
  );

  const canvasTargets = useMemo(() => {
    if (!sourceNode) return [];
    return nodes
      .filter((n) => n.id !== sourceNode.id)
      .map((n) => ({ n, label: formatCanvasNodeLabelForConnect(n) }))
      .sort(
        (a, b) =>
          String(a.label).localeCompare(String(b.label)) || String(a.n.type).localeCompare(String(b.n.type))
      );
  }, [nodes, sourceNode]);

  const resetAndClose = useCallback(() => {
    setOpen(false);
    setStep('nodes');
    setTargetPick(null);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setStep('nodes');
      setTargetPick(null);
    }
  }, []);

  const wire = useCallback(
    (target: Node, targetLogical: string, sourceLogical: string) => {
      const latest = useWorkflowStore.getState().edges;
      const edge = buildConnectEdge(sourceNode!, target, targetLogical, sourceLogical);
      const v = validateScoutConnection(
        {
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        },
        latest
      );
      if (!v.ok) {
        notifyError(v.reason ?? 'Invalid connection');
        return;
      }
      connectEdgeWithHistory([...latest, edge], edge);
      resetAndClose();
    },
    [connectEdgeWithHistory, resetAndClose, sourceNode]
  );

  const onPickTarget = useCallback(
    (target: Node) => {
      if (!sourceNode) return;
      const viable = listViableTargetPorts(sourceNode, target, storeEdges, nodes);
      if (viable.length === 0) {
        notifyError('No compatible input on this node (or inputs are already connected).');
        return;
      }
      if (viable.length === 1) {
        const v = viable[0]!;
        wire(target, v.logicalId, v.sourceLogical);
        return;
      }
      setTargetPick(target);
      setStep('handles');
    },
    [sourceNode, storeEdges, nodes, wire]
  );

  const handleOptions = useMemo(() => {
    if (!sourceNode || !targetPick) return [];
    return listViableTargetPorts(sourceNode, targetPick, storeEdges, nodes);
  }, [sourceNode, targetPick, storeEdges, nodes]);

  const disabledReason = !sourceNode
    ? 'Focus a node or select a single non-group node to connect from.'
    : null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={!!disabledReason}
                className={`flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 ${NODE_INTERACTIVE_CLASS}`}
              >
                <Link2 size={16} />
                <ChevronDown size={12} className="ml-0.5 opacity-70" aria-hidden />
              </button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="z-[90] max-w-[min(280px,calc(100vw-24px))]">
          {disabledReason ?? 'Connect to canvas node'}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={10}
        className="node-canvas-popover w-72 p-0 backdrop-blur-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {!sourceNode ? (
          <p className="px-3 py-3 text-center text-[11px] leading-snug text-[var(--node-control-muted)]">
            {disabledReason}
          </p>
        ) : step === 'nodes' ? (
          <>
            <div className="border-b border-[var(--node-panel-border)] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--node-control-muted)]">
              Connect from{' '}
              <span className="text-[var(--node-popover-text)] normal-case">
                {formatCanvasNodeLabelForConnect(sourceNode)}
              </span>
            </div>
            <ScrollArea className="nowheel h-[min(280px,45vh)] w-full overscroll-contain">
              <div className="flex flex-col gap-0.5 p-1.5 pr-2">
                {canvasTargets.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[10px] text-[var(--node-control-muted)]">
                    No other nodes on the canvas.
                  </p>
                ) : (
                  canvasTargets.map(({ n, label }) => {
                    const idStr = String(n.id);
                    return (
                      <button
                        key={idStr}
                        type="button"
                        onClick={() => onPickTarget(n)}
                        className="flex w-full flex-col items-start gap-0 rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--node-action-bar-hover-bg)]"
                      >
                        <span className="w-full truncate text-[11px] text-[var(--node-popover-text)]">{label}</span>
                        <span className="w-full truncate font-mono-display text-[9px] text-[var(--node-control-muted)]">
                          {idStr.length > 14 ? `${idStr.slice(0, 12)}…` : idStr}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 border-b border-[var(--node-panel-border)] px-2 py-1.5">
              <TooltipWrap
                label="Back"
                side="bottom"
                contentClassName="z-[200]"
              >
                <button
                  type="button"
                  className="rounded-md p-1 text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-popover-text)]"
                  onClick={() => {
                    setStep('nodes');
                    setTargetPick(null);
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              </TooltipWrap>
              <span className="truncate text-[11px] text-[var(--node-popover-text)]">
                Input on {targetPick ? formatCanvasNodeLabelForConnect(targetPick) : '…'}
              </span>
            </div>
            <ScrollArea className="nowheel max-h-[min(220px,40vh)] w-full overscroll-contain">
              <div className="flex flex-col gap-0.5 p-1.5 pr-2">
                {handleOptions.map((h) => (
                  <button
                    key={h.logicalId}
                    type="button"
                    onClick={() => targetPick && wire(targetPick, h.logicalId, h.sourceLogical)}
                    className="rounded-md px-2.5 py-2 text-left text-[11px] text-[var(--node-popover-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                  >
                    {h.label}
                    <span className="mt-0.5 block font-mono-display text-[9px] text-[var(--node-control-muted)]">
                      {h.logicalId}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
