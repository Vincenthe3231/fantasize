import { memo, useCallback, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { Image, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';

const UploadNode = memo(({ id, data }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
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

  const mediaUrl = (data.mediaUrl as string) || '';
  const label = (data.label as string) || '';

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        updateNodeData(id, { mediaUrl: url, label: file.name });
      }
    },
    [id, updateNodeData]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
    },
    noClick: !!mediaUrl,
    noDragEventsBubbling: true,
  });

  return (
    <div className="w-[280px] relative">
      <NodeLabelRow
        nodeId={id}
        nodeType="uploadNode"
        labelPrefix="Upload"
        icon={<Image size={12} />}
        fallbackText={label}
      />
      <div
        className={`glass-node glass-node-input w-full relative ${isRunning ? 'ring-1 ring-amber-500/40' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className="p-3 pt-2">
        {mediaUrl ? (
          <div className="relative rounded-lg overflow-hidden">
            {mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') ? (
              <video src={mediaUrl} className="w-full h-[140px] object-cover rounded-lg" muted />
            ) : (
              <img src={mediaUrl} alt="Reference" className="w-full h-[140px] object-cover rounded-lg" />
            )}
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 backdrop-blur-sm bg-[var(--node-overlay-dark)]">
              <span className="text-[10px] font-mono-display uppercase tracking-wider text-[var(--node-overlay-text)]">
                {label || 'Uploaded media'}
              </span>
            </div>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`h-[140px] border border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
              isDragActive ? 'border-[var(--port-input)] bg-[var(--port-input)]/5' : 'border-[var(--border-node)] hover:border-[var(--accent-color)]/35'
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={20} className="text-[var(--text-muted)]" />
            <span className="text-[11px] text-[var(--text-muted)] font-mono-display">
              Drop image or video here
            </span>
          </div>
        )}
        </div>
      </NodeContentFocus>

      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="image" />
      </div>
    </div>
  );
});

UploadNode.displayName = 'UploadNode';
export default UploadNode;
