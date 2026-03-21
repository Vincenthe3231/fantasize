import { memo, useCallback, useMemo, useState } from 'react';
import { type NodeProps } from 'reactflow';
import { Image, Loader2, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { uploadWorkflowMedia } from '@/lib/uploadStorage';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

const UploadNode = memo(({ id, data, selected }: NodeProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (mediaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mediaUrl);
      }
      setUploadError(null);
      setUploading(true);
      try {
        const { url } = await uploadWorkflowMedia(file);
        updateNodeData(id, { mediaUrl: url, label: file.name });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setUploadError(msg);
        toast.error(msg);
      } finally {
        setUploading(false);
      }
    },
    [id, mediaUrl, updateNodeData]
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
    disabled: uploading,
    noClick: !!mediaUrl,
    noDragEventsBubbling: true,
  });

  return (
    <FlowNodeResizeRoot
      selected={!!selected}
      minWidth={220}
      minHeight={120}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow
        nodeId={id}
        nodeType="uploadNode"
        labelPrefix="Upload"
        icon={<Image size={12} />}
        fallbackText={label}
      />
      <div
        className={`glass-node glass-node-input relative flex w-full flex-1 flex-col min-h-0 ${isRunning ? 'ring-1 ring-amber-500/40' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id}>
          <div className="flex min-h-0 flex-1 flex-col p-3 pt-2">
            {mediaUrl ? (
              <div className="relative min-h-[120px] min-w-0 flex-1 overflow-hidden rounded-lg bg-[var(--node-inner-mid)]">
                {isVideoUrl(mediaUrl) ? (
                  <video
                    src={mediaUrl}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                    playsInline
                    loop
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt="Reference"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 backdrop-blur-sm bg-[var(--node-overlay-dark)]">
                  <span className="text-[10px] font-mono-display uppercase tracking-wider text-[var(--node-overlay-text)]">
                    {label || 'Uploaded media'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div
                  {...getRootProps({
                    className: `${NODE_INTERACTIVE_CLASS} flex min-h-[120px] min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors ${
                      uploading
                        ? 'border-[var(--border-node)] opacity-80 cursor-wait'
                        : `cursor-pointer ${isDragActive ? 'border-[var(--port-input)] bg-[var(--port-input)]/5' : 'border-[var(--border-node)] hover:border-[var(--accent-color)]/35'}`
                    }`,
                  })}
                >
                  <input {...getInputProps()} />
                  {uploading ? (
                    <>
                      <Loader2 size={22} className="text-[var(--accent-color)] animate-spin" />
                      <span className="text-[11px] text-[var(--text-muted)] font-mono-display">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Upload size={20} className="text-[var(--text-muted)]" />
                      <span className="text-[11px] text-[var(--text-muted)] font-mono-display">
                        Drop image or video here
                      </span>
                    </>
                  )}
                </div>
                {uploadError ? (
                  <p className="shrink-0 px-0.5 font-mono-display text-[10px] leading-snug text-red-400">
                    {uploadError}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

UploadNode.displayName = 'UploadNode';
export default UploadNode;
