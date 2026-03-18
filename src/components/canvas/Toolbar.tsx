import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Play, MousePointer2, Hand, Scissors, Link2,
  Pen, Smile, StickyNote, MessageCircle, Square,
  Undo2, Redo2, Settings, ChevronRight,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWorkflowStore, type SelectedTool } from '@/stores/workflowStore';
import AddNodePanel from './AddNodePanel';

interface ToolbarProps {
  onAddNode: (type: string) => void;
  onOpenSettings: () => void;
  addPanelOpen?: boolean;
  onAddPanelOpenChange?: (open: boolean) => void;
}

/* ── Tool group definitions ─────────────────────────── */

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

/* ── Toolbar Component ──────────────────────────────── */

const Toolbar = ({ onAddNode, onOpenSettings, addPanelOpen, onAddPanelOpenChange }: ToolbarProps) => {
  const [localAddOpen, setLocalAddOpen] = useState(false);
  const isControlled = addPanelOpen !== undefined && onAddPanelOpenChange !== undefined;
  const addOpen = isControlled ? addPanelOpen! : localAddOpen;
  const setAddOpen = isControlled ? onAddPanelOpenChange! : setLocalAddOpen;
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const runAll = useWorkflowStore((s) => s.runAll);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);

  // Track which sub-tool was last selected per group
  const [activeSubIndex, setActiveSubIndex] = useState<Record<string, number>>({
    pointer: 0,
    edge: 0,
    creative: 0,
  });

  const isToolInGroup = useCallback(
    (groupId: string) => {
      const group = toolGroups.find((g) => g.id === groupId);
      return group?.subTools.some((s) => s.tool === selectedTool) ?? false;
    },
    [selectedTool]
  );

  const selectSubTool = useCallback(
    (groupId: string, index: number) => {
      const group = toolGroups.find((g) => g.id === groupId);
      if (!group) return;
      setActiveSubIndex((prev) => ({ ...prev, [groupId]: index }));
      setSelectedTool(group.subTools[index].tool);
      setOpenGroupId(null);
    },
    [setSelectedTool]
  );

  // Keyboard shortcuts
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

      // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
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

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-0.5 p-1.5 rounded-xl glass-toolbar">
      {/* Add Node */}
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <button
            className="p-2.5 rounded-lg hover:bg-white/10 transition-colors text-[var(--text-primary)] hover:text-white"
            title="Add Node"
          >
            <Plus size={18} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" sideOffset={12} className="w-72 p-0 bg-[#1a1a1e] border-white/10">
          <AddNodePanel
            onAddNode={(type) => {
              onAddNode(type);
              setAddOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Run All */}
      <button
        onClick={runAll}
        className="p-2.5 rounded-lg hover:bg-white/10 transition-colors text-[var(--text-muted)] hover:text-[var(--port-input)]"
        title="Run All"
      >
        <Play size={18} />
      </button>

      <div className="w-full h-px bg-white/[0.08] my-0.5" />

      {/* Tool Groups with carats */}
      {toolGroups.map((group) => {
        const idx = activeSubIndex[group.id] ?? 0;
        const activeSub = group.subTools[idx];
        const Icon = activeSub.icon;
        const isActive = isToolInGroup(group.id);

        return (
          <div key={group.id} className="relative flex items-center">
            {/* Main button — activates the currently selected sub-tool */}
            <button
              onClick={() => setSelectedTool(activeSub.tool)}
              className={`p-2.5 rounded-lg transition-colors relative ${
                isActive
                  ? 'text-[var(--text-primary)] bg-white/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]'
              }`}
              title={`${activeSub.label} (${activeSub.shortcut})`}
            >
              <Icon size={18} />
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-[var(--accent-color)]" />
              )}
            </button>

            {/* Carat for sub-menu */}
            <Popover
              open={openGroupId === group.id}
              onOpenChange={(open) => setOpenGroupId(open ? group.id : null)}
            >
              <PopoverTrigger asChild>
                <button
                  className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ opacity: 1 }}
                >
                  <ChevronRight size={8} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                sideOffset={8}
                className="w-auto p-1 bg-[#1a1a1e] border-white/10 rounded-lg"
              >
                <div className="flex flex-col gap-0.5">
                  {group.subTools.map((sub, i) => (
                    <button
                      key={sub.tool}
                      onClick={() => selectSubTool(group.id, i)}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] transition-colors whitespace-nowrap ${
                        selectedTool === sub.tool
                          ? 'text-[var(--text-primary)] bg-white/10'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]'
                      }`}
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      <sub.icon size={14} />
                      {sub.label}
                      <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono-display">
                        {sub.shortcut}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      })}

      {/* Single tools */}
      {singleTools.map(({ tool, icon: Icon, label, shortcut }) => (
        <button
          key={tool}
          onClick={() => setSelectedTool(tool)}
          className={`p-2.5 rounded-lg transition-colors relative ${
            selectedTool === tool
              ? 'text-[var(--text-primary)] bg-white/10'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]'
          }`}
          title={`${label} (${shortcut})`}
        >
          <Icon size={18} />
          {selectedTool === tool && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-[var(--accent-color)]" />
          )}
        </button>
      ))}

      {/* Group/Panel */}
      <button
        className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
        title="Group / Panel"
      >
        <Square size={18} />
      </button>

      <div className="w-full h-px bg-white/[0.08] my-0.5" />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        onClick={redo}
        className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={16} />
      </button>

      <div className="w-full h-px bg-white/[0.08] my-0.5" />

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </div>
  );
};

export default Toolbar;
