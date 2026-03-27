import { useCallback } from 'react';
import { useStore } from 'reactflow';
import { useWorkflowStore } from '@/stores/workflowStore';

type MotionOptions = {
  initial: { opacity: number; scale: number; y: number } | false;
  animate: { opacity: number; scale: number; y: number } | undefined;
  transition: { type: 'spring'; stiffness: number; damping: number; mass: number };
  onAnimationComplete: (() => void) | undefined;
};

export function useNodeEntranceMotion(nodeId: string | undefined): MotionOptions {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const shouldAnimate = useStore(
    useCallback(
      (s) => {
        if (!nodeId) return false;
        const node = s.nodeInternals.get(nodeId);
        if (!node || !node.data || typeof node.data !== 'object') return false;
        return Boolean((node.data as Record<string, unknown>)._animateEntrance);
      },
      [nodeId]
    )
  );

  const clearEntranceFlag = useCallback(() => {
    if (!shouldAnimate || !nodeId) return;
    updateNodeData(nodeId, { _animateEntrance: false });
  }, [shouldAnimate, nodeId, updateNodeData]);

  return {
    initial: shouldAnimate ? { opacity: 0, scale: 0.96, y: 8 } : false,
    animate: shouldAnimate ? { opacity: 1, scale: 1, y: 0 } : undefined,
    transition: { type: 'spring', stiffness: 280, damping: 24, mass: 0.8 },
    onAnimationComplete: shouldAnimate ? clearEntranceFlag : undefined,
  };
}
