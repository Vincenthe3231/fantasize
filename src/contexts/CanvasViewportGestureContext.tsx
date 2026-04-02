import { createContext, useContext } from 'react';

/**
 * True while the user is panning/zooming the React Flow viewport or dragging nodes on the canvas.
 * Used to defer expensive image URL / decode churn until the gesture ends.
 */
export const CanvasViewportGestureContext = createContext(false);

export function useCanvasViewportGestureActive(): boolean {
  return useContext(CanvasViewportGestureContext);
}
