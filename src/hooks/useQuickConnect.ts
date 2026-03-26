import { useMemo, useCallback } from 'react';
import type { Edge, XYPosition } from 'reactflow';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { ConnectMenuItem } from '@/components/canvas/NodeActionBar';
import { makeWorkflowEdge } from '@/lib/portHandles';

export type QuickConnectEdgeHint = {
  sourceHandle?: string;
  targetHandle?: string;
};

export type QuickConnectOverrides = {
  imageGenerator?: QuickConnectEdgeHint;
  videoGenerator?: QuickConnectEdgeHint;
  imageUpscaler?: QuickConnectEdgeHint;
  assistant?: QuickConnectEdgeHint;
};

/**
 * "Connect" menu: spawn Image Generator, Video Generator, Image Upscaler, or Assistant to the right and wire an edge.
 * Optional per-target overrides for nodes with multiple outputs or media-first workflows.
 */
export function useQuickConnect(nodeId: string, selfPosition: XYPosition, overrides?: QuickConnectOverrides) {
  const addNode = useWorkflowStore((s) => s.addNode);
  const connectEdgeWithHistory = useWorkflowStore((s) => s.connectEdgeWithHistory);

  const wireEdge = useCallback(
    (newEdge: Edge) => {
      const s = useWorkflowStore.getState();
      connectEdgeWithHistory([...s.edges, newEdge], newEdge);
    },
    [connectEdgeWithHistory]
  );

  const connectMenuItems: ConnectMenuItem[] = useMemo(() => {
    const ig = overrides?.imageGenerator ?? { targetHandle: 'text-in' };
    const vg = overrides?.videoGenerator ?? { targetHandle: 'text-in' };
    const up = overrides?.imageUpscaler ?? {};
    const as = overrides?.assistant ?? { targetHandle: 'text-in' };

    return [
      {
        label: 'Image Generator',
        onClick: () => {
          const nid = addNode('imageGeneratorNode', { x: selfPosition.x + 340, y: selfPosition.y });
          wireEdge(makeWorkflowEdge(nodeId, nid, ig.sourceHandle, ig.targetHandle));
        },
      },
      {
        label: 'Video Generator',
        onClick: () => {
          const nid = addNode('videoGeneratorNode', { x: selfPosition.x + 340, y: selfPosition.y });
          wireEdge(makeWorkflowEdge(nodeId, nid, vg.sourceHandle, vg.targetHandle));
        },
      },
      {
        label: 'Image Upscaler',
        onClick: () => {
          const nid = addNode('imageUpscalerNode', { x: selfPosition.x + 340, y: selfPosition.y });
          wireEdge(makeWorkflowEdge(nodeId, nid, up.sourceHandle, up.targetHandle));
        },
      },
      {
        label: 'Assistant',
        onClick: () => {
          const nid = addNode('assistantNode', { x: selfPosition.x + 340, y: selfPosition.y });
          wireEdge(makeWorkflowEdge(nodeId, nid, as.sourceHandle, as.targetHandle));
        },
      },
    ];
  }, [addNode, selfPosition.x, selfPosition.y, nodeId, wireEdge, overrides]);

  return { connectMenuItems };
}
