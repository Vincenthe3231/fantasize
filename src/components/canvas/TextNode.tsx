import { memo, useCallback, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';
import FlowNodeResizeRoot from './FlowNodeResizeRoot';
import { Type, Bold, Italic, List, ListOrdered } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { DefaultNodePortHandles } from './DefaultNodePortHandles';
import { useQuickConnect } from '@/hooks/useQuickConnect';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TextNode = memo(({ id, data, selected }: NodeProps) => {
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const { connectMenuItems } = useQuickConnect(id, selfPos);

  const content = (data.content as string) || '';

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your prompt, notes, or comments…' }),
    ],
    content: content || '',
    onUpdate: ({ editor: e }) => {
      updateNodeData(id, { content: e.getHTML() });
    },
    editorProps: {
      attributes: {
        class:
          'w-full text-[13px] text-[var(--text-primary)] outline-none min-h-[80px] leading-relaxed prose prose-invert prose-sm max-w-none',
        style: 'font-family: Inter, sans-serif',
      },
      handleDOMEvents: {
        mousedown: (_, e) => { e.stopPropagation(); return false; },
        keydown: (_, e) => { e.stopPropagation(); return false; },
      },
    },
  });

  const isFocused = editor?.isFocused;

  const setBlockType = useCallback((type: string) => {
    if (!editor) return;
    switch (type) {
      case 'paragraph': editor.chain().focus().setParagraph().run(); break;
      case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
      case 'ordered': editor.chain().focus().toggleOrderedList().run(); break;
    }
  }, [editor]);

  return (
    <FlowNodeResizeRoot
      minWidth={200}
      minHeight={120}
      className="rf-node-resize-root relative flex flex-col min-h-0"
    >
      <NodeLabelRow nodeId={id} nodeType="textNode" labelPrefix="Text" icon={<Type size={12} />} />
      <div
        className={`glass-node glass-node-input relative flex w-full flex-1 flex-col min-h-0 ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/40' : ''}`}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="text"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        connectMenuItems={connectMenuItems}
      />

      {/* Inline formatting toolbar — visible when editor focused */}
      <AnimatePresence>
        {isFocused && editor && (
          <motion.div
            className={`${NODE_INTERACTIVE_CLASS} node-inline-toolbar absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-1 rounded-lg z-50`}
            style={{ transform: 'translate(-50%, calc(-100% - 48px))' }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="node-inline-toolbar-btn px-2 py-1 rounded text-[11px] transition-colors"
                >
                  Paragraph ▾
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="node-canvas-dropdown text-xs">
                <DropdownMenuItem onClick={() => setBlockType('paragraph')}>Paragraph</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('h1')}>Heading 1</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('h2')}>Heading 2</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('h3')}>Heading 3</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('bullet')}>Bullet List</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('ordered')}>Numbered List</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-4 node-inline-toolbar-divider" />
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'is-active' : ''}`}
            >
              <Bold size={12} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'is-active' : ''}`}
            >
              <Italic size={12} />
            </button>
            <div className="w-px h-4 node-inline-toolbar-divider" />
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'is-active' : ''}`}
            >
              <List size={12} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`node-inline-toolbar-btn p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            >
              <ListOrdered size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <NodeContentFocus nodeId={id} shellMoveCursor>
        <div
          className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 pt-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </div>
      </NodeContentFocus>

      <DefaultNodePortHandles />
      </div>
    </FlowNodeResizeRoot>
  );
});

TextNode.displayName = 'TextNode';
export default TextNode;
