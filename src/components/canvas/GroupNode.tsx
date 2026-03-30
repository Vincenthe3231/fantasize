import { memo, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { Position, type Node, type NodeProps, useUpdateNodeInternals } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkflowStore, type NodeType } from '@/stores/workflowStore';
import { useNodeEntranceMotion } from '@/hooks/useNodeEntranceMotion';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';
import { aggregatePortTypesForChildTypes } from '@/lib/nodePortDataTypes';
import { GROUP_INSERTABLE_NODES, getNodeTypeDisplayLabel } from '@/lib/groupInsertableNodes';
import { EnhancedHandle, type HandleDataType } from './EnhancedHandle';

const isValidColor = (s: unknown): s is string =>
  typeof s === 'string' && (s.startsWith('#') || s.startsWith('rgb'));

const DEFAULT_LABEL = 'Group';

const DEFAULT_GROUP_PORT_TYPES: HandleDataType[] = ['text', 'image'];

function formatCanvasNodeLabel(n: Node): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const labelText = typeof d.labelText === 'string' && d.labelText.trim() ? d.labelText.trim() : '';
  const title = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : '';
  if (labelText) return labelText;
  if (title) return title;
  return getNodeTypeDisplayLabel(n.type as NodeType);
}

type GroupNodeProps = NodeProps & { style?: { width?: number; height?: number } };

/**
 * Visual-only wrapper for React Flow parent/child grouping.
 * Children are positioned relative to the parent and stay inside via `extent: 'parent'`.
 * Uses data.color if set (hex/rgba), else var(--accent-color) for theme alignment.
 */
const GroupNode = memo(({ id, selected, style, data, draggable }: GroupNodeProps) => {
  const width = typeof style?.width === 'number' ? style.width : undefined;
  const height = typeof style?.height === 'number' ? style.height : undefined;

  const updateNodeInternals = useUpdateNodeInternals();
  const resizeInternalsRaf = useRef<number | null>(null);

  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const addNodeToGroup = useWorkflowStore((s) => s.addNodeToGroup);
  const reparentNodeToGroup = useWorkflowStore((s) => s.reparentNodeToGroup);
  const nodes = useWorkflowStore((s) => s.nodes);
  const reduceMotion = useCanvasReduceMotion();

  const portTypes = useMemo(() => {
    const children = nodes.filter((n) => n.parentId === id && n.type !== 'group');
    const merged = aggregatePortTypesForChildTypes(children.map((c) => String(c.type)));
    return merged.length > 0 ? merged : DEFAULT_GROUP_PORT_TYPES;
  }, [nodes, id]);
  const portTypesKey = portTypes.join('|');
  const dimKey = `${String(style?.width ?? '')}×${String(style?.height ?? '')}`;

  const canvasEligibleNodes = useMemo(() => {
    return nodes
      .filter(
        (n) =>
          n.id !== id &&
          n.type !== 'group' &&
          n.parentId !== id &&
          n.draggable !== false
      )
      .map((n) => ({ n, label: formatCanvasNodeLabel(n) }))
      .sort((a, b) => a.label.localeCompare(b.label) || String(a.n.type).localeCompare(String(b.n.type)));
  }, [nodes, id]);

  useLayoutEffect(() => {
    updateNodeInternals(id);
    const raf = requestAnimationFrame(() => updateNodeInternals(id));
    return () => cancelAnimationFrame(raf);
  }, [id, portTypesKey, dimKey, updateNodeInternals]);

  const scheduleResizeInternalsUpdate = useCallback(() => {
    if (resizeInternalsRaf.current != null) return;
    resizeInternalsRaf.current = requestAnimationFrame(() => {
      resizeInternalsRaf.current = null;
      updateNodeInternals(id);
    });
  }, [id, updateNodeInternals]);

  const onNodeResizeEnd = useCallback(() => {
    if (resizeInternalsRaf.current != null) {
      cancelAnimationFrame(resizeInternalsRaf.current);
      resizeInternalsRaf.current = null;
    }
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);
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

  const storedLabel = String((data as { labelText?: unknown })?.labelText ?? '').trim();
  const labelText = storedLabel || DEFAULT_LABEL;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(labelText);
  const cancellingRef = useRef(false);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(labelText);
    setEditing(true);
  }, [labelText]);

  const commitEdit = useCallback(() => {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      setEditing(false);
      return;
    }
    const value = draft.trim();
    updateNodeData(id, { labelText: value || DEFAULT_LABEL });
    setEditing(false);
  }, [id, draft, updateNodeData]);

  const cancelEdit = useCallback(() => {
    cancellingRef.current = true;
    setDraft(labelText);
    setEditing(false);
  }, [labelText]);

  const boxStyle = {
    width: width ?? style?.width ?? '100%',
    height: height ?? style?.height ?? '100%',
  };

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

  const canResize = draggable !== false;
  const entranceMotion = useNodeEntranceMotion(id);

  return (
    <motion.div
      className="relative flex h-full w-full min-h-0 min-w-0 flex-col"
      style={boxStyle}
      initial={entranceMotion.initial}
      animate={entranceMotion.animate}
      transition={reduceMotion ? { duration: 0 } : entranceMotion.transition}
      onAnimationComplete={entranceMotion.onAnimationComplete}
    >
      <NodeResizer
        isVisible={!!selected && canResize}
        minWidth={200}
        minHeight={158}
        onResize={scheduleResizeInternalsUpdate}
        onResizeEnd={onNodeResizeEnd}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: 'hsl(217 91% 60%)',
        }}
      />
      <div
        className="absolute bottom-full left-0 z-10 min-h-8 w-max flex items-center text-[11px] font-mono-display tracking-wider text-[var(--text-muted)] mb-0.5"
        style={{ pointerEvents: 'auto' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {editing ? (
          <input
            autoFocus
            draggable={false}
            className="min-w-[4rem] w-full rounded px-1.5 py-0.5 text-[11px] font-mono-display tracking-wider text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[hsl(217_91%_60%)] bg-[var(--node-control-bg)] border border-[var(--node-control-border)]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="text-left w-full whitespace-nowrap rounded px-1 -mx-1 py-0.5 -my-0.5 text-[var(--text-primary)] hover:opacity-90 hover:bg-[var(--node-action-bar-hover-bg)]"
            onClick={startEdit}
          >
            {labelText}
          </button>
        )}
      </div>

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
        className="nodrag nopan flex h-[38px] shrink-0 items-center gap-1.5 overflow-hidden border-t border-[var(--node-panel-border)] bg-[var(--node-control-bg)] px-3 py-2 text-[10px]"
        style={{ pointerEvents: 'auto' }}
      >
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Add node to group"
              className="rounded-md bg-[var(--node-control-bg)] p-1 text-[var(--node-control-text)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)]"
            >
              <Plus size={12} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="node-canvas-popover w-64 p-0 backdrop-blur-xl" align="start">
            <Tabs defaultValue="new" className="w-full">
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
                    {canvasEligibleNodes.length === 0 ? (
                      <p className="px-2 py-3 text-center text-[10px] leading-snug text-[var(--node-control-muted)]">
                        No other nodes to add. Create nodes on the canvas first, or use the New tab.
                      </p>
                    ) : (
                      canvasEligibleNodes.map(({ n, label }) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => reparentNodeToGroup(id, n.id)}
                          className="flex w-full flex-col items-start gap-0 rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--node-action-bar-hover-bg)]"
                        >
                          <span className="w-full truncate text-[11px] text-[var(--node-popover-text)]">{label}</span>
                          <span className="w-full truncate font-mono-display text-[9px] text-[var(--node-control-muted)]">
                            {n.id.length > 14 ? `${n.id.slice(0, 12)}…` : n.id}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
        <span className="truncate text-[var(--node-control-muted)]">Add to group</span>
      </div>
    </motion.div>
  );
});

export default GroupNode;

