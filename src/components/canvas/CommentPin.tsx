import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useWorkflowStore, type Comment } from '@/stores/workflowStore';
import { RichTextField } from '@/components/rich-text/RichTextField';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';
import { NODE_INTERACTIVE_CLASS } from '@/components/canvas/nodeResizeUtils';

interface CommentPinProps {
  comment: Comment;
}

const CommentPin = ({ comment }: CommentPinProps) => {
  const [expanded, setExpanded] = useState(!comment.text);
  const popoverRef = useRef<HTMLDivElement>(null);
  const updateComment = useWorkflowStore((s) => s.updateComment);
  const resolveComment = useWorkflowStore((s) => s.resolveComment);
  const deleteComment = useWorkflowStore((s) => s.deleteComment);
  const reduceMotion = useCanvasReduceMotion();

  return (
    <div
      data-vf-comment-ui
      className={`absolute ${NODE_INTERACTIVE_CLASS}`}
      style={{ left: comment.x, top: comment.y, zIndex: 60 }}
    >
      <div
        className={`comment-pin ${comment.resolved ? 'opacity-50' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setExpanded((v) => !v);
        }}
      >
        {comment.author.charAt(0).toUpperCase()}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            ref={popoverRef}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: -4 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            className={`comment-pin-popover absolute top-8 left-0 flex w-[220px] flex-col rounded-xl p-3 shadow-lg bg-[var(--node-inner-mid)] border border-[var(--accent-color)]/40 ${NODE_INTERACTIVE_CLASS}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <RichTextField
              value={comment.text}
              onChange={(html) => updateComment(comment.id, html)}
              placeholder="Add a comment…"
              enableMentions={false}
              toolbarVariant="floating-above"
              toolbarAnchorRef={popoverRef}
              className="max-h-[min(200px,42vh)] min-h-0"
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
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  resolveComment(comment.id);
                }}
                className={`flex items-center gap-1 text-[10px] font-mono-display uppercase tracking-wider transition-colors ${
                  comment.resolved ? 'text-[var(--port-input)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Check size={10} />
                {comment.resolved ? 'Resolved' : 'Resolve'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setExpanded(false);
                  deleteComment(comment.id);
                }}
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
