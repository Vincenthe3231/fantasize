import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, Download, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCanvasReduceMotion } from '@/hooks/useCanvasReduceMotion';
import CanvasNodeImage from '@/components/canvas/CanvasNodeImage';
import { useCanvasViewportGestureActive } from '@/contexts/CanvasViewportGestureContext';

interface ImageCellOverlayProps {
  src: string;
  label?: string;
  resolution?: string;
  index: number;
  nodeId: string;
  selected?: boolean;
  onSelect?: () => void;
  onReplace?: (file: File) => void;
  className?: string;
}

const ImageCellOverlay = ({
  src,
  label,
  resolution,
  selected,
  onSelect,
  onReplace,
  className = '',
}: ImageCellOverlayProps) => {
  const [hovered, setHovered] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useCanvasReduceMotion();
  const gestureActive = useCanvasViewportGestureActive();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onReplace) onReplace(file);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = src;
    a.download = label || 'image';
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${selected ? 'ring-2 ring-blue-500' : ''} ${className}`}
      onMouseEnter={() => {
        if (!gestureActive) setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {label && (
        <div className="text-[11px] text-[var(--node-control-muted)] font-mono mb-1 flex items-center gap-1">
          <ImageIcon size={10} />
          {label}
        </div>
      )}

      <div className="relative aspect-[4/3] bg-[var(--node-control-bg)] border border-[var(--node-control-border)] rounded-xl overflow-hidden group/cell">
        <CanvasNodeImage
          mediaUrl={src}
          fixedCssWidth={180}
          fixedCssHeight={135}
          quality={60}
          resize="cover"
          alt={label || 'image'}
          className="h-full w-full object-cover"
        />

        <AnimatePresence>
          {hovered && !gestureActive && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none bg-[var(--node-overlay-dark)]"
            >
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  className="rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1.5 text-[11px] text-[var(--node-on-accent)] flex items-center gap-1 backdrop-blur-sm transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileRef.current?.click();
                  }}
                >
                  <ImageIcon size={12} />
                  Replace
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-white/15 hover:bg-white/25 p-1.5 text-[var(--node-on-accent)] backdrop-blur-sm transition-colors"
                  title="Download"
                  onClick={handleDownload}
                >
                  <Download size={14} />
                </button>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg bg-white/15 hover:bg-white/25 p-1.5 text-[var(--node-on-accent)] backdrop-blur-sm transition-colors"
                      title="Expand"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-w-[90vw] max-h-[90vh] p-2 border border-[var(--node-control-border)] bg-[var(--node-inner-deep)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mx-auto w-full max-h-[85vh] min-h-[120px]">
                      <CanvasNodeImage
                        mediaUrl={src}
                        fixedCssWidth={1280}
                        fixedCssHeight={960}
                        quality={72}
                        resize="contain"
                        alt=""
                        loading="lazy"
                        className="mx-auto h-auto max-h-[85vh] w-full object-contain rounded-md"
                      />
                    </div>
                    {resolution && (
                      <p className="text-center text-[11px] font-mono text-[var(--text-muted)] pt-1">{resolution}</p>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {resolution && (
          <motion.div
            initial={false}
            animate={{ opacity: hovered ? 0 : 1 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            className="absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px] font-mono text-[var(--node-on-accent)] bg-[var(--node-badge-bg)]"
          >
            {resolution}
          </motion.div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
};

export default ImageCellOverlay;
