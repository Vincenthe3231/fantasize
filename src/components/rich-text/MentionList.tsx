import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MentionItem } from './nodeMentionUtils';

export type MentionListProps = {
  items: MentionItem[];
  command: (item: { id: string; label: string | null }) => void;
};

export type MentionListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

/**
 * TipTap @-mention suggestion list. Keyboard nav matches TipTap suggestion plugin expectations.
 */
const MentionList = forwardRef<MentionListHandle, MentionListProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  const select = (index: number) => {
    const item = items[index];
    if (item) command({ id: item.id, label: item.label });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelected((s) => (items.length ? (s + 1) % items.length : 0));
        return true;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected((s) => (items.length ? (s + items.length - 1) % items.length : 0));
        return true;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        select(selected);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="vf-mention-list rounded-lg border border-[var(--node-control-border)] bg-[var(--node-inner-deep)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] shadow-lg">
        No matching nodes
      </div>
    );
  }

  return (
    <ScrollArea className="vf-mention-list nowheel max-h-[min(40vh,240px)] w-[min(100vw-2rem,280px)] rounded-lg border border-[var(--node-control-border)] bg-[var(--node-inner-deep)] text-[11px] shadow-lg">
      <div className="py-1 pr-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left transition-colors ${
              index === selected
                ? 'bg-[var(--node-tab-active-bg)] text-[var(--text-primary)]'
                : 'text-[var(--text-primary)] hover:bg-[var(--node-action-bar-hover-bg)]'
            }`}
            onClick={() => select(index)}
          >
            <span className="truncate font-medium">{item.label}</span>
            <span className="truncate text-[9px] font-mono uppercase tracking-wide text-[var(--text-muted)]">
              {item.nodeType}
            </span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
});

MentionList.displayName = 'MentionList';

export default MentionList;
