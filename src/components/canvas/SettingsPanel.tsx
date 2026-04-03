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
import { ScrollArea } from '@/components/ui/scroll-area';
import { CANVAS_SHORTCUT_SECTIONS } from '@/lib/canvasKeymap';

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
              description="Disables glass blur on nodes and toolbars, turns off edge run animation and cursor trails while on, and reduces in-canvas motion"
              checked={settings.performanceMode}
              onChange={(v) => updateSettings({ performanceMode: v })}
            />
            <Toggle
              label="Canvas cursor trails"
              description="Soft animated trails that follow the pointer (overridden when Performance mode is on)"
              checked={settings.canvasCursorTrails}
              onChange={(v) => updateSettings({ canvasCursorTrails: v })}
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
              <p className="text-[11px] font-mono-display text-muted-foreground uppercase tracking-widest mb-1">
                Mouse wheel
              </p>
              <p className="text-[11px] text-muted-foreground mb-2 leading-snug" style={{ fontFamily: 'Inter, sans-serif' }}>
                <span className="text-foreground/90">Zoom</span> — scroll up/down changes scale (magnification).{' '}
                <span className="text-foreground/90">Pan</span> — scroll moves the viewing area at the same zoom.
                Middle mouse button <span className="text-foreground/90">drag</span> always pans the canvas (move the view, not zoom).
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
              description="Dashed path animation on connections during a run (overridden when Performance mode is on)"
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
          <TabsContent value="shortcuts" className="mt-0 px-0 py-0">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 px-5 py-4">
                {CANVAS_SHORTCUT_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <p className="text-[10px] font-mono-display text-muted-foreground uppercase tracking-widest mb-2">
                      {section.title}
                    </p>
                    <div className="space-y-0.5">
                      {section.rows.map((row) => (
                        <ShortcutRow key={`${section.title}-${row.action}`} action={row.action} keys={row.keys} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPanel;
