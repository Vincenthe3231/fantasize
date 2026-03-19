import { memo, useState, useMemo } from 'react';
import { Position, type NodeProps } from 'reactflow';
import { ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import NodeActionBar from './NodeActionBar';
import { NodeContentFocus } from './NodeContentFocus';
import { NodeLabelRow } from './NodeLabelRow';
import { EnhancedHandle } from './EnhancedHandle';
import { useQuickConnect } from '@/hooks/useQuickConnect';

const SelectedShotNode = memo(({ id, data, selected }: NodeProps) => {
  const runFromNode = useWorkflowStore((s) => s.runFromNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const lockNode = useWorkflowStore((s) => s.lockNode);
  const isRunning = useWorkflowStore((s) => s.runningNodes.has(id));
  const contentFocused = useWorkflowStore((s) => s.focusedNodeContentId === id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selfPos = useMemo(() => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 }, [nodes, id]);
  const quickOverrides = useMemo(
    () => ({
      imageGenerator: { targetHandle: 'image-in' as const },
      videoGenerator: { targetHandle: 'image-in' as const },
      assistant: { targetHandle: 'image-in' as const },
    }),
    []
  );
  const { connectMenuItems } = useQuickConnect(id, selfPos, quickOverrides);
  const [hovered, setHovered] = useState(false);

  const mediaUrl =
    (data.mediaUrl as string) || 'https://picsum.photos/seed/vps-final/800/444';
  const resolution = (data.resolution as string) || '2738 × 1524';

  return (
    <div className="w-[280px] relative">
      <NodeLabelRow nodeId={id} nodeType="selectedShotNode" labelPrefix="Selected shot" icon={<ImageIcon size={12} />} />
      <div
        className={`glass-node glass-node-output w-full relative ${selected ? 'node-selected' : ''} ${isRunning ? 'ring-1 ring-[var(--accent-color)]' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-content-focused={contentFocused || undefined}
      >
      <NodeActionBar
        variant="image"
        onRun={() => runFromNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onLock={() => lockNode(id)}
        showDownload
        onDownload={() => {}}
        connectMenuItems={connectMenuItems}
      />

      <NodeContentFocus nodeId={id}>
        <div className="relative">
        <img src={mediaUrl} alt="Selected shot" className="w-full aspect-[16/9] object-cover rounded-b-[12px]" />

        {/* Resolution badge */}
        <div className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[10px] font-mono text-[var(--node-overlay-text)] bg-[var(--node-badge-bg)]">
          {resolution}
        </div>

        <AnimatePresence>
          {hovered && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-3 left-3 text-[11px] rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition-colors bg-[var(--node-overlay-dark)] text-[var(--node-overlay-text)] hover:opacity-95"
            >
              <ImageIcon size={10} />
              Replace
            </motion.button>
          )}
        </AnimatePresence>
        </div>
      </NodeContentFocus>

      <EnhancedHandle type="target" position={Position.Left} className="port-input" dataType="image" />
      <EnhancedHandle type="source" position={Position.Right} className="port-output" dataType="image" />
      </div>
    </div>
  );
});

SelectedShotNode.displayName = 'SelectedShotNode';
export default SelectedShotNode;
