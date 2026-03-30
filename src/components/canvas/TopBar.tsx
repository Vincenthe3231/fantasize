import { useState } from 'react';
import { ChevronRight, Share2, LayoutTemplate, Sun, Moon, UserPlus, LogIn } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useAuth } from '@/hooks/useAuth';
import SignUpPrompt from '@/components/auth/SignUpPrompt';
import SignInPrompt from '@/components/auth/SignInPrompt';
import TemplateGallery from './TemplateGallery';
import RemoteSavePanel from './RemoteSavePanel';

const TopBar = () => {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const { isAnonymous, signUp, signIn } = useAuth();
  const darkMode = useWorkflowStore((s) => s.settings.darkMode);
  const updateSettings = useWorkflowStore((s) => s.updateSettings);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 flex-wrap">
          <img
            src="/logo.png"
            alt="BeLive"
            className="block h-8 w-auto bg-transparent object-contain object-left select-none"
            draggable={false}
          />
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass-toolbar">
            <span className="text-[12px] text-muted-foreground font-mono-display">Project</span>
            <ChevronRight size={12} className="text-muted-foreground opacity-50" />
            <span className="text-[12px] text-foreground font-mono-display">Virtual Production Scout</span>
            <ChevronRight size={12} className="text-muted-foreground opacity-50" />
            <span className="text-[12px] text-muted-foreground font-mono-display">Space</span>
          </div>
          <RemoteSavePanel />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => updateSettings({ darkMode: !darkMode })}
            className="p-2 rounded-lg glass-toolbar text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={darkMode ? 'Light mode' : 'Dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {isAnonymous && (
            <>
              <button
                type="button"
                onClick={() => setSignInOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-toolbar text-[12px] font-mono-display text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <LogIn size={13} />
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setSignUpOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-toolbar text-[12px] font-mono-display text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <UserPlus size={13} />
                Create account
              </button>
            </>
          )}
          {/* Templates */}
          <button
            onClick={() => setTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-toolbar text-[12px] font-mono-display text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <LayoutTemplate size={13} />
            Templates
          </button>

          {/* Avatar stack */}
          <div className="flex -space-x-2">
            <Avatar className="h-7 w-7 border-2 border-[var(--canvas-bg)]">
              <AvatarFallback className="bg-[var(--accent-color)] text-[10px] font-mono-display text-[var(--node-on-accent)]">
                CD
              </AvatarFallback>
            </Avatar>
            <Avatar className="h-7 w-7 border-2 border-[var(--canvas-bg)]">
              <AvatarFallback className="bg-emerald-600 text-[10px] font-mono-display text-[var(--node-on-accent)]">
                PD
              </AvatarFallback>
            </Avatar>
            <Avatar className="h-7 w-7 border-2 border-[var(--canvas-bg)]">
              <AvatarFallback className="bg-amber-600 text-[10px] font-mono-display text-[var(--node-on-accent)]">
                DP
              </AvatarFallback>
            </Avatar>
          </div>

          <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--accent-color)] text-[var(--node-on-accent)] text-[12px] font-mono-display hover:bg-[var(--accent-hover)] transition-colors">
            <Share2 size={13} />
            Share
          </button>
        </div>
      </div>

      <TemplateGallery open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <SignInPrompt open={signInOpen} onOpenChange={setSignInOpen} signIn={signIn} />
      <SignUpPrompt open={signUpOpen} onOpenChange={setSignUpOpen} signUp={signUp} />
    </>
  );
};

export default TopBar;
