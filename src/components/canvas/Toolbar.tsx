import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Play, MousePointer2, Hand, Scissors, Link2,
  Pen, Smile, StickyNote, MessageCircle, Square,
  Undo2, Redo2, Settings,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useWorkflowStore, type SelectedTool } from '@/stores/workflowStore';
import AddNodePanel from './AddNodePanel';

interface ToolbarProps {
  onAddNode: (type: string) => void;
  onOpenSettings: () => void;
  addPanelOpen?: boolean;
  onAddPanelOpenChange?: (open: boolean) => void;
}

interface SubTool {
  tool: SelectedTool;
  icon: typeof MousePointer2;
  label: string;
  shortcut: string;
}

interface ToolGroup {
  id: string;
  subTools: SubTool[];
}

const toolGroups: ToolGroup[] = [
  {
    id: 'pointer',
    subTools: [
      { tool: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
      { tool: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
    ],
  },
  {
    id: 'edge',
    subTools: [
      { tool: 'cut', icon: Scissors, label: 'Snip', shortcut: 'X' },
      { tool: 'connection', icon: Link2, label: 'Connection', shortcut: 'L' },
    ],
  },
  {
    id: 'creative',
    subTools: [
      { tool: 'draw', icon: Pen, label: 'Draw', shortcut: 'P' },
      { tool: 'sticker', icon: Smile, label: 'Stickers', shortcut: 'S' },
      { tool: 'stickyNote', icon: StickyNote, label: 'Sticky Note', shortcut: 'T' },
    ],
  },
];

const singleTools: SubTool[] = [
  { tool: 'comment', icon: MessageCircle, label: 'Comment', shortcut: 'C' },
];

const Toolbar = ({ onAddNode, onOpenSettings, addPanelOpen, onAddPanelOpenChange }: ToolbarProps) => {
  const [localAddOpen, setLocalAddOpen] = useState(false);
  const isControlled = addPanelOpen !== undefined && onAddPanelOpenChange !== undefined;
  const addOpen = isControlled ? addPanelOpen! : localAddOpen;
  const setAddOpen = isControlled ? onAddPanelOpenChange! : setLocalAddOpen;
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const runAll = useWorkflowStore((s) => s.runAll);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const canUndo = useWorkflowStore((s) => s.pastStack.length > 0);
  const canRedo = useWorkflowStore((s) => s.futureStack.length > 0);

  const [activeSubIndex, setActiveSubIndex] = useState<Record<string, number>>({
    pointer: 0,
    edge: 0,
    creative: 0,
  });

  const isToolInGroup = useCallback(
    (groupId: string) => {
      const group = toolGroups.find((g) => g.id === groupId);
      return group?.subTools.some((st) => st.tool === selectedTool) ?? false;
    },
    [selectedTool]
  );

  const selectSubTool = useCallback(
    (groupId: string, index: number) => {
      const group = toolGroups.find((g) => g.id === groupId);
      if (!group) return;
      setActiveSubIndex((prev) => ({ ...prev, [groupId]: index }));
      setSelectedTool(group.subTools[index].tool);
    },
    [setSelectedTool]
  );

  useEffect(() => {
    const shortcutMap: Record<string, () => void> = {
      v: () => selectSubTool('pointer', 0),
      h: () => selectSubTool('pointer', 1),
      x: () => selectSubTool('edge', 0),
      l: () => selectSubTool('edge', 1),
      p: () => selectSubTool('creative', 0),
      s: () => selectSubTool('creative', 1),
      t: () => selectSubTool('creative', 2),
      c: () => setSelectedTool('comment'),
    };

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Use code === 'KeyZ' so Ctrl+Shift+Z works (key is often "Z" not "z" when Shift is held)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Windows-style redo
      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      const fn = shortcutMap[e.key.toLowerCase()];
      if (fn && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        fn();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectSubTool, setSelectedTool, undo, redo]);

  const panelClass =
    'w-auto p-1 border rounded-lg shadow-xl bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] border-[hsl(var(--border))]';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-0.5 p-1.5 rounded-xl glass-toolbar transition-opacity duration-200"
    >
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="p-2.5 rounded-lg hover:bg-muted transition-colors text-foreground hover:text-foreground"
            title="Add Node"
          >
            <Plus size={18} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" sideOffset={12} className="w-72 p-0 bg-[hsl(var(--popover))] border-[hsl(var(--border))]">
          <AddNodePanel
            onAddNode={(type) => {
              onAddNode(type);
              setAddOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={runAll}
        className="p-2.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-[var(--port-input)]"
        title="Run All"
      >
        <Play size={18} />
      </button>

      <div className="w-full h-px bg-border my-0.5" />

      {toolGroups.map((group) => {
        const idx = activeSubIndex[group.id] ?? 0;
        const activeSub = group.subTools[idx];
        const Icon = activeSub.icon;
        const isActive = isToolInGroup(group.id);

        return (
          <HoverCard key={group.id} openDelay={0} closeDelay={220}>
            <HoverCardTrigger asChild>
              <div
                className="flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas-bg)]"
                tabIndex={0}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTool(activeSub.tool)}
                  className={`p-2.5 rounded-lg transition-colors relative ${
                    isActive
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }`}
                  title={`${activeSub.label} (${activeSub.shortcut}) — hover for all tools`}
                >
                  <Icon size={18} />
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-[var(--accent-color)]" />
                  )}
                </button>
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              side="right"
              align="start"
              sideOffset={10}
              className={`${panelClass} w-auto`}
            >
              <div className="flex flex-col gap-0.5">
                {group.subTools.map((sub, i) => (
                  <button
                    key={sub.tool}
                    type="button"
                    onClick={() => selectSubTool(group.id, i)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] transition-colors whitespace-nowrap ${
                      selectedTool === sub.tool
                        ? 'text-foreground bg-muted'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    <sub.icon size={14} />
                    {sub.label}
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono-display">
                      {sub.shortcut}
                    </span>
                  </button>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}

      {singleTools.map(({ tool, icon: Icon, label, shortcut }) => (
        <button
          key={tool}
          type="button"
          onClick={() => setSelectedTool(tool)}
          className={`p-2.5 rounded-lg transition-colors relative ${
            selectedTool === tool
              ? 'text-foreground bg-muted'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
          title={`${label} (${shortcut})`}
        >
          <Icon size={18} />
          {selectedTool === tool && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-[var(--accent-color)]" />
          )}
        </button>
      ))}

      <button
        type="button"
        className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        title="Group / Panel"
      >
        <Square size={18} />
      </button>

      <div className="w-full h-px bg-border my-0.5" />

      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        aria-disabled={!canUndo}
        className={`p-2.5 rounded-lg transition-colors ${
          canUndo
            ? 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            : 'text-muted-foreground/40 cursor-not-allowed opacity-60'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        aria-disabled={!canRedo}
        className={`p-2.5 rounded-lg transition-colors ${
          canRedo
            ? 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            : 'text-muted-foreground/40 cursor-not-allowed opacity-60'
        }`}
        title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
      >
        <Redo2 size={16} />
      </button>

      <div className="w-full h-px bg-border my-0.5" />

      <button
        type="button"
        onClick={onOpenSettings}
        className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </motion.div>
  );
};

export default Toolbar;
