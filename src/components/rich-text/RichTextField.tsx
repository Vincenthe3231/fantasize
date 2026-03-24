import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import { getRichTextExtensions, type RichTextExtensionOptions } from './getRichTextExtensions';
import { NodeInlineRichToolbar } from './NodeInlineRichToolbar';
import { mentionLabelForNode } from './nodeMentionUtils';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** TipTap expects HTML; plain strings become a single paragraph. */
export function normalizeIncomingRichHtml(raw: string): string {
  const t = raw?.trim() ?? '';
  if (!t) return '';
  if (t.startsWith('<')) return raw;
  return `<p>${escapeHtml(raw)}</p>`;
}

export type RichTextFieldProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  enableMentions?: boolean;
  excludeNodeId?: string;
  toolbarVariant?: 'floating-above' | 'top';
  /** Outer wrapper (e.g. relative flex flex-col for floating toolbar). */
  className?: string;
  /** Classes on TipTap editable root. */
  editorContentClassName?: string;
  /** Extra TipTap editor props (e.g. handleDOMEvents for React Flow). */
  editorProps?: Record<string, unknown>;
  /** Passed to useEditor dependency array when extensions must recreate. */
  extensionDeps?: unknown[];
};

export function RichTextField({
  value,
  onChange,
  placeholder = 'Write…',
  enableMentions = true,
  excludeNodeId,
  toolbarVariant = 'floating-above',
  className = '',
  editorContentClassName = 'w-full text-[13px] text-[var(--text-primary)] outline-none min-h-[80px] leading-relaxed prose prose-invert prose-sm max-w-none [&_blockquote]:border-l-[var(--accent-color)] [&_blockquote]:text-muted-foreground [&_pre]:bg-[var(--node-inner-deep)] [&_pre]:rounded-md [&_code]:text-[var(--accent-color)]',
  editorProps: extraEditorProps,
  extensionDeps = [],
}: RichTextFieldProps) {
  const getWorkflowNodes = useCallback(() => useWorkflowStore.getState().nodes, []);
  const workflowNodes = useWorkflowStore((s) => s.nodes);
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusWithin, setFocusWithin] = useState(false);

  const extensions = useMemo(
    () =>
      getRichTextExtensions({
        placeholder,
        enableMentions,
        getWorkflowNodes,
        excludeNodeId,
      } satisfies RichTextExtensionOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getWorkflowNodes is stable
    [placeholder, enableMentions, excludeNodeId, ...extensionDeps]
  );

  const editor = useEditor(
    {
      extensions,
      content: normalizeIncomingRichHtml(value),
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getHTML());
      },
      editorProps: {
        attributes: {
          class: editorContentClassName,
          style: 'font-family: Inter, sans-serif',
        },
        ...(extraEditorProps as object),
      },
    },
    [extensions]
  );

  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    const next = normalizeIncomingRichHtml(value);
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, false);
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor || !enableMentions) return;
    const byId = new Map(workflowNodes.map((n) => [n.id, mentionLabelForNode(n)]));
    let tr = editor.state.tr;
    let changed = false;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== 'mention') return;
      const id = String(node.attrs.id ?? '');
      if (!id) return;
      const nextLabel = byId.get(id);
      if (!nextLabel || nextLabel === node.attrs.label) return;
      tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: nextLabel });
      changed = true;
    });
    if (changed) {
      editor.view.dispatch(tr);
    }
  }, [editor, workflowNodes, enableMentions]);

  const { isFocused } = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({ isFocused: ed?.isFocused ?? false }),
  });

  return (
    <div
      ref={rootRef}
      className={
        toolbarVariant === 'floating-above'
          ? `relative flex min-h-0 flex-1 flex-col ${className}`
          : `flex min-h-0 flex-1 flex-col ${className}`
      }
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && rootRef.current?.contains(next)) return;
        setFocusWithin(false);
      }}
    >
      <AnimatePresence>
        {editor && (isFocused || focusWithin) && (
          <NodeInlineRichToolbar key="vf-toolbar" editor={editor} variant={toolbarVariant} />
        )}
      </AnimatePresence>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
