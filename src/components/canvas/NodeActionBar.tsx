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
  Link2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type NodeActionBarVariant =
  | 'default'
  | 'text'
  | 'image'
  | 'multiImage'
  | 'group'
  | 'assistant'
  | 'imageGen';

export interface ConnectMenuItem {
  label: string;
  onClick: () => void;
}

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
  connectMenuItems?: ConnectMenuItem[];
}

const Btn = ({
  children,
  onClick,
  className = '',
  tooltip,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  tooltip?: string;
}) => (
  <div className="node-action-bar-icon">
    {tooltip && <span className="node-action-bar-tooltip">{tooltip}</span>}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex items-center justify-center w-8 h-8 rounded-full text-white/60 hover:text-white/90 transition-all duration-300 ease-in-out hover:bg-white/10 ${className}`}
    >
      {children}
    </button>
  </div>
);

const NodeActionBar = memo(
  ({
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
    connectMenuItems = [],
  }: NodeActionBarProps) => {
    const isAssistant = variant === 'assistant';
    const isImageGen = variant === 'imageGen';

    return (
      <div
        className="node-action-bar absolute top-0 left-1/2 flex items-center gap-1 px-3 py-2 shadow-xl z-50"
        style={{
          transform: 'translate(-50%, calc(-100% - 8px))',
          background: 'rgba(26, 26, 26, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {onRun && (
          <Btn onClick={onRun} tooltip="Run">
            <Play size={14} />
          </Btn>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="node-action-bar-icon flex items-center justify-center w-8 h-8 rounded-full text-white/60 hover:text-white/90 transition-all duration-300 ease-in-out hover:bg-white/10"
            >
              <span className="node-action-bar-tooltip">Run options</span>
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#1a1a1e] border-white/10 text-white/90 text-xs">
            <DropdownMenuItem onClick={onRun}>Run this node</DropdownMenuItem>
            <DropdownMenuItem>Run from here</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-4 bg-white/10 mx-0.5" />

        {(isAssistant || isImageGen) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="node-action-bar-icon flex items-center justify-center w-8 h-8 rounded-full text-white/60 hover:text-white/90 transition-all duration-300 ease-in-out hover:bg-white/10"
              >
                <span className="node-action-bar-tooltip">Connect</span>
                <Link2 size={12} />
                <ChevronDown size={10} className="ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1a1a1e] border-white/10 text-white/90 text-xs min-w-[180px]">
              {connectMenuItems.length > 0 ? (
                connectMenuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onClick();
                    }}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>Add connected node…</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isAssistant && (
          <>
            <div className="w-px h-4 bg-white/10 mx-0.5" />
            {onExpand && <Btn onClick={onExpand} tooltip="Expand"><Maximize2 size={14} /></Btn>}
            {onDuplicate && <Btn onClick={onDuplicate} tooltip="Duplicate"><Copy size={14} /></Btn>}
            {onDelete && <Btn onClick={onDelete} tooltip="Delete" className="hover:!text-red-400"><Trash2 size={14} /></Btn>}
          </>
        )}

        {isImageGen && (
          <>
            <div className="w-px h-4 bg-white/10 mx-0.5" />
            {onDelete && <Btn onClick={onDelete} tooltip="Delete" className="hover:!text-red-400"><Trash2 size={14} /></Btn>}
          </>
        )}

        {!isAssistant && !isImageGen && (
          <>
            {onExpand && <Btn onClick={onExpand} tooltip="Expand"><Maximize2 size={14} /></Btn>}
            {variant === 'text' && (
              <>
                <Btn tooltip="Select"><CircleDot size={14} /></Btn>
                <Btn tooltip="Type"><Type size={14} /></Btn>
              </>
            )}
            {(variant === 'image' || variant === 'multiImage') && onGridToggle && (
              <Btn onClick={onGridToggle} tooltip="Grid"><Grid3X3 size={14} /></Btn>
            )}
            {variant === 'image' && <Btn tooltip="Corner"><CornerDownRight size={14} /></Btn>}
            {variant === 'multiImage' && (
              <>
                {onSelectMode && <Btn onClick={onSelectMode} tooltip="Select mode"><CircleDot size={14} /></Btn>}
                <Btn tooltip="List"><List size={14} /></Btn>
                <Btn tooltip="Settings"><Settings size={14} /></Btn>
                <Btn tooltip="Add"><Plus size={14} /></Btn>
              </>
            )}
            {variant === 'group' && <div className="w-2 h-2 rounded-full bg-yellow-400 mx-1" />}
            <div className="w-px h-4 bg-white/10 mx-0.5" />
            {onLock && <Btn onClick={onLock} tooltip="Lock"><Lock size={14} /></Btn>}
            {onDuplicate && <Btn onClick={onDuplicate} tooltip="Duplicate"><Copy size={14} /></Btn>}
            {onDelete && <Btn onClick={onDelete} tooltip="Delete" className="hover:!text-red-400"><Trash2 size={14} /></Btn>}
          </>
        )}

        {showDownload && onDownload && <Btn onClick={onDownload} tooltip="Download"><Download size={14} /></Btn>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="node-action-bar-icon flex items-center justify-center w-8 h-8 rounded-full text-white/60 hover:text-white/90 transition-all duration-300 ease-in-out hover:bg-white/10"
            >
              <span className="node-action-bar-tooltip">More</span>
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#1a1a1e] border-white/10 text-white/90 text-xs">
            {onDuplicate && isImageGen && <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>}
            {onDuplicate && !isAssistant && !isImageGen && <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>}
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Add to group</DropdownMenuItem>
            <DropdownMenuItem>Copy link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

NodeActionBar.displayName = 'NodeActionBar';
export default NodeActionBar;
