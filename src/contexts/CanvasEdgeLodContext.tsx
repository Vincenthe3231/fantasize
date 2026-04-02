import { createContext, useContext } from 'react';

/** `reduced` = cheaper SVG edge layer during heavy viewport/node-drag gestures (see `CustomEdge`). */
export type CanvasEdgeLodLevel = 'full' | 'reduced';

const CanvasEdgeLodContext = createContext<CanvasEdgeLodLevel>('full');

export const CanvasEdgeLodProvider = CanvasEdgeLodContext.Provider;

export function useCanvasEdgeLodLevel(): CanvasEdgeLodLevel {
  return useContext(CanvasEdgeLodContext);
}
