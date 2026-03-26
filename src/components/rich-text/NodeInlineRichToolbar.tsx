import { useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Strikethrough,
  Code,
  Quote,
  Undo2,
  Redo2,
  Minus,
  Link2,
  SquareCode,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { NODE_INTERACTIVE_CLASS } from '@/components/canvas/nodeResizeUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getRichTextBlockLabel } from './blockLabel';

const PRESET_COLORS = [
  '#e5e5e5',
  '#fca5a5',
  '#fdba74',
  '#fde047',
  '#86efac',
  '#67e8f9',
  '#93c5fd',
  '#c4b5fd',
  '#f0abfc',
  '#ffffff',
];

const defaultToolbar = {
  blockLabel: 'Paragraph',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrike: false,
  isCode: false,
  isBulletList: false,
  isOrderedList: false,
  isBlockquote: false,
  isCodeBlock: false,
  isLink: false,
  canUndo: false,
  canRedo: false,
  textColor: '' as string,
};

export type NodeInlineRichToolbarProps = {
  editor: Editor | null;
  /** Canvas: float above; top: bar above content inside container */
  variant?: 'floating-above' | 'top';
};

export function NodeInlineRichToolbar({ editor, variant = 'floating-above' }: NodeInlineRichToolbarProps) {
  const t = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return defaultToolbar;
      const attrs = ed.getAttributes('textStyle') as { color?: string };
      return {
        blockLabel: getRichTextBlockLabel(ed),
        isBold: ed.isActive('bold'),
        isItalic: ed.isActive('italic'),
        isUnderline: ed.isActive('underline'),
        isStrike: ed.isActive('strike'),
        isCode: ed.isActive('code'),
        isBulletList: ed.isActive('bulletList'),
        isOrderedList: ed.isActive('orderedList'),
        isBlockquote: ed.isActive('blockquote'),
        isCodeBlock: ed.isActive('codeBlock'),
        isLink: ed.isActive('link'),
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        textColor: (attrs?.color as string) || '',
      };
    },
  });

  const setBlockType = useCallback(
    (type: string) => {
      if (!editor) return;
      const c = editor.chain().focus();
      switch (type) {
        case 'paragraph':
          c.setParagraph().run();
          break;
        case 'h1':
          c.toggleHeading({ level: 1 }).run();
          break;
        case 'h2':
          c.toggleHeading({ level: 2 }).run();
          break;
        case 'h3':
          c.toggleHeading({ level: 3 }).run();
          break;
        case 'bullet':
          c.toggleBulletList().run();
          break;
        case 'ordered':
          c.toggleOrderedList().run();
          break;
        case 'blockquote':
          c.toggleBlockquote().run();
          break;
        case 'codeBlock':
          c.toggleCodeBlock().run();
          break;
        default:
          break;
      }
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (leave empty to remove)', prev ?? 'https://');
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  const setTextColor = useCallback(
    (hex: string) => {
      if (!editor) return;
      editor.chain().focus().setColor(hex).run();
    },
    [editor]
  );

  const clearTextColor = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetColor().run();
  }, [editor]);

  if (!editor || !t) return null;

  const motionStyle =
    variant === 'floating-above'
      ? { transform: 'translate(-50%, calc(-100% - 48px))' }
      : { transform: 'none' };

  const motionClass =
    variant === 'floating-above'
      ? `${NODE_INTERACTIVE_CLASS} node-inline-toolbar absolute left-1/2 -translate-x-1/2 flex max-w-[min(100%,calc(100vw-2rem))] flex-wrap items-center gap-0.5 px-2 py-1 rounded-lg z-50`
      : `${NODE_INTERACTIVE_CLASS} node-inline-toolbar flex w-full flex-wrap items-center gap-0.5 px-2 py-1 rounded-lg z-50 border-b border-[var(--node-control-border)] bg-[var(--node-inner-mid)]`;

  return (
    <motion.div
      className={motionClass}
      style={motionStyle}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.12 }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="node-inline-toolbar-btn px-2 py-1 rounded text-[11px] transition-colors max-w-[9rem] truncate"
            title="Block type"
            onPointerDown={(e) => {
              // Keep editor focus while opening the menu so toolbar doesn't unmount.
              e.preventDefault();
            }}
          >
            {t.blockLabel} ▾
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="node-canvas-dropdown p-0 text-xs">
          <ScrollArea className="max-h-[min(70vh,20rem)]">
            <div className="py-1">
              <DropdownMenuItem onClick={() => setBlockType('paragraph')}>Paragraph</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockType('h1')}>Heading 1</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockType('h2')}>Heading 2</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockType('h3')}>Heading 3</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockType('blockquote')}>Quote</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockType('codeBlock')}>Code block</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockType('bullet')}>Bullet list</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockType('ordered')}>Numbered list</DropdownMenuItem>
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="w-px h-4 node-inline-toolbar-divider shrink-0" />
      <button
        type="button"
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isBold ? 'is-active' : ''}`}
      >
        <Bold size={12} />
      </button>
      <button
        type="button"
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isItalic ? 'is-active' : ''}`}
      >
        <Italic size={12} />
      </button>
      <button
        type="button"
        title="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isUnderline ? 'is-active' : ''}`}
      >
        <Underline size={12} />
      </button>
      <button
        type="button"
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isStrike ? 'is-active' : ''}`}
      >
        <Strikethrough size={12} />
      </button>
      <button
        type="button"
        title="Inline code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isCode ? 'is-active' : ''}`}
      >
        <Code size={12} />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Text color"
            className="node-inline-toolbar-btn flex h-7 w-7 items-center justify-center rounded p-1 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="h-3.5 w-3.5 rounded-sm border border-[var(--node-control-border)]"
              style={{ backgroundColor: t.textColor || 'var(--text-primary)' }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="node-canvas-dropdown w-auto p-2" align="start" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 grid grid-cols-5 gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="h-6 w-6 rounded border border-[var(--node-control-border)]"
                style={{ backgroundColor: c }}
                title={c}
                onClick={() => setTextColor(c)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={t.textColor || '#e5e5e5'}
              onChange={(e) => setTextColor(e.target.value)}
              className="h-8 w-full cursor-pointer rounded border border-[var(--node-control-border)] bg-transparent"
            />
            <button
              type="button"
              className="shrink-0 rounded px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={clearTextColor}
            >
              Reset
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <div className="w-px h-4 node-inline-toolbar-divider shrink-0" />
      <button
        type="button"
        title="Link"
        onClick={setLink}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isLink ? 'is-active' : ''}`}
      >
        <Link2 size={12} />
      </button>
      <button
        type="button"
        title="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isBlockquote ? 'is-active' : ''}`}
      >
        <Quote size={12} />
      </button>
      <button
        type="button"
        title="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isCodeBlock ? 'is-active' : ''}`}
      >
        <SquareCode size={12} />
      </button>
      <div className="w-px h-4 node-inline-toolbar-divider shrink-0" />
      <button
        type="button"
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isBulletList ? 'is-active' : ''}`}
      >
        <List size={12} />
      </button>
      <button
        type="button"
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${t.isOrderedList ? 'is-active' : ''}`}
      >
        <ListOrdered size={12} />
      </button>
      <div className="w-px h-4 node-inline-toolbar-divider shrink-0" />
      <button
        type="button"
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="node-inline-toolbar-btn p-1.5 rounded transition-colors"
      >
        <Minus size={12} />
      </button>
      <div className="w-px h-4 node-inline-toolbar-divider shrink-0" />
      <button
        type="button"
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!t.canUndo}
        className="node-inline-toolbar-btn p-1.5 rounded transition-colors disabled:opacity-30"
      >
        <Undo2 size={12} />
      </button>
      <button
        type="button"
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!t.canRedo}
        className="node-inline-toolbar-btn p-1.5 rounded transition-colors disabled:opacity-30"
      >
        <Redo2 size={12} />
      </button>
    </motion.div>
  );
}
