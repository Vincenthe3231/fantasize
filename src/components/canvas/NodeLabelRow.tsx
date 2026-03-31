import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { useWorkflowStore, type NodeType } from '@/stores/workflowStore';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';

const LABEL_DEBOUNCE_MS = 350;

export interface NodeLabelRowProps {
  nodeId: string;
  nodeType: NodeType;
  /** Shown as default before #n when labelText/title empty, e.g. "Text", "Assistant" */
  labelPrefix: string;
  icon?: React.ReactNode;
  /** If set and no labelText/title, show this before prefix #n (e.g. Upload data.label) */
  fallbackText?: string;
  className?: string;
}

/** Renamable label above the glass card; persists `labelText` (reads legacy `title`). */
export const NodeLabelRow = memo(function NodeLabelRow({
  nodeId,
  nodeType,
  labelPrefix,
  icon,
  fallbackText,
  className = '',
}: NodeLabelRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const snapshotRef = useRef<{ labelText?: unknown; title?: unknown }>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeDataSilent = useWorkflowStore((s) => s.updateNodeDataSilent);
  const commitNodeLabelRename = useWorkflowStore((s) => s.commitNodeLabelRename);
  const restoreNodeLabelSnapshot = useWorkflowStore((s) => s.restoreNodeLabelSnapshot);

  const data = useMemo(
    () => nodes.find((n) => n.id === nodeId)?.data ?? {},
    [nodes, nodeId]
  );

  const instanceIndex = useMemo(() => {
    const same = nodes.filter((n) => n.type === nodeType);
    const i = same.findIndex((n) => n.id === nodeId);
    return i >= 0 ? i + 1 : 1;
  }, [nodes, nodeId, nodeType]);

  const stored = (
    (data.labelText as string) ||
    (data.title as string) ||
    ''
  ).trim();
  const hidden = Boolean((data as { nodeUiHidden?: boolean }).nodeUiHidden);
  const fb = (fallbackText || '').trim();
  const display = stored || fb || `${labelPrefix} #${instanceIndex}`;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const scheduleSilentLabel = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        updateNodeDataSilent(nodeId, { labelText: value });
      }, LABEL_DEBOUNCE_MS);
    },
    [nodeId, updateNodeDataSilent]
  );

  const beginEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const store = useWorkflowStore.getState();
      const n = store.nodes.find((x) => x.id === nodeId);
      const d = n?.data ?? {};
      snapshotRef.current = { labelText: d.labelText, title: d.title };
      const same = store.nodes.filter((x) => x.type === nodeType);
      const i = same.findIndex((x) => x.id === nodeId);
      const idx = i >= 0 ? i + 1 : 1;
      const st = String(d.labelText ?? d.title ?? '').trim();
      const fbTrim = (fallbackText || '').trim();
      const disp = st || fbTrim || `${labelPrefix} #${idx}`;
      setDraft(st || disp);
      setEditing(true);
    },
    [nodeId, nodeType, labelPrefix, fallbackText]
  );

  const finishEdit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const v = draft.trim();
    commitNodeLabelRename(nodeId, v, snapshotRef.current);
    setEditing(false);
  }, [draft, nodeId, commitNodeLabelRename]);

  const cancelEdit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    restoreNodeLabelSnapshot(nodeId, snapshotRef.current);
    setEditing(false);
  }, [nodeId, restoreNodeLabelSnapshot]);

  if (hidden) return null;

  return (
    <div
      className={`${NODE_INTERACTIVE_CLASS} mb-1 flex items-center gap-1.5 px-0.5 text-[13px] text-[var(--text-primary)] min-h-[22px] ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={beginEdit}
        className="p-0.5 rounded shrink-0 text-[var(--node-control-muted)] hover:text-[var(--node-control-text)] hover:bg-[var(--node-action-bar-hover-bg)]"
        title="Rename"
      >
        <Pencil size={11} />
      </button>
      {editing ? (
        <input
          autoFocus
          draggable={false}
          className="flex-1 min-w-0 rounded px-2 py-0.5 text-[13px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[hsl(217_91%_60%)] bg-[var(--node-control-bg)] border border-[var(--node-control-border)]"
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            scheduleSilentLabel(v);
          }}
          onBlur={finishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="font-medium truncate cursor-text flex items-center gap-1.5 min-w-0"
          onClick={beginEdit}
        >
          {icon ? <span className="shrink-0 opacity-80">{icon}</span> : null}
          {display}
        </span>
      )}
    </div>
  );
});
