import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Eye, EyeOff, Copy, Trash2, Download, Maximize2 } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from '@/stores/workflowStore.constants';
import { useStore, type Node, type Edge } from 'reactflow';
import { shallow } from 'zustand/shallow';
import { canvasPerfFlags } from '@/lib/canvasPerf';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';
import { SelectionConnectMenu } from '@/components/canvas/SelectionConnectMenu';
import { upstreamImageItemsFromNode } from '@/lib/graphUpstreamPayload';
import { TooltipWrap } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const GROUP_COLOR_PRESETS: { label: string; value: string | undefined }[] = [
  { label: 'Accent', value: undefined },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
];

/** Shared classes for icon-shaped controls in the multiselect toolbar row. */
const SELECTION_BAR_ICON_CLASS =
  'flex items-center justify-center rounded-full p-2 text-muted-foreground transition-[color,background-color] duration-150 ease-out';

/** Space between bottom of this overlay and top edge of selected nodes (flow coords → screen). */
const OVERLAY_GAP = 16;
/**
 * Floating node action bar sits above the node (`translate(-100% - 8px)`). Without extra clearance,
 * the multiselect toolbar overlaps that pill and blocks clicks.
 */
const NODE_TOP_CHROME_CLEARANCE_PX = 56;

interface SelectionOverlayProps {
  nodes: Node[];
  edges: Edge[];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  /** Fewer viewport-driven commits during pan/zoom by quantizing RF transform (see `canvasPerfFlags`). */
  interactionCompressViewport?: boolean;
}

type FlowBounds = { minX: number; minY: number; maxX: number; maxY: number };

function getNodeDimensions(n: Node): { w: number; h: number } {
  const w =
    typeof (n as Node & { width?: number }).width === 'number'
      ? (n as Node & { width: number }).width
      : DEFAULT_NODE_W;
  const h =
    typeof (n as Node & { height?: number }).height === 'number'
      ? (n as Node & { height: number }).height
      : DEFAULT_NODE_H;
  return { w, h };
}

/** Top-left of a node in flow space, including parent offsets (nested / group children). */
function getAbsoluteFlowPosition(nodeId: string, allNodes: Node[]): { x: number; y: number } | null {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const pa = (node as Node & { positionAbsolute?: { x: number; y: number } }).positionAbsolute;
  if (pa != null && Number.isFinite(pa.x) && Number.isFinite(pa.y)) {
    return { x: pa.x, y: pa.y };
  }
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  let x = node.position.x;
  let y = node.position.y;
  let pid = node.parentId;
  while (pid) {
    const p = byId.get(pid);
    if (!p) break;
    x += p.position.x;
    y += p.position.y;
    pid = p.parentId;
  }
  return { x, y };
}

function getNodeFlowBounds(nodeId: string, allNodes: Node[]): FlowBounds | null {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const pos = getAbsoluteFlowPosition(nodeId, allNodes);
  if (!pos) return null;
  const { w, h } = getNodeDimensions(node);
  return { minX: pos.x, minY: pos.y, maxX: pos.x + w, maxY: pos.y + h };
}

/** Union of selected nodes in absolute flow coordinates (correct inside groups). */
function getSelectionBoundsAbsolute(selectedNodes: Node[], allNodes: Node[]): FlowBounds | null {
  if (selectedNodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of selectedNodes) {
    const b = getNodeFlowBounds(n.id, allNodes);
    if (!b) continue;
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

function flowToScreen(
  flowX: number,
  flowY: number,
  viewport: { x: number; y: number; zoom: number },
  wrapperRect: DOMRect
) {
  return {
    x: wrapperRect.left + viewport.x + flowX * viewport.zoom,
    y: wrapperRect.top + viewport.y + flowY * viewport.zoom,
  };
}

/** True if `nodeId` is selected or sits under a selected parent (e.g. child after group — children are not `selected`). */
function nodeIsUnderSelection(nodeId: string, allNodes: Node[], selectedIds: Set<string>): boolean {
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  let cur: Node | undefined = byId.get(nodeId);
  while (cur) {
    if (selectedIds.has(cur.id)) return true;
    const pid = cur.parentId;
    if (!pid) return false;
    cur = byId.get(pid);
  }
  return false;
}

/** Only allow schemes suitable for opening as an image in a new tab (avoid `javascript:` etc. from untrusted node data). */
function isSafeNewTabImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (/^https?:\/\//i.test(u)) return true;
  if (u.startsWith('blob:')) return true;
  if (u.startsWith('data:image/')) return true;
  return false;
}

/** First safe image URL among selected nodes (stable order) for opening in a new tab. */
function firstSelectionImageDownloadUrl(selection: Node[], allNodes: Node[]): string | null {
  const ordered = [...selection].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const n of ordered) {
    const items = upstreamImageItemsFromNode(n, allNodes);
    const raw = items[0]?.url;
    const u = typeof raw === 'string' ? raw.trim() : '';
    if (u && isSafeNewTabImageUrl(u)) return u;
  }
  return null;
}

function BarTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipWrap
      label={label}
      side="top"
      sideOffset={6}
      contentClassName="z-[80] max-w-[min(280px,calc(100vw-24px))]"
    >
      {children}
    </TooltipWrap>
  );
}

export default function SelectionOverlay({
  nodes,
  edges,
  wrapperRef,
  interactionCompressViewport = false,
}: SelectionOverlayProps) {
  const compress = Boolean(interactionCompressViewport);
  const [vx, vy, vzoom] = useStore(
    useCallback(
      (s) => {
        const [x, y, z] = s.transform;
        const q = compress
          ? Math.max(
              canvasPerfFlags.selectionOverlayViewportQuantizePx,
              canvasPerfFlags.selectionOverlayViewportStrongQuantizePx
            )
          : 0;
        if (q > 0) {
          return [Math.round(x / q) * q, Math.round(y / q) * q, z] as const;
        }
        return [x, y, z] as const;
      },
      [compress]
    ),
    shallow
  );
  const viewport = useMemo(() => ({ x: vx, y: vy, zoom: vzoom }), [vx, vy, vzoom]);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const removeEdgeById = useWorkflowStore((s) => s.removeEdgeById);
  const groupSelectedNodes = useWorkflowStore((s) => s.groupSelectedNodes);
  const ungroupSelectedNodes = useWorkflowStore((s) => s.ungroupSelectedNodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const focusedNodeContentId = useWorkflowStore((s) => s.focusedNodeContentId);

  const [groupColorChoice, setGroupColorChoice] = useState<string | undefined>(undefined);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const reduceMotion = useCanvasReduceMotion();

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedNodeIds = useMemo(() => new Set(selectedNodes.map((n) => n.id)), [selectedNodes]);
  /** Hide floating multiselect chrome while the user is focused inside the current selection (including grouped children). */
  const fadeChromeForContentFocus =
    focusedNodeContentId != null &&
    nodeIsUnderSelection(focusedNodeContentId, nodes, selectedNodeIds);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
  const allSelectedNodesHidden =
    selectedNodes.length > 0 &&
    selectedNodes.every((n) => Boolean((n.data as { nodeUiHidden?: boolean } | undefined)?.nodeUiHidden));
  const selectedGroupNodes = useMemo(() => selectedNodes.filter((n) => n.type === 'group'), [selectedNodes]);
  const selectedTopLevelNodes = useMemo(
    () => selectedNodes.filter((n) => n.type !== 'group' && !n.parentId),
    [selectedNodes]
  );
  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0;
  const canUngroup = selectedGroupNodes.length > 0;
  const canGroup = selectedTopLevelNodes.length > 0 && !canUngroup;
  const singleGroupSelected = selectedGroupNodes.length === 1 ? selectedGroupNodes[0]! : null;
  const showGroupColors = canGroup || singleGroupSelected !== null;

  const position = useMemo(() => {
    if (!hasSelection || selectedNodes.length === 0 || !wrapperRef.current) return null;

    const anchorToFocusedBody =
      focusedNodeContentId != null &&
      nodeIsUnderSelection(focusedNodeContentId, nodes, selectedNodeIds);

    const bounds: FlowBounds | null = anchorToFocusedBody
      ? getNodeFlowBounds(focusedNodeContentId, nodes)
      : getSelectionBoundsAbsolute(selectedNodes, nodes);

    const fallback = getSelectionBoundsAbsolute(selectedNodes, nodes);
    const b = bounds ?? fallback;
    if (!b) return null;

    const centerX = (b.minX + b.maxX) / 2;
    const topY = b.minY;
    const rect = wrapperRef.current.getBoundingClientRect();
    const screen = flowToScreen(centerX, topY, viewport, rect);
    const overlayWidth = 320;
    const hasColorRow = showGroupColors;
    // Approx. stacked height (color row + gaps + “Group” chip + toolbar); keep ≥ real DOM to avoid overlapping nodes.
    const overlayHeight = hasColorRow ? 132 : 88;
    let left = screen.x - overlayWidth / 2;
    let top =
      screen.y - overlayHeight - OVERLAY_GAP - NODE_TOP_CHROME_CLEARANCE_PX;
    left = Math.max(8, Math.min(window.innerWidth - overlayWidth - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - overlayHeight - 8, top));
    return { left, top };
  }, [
    hasSelection,
    selectedNodes,
    selectedNodeIds,
    nodes,
    viewport,
    wrapperRef,
    showGroupColors,
    focusedNodeContentId,
  ]);

  const handleDeleteSelection = () => {
    selectedEdges.forEach((e) => removeEdgeById(e.id));
    selectedNodes.forEach((n) => deleteNode(n.id));
  };

  const handleDuplicateSelection = () => {
    selectedNodes.forEach((n) => duplicateNode(n.id));
  };

  const downloadImageUrl = useMemo(
    () => firstSelectionImageDownloadUrl(selectedNodes, nodes),
    [selectedNodes, nodes]
  );

  const openImagePreview = useCallback(() => {
    if (!downloadImageUrl) return;
    setImagePreviewUrl(downloadImageUrl);
    setImagePreviewOpen(true);
  }, [downloadImageUrl]);

  const onImagePreviewOpenChange = useCallback((open: boolean) => {
    setImagePreviewOpen(open);
    if (!open) setImagePreviewUrl(null);
  }, []);

  const showFloatingChrome = hasSelection && position !== null;

  return (
    <>
    <AnimatePresence>
      {showFloatingChrome && (
      <motion.div
        key="vf-selection-overlay"
        className={`fixed z-[60] flex flex-col items-center gap-2 ${fadeChromeForContentFocus ? 'pointer-events-none' : ''}`}
        style={{ left: position.left, top: position.top }}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={
          reduceMotion
            ? { opacity: fadeChromeForContentFocus ? 0 : 1, y: 0 }
            : {
                opacity: fadeChromeForContentFocus ? 0 : 1,
                y: fadeChromeForContentFocus ? 4 : 0,
              }
        }
        exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      >
        {showGroupColors && (
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 backdrop-blur-sm bg-[var(--node-action-bar-bg)] border border-[var(--node-action-bar-border)] shadow-md">
            {GROUP_COLOR_PRESETS.map(({ label, value }) => {
              const isSelected =
                singleGroupSelected != null
                  ? (singleGroupSelected.data as { color?: string })?.color === value
                  : groupColorChoice === value;
              return (
                <TooltipWrap key={label} label={label} contentClassName="z-[80]">
                  <button
                    type="button"
                    className="h-5 w-5 shrink-0 rounded-full border-2 border-transparent transition-[box-shadow,border-color] hover:border-[var(--node-control-border)]"
                    style={{
                      background: value ?? 'var(--accent-color)',
                      boxShadow: isSelected ? '0 0 0 2px var(--text-primary)' : undefined,
                    }}
                    onClick={() => {
                      if (singleGroupSelected) {
                        updateNodeData(singleGroupSelected.id, { color: value });
                      } else {
                        setGroupColorChoice(value);
                      }
                    }}
                  />
                </TooltipWrap>
              );
            })}
          </div>
        )}
        <div className="flex h-10 items-center gap-1 rounded-full glass-toolbar px-3 py-0">
            <SelectionConnectMenu
              nodes={nodes}
              selectedNodes={selectedNodes}
              selectedNodeIds={selectedNodeIds}
              focusedNodeContentId={focusedNodeContentId}
            />
            <BarTooltip label={canUngroup ? 'Ungroup' : 'Group'}>
              <span className="inline-flex">
                <button
                  type="button"
                  className={cn(
                    SELECTION_BAR_ICON_CLASS,
                    canGroup || canUngroup ?
                      'hover:bg-muted/80 hover:text-foreground'
                    : 'cursor-not-allowed text-muted-foreground/30'
                  )}
                  onClick={() => {
                    if (!canGroup && !canUngroup) return;
                    if (canUngroup) ungroupSelectedNodes();
                    else groupSelectedNodes(groupColorChoice);
                  }}
                  disabled={!canGroup && !canUngroup}
                >
                  <Square size={16} />
                </button>
              </span>
            </BarTooltip>
            <BarTooltip label={allSelectedNodesHidden ? 'Show nodes' : 'Hide nodes'}>
              <span className="inline-flex">
                <button
                  type="button"
                  className={cn(SELECTION_BAR_ICON_CLASS, 'hover:bg-muted/80 hover:text-foreground')}
                  onClick={() => {
                    selectedNodes.forEach((n) =>
                      updateNodeData(n.id, { nodeUiHidden: !allSelectedNodesHidden })
                    );
                  }}
                >
                  {allSelectedNodesHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </span>
            </BarTooltip>
            <div className="mx-1 h-4 w-px bg-border" />
            <BarTooltip label="Duplicate">
              <span className="inline-flex">
                <button
                  type="button"
                  className={cn(SELECTION_BAR_ICON_CLASS, 'hover:bg-muted/80 hover:text-foreground')}
                  onClick={handleDuplicateSelection}
                >
                  <Copy size={16} />
                </button>
              </span>
            </BarTooltip>
            <BarTooltip label="Delete">
              <span className="inline-flex">
                <button
                  type="button"
                  className={cn(
                    SELECTION_BAR_ICON_CLASS,
                    'hover:bg-muted/80 hover:text-foreground hover:text-red-400'
                  )}
                  onClick={handleDeleteSelection}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </BarTooltip>
            <BarTooltip
              label={
                downloadImageUrl ?
                  'Open preview — same URL as the canvas image (browser cache)'
                : 'No previewable image in selection'
              }
            >
              <span className="inline-flex">
                <button
                  type="button"
                  className={cn(
                    SELECTION_BAR_ICON_CLASS,
                    downloadImageUrl ?
                      'hover:bg-muted/80 hover:text-foreground'
                    : 'cursor-not-allowed opacity-40'
                  )}
                  onClick={openImagePreview}
                  disabled={!downloadImageUrl}
                  aria-label="Open image preview"
                >
                  <Maximize2 size={16} />
                </button>
              </span>
            </BarTooltip>
            <BarTooltip
              label={
                downloadImageUrl ? 'Open image in new tab' : 'No downloadable image in selection'
              }
            >
              <span className="inline-flex">
                {downloadImageUrl ?
                  <a
                    href={downloadImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(SELECTION_BAR_ICON_CLASS, 'hover:bg-muted/80 hover:text-foreground')}
                    aria-label="Open image in new tab"
                  >
                    <Download size={16} />
                  </a>
                : <span
                    className={cn(SELECTION_BAR_ICON_CLASS, 'cursor-not-allowed opacity-40')}
                    aria-disabled="true"
                  >
                    <Download size={16} aria-hidden />
                  </span>
                }
              </span>
            </BarTooltip>
          </div>
      </motion.div>
      )}
    </AnimatePresence>
    <Dialog open={imagePreviewOpen} onOpenChange={onImagePreviewOpenChange}>
      <DialogContent
        className={cn(
          'gap-3 border-[var(--node-panel-border)] bg-[var(--background)] p-3 sm:p-4',
          'max-h-[min(92vh,1200px)] w-[min(96vw,1400px)] max-w-[min(96vw,1400px)] translate-x-[-50%] translate-y-[-50%] overflow-hidden'
        )}
      >
        <DialogHeader className="space-y-1 pr-8 text-left">
          <DialogTitle className="text-base">Image preview</DialogTitle>
          <DialogDescription className="text-xs">
            Same URL as the canvas thumbnail — shown at full decoded size (up to this window).
          </DialogDescription>
        </DialogHeader>
        {imagePreviewUrl ?
          <div className="flex max-h-[min(78vh,1000px)] w-full items-center justify-center overflow-auto rounded-md bg-black/40 p-1">
            <img
              src={imagePreviewUrl}
              alt=""
              className="h-auto max-h-[min(78vh,1000px)] w-auto max-w-full object-contain"
              decoding="async"
              draggable={false}
            />
          </div>
        : null}
      </DialogContent>
    </Dialog>
    </>
  );
}
