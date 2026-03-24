import type { Node as FlowNode } from 'reactflow';

export type MentionItem = { id: string; label: string; nodeType: string };

/** Annotation tips are not part of the generative graph; skip from @-references. */
const SKIP_TYPES = new Set<string>(['annotationNode']);

export function mentionLabelForNode(n: FlowNode): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const lt = d.labelText ?? d.title;
  if (typeof lt === 'string' && lt.trim()) return lt.trim();
  return `${n.type}:${n.id.slice(0, 8)}`;
}

/** Nodes that can be @-referenced in rich text (excludes annotation tips only). */
export function collectMentionCandidates(
  nodes: FlowNode[],
  query: string,
  excludeId?: string
): MentionItem[] {
  const q = query.trim().toLowerCase();
  const out: MentionItem[] = [];
  for (const n of nodes) {
    if (excludeId && n.id === excludeId) continue;
    if (SKIP_TYPES.has(n.type)) continue;
    const label = mentionLabelForNode(n);
    if (
      q &&
      !label.toLowerCase().includes(q) &&
      !n.id.toLowerCase().includes(q) &&
      !n.type.toLowerCase().includes(q)
    ) {
      continue;
    }
    out.push({ id: n.id, label, nodeType: n.type });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out.slice(0, 40);
}
