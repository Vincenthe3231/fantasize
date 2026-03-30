/** Match React Flow viewport `{ x, y, zoom }` on the pane: flow = (screenLocal - translate) / zoom */

export type Viewport2D = { x: number; y: number; zoom: number };

export function screenToFlow(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  vp: Viewport2D
): { x: number; y: number } {
  const lx = clientX - containerRect.left;
  const ly = clientY - containerRect.top;
  const z = vp.zoom || 1;
  return { x: (lx - vp.x) / z, y: (ly - vp.y) / z };
}

export function flowToScreen(
  fx: number,
  fy: number,
  containerRect: DOMRect,
  vp: Viewport2D
): { x: number; y: number } {
  const z = vp.zoom || 1;
  return {
    x: containerRect.left + vp.x + fx * z,
    y: containerRect.top + vp.y + fy * z,
  };
}

/** Zoom toward cursor; keeps flow point under cursor stable. */
export function zoomViewportAtScreenPoint(
  vp: Viewport2D,
  containerRect: DOMRect,
  clientX: number,
  clientY: number,
  nextZoom: number
): Viewport2D {
  const z0 = vp.zoom || 1;
  const z1 = Math.max(0.02, Math.min(4, nextZoom));
  const lx = clientX - containerRect.left;
  const ly = clientY - containerRect.top;
  const wx = (lx - vp.x) / z0;
  const wy = (ly - vp.y) / z0;
  return {
    zoom: z1,
    x: lx - wx * z1,
    y: ly - wy * z1,
  };
}
