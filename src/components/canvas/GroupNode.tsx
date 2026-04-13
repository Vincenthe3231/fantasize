import { memo, useState, useMemo, useLayoutEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Position, type Node, type NodeProps, useUpdateNodeInternals } from 'reactflow';
import { Boxes, Plus } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TooltipWrap } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkflowStore, type NodeType } from '@/stores/workflowStore';
import { aggregatePortTypesForChildTypes } from '@/lib/nodePortDataTypes';
import { GROUP_INSERTABLE_NODES, getNodeTypeDisplayLabel } from '@/lib/groupInsertableNodes';
import { EnhancedHandle, type HandleDataType } from './EnhancedHandle';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';

const isValidColor = (s: unknown): s is string =>
  typeof s === 'string' && (s.startsWith('#') || s.startsWith('rgb'));

const DEFAULT_GROUP_PORT_TYPES: HandleDataType[] = ['text', 'image'];

function formatCanvasNodeLabel(n: Node): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const labelText = typeof d.labelText === 'string' && d.labelText.trim() ? d.labelText.trim() : '';
  const title = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : '';
  if (labelText) return labelText;
  if (title) return title;
  return getNodeTypeDisplayLabel(n.type as NodeType);
}

/**
 * Subscribes to full `nodes` only while mounted — mount when the Add popover is open on the Canvas tab
 * so we do not filter/sort the whole graph for every group on every graph churn.
 */
function GroupNodeCanvasPicker({
  groupId,
  onReparent,
}: {
  groupId: string;
  onReparent: (targetGroupId: string, nodeId: string) => void;
}) {
  const nodes = useWorkflowStore((s) => s.nodes);
  const canvasEligibleNodes = useMemo(() => {
    return nodes
      .filter(
        (n) =>
          n.id !== groupId &&
          n.type !== 'group' &&
          n.parentId !== groupId &&
          n.draggable !== false
      )
      .map((n) => ({ n, label: formatCanvasNodeLabel(n) }))
      .sort(
        (a, b) =>
          String(a.label).localeCompare(String(b.label)) || String(a.n.type).localeCompare(String(b.n.type))
      );
  }, [nodes, groupId]);

  if (canvasEligibleNodes.length === 0) {
    return (
      <p className="px-2 py-3 text-center text-[10px] leading-snug text-[var(--node-control-muted)]">
        No other nodes to add. Create nodes on the canvas first, or use the New tab.
      </p>
    );
  }
  return (
    <>
      {canvasEligibleNodes.map(({ n, label }) => {
        const idStr = String(n.id);
        return (
          <button
            key={idStr}
            type="button"
            onClick={() => onReparent(groupId, n.id)}
            className="flex w-full flex-col items-start gap-0 rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--node-action-bar-hover-bg)]"
          >
            <span className="w-full truncate text-[11px] text-[var(--node-popover-text)]">{label}</span>
            <span className="w-full truncate font-mono-display text-[9px] text-[var(--node-control-muted)]">
              {idStr.length > 14 ? `${idStr.slice(0, 12)}…` : idStr}
            </span>
          </button>
        );
      })}
    </>
  );
}

type GroupNodeProps = NodeProps & { style?: { width?: number; height?: number } };

/**
 * Visual-only wrapper for React Flow parent/child grouping.
 * Children are positioned relative to the parent and stay inside via `extent: 'parent'`.
 * Uses data.color if set (hex/rgba), else var(--accent-color) for theme alignment.
 */
const GroupNode = memo(({ id, selected, style, data }: GroupNodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();

  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const addNodeToGroup = useWorkflowStore((s) => s.addNodeToGroup);
  const reparentNodeToGroup = useWorkflowStore((s) => s.reparentNodeToGroup);
  /** Shallow compare — skip re-renders when unrelated nodes update but this group's children are unchanged. */
  const groupChildNodes = useWorkflowStore(
    useShallow((s) => s.nodes.filter((n) => n.parentId === id && n.type !== 'group'))
  );
  const portTypes = useMemo(() => {
    const merged = aggregatePortTypesForChildTypes(groupChildNodes.map((c) => String(c.type)));
    return merged.length > 0 ? merged : DEFAULT_GROUP_PORT_TYPES;
  }, [groupChildNodes]);
  const portTypesKey = portTypes.join('|');
  const dimKey = `${String(style?.width ?? '')}×${String(style?.height ?? '')}`;

  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [addPopoverTab, setAddPopoverTab] = useState('new');

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, portTypesKey, dimKey, updateNodeInternals]);

  // When connecting, let pointer interactions pass through the group container
  // so child nodes' handles remain clickable/connectable.
  const pointerEvents = selectedTool === 'connection' ? 'none' : 'auto';

  const rawColor = (data as { color?: unknown })?.color;
  const useCustom = isValidColor(rawColor);
  const borderColor = useCustom
    ? `color-mix(in srgb, ${rawColor} 55%, transparent)`
    : 'color-mix(in srgb, var(--accent-color) 55%, transparent)';
  const background = useCustom
    ? `color-mix(in srgb, ${rawColor} 10%, transparent)`
    : 'color-mix(in srgb, var(--accent-color) 10%, transparent)';

  /** Vertical center on the node box; half handle = 10px for `.port-with-type-glyph` (20×20). No root `transform` — RF measures handle bounds for edges (see index.css). */
  const HANDLE_VISUAL_HALF_PX = 10;
  const HANDLE_STACK_GAP_PX = 26;
  const handleVerticalStyle = (i: number) => {
    const n = portTypes.length;
    const offsetPx = n <= 1 ? 0 : (i - (n - 1) / 2) * HANDLE_STACK_GAP_PX;
    const offsetTerm = offsetPx === 0 ? '' : ` + ${offsetPx}px`;
    return {
      top: `calc(50% - ${HANDLE_VISUAL_HALF_PX}px${offsetTerm})`,
    };
  };

  return (
    <FlowNodeResizeRoot minWidth={200} minHeight={158} className="rf-node-resize-root relative flex flex-col min-h-0">
      <NodeLabelRow nodeId={id} nodeType="group" labelPrefix="Group" icon={<Boxes size={12} />} />
      <div
        className={`glass-node w-full relative flex flex-1 flex-col min-h-0 min-w-0 ${selected ? 'node-selected' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div
            className={`rounded-xl border-2 transition-colors flex flex-1 flex-col min-h-0 min-w-0 ${
              contentFocused
                ? 'border-[hsl(217_91%_60%)] shadow-[0_0_0_3px_hsla(217,91%,60%,0.15)]'
                : 'border-transparent'
            }`}
          >
            <div className="relative rounded-[10px] overflow-hidden flex flex-col flex-1 min-h-0 min-w-0">
              <div className="relative min-h-0 min-w-0 flex-1">
                <div
                  className="vf-group-node absolute inset-0 rounded-lg overflow-hidden"
                  style={{
                    background,
                    border: `1px solid ${borderColor}`,
                    boxSizing: 'border-box',
                    cursor: 'move',
                    backdropFilter: 'blur(0px)',
                    pointerEvents,
                  }}
                  data-group-node-selected={selected || undefined}
                />
                {portTypes.map((dt, i) => (
                  <EnhancedHandle
                    key={`group-in-${dt}`}
                    type="target"
                    position={Position.Left}
                    id={`group-in-${dt}`}
                    className="port-input !pointer-events-auto"
                    style={handleVerticalStyle(i)}
                    dataType={dt}
                  />
                ))}
                {portTypes.map((dt, i) => (
                  <EnhancedHandle
                    key={`group-out-${dt}`}
                    type="source"
                    position={Position.Right}
                    id={`group-out-${dt}`}
                    className={`port-output ${dt === 'text' ? 'port-output-accent' : ''} !pointer-events-auto`}
                    style={handleVerticalStyle(i)}
                    dataType={dt}
                  />
                ))}
              </div>

              <div
                className={`nodrag nopan ${NODE_INTERACTIVE_CLASS} flex shrink-0 flex-col gap-1.5 border-t border-[var(--node-panel-border)] bg-[var(--node-control-bg)] px-2.5 py-2`}
                style={{ pointerEvents: 'auto' }}
              >
                <div className="flex min-h-0 items-center gap-1.5 overflow-hidden text-[10px]">
                  <Popover
                    onOpenChange={(open) => {
                      setAddPopoverOpen(open);
                      if (!open) setAddPopoverTab('new');
                    }}
                  >
                    <TooltipWrap label="Add node to group" side="top" contentClassName="z-[100]">
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="rounded-md bg-[var(--node-control-bg)] p-1 text-[var(--node-control-text)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)]"
                        >
                          <Plus size={12} />
                        </button>
                      </PopoverTrigger>
                    </TooltipWrap>
                    <PopoverContent side="top" className="node-canvas-popover w-64 p-0 backdrop-blur-xl" align="start">
                      <Tabs value={addPopoverTab} onValueChange={setAddPopoverTab} className="w-full">
                        <TabsList className="grid h-8 w-full grid-cols-2 gap-0 rounded-none border-b border-[var(--node-panel-border)] bg-[var(--node-control-bg)] p-0.5 text-[var(--node-control-muted)]">
                          <TabsTrigger
                            value="new"
                            className="h-7 rounded-sm px-2 py-0 text-[10px] font-medium data-[state=active]:bg-[var(--node-action-bar-hover-bg)] data-[state=active]:text-[var(--node-popover-text)] data-[state=active]:shadow-none"
                          >
                            New
                          </TabsTrigger>
                          <TabsTrigger
                            value="canvas"
                            className="h-7 rounded-sm px-2 py-0 text-[10px] font-medium data-[state=active]:bg-[var(--node-action-bar-hover-bg)] data-[state=active]:text-[var(--node-popover-text)] data-[state=active]:shadow-none"
                          >
                            Canvas
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent
                          value="new"
                          className="mt-0 flex min-h-0 flex-col overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0"
                        >
                          <ScrollArea className="nowheel h-[min(280px,45vh)] w-full min-h-0 overscroll-contain">
                            <div className="flex flex-col p-1.5 pr-2">
                              {GROUP_INSERTABLE_NODES.map((entry) => {
                                const Icon = entry.icon;
                                return (
                                  <button
                                    key={entry.type}
                                    type="button"
                                    onClick={() => addNodeToGroup(id, entry.type)}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-[var(--node-popover-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                                  >
                                    <Icon size={12} className="shrink-0 text-[var(--node-control-muted)]" />
                                    {entry.label}
                                  </button>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                        <TabsContent
                          value="canvas"
                          className="mt-0 flex min-h-0 flex-col overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0"
                        >
                          <ScrollArea className="nowheel h-[min(280px,45vh)] w-full min-h-0 overscroll-contain">
                            <div className="flex flex-col gap-0.5 p-1.5 pr-2">
                              {addPopoverOpen && addPopoverTab === 'canvas' ? (
                                <GroupNodeCanvasPicker groupId={id} onReparent={reparentNodeToGroup} />
                              ) : null}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    </PopoverContent>
                  </Popover>
                  <span className="truncate text-[var(--node-control-muted)]">Add to group</span>
                </div>
              </div>
            </div>
          </div>
        </NodeContentFocus>
      </div>
    </FlowNodeResizeRoot>
  );
});

export default GroupNode;

