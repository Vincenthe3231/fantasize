import { useMemo } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';

/**
 * Pattern B (inspector): lightweight React panel for the selected node on the Pixi board — no full node chrome in WebGL.
 */
export function PixiBoardInspector() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const selected = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const node = selected.length === 1 ? selected[0]! : null;

  if (!node) {
    return (
      <div className="fixed right-4 top-20 z-[120] w-[min(320px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#141416]/95 p-3 text-[11px] text-muted-foreground shadow-xl backdrop-blur-sm">
        <p className="font-mono-display text-[10px] uppercase tracking-wide text-foreground/80">Pixi board</p>
        <p className="mt-2">Select a node to inspect data (DOM editors stay on the React Flow path).</p>
      </div>
    );
  }

  const preview = JSON.stringify(node.data ?? {}, null, 0);
  const clipped = preview.length > 400 ? `${preview.slice(0, 400)}…` : preview;

  return (
    <div className="fixed right-4 top-20 z-[120] w-[min(320px,calc(100vw-2rem))] max-h-[min(70vh,480px)] overflow-auto rounded-lg border border-white/10 bg-[#141416]/95 p-3 text-[11px] shadow-xl backdrop-blur-sm">
      <p className="font-mono-display text-[10px] uppercase tracking-wide text-foreground/80">Inspector</p>
      <p className="mt-1 font-mono text-[10px] text-[var(--accent-color)]">{node.type}</p>
      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground break-all">{node.id}</p>
      <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{clipped}</pre>
    </div>
  );
}
