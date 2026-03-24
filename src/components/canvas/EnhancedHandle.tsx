import { useMemo, useState } from 'react';
import { Handle, useNodeId, type Edge, type HandleProps, type Node } from 'reactflow';
import { Type, Image as ImageIcon, Video, type LucideIcon } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';

export type HandleDataType = 'text' | 'image' | 'video' | 'generic';

export type EnhancedHandleProps = Omit<HandleProps, 'children'> & {
  dataType?: HandleDataType;
};

function iconFor(dataType: HandleDataType): LucideIcon | null {
  switch (dataType) {
    case 'text':
      return Type;
    case 'image':
      return ImageIcon;
    case 'video':
      return Video;
    default:
      return null;
  }
}

/** Stable color per data kind (see `--handle-icon-*` in index.css). */
function iconColorClass(dataType: HandleDataType): string {
  switch (dataType) {
    case 'text':
      return 'text-[var(--handle-icon-text)]';
    case 'image':
      return 'text-[var(--handle-icon-image)]';
    case 'video':
      return 'text-[var(--handle-icon-video)]';
    default:
      return '';
  }
}

/**
 * React Flow handle with a data-type glyph on a shared chip (dark bg + light border) for consistent UX;
 * outer ring still reflects input (green) vs output (violet) / accent.
 */
export function EnhancedHandle({ dataType = 'generic', className = '', ...props }: EnhancedHandleProps) {
  const Icon = iconFor(dataType);
  const colorClass = iconColorClass(dataType);
  const hasGlyph = Icon != null;
  const nodeId = useNodeId();
  const handleId = props.id;
  const handleType = props.type;
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const edges = useWorkflowStore((s) => s.edges);
  const nodes = useWorkflowStore((s) => s.nodes);

  const connectedEdges = useMemo(() => {
    if (!nodeId) return [];
    if (handleType === 'target') {
      return edges.filter(
        (e) => e.target === nodeId && (e.targetHandle ?? 'default') === (handleId ?? 'default')
      );
    }
    return edges.filter(
      (e) => e.source === nodeId && (e.sourceHandle ?? 'default') === (handleId ?? 'default')
    );
  }, [edges, nodeId, handleType, handleId]);

  const linkedNodes = useMemo(() => {
    const byId = new Map<string, Node>(nodes.map((n) => [n.id, n]));
    return connectedEdges.map((e) => {
      const otherId = handleType === 'target' ? e.source : e.target;
      const other = byId.get(otherId);
      const d = (other?.data ?? {}) as Record<string, unknown>;
      const labelText = typeof d.labelText === 'string' && d.labelText.trim() ? d.labelText.trim() : '';
      const title = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : '';
      const label = labelText || title || `${other?.type ?? 'node'}:${otherId.slice(0, 8)}`;
      return { edge: e, nodeId: otherId, label, nodeType: other?.type ?? 'node' };
    });
  }, [connectedEdges, nodes, handleType]);

  return (
    <Handle
      className={`${className} ${hasGlyph ? 'port-with-type-glyph' : ''} !flex items-center justify-center p-0 [&>svg]:shrink-0`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
      }}
      onClick={(e) => {
        if (!hovered) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }}
      {...props}
    >
      {hovered ? (
        <span className="pointer-events-none text-[9px] font-mono-display leading-none text-[var(--node-control-text)]">
          {connectedEdges.length}
        </span>
      ) : Icon ? (
        <span
          className="port-type-glyph-inner pointer-events-none flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <Icon size={8} strokeWidth={2.35} className={colorClass} />
        </span>
      ) : null}
      {open && nodeId && (
        <div
          className={`absolute top-1/2 z-[70] -translate-y-1/2 ${
            handleType === 'target' ? 'left-5' : 'right-5'
          }`}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        >
          <div
            className={`absolute mt-1 max-h-52 w-56 overflow-y-auto rounded-lg border border-[var(--node-control-border)] bg-[var(--node-dropdown-bg)] p-1 shadow-xl ${
              handleType === 'target' ? 'left-0' : 'right-0'
            }`}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {linkedNodes.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-[var(--node-control-muted)]">
                No connections
              </div>
            ) : (
              linkedNodes.map((item) => (
                <div
                  key={item.edge.id}
                  className="rounded-md px-2 py-1.5 text-[11px] text-[var(--node-dropdown-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
                >
                  <div className="truncate">{item.label}</div>
                  <div className="truncate text-[10px] text-[var(--node-control-muted)]">
                    {item.nodeType} - {item.nodeId}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Handle>
  );
}
