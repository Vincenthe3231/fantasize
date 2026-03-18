import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Type, Bold, Italic, List, ListOrdered } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
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
        class: 'w-full text-[13px] text-[var(--text-primary)] outline-none min-h-[80px] leading-relaxed prose prose-invert prose-sm max-w-none',
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
    <div className={`glass-node glass-node-input w-[280px] relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-amber-500/40' : ''}`}>
      <NodeActionBar
        variant="text"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
      />

      {/* Inline formatting toolbar — visible when editor focused */}
      <AnimatePresence>
        {isFocused && editor && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-1 rounded-lg z-50"
            style={{
              transform: 'translate(-50%, calc(-100% - 48px))',
              background: 'rgba(26,26,26,0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-2 py-1 rounded text-[11px] text-white/70 hover:bg-white/10 transition-colors">
                  Paragraph ▾
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a1e] border-white/10 text-white/90 text-xs">
                <DropdownMenuItem onClick={() => setBlockType('paragraph')}>Paragraph</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('h1')}>Heading 1</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('h2')}>Heading 2</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('h3')}>Heading 3</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('bullet')}>Bullet List</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBlockType('ordered')}>Numbered List</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded text-white/60 hover:text-white/90 transition-colors ${editor.isActive('bold') ? 'bg-white/20' : ''}`}
            >
              <Bold size={12} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded text-white/60 hover:text-white/90 transition-colors ${editor.isActive('italic') ? 'bg-white/20' : ''}`}
            >
              <Italic size={12} />
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded text-white/60 hover:text-white/90 transition-colors ${editor.isActive('bulletList') ? 'bg-white/20' : ''}`}
            >
              <List size={12} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded text-white/60 hover:text-white/90 transition-colors ${editor.isActive('orderedList') ? 'bg-white/20' : ''}`}
            >
              <ListOrdered size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-node-header px-3 py-2.5 flex items-center gap-2 text-[var(--text-primary)]">
        <Type size={13} />
        <span>Text</span>
      </div>

      <div className="p-3" onMouseDown={(e) => e.stopPropagation()}>
        <EditorContent editor={editor} />
      </div>

      <Handle type="source" position={Position.Right} className="port-output" />
    </div>
  );
});

TextNode.displayName = 'TextNode';
export default TextNode;
