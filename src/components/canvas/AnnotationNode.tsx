import { memo } from 'react';
import { type NodeProps } from 'reactflow';

const AnnotationNode = memo(({ data }: NodeProps) => {
  const text = (data.text as string) || '';

  // Parse *word* as italic
  const parts = text.split(/(\*[^*]+\*)/g);

  return (
    <div className="max-w-[320px] select-none" style={{ fontFamily: 'Inter, sans-serif' }}>
      <p className="text-[13px] text-white/70 leading-relaxed">
        {parts.map((part, i) => {
          if (part.startsWith('*') && part.endsWith('*')) {
            return (
              <span key={i} className="italic text-white underline cursor-pointer hover:text-white/90">
                {part.slice(1, -1)}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    </div>
  );
});

AnnotationNode.displayName = 'AnnotationNode';
export default AnnotationNode;
