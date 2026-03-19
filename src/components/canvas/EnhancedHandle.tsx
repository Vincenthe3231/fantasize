import { Handle, type HandleProps } from 'reactflow';
import { Type, Image as ImageIcon, Video, type LucideIcon } from 'lucide-react';

export type HandleDataType = 'text' | 'image' | 'video' | 'generic';

export type EnhancedHandleProps = Omit<HandleProps, 'children'> & {
  dataType?: HandleDataType;
};

function iconFor(dataType: HandleDataType): LucideIcon | null {
  switch (dataType) {
    case 'text':
      return Type;
    case 'image':
      return ImageIcon;
    case 'video':
      return Video;
    default:
      return null;
  }
}

/** Stable color per data kind (see `--handle-icon-*` in index.css). */
function iconColorClass(dataType: HandleDataType): string {
  switch (dataType) {
    case 'text':
      return 'text-[var(--handle-icon-text)]';
    case 'image':
      return 'text-[var(--handle-icon-image)]';
    case 'video':
      return 'text-[var(--handle-icon-video)]';
    default:
      return '';
  }
}

/**
 * React Flow handle with a data-type glyph on a shared chip (dark bg + light border) for consistent UX;
 * outer ring still reflects input (green) vs output (violet) / accent.
 */
export function EnhancedHandle({ dataType = 'generic', className = '', ...props }: EnhancedHandleProps) {
  const Icon = iconFor(dataType);
  const colorClass = iconColorClass(dataType);
  const hasGlyph = Icon != null;
  return (
    <Handle
      className={`${className} ${hasGlyph ? 'port-with-type-glyph' : ''} !flex items-center justify-center p-0 [&>svg]:shrink-0`}
      {...props}
    >
      {Icon ? (
        <span
          className="port-type-glyph-inner pointer-events-none flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <Icon size={8} strokeWidth={2.35} className={colorClass} />
        </span>
      ) : null}
    </Handle>
  );
}
