import { memo, useState, useRef, useCallback } from 'react';
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
  supabaseUrl?: string;
}

const ListNode = memo(({ id, data, selected }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const updateNodeDataSilent = useWorkflowStore((s) => s.updateNodeDataSilent);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);

  const items: ListItem[] = (data.items as ListItem[]) || [];
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
    updateNodeData(id, {
      items: [...items, { id: `t-${Date.now()}`, type: 'text', text: textDraft.trim() }],
      listAddingText: false,
      listTextDraft: '',
    });
  };

  const addMediaItem = (file: File) => {
    const url = URL.createObjectURL(file);
    setItems([...items, { id: `m-${Date.now()}`, type: 'image', mediaUrl: url, mediaName: file.name }]);
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

  const removeItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) removeListImageFromStorage(item);
    setItems(items.filter((i) => i.id !== itemId));
  };

  const clearAllItems = useCallback(() => {
    for (const it of items) {
      removeListImageFromStorage(it);
    }
    updateNodeData(id, {
      items: [],
      listAddingText: false,
      listTextDraft: '',
    });
  }, [items, id, removeListImageFromStorage, updateNodeData]);

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

  const textItems = items.filter((i) => i.type === 'text');
  const imageItems = items.filter((i) => i.type === 'image');
  const textCount = textItems.length;
  const imageCount = imageItems.length;
  const countLabel = [textCount && `${textCount} text`, imageCount && `${imageCount} image`].filter(Boolean).join(', ');

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
              <AnimatePresence>
                {addingText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
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
                  {textItems.length > 0 && (
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

                  {/* Media items — list or grid */}
                  {viewMode === 'list' ? (
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
                            <img src={item.mediaUrl || '/placeholder.svg'} alt={item.mediaName} className="h-14 w-14 shrink-0 rounded-lg bg-[var(--node-control-bg)] object-cover" />
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
                  ) : (
                    <div className="grid grid-cols-3 gap-2 p-1">
                      {imageItems.map((item) => (
                        <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-[var(--node-control-bg)]">
                          <img src={item.mediaUrl || '/placeholder.svg'} alt={item.mediaName} className="h-full w-full object-cover" />
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
        <div className="flex items-center gap-1.5 border-t border-[var(--node-panel-border)] px-3 py-2 text-[10px]">
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

          {items.length > 0 && (
            <span className="flex items-center gap-1 text-[var(--node-control-muted)]">
              {imageCount > 0 && textCount === 0 ? `${imageCount} images` : countLabel} <Check size={9} />
            </span>
          )}

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
          {(hovered || selected) && (
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
