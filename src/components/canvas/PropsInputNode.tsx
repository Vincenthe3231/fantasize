import { memo, useMemo, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import { Package } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { DEFAULT_SCOUT_PROP_SLOTS } from '@/lib/mockPipelineAssets';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import { stage1Complete } from '@/lib/scoutPipeline';

export type PropSlot = { id: string; label: string; src: string };

const PropsInputNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const quickOverrides = useMemo(
    () => ({
      imageGenerator: { sourceHandle: 'image-out' as const, targetHandle: 'image-in' as const },
      videoGenerator: { sourceHandle: 'text-out' as const, targetHandle: 'text-in' as const },
      imageUpscaler: { sourceHandle: 'image-out' as const },
      assistant: { sourceHandle: 'text-out' as const, targetHandle: 'text-in' as const },
    }),
    []
  );
  const { connectMenuItems } = useQuickConnect(id, selfPos, quickOverrides);

  const rawProps = (data as { props?: PropSlot[] })?.props;
  const props: PropSlot[] =
    Array.isArray(rawProps) && rawProps.length > 0 ? rawProps : [...DEFAULT_SCOUT_PROP_SLOTS];

  const setProps = useCallback(
    (next: PropSlot[]) => {
      updateNodeData(id, { props: next });
    },
    [id, updateNodeData]
  );

  const updateLabel = useCallback(
    (pid: string, label: string) => {
      setProps(props.map((p) => (p.id === pid ? { ...p, label } : p)));
    },
    [props, setProps]
  );

  const s1 = useMemo(() => stage1Complete(nodes), [nodes]);
  const propsOk = s1.hasProps;

  return (
    <FlowNodeResizeRoot
      minWidth={320}
      minHeight={180}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="propsInputNode" labelPrefix="Props input" icon={<Package size={12} />} />
      <div
        className={`glass-node-input relative flex w-full flex-1 flex-col min-h-0 overflow-visible rounded-[var(--radius-node)] ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/40' : ''}`}
        style={{ background: 'var(--node-props-chrome-bg)', boxShadow: 'var(--shadow-node)' }}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          variant="group"
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          onLock={() => lockNode(id)}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="px-0 text-[13px] text-[var(--node-props-hint)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              Label each prop reference for the Instructions node.
            </div>
            {propsOk ? (
              <span className="shrink-0 text-[9px] rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">Ready</span>
            ) : (
              <span className="shrink-0 text-[9px] rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">Label props</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 pt-2">
            {props.map((item, i) => (
              <div key={item.id} className="flex flex-col gap-1">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateLabel(item.id, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`${NODE_INTERACTIVE_CLASS} w-full rounded border border-[var(--node-control-border)] bg-[var(--node-inner-mid)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)]`}
                  placeholder="Prop name"
                />
                <ImageCellOverlay
                  src={item.src}
                  label={item.label}
                  resolution="1024 × 768"
                  index={i}
                  nodeId={id}
                />
              </div>
            ))}
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

PropsInputNode.displayName = 'PropsInputNode';
export default PropsInputNode;
