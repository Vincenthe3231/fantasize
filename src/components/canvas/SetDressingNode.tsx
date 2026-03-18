import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Sofa } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import ImageCellOverlay from './ImageCellOverlay';
import { MOCK } from '@/lib/mockPipelineAssets';

const SetDressingNode = memo(({ id, selected, data }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const previewUrl = (data?.previewUrl as string) || MOCK.setDressing;

  return (
    <div className="w-[420px] relative">
      <NodeLabelRow nodeId={id} nodeType="setDressingNode" labelPrefix="Set dressing preview" icon={<Sofa size={12} />} />
      <div
        className={`glass-node w-full relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="image"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onDownload={() => window.open(previewUrl, '_blank')}
      />

      <NodeContentFocus nodeId={id}>
        <div className="p-3 pt-2">
        <ImageCellOverlay
          src={previewUrl}
          resolution="3840 × 2160"
          index={0}
          nodeId={id}
          className="!rounded-lg"
        />
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[10px] text-[var(--text-muted)]">
        <span>Composite from location · placement · props · generator</span>
        <button
          type="button"
          className="text-[var(--accent-color)] hover:underline font-mono-display uppercase tracking-wider"
          onClick={(e) => {
            e.stopPropagation();
            runFromNode(id);
          }}
        >
          Regenerate
        </button>
      </div>
      </NodeContentFocus>

      <Handle type="target" position={Position.Left} id="location-in" className="port-input" style={{ top: '22%' }} />
      <Handle type="target" position={Position.Left} id="placement-in" className="port-input" style={{ top: '38%' }} />
      <Handle type="target" position={Position.Left} id="props-in" className="port-input" style={{ top: '54%' }} />
      <Handle type="target" position={Position.Left} id="scene-in" className="port-input" style={{ top: '70%' }} />
      <Handle type="source" position={Position.Right} className="port-output" />
      </div>
    </div>
  );
});

SetDressingNode.displayName = 'SetDressingNode';
export default SetDressingNode;
