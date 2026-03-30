import { describe, it, expect } from 'vitest';
import { screenToFlow, flowToScreen, zoomViewportAtScreenPoint } from './screenFlowTransform';

function mkRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

const rect = mkRect(100, 80, 800, 600);
const vp = { x: 0, y: 0, zoom: 1 };

describe('screenFlowTransform', () => {
  it('screenToFlow inverts flowToScreen at zoom 1', () => {
    const fx = 220;
    const fy = 340;
    const scr = flowToScreen(fx, fy, rect, vp);
    const back = screenToFlow(scr.x, scr.y, rect, vp);
    expect(back.x).toBeCloseTo(fx, 5);
    expect(back.y).toBeCloseTo(fy, 5);
  });

  it('zoomViewportAtScreenPoint keeps point under cursor', () => {
    const cur = { x: 10, y: 20, zoom: 1 };
    const clientX = rect.left + 400;
    const clientY = rect.top + 300;
    const before = screenToFlow(clientX, clientY, rect, cur);
    const next = zoomViewportAtScreenPoint(cur, rect, clientX, clientY, 1.5);
    const after = screenToFlow(clientX, clientY, rect, next);
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
    expect(next.zoom).toBe(1.5);
  });
});
