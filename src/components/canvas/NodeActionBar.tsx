import { memo } from 'react';
import {
  Play,
  Loader2,
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
import { NODE_INTERACTIVE_CLASS } from './nodeResizeUtils';

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
  hidden?: boolean;
  onRun?: () => void;
  /** Scout / long-running: show spinner on Run and disable Run actions */
  runBusy?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onLock?: () => void;
  onDownload?: () => void;
  onExpand?: () => void;
  onGridToggle?: () => void;
  onSelectMode?: () => void;
  /** Angle variations / multi-image: open Perspectives picker (List icon). */
  onOpenPerspectives?: () => void;
  /** Angle variations / multi-image: open output preferences (Settings icon). */
  onOpenPreferences?: () => void;
  showDownload?: boolean;
  connectMenuItems?: ConnectMenuItem[];
}

const Btn = ({
  children,
  onClick,
  className = '',
  tooltip,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  tooltip?: string;
  disabled?: boolean;
}) => (
  <div className="node-action-bar-icon">
    {tooltip && <span className="node-action-bar-tooltip">{tooltip}</span>}
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick?.();
      }}
      className={`node-action-bar-btn flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  </div>
);

const NodeActionBar = memo(
  ({
    variant = 'default',
    hidden = false,
    onRun,
    onDuplicate,
    onDelete,
    onLock,
    onDownload,
    onExpand,
    onGridToggle,
    onSelectMode,
    onOpenPerspectives,
    onOpenPreferences,
    showDownload,
    connectMenuItems = [],
    runBusy = false,
  }: NodeActionBarProps) => {
    if (hidden) return null;
    const isAssistant = variant === 'assistant';
    const isImageGen = variant === 'imageGen';

    const showConnectMenu = connectMenuItems.length > 0;

    return (
      <div
        className={`${NODE_INTERACTIVE_CLASS} node-action-bar node-action-bar-pill absolute top-0 left-1/2 flex items-center gap-0.5 px-1.5 py-0.5 z-50`}
      >
        {onRun && (
          <Btn onClick={onRun} tooltip="Run" disabled={runBusy}>
            {runBusy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          </Btn>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="node-action-bar-icon node-action-bar-btn flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ease-in-out"
            >
              <span className="node-action-bar-tooltip">Run options</span>
              <ChevronDown size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="node-canvas-dropdown text-xs">
            <DropdownMenuItem onClick={onRun} disabled={runBusy}>
              Run this node
            </DropdownMenuItem>
            <DropdownMenuItem>Run from here</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-3 node-action-bar-divider mx-0.5" />

        {showConnectMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="node-action-bar-icon node-action-bar-btn flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ease-in-out"
              >
                <span className="node-action-bar-tooltip">Connect</span>
                <Link2 size={10} />
                <ChevronDown size={10} className="ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="node-canvas-dropdown text-xs min-w-[180px]">
              {connectMenuItems.map((item) => (
                <DropdownMenuItem
                  key={item.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick();
                  }}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isAssistant && (
          <>
            <div className="w-px h-3 node-action-bar-divider mx-0.5" />
            {onExpand && <Btn onClick={onExpand} tooltip="Expand"><Maximize2 size={12} /></Btn>}
            {onDuplicate && <Btn onClick={onDuplicate} tooltip="Duplicate"><Copy size={12} /></Btn>}
            {onDelete && <Btn onClick={onDelete} tooltip="Delete" className="hover:!text-red-400"><Trash2 size={12} /></Btn>}
          </>
        )}

        {isImageGen && (
          <>
            <div className="w-px h-3 node-action-bar-divider mx-0.5" />
            {onDelete && <Btn onClick={onDelete} tooltip="Delete" className="hover:!text-red-400"><Trash2 size={12} /></Btn>}
          </>
        )}

        {!isAssistant && !isImageGen && (
          <>
            {onExpand && <Btn onClick={onExpand} tooltip="Expand"><Maximize2 size={12} /></Btn>}
            {variant === 'text' && (
              <>
                <Btn tooltip="Select"><CircleDot size={12} /></Btn>
                <Btn tooltip="Type"><Type size={12} /></Btn>
              </>
            )}
            {(variant === 'image' || variant === 'multiImage') && onGridToggle && (
              <Btn onClick={onGridToggle} tooltip="Grid"><Grid3X3 size={12} /></Btn>
            )}
            {variant === 'image' && <Btn tooltip="Corner"><CornerDownRight size={12} /></Btn>}
            {variant === 'multiImage' && (
              <>
                {onSelectMode && <Btn onClick={onSelectMode} tooltip="Select mode"><CircleDot size={12} /></Btn>}
                <Btn onClick={onOpenPerspectives} tooltip="Perspectives"><List size={12} /></Btn>
                <Btn onClick={onOpenPreferences} tooltip="Preferences"><Settings size={12} /></Btn>
                <Btn tooltip="Add"><Plus size={12} /></Btn>
              </>
            )}
            {variant === 'group' && <div className="w-2 h-2 rounded-full bg-yellow-400 mx-1" />}
            <div className="w-px h-3 node-action-bar-divider mx-0.5" />
            {onLock && <Btn onClick={onLock} tooltip="Lock"><Lock size={12} /></Btn>}
            {onDuplicate && <Btn onClick={onDuplicate} tooltip="Duplicate"><Copy size={12} /></Btn>}
            {onDelete && <Btn onClick={onDelete} tooltip="Delete" className="hover:!text-red-400"><Trash2 size={12} /></Btn>}
          </>
        )}

        {showDownload && onDownload && <Btn onClick={onDownload} tooltip="Download"><Download size={12} /></Btn>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="node-action-bar-icon node-action-bar-btn flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ease-in-out"
            >
              <span className="node-action-bar-tooltip">More</span>
              <MoreHorizontal size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="node-canvas-dropdown text-xs">
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
