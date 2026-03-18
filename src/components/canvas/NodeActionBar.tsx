import { memo } from 'react';
import {
  Play,
  ChevronDown,
  Maximize2,
  Lock,
  Trash2,
  Download,
  MoreHorizontal,
  Copy,
  Grid3X3,
  CornerDownRight,
  CircleDot,
  List,
  Settings,
  Plus,
  Type,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type NodeActionBarVariant = 'default' | 'text' | 'image' | 'multiImage' | 'group';

interface NodeActionBarProps {
  variant?: NodeActionBarVariant;
  onRun?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onLock?: () => void;
  onDownload?: () => void;
  onExpand?: () => void;
  onGridToggle?: () => void;
  onSelectMode?: () => void;
  showDownload?: boolean;
}

const Btn = ({ children, onClick, className = '' }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}
    className={`p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/60 hover:text-white/90 ${className}`}
  >
    {children}
  </button>
);

const NodeActionBar = memo(({
  variant = 'default',
  onRun,
  onDuplicate,
  onDelete,
  onLock,
  onDownload,
  onExpand,
  onGridToggle,
  onSelectMode,
  showDownload,
}: NodeActionBarProps) => {
  return (
    <motion.div
      className="node-action-bar absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-1.5 rounded-xl shadow-xl z-50"
      style={{
        transform: 'translate(-50%, calc(-100% - 8px))',
        background: 'rgba(26, 26, 26, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Run */}
      {onRun && <Btn onClick={onRun}><Play size={12} /></Btn>}

      {/* Run dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded-md hover:bg-white/10 transition-colors text-white/60 hover:text-white/90">
            <ChevronDown size={10} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#1a1a1e] border-white/10 text-white/90 text-xs">
          <DropdownMenuItem onClick={onRun}>Run this node</DropdownMenuItem>
          <DropdownMenuItem>Run from here</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-4 bg-white/10 mx-0.5" />

      {/* Expand */}
      {onExpand && <Btn onClick={onExpand}><Maximize2 size={12} /></Btn>}

      {/* Text-only: Style + Block type */}
      {variant === 'text' && (
        <>
          <Btn><CircleDot size={12} /></Btn>
          <Btn><Type size={12} /></Btn>
        </>
      )}

      {/* Image-only: Grid toggle + Curve */}
      {(variant === 'image' || variant === 'multiImage') && onGridToggle && (
        <Btn onClick={onGridToggle}><Grid3X3 size={12} /></Btn>
      )}

      {variant === 'image' && (
        <Btn><CornerDownRight size={12} /></Btn>
      )}

      {/* Multi-image: Select mode, List/Grid, Settings, + Replace */}
      {variant === 'multiImage' && (
        <>
          {onSelectMode && <Btn onClick={onSelectMode}><CircleDot size={12} /></Btn>}
          <Btn><List size={12} /></Btn>
          <Btn><Settings size={12} /></Btn>
          <Btn><Plus size={12} /></Btn>
        </>
      )}

      {/* Group: status dot */}
      {variant === 'group' && (
        <div className="w-2 h-2 rounded-full bg-yellow-400 mx-1" />
      )}

      <div className="w-px h-4 bg-white/10 mx-0.5" />

      {/* Lock */}
      {onLock && <Btn onClick={onLock}><Lock size={12} /></Btn>}

      {/* Duplicate */}
      {onDuplicate && <Btn onClick={onDuplicate}><Copy size={12} /></Btn>}

      {/* Delete */}
      {onDelete && <Btn onClick={onDelete} className="hover:!text-red-400"><Trash2 size={12} /></Btn>}

      {/* Download */}
      {showDownload && onDownload && <Btn onClick={onDownload}><Download size={12} /></Btn>}

      {/* More */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/60 hover:text-white/90">
            <MoreHorizontal size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#1a1a1e] border-white/10 text-white/90 text-xs">
          <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem>Add to group</DropdownMenuItem>
          <DropdownMenuItem>Copy link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
});

NodeActionBar.displayName = 'NodeActionBar';
export default NodeActionBar;
