import { memo, useState, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { type NodeProps } from 'reactflow';
import { List, Plus, X, Check, Type, ImageIcon, Copy, FolderOpen, SlidersHorizontal, Sparkles, LayoutList, LayoutGrid, Settings, ChevronDown, Download, ExternalLink } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeLabelRow } from './NodeLabelRow';
import ResizableNodeWrapper from './ResizableNodeWrapper';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { deleteWorkflowMediaByPublicUrl } from '@/lib/uploadStorage';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';
import { mergeTextAndSortedListImages } from '@/lib/listNodeImageSort';
import { canvasPreviewImageUrl, canvasResponsiveSrcSet } from '@/lib/imageDelivery';

type ListItemType = 'text' | 'image';

interface ListItem {
  id: string;
  type: ListItemType;
  text?: string;
  mediaUrl?: string;
  mediaName?: string;
  referer?: string;
  generatedBy?: string;
  timestamp?: number;
  /** ISO-8601; used with timestamp for newest-first image order */
  created_at?: string;
  supabaseUrl?: string;
}

/** Preserve invariant: all text items first, then all image items (required by Reorder merge). New images prepend (newest first); new text appends after existing text. */
function splitListItems(items: ListItem[]) {
  const text: ListItem[] = [];
  const image: ListItem[] = [];
  for (const it of items) {
    if (it.type === 'text') text.push(it);
    else image.push(it);
  }
  return { text, image };
}

function mergeListItems(text: ListItem[], image: ListItem[]) {
  return [...text, ...image];
}

const ListNode = memo(({ id, data, selected }: NodeProps) => {
  const {
    updateNodeData,
    updateNodeDataSilent,
    runFromNode,
    deleteNode,
    duplicateNode,
  } = useWorkflowStore(
    useShallow((s) => ({
      updateNodeData: s.updateNodeData,
      updateNodeDataSilent: s.updateNodeDataSilent,
      runFromNode: s.runFromNode,
      deleteNode: s.deleteNode,
      duplicateNode: s.duplicateNode,
    }))
  );
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const reduceMotion = useCanvasReduceMotion();

  const items = useMemo(() => ((data.items as ListItem[]) || []) as ListItem[], [data.items]);
  const viewMode = (data.listViewMode as 'list' | 'grid') === 'grid' ? 'grid' : 'list';
  const addingText = Boolean(data.listAddingText);
  const textDraft = String(data.listTextDraft ?? '');
  const [hovered, setHovered] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setItems = useCallback((newItems: ListItem[]) => {
    updateNodeData(id, { items: newItems });
  }, [id, updateNodeData]);

  const closeTextEntry = useCallback(() => {
    updateNodeData(id, { listAddingText: false, listTextDraft: '' });
  }, [id, updateNodeData]);

  const addTextItem = () => {
    if (!textDraft.trim()) return;
    const { text, image } = splitListItems(items);
    updateNodeData(id, {
      items: mergeListItems(
        [...text, { id: `t-${Date.now()}`, type: 'text', text: textDraft.trim() }],
        image
      ),
      listAddingText: false,
      listTextDraft: '',
    });
  };

  const addMediaItem = (file: File) => {
    const url = URL.createObjectURL(file);
    const { text, image } = splitListItems(items);
    const now = Date.now();
    const created_at = new Date(now).toISOString();
    setItems(
      mergeTextAndSortedListImages(text, [
        { id: `m-${now}`, type: 'image', mediaUrl: url, mediaName: file.name, timestamp: now, created_at },
        ...image,
      ])
    );
  };

  const removeListImageFromStorage = useCallback((item: ListItem) => {
    if (item.type !== 'image') return;
    const supabaseOrHttps =
      item.supabaseUrl?.trim() ||
      (item.mediaUrl?.trim() && /^https?:\/\//i.test(item.mediaUrl.trim()) ? item.mediaUrl.trim() : '');
    if (supabaseOrHttps) void deleteWorkflowMediaByPublicUrl(supabaseOrHttps);
    const media = item.mediaUrl?.trim() ?? '';
    if (media.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(media);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const selectedImageIds = useMemo(
    () => (((data.listSelectedImageIds as string[] | undefined) ?? []) as string[]).filter(Boolean),
    [data.listSelectedImageIds]
  );
  const selectedImageIdSet = useMemo(() => new Set(selectedImageIds), [selectedImageIds]);
  const multiSelectMode = Boolean(data.listMultiSelectMode);

  const removeItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) removeListImageFromStorage(item);
    setItems(items.filter((i) => i.id !== itemId));
    if (selectedImageIdSet.has(itemId)) {
      updateNodeData(id, { listSelectedImageIds: selectedImageIds.filter((sid) => sid !== itemId) });
    }
  };

  const clearAllItems = useCallback(() => {
    for (const it of items) {
      removeListImageFromStorage(it);
    }
    updateNodeData(id, {
      items: [],
      listAddingText: false,
      listTextDraft: '',
      listSelectedImageIds: [],
    });
  }, [items, id, removeListImageFromStorage, updateNodeData]);

  const toggleImageSelectionMode = useCallback(() => {
    updateNodeData(id, { listMultiSelectMode: !multiSelectMode });
  }, [id, multiSelectMode, updateNodeData]);

  const toggleImageSelected = useCallback((itemId: string) => {
    const next = selectedImageIdSet.has(itemId)
      ? selectedImageIds.filter((sid) => sid !== itemId)
      : [...selectedImageIds, itemId];
    updateNodeData(id, { listSelectedImageIds: next });
  }, [id, selectedImageIdSet, selectedImageIds, updateNodeData]);

  const openImage = (url: string) => {
    const u = url.trim();
    if (!u) return;
    window.open(u, '_blank', 'noopener,noreferrer');
  };

  const downloadImage = (url: string, fallbackName: string) => {
    const u = url.trim();
    if (!u) return;
    try {
      if (u.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = u;
        const ext =
          u.startsWith('data:image/png') ? 'png'
          : u.startsWith('data:image/jpeg') || u.startsWith('data:image/jpg') ? 'jpg'
          : u.startsWith('data:image/webp') ? 'webp'
          : u.startsWith('data:image/gif') ? 'gif'
          : 'png';
        a.download = `${fallbackName}.${ext}`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const a = document.createElement('a');
      a.href = u;
      a.download = fallbackName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(u, '_blank', 'noopener,noreferrer');
    }
  };

  const textItems = useMemo(() => items.filter((i) => i.type === 'text'), [items]);
  const imageItems = useMemo(() => items.filter((i) => i.type === 'image'), [items]);
  const listThumbSrc = useCallback(
    (item: ListItem) => canvasPreviewImageUrl(item.mediaUrl || '/placeholder.svg', { width: 112, height: 112, quality: 55 }),
    []
  );
  const gridThumbSrc = useCallback(
    (item: ListItem) => canvasPreviewImageUrl(item.mediaUrl || '/placeholder.svg', { width: 240, height: 240, quality: 58 }),
    []
  );
  const gridThumbSrcSet = useCallback(
    (item: ListItem) => canvasResponsiveSrcSet(item.mediaUrl || '', [160, 240, 320], { quality: 58 }),
    []
  );
  const textCount = textItems.length;
  const imageCount = imageItems.length;
  const selectedImageCount = useMemo(
    () => imageItems.filter((item) => selectedImageIdSet.has(item.id)).length,
    [imageItems, selectedImageIdSet]
  );
  const countLabel = useMemo(
    () => [textCount && `${textCount} text`, imageCount && `${imageCount} image`].filter(Boolean).join(', '),
    [textCount, imageCount]
  );
  const imageSelectionLabel =
    imageCount > 0 && multiSelectMode ? `${selectedImageCount}/${imageCount} selected` : `${imageCount} images`;

  const legacyLabel = (data.label as string) || '';

  return (
    <ResizableNodeWrapper selected={!!selected} minWidth={260} minHeight={120}>
      <div className="flex h-full w-full min-h-0 flex-col">
        <NodeLabelRow
          nodeId={id}
          nodeType="listNode"
          labelPrefix="List"
          icon={<List size={12} />}
          fallbackText={legacyLabel}
        />
        <div
          className={`glass-node relative flex min-h-0 w-full flex-1 flex-col ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
        <NodeActionBar
          hidden={Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden)}
          onRun={() => runFromNode(id)}
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
        />

        {/* Body */}
        <div className="flex min-h-[80px] flex-col p-3">
          {items.length === 0 && !addingText ? (
            /* Empty state */
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
              <List size={28} className="text-[var(--node-control-muted)]" />
              <div className="text-center">
                <p className="text-[12px] font-medium text-[var(--node-control-text)]">No elements yet</p>
                <p className="mt-0.5 text-[10px] text-[var(--node-control-muted)]">Add elements to this list</p>
              </div>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateNodeData(id, { listAddingText: true })}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--node-control-border)] bg-[var(--node-control-bg)] px-3 py-1.5 text-[11px] text-[var(--node-control-text)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)]"
                >
                  <Type size={12} /> Add text
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--node-control-border)] bg-[var(--node-control-bg)] px-3 py-1.5 text-[11px] text-[var(--node-control-text)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)]"
                >
                  <ImageIcon size={12} /> Add media
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Text entry bar */}
              <AnimatePresence initial={false}>
                {addingText && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                    animate={reduceMotion ? { opacity: 1, height: 'auto' } : { opacity: 1, height: 'auto' }}
                    exit={reduceMotion ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                    className="mb-2"
                  >
                    <div className="rounded-lg border border-[var(--node-control-border)] bg-[var(--node-control-bg)] p-2">
                      <input
                        autoFocus
                        draggable={false}
                        value={textDraft}
                        onChange={(e) => updateNodeDataSilent(id, { listTextDraft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTextItem();
                          if (e.key === 'Escape') closeTextEntry();
                          e.stopPropagation();
                        }}
                        placeholder="Type text and press Enter…"
                        className="w-full bg-transparent text-[12px] text-[var(--node-control-text)] outline-none placeholder:text-[var(--node-control-muted)]"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      />
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-[var(--node-control-muted)]">Aa</span>
                        <button type="button" onClick={() => navigator.clipboard.writeText(textDraft)} className="p-1 text-[var(--node-control-muted)] hover:text-[var(--node-control-text)]"><Copy size={11} /></button>
                        <div className="flex-1" />
                        <button type="button" onClick={closeTextEntry} className="p-1 text-[var(--node-control-muted)] hover:text-destructive"><X size={12} /></button>
                        <button type="button" onClick={addTextItem} className="p-1 text-[var(--node-control-muted)] hover:text-emerald-500"><Check size={12} /></button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Items */}
              {items.length > 0 && (
                <ScrollArea className="nowheel max-h-[300px] flex-1">
                  <div className="space-y-1 pr-2">
                  {/* Text items always in list */}
                  {textItems.length > 0 && !reduceMotion && (
                    <Reorder.Group
                      axis="y"
                      values={textItems}
                      onReorder={(newTextItems) => {
                        setItems([...newTextItems, ...imageItems]);
                      }}
                      className="mb-2 space-y-1"
                    >
                      {textItems.map((item) => (
                        <Reorder.Item key={item.id} value={item} className="cursor-grab active:cursor-grabbing">
                          <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--node-action-bar-hover-bg)]">
                            <Type size={11} className="mt-0.5 shrink-0 text-[var(--node-control-muted)]" />
                            <span className="flex-1 break-words text-[12px] text-[var(--node-control-text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{item.text}</span>
                            <button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-[var(--node-control-muted)] opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><X size={11} /></button>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                  {textItems.length > 0 && reduceMotion && (
                    <div className="mb-2 space-y-1">
                      {textItems.map((item) => (
                        <div key={item.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5">
                          <Type size={11} className="mt-0.5 shrink-0 text-[var(--node-control-muted)]" />
                          <span className="flex-1 break-words text-[12px] text-[var(--node-control-text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{item.text}</span>
                          <button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-[var(--node-control-muted)] hover:text-destructive"><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Media items — list or grid */}
                  {viewMode === 'list' && !reduceMotion ? (
                    <Reorder.Group
                      axis="y"
                      values={imageItems}
                      onReorder={(newImageItems) => {
                        setItems([...textItems, ...newImageItems]);
                      }}
                      className="space-y-0.5"
                    >
                      {imageItems.map((item) => (
                        <Reorder.Item key={item.id} value={item} className="cursor-grab active:cursor-grabbing">
                          <div className="group flex items-center gap-2.5 rounded-lg border-b border-[var(--node-divider)] px-2 py-1.5 transition-colors last:border-b-0 hover:bg-[var(--node-action-bar-hover-bg)]">
                            {multiSelectMode && (
                              <button
                                type="button"
                                onClick={() => toggleImageSelected(item.id)}
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                  selectedImageIdSet.has(item.id)
                                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                    : 'border-[var(--node-control-border)] text-transparent hover:text-[var(--node-control-muted)]'
                                }`}
                                title={selectedImageIdSet.has(item.id) ? 'Deselect image' : 'Select image'}
                              >
                                <Check size={10} />
                              </button>
                            )}
                            <img
                              src={listThumbSrc(item)}
                              alt={item.mediaName}
                              width={56}
                              height={56}
                              loading="lazy"
                              decoding="async"
                              className="h-14 w-14 shrink-0 rounded-lg bg-[var(--node-control-bg)] object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] text-[var(--node-control-text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{item.mediaName}</p>
                              <p className="mt-0.5 font-mono text-[11px] text-[var(--node-control-muted)]">
                                {item.generatedBy ? 'Generated' : 'Uploaded'}
                                {item.referer ? ` • ${item.referer}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openImage(item.supabaseUrl || item.mediaUrl || '')}
                              className="shrink-0 text-[var(--node-control-muted)] opacity-0 transition-opacity hover:text-[var(--node-control-text)] group-hover:opacity-100"
                              title="Open preview"
                            >
                              <ExternalLink size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadImage(item.supabaseUrl || item.mediaUrl || '', item.mediaName || `image-${item.id}`)}
                              className="shrink-0 text-[var(--node-control-muted)] opacity-0 transition-opacity hover:text-[var(--node-control-text)] group-hover:opacity-100"
                              title="Download image"
                            >
                              <Download size={11} />
                            </button>
                            <button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-[var(--node-control-muted)] opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><X size={11} /></button>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  ) : viewMode === 'list' ? (
                    <div className="space-y-0.5">
                      {imageItems.map((item) => (
                        <div key={item.id} className="group flex items-center gap-2.5 rounded-lg border-b border-[var(--node-divider)] px-2 py-1.5 last:border-b-0">
                          {multiSelectMode && (
                            <button
                              type="button"
                              onClick={() => toggleImageSelected(item.id)}
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                selectedImageIdSet.has(item.id)
                                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                  : 'border-[var(--node-control-border)] text-transparent hover:text-[var(--node-control-muted)]'
                              }`}
                              title={selectedImageIdSet.has(item.id) ? 'Deselect image' : 'Select image'}
                            >
                              <Check size={10} />
                            </button>
                          )}
                          <img
                            src={listThumbSrc(item)}
                            alt={item.mediaName}
                            width={56}
                            height={56}
                            loading="lazy"
                            decoding="async"
                            className="h-14 w-14 shrink-0 rounded-lg bg-[var(--node-control-bg)] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-[var(--node-control-text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{item.mediaName}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-[var(--node-control-muted)]">
                              {item.generatedBy ? 'Generated' : 'Uploaded'}
                              {item.referer ? ` • ${item.referer}` : ''}
                            </p>
                          </div>
                          <button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-[var(--node-control-muted)] hover:text-destructive"><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 p-1">
                      {imageItems.map((item) => (
                        <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-[var(--node-control-bg)]">
                          <img
                            src={gridThumbSrc(item)}
                            srcSet={gridThumbSrcSet(item)}
                            sizes="(max-width: 900px) 20vw, 120px"
                            alt={item.mediaName}
                            width={120}
                            height={120}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => openImage(item.supabaseUrl || item.mediaUrl || '')}
                            className="absolute left-1 top-1 z-10 rounded-full bg-[var(--node-badge-bg)] p-0.5 text-[var(--node-overlay-text)] opacity-0 transition-opacity group-hover:opacity-100"
                            title="Open preview"
                          >
                            <ExternalLink size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadImage(item.supabaseUrl || item.mediaUrl || '', item.mediaName || `image-${item.id}`)}
                            className="absolute left-7 top-1 z-10 rounded-full bg-[var(--node-badge-bg)] p-0.5 text-[var(--node-overlay-text)] opacity-0 transition-opacity group-hover:opacity-100"
                            title="Download image"
                          >
                            <Download size={10} />
                          </button>
                          <button type="button" onClick={() => removeItem(item.id)} className="absolute right-1 top-1 z-10 rounded-full bg-[var(--node-badge-bg)] p-0.5 text-[var(--node-overlay-text)] opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><X size={10} /></button>
                          {multiSelectMode && (
                            <button
                              type="button"
                              onClick={() => toggleImageSelected(item.id)}
                              className={`absolute left-1 bottom-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                                selectedImageIdSet.has(item.id)
                                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                                  : 'border-[var(--node-control-border)] bg-[var(--node-badge-bg)] text-transparent hover:text-[var(--node-overlay-text)]'
                              }`}
                              title={selectedImageIdSet.has(item.id) ? 'Deselect image' : 'Select image'}
                            >
                              <Check size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="nodrag nopan flex h-[38px] shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap border-t border-[var(--node-panel-border)] bg-[var(--node-control-bg)] px-3 py-2 text-[10px] [&>*]:shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="rounded-md bg-[var(--node-control-bg)] p-1 text-[var(--node-control-text)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)]"><Plus size={12} /></button>
            </PopoverTrigger>
            <PopoverContent side="top" className="node-canvas-popover w-36 p-1.5 backdrop-blur-xl" align="start">
              <button
                type="button"
                onClick={() => updateNodeData(id, { listAddingText: true })}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-[var(--node-popover-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
              >
                <Type size={12} /> Add text
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-[var(--node-popover-text)] hover:bg-[var(--node-action-bar-hover-bg)]"><ImageIcon size={12} /> Add media</button>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-1 rounded-md bg-[var(--node-control-bg)] px-2 py-1 text-[var(--node-control-text)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)]">
                Keep Items <ChevronDown size={9} className="text-[var(--node-control-muted)]" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="node-canvas-popover w-36 p-1.5 backdrop-blur-xl" align="start">
              <button type="button" className="w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-[var(--node-popover-text)] hover:bg-[var(--node-action-bar-hover-bg)]">Keep Items</button>
              <button type="button" className="w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-[var(--node-popover-text)] hover:bg-[var(--node-action-bar-hover-bg)]">Replace Items</button>
              <button
                type="button"
                onClick={clearAllItems}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-destructive hover:bg-[var(--node-action-bar-hover-bg)]"
              >
                Clear All
              </button>
            </PopoverContent>
          </Popover>

          <div className="flex-1" />

          {items.length > 0 && imageCount > 0 ? (
            <motion.button
              type="button"
              onClick={toggleImageSelectionMode}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                multiSelectMode
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-[var(--node-control-muted)] hover:bg-[var(--node-action-bar-hover-bg)]'
              }`}
              title={multiSelectMode ? 'Disable image multi-selection' : 'Enable image multi-selection'}
            >
              {imageSelectionLabel} <Check size={9} />
            </motion.button>
          ) : items.length > 0 ? (
            <span className="flex items-center gap-1 text-[var(--node-control-muted)]">
              {countLabel} <Check size={9} />
            </span>
          ) : null}

          <button
            type="button"
            title="List view"
            onClick={() => updateNodeData(id, { listViewMode: 'list' })}
            className={`rounded p-1 transition-colors ${viewMode === 'list' ? 'bg-[var(--node-tab-active-bg)] text-[var(--node-control-text)]' : 'text-[var(--node-tab-inactive)] hover:text-[var(--node-control-text)]'}`}
          >
            <LayoutList size={11} />
          </button>
          <button
            type="button"
            title="Grid view"
            onClick={() => updateNodeData(id, { listViewMode: 'grid' })}
            className={`rounded p-1 transition-colors ${viewMode === 'grid' ? 'bg-[var(--node-tab-active-bg)] text-[var(--node-control-text)]' : 'text-[var(--node-tab-inactive)] hover:text-[var(--node-control-text)]'}`}
          >
            <LayoutGrid size={11} />
          </button>
          <button type="button" className="rounded p-1 text-[var(--node-tab-inactive)] transition-colors hover:text-[var(--node-control-text)]"><Settings size={11} /></button>
        </div>

        {/* Side action buttons */}
        <AnimatePresence>
          {(hovered || selected) && !Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden) && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute -right-10 top-1/2 flex -translate-y-1/2 flex-col gap-1.5"
            >
              {[
                { icon: Type, action: () => updateNodeData(id, { listAddingText: true }), tip: 'Add text' },
                { icon: ImageIcon, action: () => fileRef.current?.click(), tip: 'Add media' },
                { icon: FolderOpen, action: () => {}, tip: 'Group' },
                { icon: SlidersHorizontal, action: () => {}, tip: 'Settings' },
                { icon: Sparkles, action: () => {}, tip: 'AI' },
              ].map(({ icon: Icon, action, tip }) => (
                <button
                  key={tip}
                  type="button"
                  onClick={action}
                  title={tip}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--node-float-btn-border)] bg-[var(--node-float-btn-bg)] text-[var(--node-control-muted)] transition-colors hover:bg-[var(--node-action-bar-hover-bg)] hover:text-[var(--node-control-text)]"
                >
                  <Icon size={12} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <DefaultNodePortHandles />

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addMediaItem(file);
            e.target.value = '';
          }}
        />
        </div>
      </div>
    </ResizableNodeWrapper>
  );
});

ListNode.displayName = 'ListNode';
export default ListNode;
