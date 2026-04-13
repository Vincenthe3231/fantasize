import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';
import { useWorkflowStore } from '@/stores/workflowStore';
import { getRichTextExtensions, type RichTextExtensionOptions } from './getRichTextExtensions';
import { NodeInlineRichToolbar } from './NodeInlineRichToolbar';
import { mentionLabelForNode } from './nodeMentionUtils';
import { useRichTextToolbarPortalPosition } from './useRichTextToolbarPortalPosition';

function isRichTextChromeTarget(node: EventTarget | null): boolean {
  return (
    node instanceof Element &&
    Boolean(node.closest('.node-canvas-dropdown') || node.closest('.node-canvas-popover'))
  );
}

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
  /** When focus leaves the field (and toolbar inside), e.g. flush coalesced undo history. */
  onFlushHistory?: () => void;
  /** Optional shell to align the portaled floating toolbar (e.g. glass card). Otherwise uses `.react-flow__node` or this field root. */
  toolbarAnchorRef?: RefObject<HTMLElement | null>;
  /** Portal host for the floating toolbar (default `document.body`). */
  toolbarMountEl?: HTMLElement | null;
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
  onFlushHistory,
  toolbarAnchorRef,
  toolbarMountEl,
}: RichTextFieldProps) {
  const getWorkflowNodes = useCallback(() => useWorkflowStore.getState().nodes, []);
  const workflowNodes = useWorkflowStore((s) => s.nodes);
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarPortalRef = useRef<HTMLDivElement>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const [portalAnchorEl, setPortalAnchorEl] = useState<HTMLElement | null>(null);
  const reduceMotion = useCanvasReduceMotion();

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

  const showToolbar = Boolean(editor && (isFocused || focusWithin));
  const usePortalToolbar = toolbarVariant === 'floating-above';

  useLayoutEffect(() => {
    if (!usePortalToolbar || !showToolbar) {
      setPortalAnchorEl(null);
      return;
    }
    const el =
      toolbarAnchorRef?.current ??
      rootRef.current?.closest('.react-flow__node') ??
      rootRef.current;
    setPortalAnchorEl(el);
  }, [usePortalToolbar, showToolbar, toolbarAnchorRef]);

  const portalPlacement = useRichTextToolbarPortalPosition(
    usePortalToolbar ? portalAnchorEl : null,
    usePortalToolbar && showToolbar,
    toolbarPortalRef
  );

  const portalHost = toolbarMountEl ?? (typeof document !== 'undefined' ? document.body : null);

  const handleBlurCapture = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && rootRef.current?.contains(next)) return;
      if (next && toolbarPortalRef.current?.contains(next)) return;
      if (next && isRichTextChromeTarget(next)) return;
      if (next === null && showToolbar) {
        requestAnimationFrame(() => {
          const ae = document.activeElement;
          if (ae instanceof Element) {
            if (rootRef.current?.contains(ae)) return;
            if (toolbarPortalRef.current?.contains(ae)) return;
            if (isRichTextChromeTarget(ae)) return;
          }
          setFocusWithin(false);
          onFlushHistory?.();
        });
        return;
      }
      setFocusWithin(false);
      onFlushHistory?.();
    },
    [onFlushHistory, showToolbar]
  );

  return (
    <div
      ref={rootRef}
      className={
        toolbarVariant === 'floating-above'
          ? `relative flex min-h-0 flex-1 flex-col ${className}`
          : `flex min-h-0 flex-1 flex-col ${className}`
      }
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={handleBlurCapture}
    >
      {usePortalToolbar && portalHost
        ? createPortal(
            <AnimatePresence>
              {showToolbar && editor && (
                <NodeInlineRichToolbar
                  key="vf-portal-toolbar"
                  editor={editor}
                  variant="floating-above"
                  portalPlacement={portalPlacement}
                  reduceMotion={reduceMotion}
                  toolbarMeasureRef={toolbarPortalRef}
                />
              )}
            </AnimatePresence>,
            portalHost
          )
        : null}
      {!usePortalToolbar ? (
        <AnimatePresence>
          {showToolbar && editor && (
            <NodeInlineRichToolbar key="vf-toolbar" editor={editor} variant={toolbarVariant} />
          )}
        </AnimatePresence>
      ) : null}
      <ScrollArea className="nowheel min-h-0 flex-1 overscroll-contain">
        <EditorContent editor={editor} />
      </ScrollArea>
    </div>
  );
}
