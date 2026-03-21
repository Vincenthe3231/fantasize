import { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { Package } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';

const PROPS_ITEMS = [
  { label: 'Coffee table', src: MOCK.propTable, resolution: '1024 × 768' },
  { label: 'Vintage speakers', src: MOCK.propSpeakers, resolution: '1024 × 768' },
  { label: 'L-sofa', src: MOCK.propSofa, resolution: '1024 × 768' },
  { label: 'Piano', src: MOCK.propPiano, resolution: '1024 × 768' },
  { label: 'Lamp', src: MOCK.propLamp, resolution: '1024 × 768' },
  { label: 'Accent chair', src: MOCK.propChair, resolution: '1024 × 768' },
];

const PropsInputNode = memo(({ id, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
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

  return (
    <FlowNodeResizeRoot
      selected={!!selected}
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

      <NodeContentFocus nodeId={id}>
        <div className="px-4 py-3 text-[13px] text-[var(--node-props-hint)]" style={{ fontFamily: 'Inter, sans-serif' }}>
          👆 Replace with references of your key props to guide the look and style of each element.
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 pt-0">
        {PROPS_ITEMS.map((item, i) => (
          <ImageCellOverlay
            key={i}
            src={item.src}
            label={item.label}
            resolution={item.resolution}
            index={i}
            nodeId={id}
          />
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
