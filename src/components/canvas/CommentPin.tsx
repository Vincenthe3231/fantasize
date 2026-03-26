import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useWorkflowStore, type Comment } from '@/stores/workflowStore';
import { RichTextField } from '@/components/rich-text/RichTextField';

interface CommentPinProps {
  comment: Comment;
}

const CommentPin = ({ comment }: CommentPinProps) => {
  const [expanded, setExpanded] = useState(!comment.text);
  const updateComment = useWorkflowStore((s) => s.updateComment);
  const resolveComment = useWorkflowStore((s) => s.resolveComment);
  const deleteComment = useWorkflowStore((s) => s.deleteComment);

  return (
    <div className="absolute" style={{ left: comment.x, top: comment.y, zIndex: 60 }}>
      <div
        className={`comment-pin ${comment.resolved ? 'opacity-50' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        {comment.author.charAt(0).toUpperCase()}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            className="comment-pin-popover absolute top-8 left-0 w-[220px] rounded-xl p-3 space-y-2 shadow-lg bg-[var(--node-inner-mid)] border border-[var(--accent-color)]/40"
          >
            <RichTextField
              value={comment.text}
              onChange={(html) => updateComment(comment.id, html)}
              placeholder="Add a comment…"
              enableMentions={false}
              toolbarVariant="top"
              className="max-h-[200px]"
              editorContentClassName="w-full min-h-[50px] text-[13px] text-[var(--text-primary)] outline-none prose prose-invert prose-sm max-w-none"
              editorProps={{
                handleDOMEvents: {
                  mousedown: (_, e) => {
                    e.stopPropagation();
                    return false;
                  },
                  keydown: (_, e) => {
                    e.stopPropagation();
                    return false;
                  },
                },
              }}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => resolveComment(comment.id)}
                className={`flex items-center gap-1 text-[10px] font-mono-display uppercase tracking-wider transition-colors ${
                  comment.resolved ? 'text-[var(--port-input)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Check size={10} />
                {comment.resolved ? 'Resolved' : 'Resolve'}
              </button>
              <button
                onClick={() => deleteComment(comment.id)}
                className="text-[var(--text-muted)] hover:text-destructive transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CommentPin;
