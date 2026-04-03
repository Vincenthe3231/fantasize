import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from 'reactflow';
import { Image, Loader2, Replace as ReplaceIcon, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { notifyError } from '@/lib/systemNotify';
import { uploadWorkflowMedia } from '@/lib/uploadStorage';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { stage1Complete } from '@/lib/scoutPipeline';
import CanvasNodeImage from '@/components/canvas/CanvasNodeImage';

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

const REPLACE_INPUT_ACCEPT =
  'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';

async function getImageFileDimensions(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width;
    const h = bmp.height;
    bmp.close();
    return w > 0 && h > 0 ? { w, h } : null;
  } catch {
    return null;
  }
}

function getVideoFileDimensions(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    const finish = (dims: { w: number; h: number } | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      v.onloadedmetadata = null;
      v.onerror = null;
      v.removeAttribute('src');
      resolve(dims);
    };
    v.onloadedmetadata = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      finish(w > 0 && h > 0 ? { w, h } : null);
    };
    v.onerror = () => finish(null);
    v.src = url;
  });
}

async function getMediaFileDimensions(file: File): Promise<{ w: number; h: number } | null> {
  if (file.type.startsWith('video/')) {
    return getVideoFileDimensions(file);
  }
  if (file.type.startsWith('image/')) {
    return getImageFileDimensions(file);
  }
  return null;
}

const UploadNode = memo(({ id, data, selected }: NodeProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mediaDims, setMediaDims] = useState<{ w: number; h: number } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const updateNodeDataSilent = useWorkflowStore((s) => s.updateNodeDataSilent);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const s1 = useMemo(() => stage1Complete(nodes), [nodes]);
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

  useEffect(() => {
    setMediaDims(null);
  }, [mediaUrl]);

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
        const [{ url }, measured] = await Promise.all([
          uploadWorkflowMedia(file),
          getMediaFileDimensions(file),
        ]);
        updateNodeData(id, {
          mediaUrl: url,
          label: file.name,
          mediaIntrinsicW: measured?.w,
          mediaIntrinsicH: measured?.h,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setUploadError(msg);
        notifyError('Upload failed', msg);
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

  const onReplaceInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) void onDrop([file]);
    },
    [onDrop]
  );

  const storedW = data.mediaIntrinsicW as number | undefined;
  const storedH = data.mediaIntrinsicH as number | undefined;
  const displayDims =
    mediaDims ??
    (typeof storedW === 'number' &&
    typeof storedH === 'number' &&
    storedW > 0 &&
    storedH > 0
      ? { w: storedW, h: storedH }
      : null);
  const syncDimsFromElement = useCallback(
    (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      setMediaDims({ w, h });
      updateNodeDataSilent(id, { mediaIntrinsicW: w, mediaIntrinsicH: h });
    },
    [id, updateNodeDataSilent]
  );

  return (
    <FlowNodeResizeRoot
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
        className={`glass-node glass-node-input relative flex w-full flex-1 flex-col min-h-0 overflow-hidden ${isRunning ? 'ring-1 ring-amber-500/40' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
        <NodeActionBar
          hidden={Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden)}
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
          connectMenuItems={connectMenuItems}
        />

        <NodeContentFocus nodeId={id} shellMoveCursor>
          <div
            className={`rounded-xl border-2 transition-colors flex flex-1 flex-col min-h-0 ${
              contentFocused
                ? 'border-[hsl(217_91%_60%)] shadow-[0_0_0_3px_hsla(217,91%,60%,0.15)]'
                : 'border-transparent'
            }`}
          >
            <div className="rounded-[10px] overflow-hidden bg-[var(--node-inner-deep)] flex min-h-0 min-w-0 flex-1 flex-col">
              {mediaUrl ? (
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="absolute inset-0 min-h-0 min-w-0 overflow-hidden">
                    {isVideoUrl(mediaUrl) ? (
                      <video
                        src={mediaUrl}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        loop
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          const el = e.currentTarget;
                          syncDimsFromElement(el.videoWidth, el.videoHeight);
                        }}
                      />
                    ) : (
                      <CanvasNodeImage
                        mediaUrl={mediaUrl}
                        quality={68}
                        resize="cover"
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onLoad={(e) => {
                          const el = e.currentTarget;
                          syncDimsFromElement(el.naturalWidth, el.naturalHeight);
                        }}
                      />
                    )}
                  </div>
                  {/* <div className="pointer-events-none absolute left-2 top-2 z-10">
                    {s1.hasLocation ? (
                      <span className="text-[9px] rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">
                        Location OK
                      </span>
                    ) : (
                      <span className="text-[9px] rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">
                        Add location
                      </span>
                    )}
                  </div> */}
                  {displayDims ? (
                    <div
                      className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white backdrop-blur-[2px]"
                      aria-hidden
                    >
                      {displayDims.w} × {displayDims.h}
                    </div>
                  ) : null}
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/55 via-black/25 to-transparent"
                    aria-hidden
                  />
                  <input
                    ref={replaceInputRef}
                    type="file"
                    className="sr-only"
                    accept={REPLACE_INPUT_ACCEPT}
                    onChange={onReplaceInputChange}
                    disabled={uploading}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    title="Replace image or video"
                    className={`${NODE_INTERACTIVE_CLASS} absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-[2px] transition-opacity hover:bg-black/55 disabled:cursor-wait disabled:opacity-60`}
                    onClick={() => replaceInputRef.current?.click()}
                  >
                    <ReplaceIcon size={14} strokeWidth={2} className="shrink-0 opacity-95" aria-hidden />
                    Replace
                  </button>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 pt-2">
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
          </div>
        </NodeContentFocus>

        <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

UploadNode.displayName = 'UploadNode';
export default UploadNode;
