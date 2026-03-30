import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  ChevronDown,
  Square,
  Grid3X3,
  EyeOff,
  Copy,
  Trash2,
  Download,
  CornerUpRight,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useViewport, type Node, type Edge } from 'reactflow';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';

const GROUP_COLOR_PRESETS: { label: string; value: string | undefined }[] = [
  { label: 'Accent', value: undefined },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
];

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 120;
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
}

function getSelectionBounds(nodes: Node[]) {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const w = typeof (n as Node & { width?: number }).width === 'number' ? (n as Node & { width: number }).width : DEFAULT_NODE_WIDTH;
    const h = typeof (n as Node & { height?: number }).height === 'number' ? (n as Node & { height: number }).height : DEFAULT_NODE_HEIGHT;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  return { minX, minY, maxX, maxY };
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

export default function SelectionOverlay({ nodes, edges, wrapperRef }: SelectionOverlayProps) {
  const viewport = useViewport();
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const removeEdgeById = useWorkflowStore((s) => s.removeEdgeById);
  const groupSelectedNodes = useWorkflowStore((s) => s.groupSelectedNodes);
  const ungroupSelectedNodes = useWorkflowStore((s) => s.ungroupSelectedNodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const [groupColorChoice, setGroupColorChoice] = useState<string | undefined>(undefined);
  const reduceMotion = useCanvasReduceMotion();

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
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
    const bounds = getSelectionBounds(selectedNodes);
    if (!bounds) return null;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const topY = bounds.minY;
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
  }, [hasSelection, selectedNodes, viewport, wrapperRef, showGroupColors]);

  const handleDeleteSelection = () => {
    selectedEdges.forEach((e) => removeEdgeById(e.id));
    selectedNodes.forEach((n) => deleteNode(n.id));
  };

  const handleDuplicateSelection = () => {
    selectedNodes.forEach((n) => duplicateNode(n.id));
  };

  if (!hasSelection || position === null) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed z-[60] flex flex-col items-center gap-2"
        style={{ left: position.left, top: position.top }}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
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
                <button
                  key={label}
                  type="button"
                  className="h-5 w-5 shrink-0 rounded-full border-2 border-transparent transition-[box-shadow,border-color] hover:border-[var(--node-control-border)]"
                  style={{
                    background: value ?? 'var(--accent-color)',
                    boxShadow: isSelected ? '0 0 0 2px var(--text-primary)' : undefined,
                  }}
                  title={label}
                  onClick={() => {
                    if (singleGroupSelected) {
                      updateNodeData(singleGroupSelected.id, { color: value });
                    } else {
                      setGroupColorChoice(value);
                    }
                  }}
                />
              );
            })}
          </div>
        )}
        <span className="rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm bg-[var(--node-action-bar-bg)] border border-[var(--node-action-bar-border)] text-[var(--text-primary)] shadow-md">
          {canUngroup ? 'Ungroup' : 'Group'}
        </span>
        <div className="flex h-10 items-center gap-1 rounded-full glass-toolbar px-3 py-0">
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            title="Connector"
          >
            <Link2 size={16} />
            <ChevronDown size={12} className="ml-0.5 opacity-70" />
          </button>
          <button
            type="button"
            className={`flex items-center justify-center rounded-full p-2 transition-colors ${
              canGroup || canUngroup
                ? 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                : 'text-muted-foreground/30 cursor-not-allowed'
            }`}
            title={canUngroup ? 'Ungroup' : 'Group'}
            onClick={() => {
              if (!canGroup && !canUngroup) return;
              if (canUngroup) ungroupSelectedNodes();
              else groupSelectedNodes(groupColorChoice);
            }}
            disabled={!canGroup && !canUngroup}
          >
            <Square size={16} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            title="Grid"
          >
            <Grid3X3 size={16} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            title="Hide"
          >
            <EyeOff size={16} />
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            title="Duplicate"
            onClick={handleDuplicateSelection}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground hover:text-red-400"
            title="Delete"
            onClick={handleDeleteSelection}
          >
            <Trash2 size={16} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            title="Download"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            title="Export"
          >
            <CornerUpRight size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
