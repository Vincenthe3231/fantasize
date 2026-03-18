import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/* ── Toggle Component ──────────────────────────────── */

const Toggle = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex items-center justify-between py-2.5 cursor-pointer group">
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
      {description && (
        <span className="text-[11px] text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
          {description}
        </span>
      )}
    </div>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-9 h-5 rounded-full bg-muted peer peer-checked:bg-[var(--accent-color)] transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-background after:shadow-sm after:ring-1 after:ring-border/50 after:transition-transform peer-checked:after:translate-x-4" />
  </label>
);

/* ── Radio Option ──────────────────────────────────── */

const RadioOption = ({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
      selected
        ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border border-[var(--accent-color)]/40'
        : 'bg-muted/50 text-muted-foreground border border-border hover:bg-muted'
    }`}
    style={{ fontFamily: 'Inter, sans-serif' }}
  >
    {label}
  </button>
);

/* ── Shortcut Row ──────────────────────────────────── */

const ShortcutRow = ({ action, keys }: { action: string; keys: string[] }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[12px] text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
      {action}
    </span>
    <div className="flex gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono-display text-muted-foreground border border-border"
        >
          {k}
        </kbd>
      ))}
    </div>
  </div>
);

/* ── Main Settings Panel ──────────────────────────── */

const SettingsPanel = ({ open, onClose }: SettingsPanelProps) => {
  const settings = useWorkflowStore((s) => s.settings);
  const updateSettings = useWorkflowStore((s) => s.updateSettings);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card text-card-foreground border-border max-w-lg p-0 gap-0 shadow-xl">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-[14px] font-mono-display uppercase tracking-widest text-foreground">
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-0 border-b border-border bg-transparent px-5 h-auto py-0 gap-4 text-muted-foreground">
            <TabsTrigger
              value="general"
              className="rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:border-[var(--accent-color)] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground text-[12px] font-mono-display uppercase tracking-wider pb-2.5 pt-3 px-0"
            >
              General
            </TabsTrigger>
            <TabsTrigger
              value="shortcuts"
              className="rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:border-[var(--accent-color)] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground text-[12px] font-mono-display uppercase tracking-wider pb-2.5 pt-3 px-0"
            >
              Shortcuts
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="px-5 py-4 space-y-1 mt-0">
            <Toggle
              label="Helper lines"
              description="Show alignment guides when dragging nodes"
              checked={settings.helperLines}
              onChange={(v) => updateSettings({ helperLines: v })}
            />
            <Toggle
              label="Rich tooltips"
              description="Show detailed descriptions on hover"
              checked={settings.richTooltips}
              onChange={(v) => updateSettings({ richTooltips: v })}
            />
            <Toggle
              label="Experimental tools"
              description="Enable tools marked as experimental"
              checked={settings.experimentalTools}
              onChange={(v) => updateSettings({ experimentalTools: v })}
            />
            <Toggle
              label="Autoplay videos"
              description="Auto-play video previews in nodes"
              checked={settings.videoAutoplay}
              onChange={(v) => updateSettings({ videoAutoplay: v })}
            />
            <Toggle
              label="Performance mode"
              description="Disable blur effects on large canvases"
              checked={settings.performanceMode}
              onChange={(v) => updateSettings({ performanceMode: v })}
            />
            <Toggle
              label="Dark mode"
              description="Toggle light/dark canvas theme"
              checked={settings.darkMode}
              onChange={(v) => updateSettings({ darkMode: v })}
            />

            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-mono-display text-muted-foreground uppercase tracking-widest mb-2">
                Edge path type
              </p>
              <div className="flex gap-2">
                <RadioOption
                  label="Bezier"
                  selected={settings.edgePathType === 'bezier'}
                  onClick={() => updateSettings({ edgePathType: 'bezier' })}
                />
                <RadioOption
                  label="Palma"
                  selected={settings.edgePathType === 'palma'}
                  onClick={() => updateSettings({ edgePathType: 'palma' })}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-mono-display text-muted-foreground uppercase tracking-widest mb-2">
                Mouse wheel
              </p>
              <div className="flex gap-2">
                <RadioOption
                  label="Zoom"
                  selected={settings.mouseWheelBehavior === 'zoom'}
                  onClick={() => updateSettings({ mouseWheelBehavior: 'zoom' })}
                />
                <RadioOption
                  label="Pan"
                  selected={settings.mouseWheelBehavior === 'pan'}
                  onClick={() => updateSettings({ mouseWheelBehavior: 'pan' })}
                />
              </div>
            </div>

            <Toggle
              label="Show minimap"
              description="Overview map (toggle from bottom bar too)"
              checked={settings.showMinimap}
              onChange={(v) => updateSettings({ showMinimap: v })}
            />
            <Toggle
              label="Animate edges when running"
              checked={settings.edgeAnimation}
              onChange={(v) => updateSettings({ edgeAnimation: v })}
            />
            <Toggle
              label="Show node headers"
              description="Hide for a cleaner canvas look"
              checked={settings.showNodeLabels}
              onChange={(v) => updateSettings({ showNodeLabels: v })}
            />

            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-mono-display text-muted-foreground uppercase tracking-widest mb-2">
                Canvas background
              </p>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { id: 'dots' as const, label: 'Dots' },
                    { id: 'grid' as const, label: 'Grid' },
                    { id: 'lines' as const, label: 'Lines' },
                    { id: 'none' as const, label: 'None' },
                  ] as const
                ).map((opt) => (
                  <RadioOption
                    key={opt.id}
                    label={opt.label}
                    selected={settings.canvasPattern === opt.id}
                    onClick={() => updateSettings({ canvasPattern: opt.id })}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Shortcuts Tab */}
          <TabsContent value="shortcuts" className="px-5 py-4 mt-0 max-h-[400px] overflow-y-auto space-y-4">
            {/* Basics */}
            <div>
              <p className="text-[10px] font-mono-display text-muted-foreground uppercase tracking-widest mb-2">
                Basics
              </p>
              <div className="space-y-0.5">
                <ShortcutRow action="Select tool" keys={['V']} />
                <ShortcutRow action="Hand tool" keys={['H']} />
                <ShortcutRow action="Snip tool" keys={['X']} />
                <ShortcutRow action="Connection tool" keys={['L']} />
                <ShortcutRow action="Draw tool" keys={['P']} />
                <ShortcutRow action="Stickers" keys={['S']} />
                <ShortcutRow action="Sticky Note" keys={['T']} />
                <ShortcutRow action="Comment" keys={['C']} />
              </div>
            </div>

            {/* Control */}
            <div>
              <p className="text-[10px] font-mono-display text-muted-foreground uppercase tracking-widest mb-2">
                Control
              </p>
              <div className="space-y-0.5">
                <ShortcutRow action="Run workflow" keys={['Ctrl', 'Enter']} />
                <ShortcutRow action="Undo" keys={['Ctrl', 'Z']} />
                <ShortcutRow action="Redo" keys={['Ctrl', 'Shift', 'Z']} />
                <ShortcutRow action="Delete node" keys={['Delete']} />
                <ShortcutRow action="Duplicate node" keys={['Ctrl', 'D']} />
                <ShortcutRow action="Select all" keys={['Ctrl', 'A']} />
                <ShortcutRow action="Copy" keys={['Ctrl', 'C']} />
                <ShortcutRow action="Paste" keys={['Ctrl', 'V']} />
              </div>
            </div>

            {/* Navigation + Board */}
            <div>
              <p className="text-[10px] font-mono-display text-muted-foreground uppercase tracking-widest mb-2">
                Navigation + Board
              </p>
              <div className="space-y-0.5">
                <ShortcutRow action="Zoom in" keys={['Ctrl', '+']} />
                <ShortcutRow action="Zoom out" keys={['Ctrl', '−']} />
                <ShortcutRow action="Fit view" keys={['Ctrl', '1']} />
                <ShortcutRow action="Add node" keys={['N']} />
                <ShortcutRow action="Toggle grid" keys={['G']} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPanel;
