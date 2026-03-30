import { describe, it, expect } from 'vitest';
import {
  cubicPoint,
  horizontalBezierControls,
  sampleCubicBezier,
  minDistSqToPolyline,
} from './cubicBezier';

describe('cubicBezier', () => {
  it('endpoints of horizontalBezierControls match line ends', () => {
    const [p0, , , p3] = horizontalBezierControls(0, 0, 100, 0);
    expect(p0.x).toBe(0);
    expect(p0.y).toBe(0);
    expect(p3.x).toBe(100);
    expect(p3.y).toBe(0);
  });

  it('cubicPoint t=0 and t=1 are endpoints', () => {
    const [p0, p1, p2, p3] = horizontalBezierControls(10, 20, 200, 80);
    const a = cubicPoint(0, p0, p1, p2, p3);
    const b = cubicPoint(1, p0, p1, p2, p3);
    expect(a.x).toBeCloseTo(p0.x);
    expect(a.y).toBeCloseTo(p0.y);
    expect(b.x).toBeCloseTo(p3.x);
    expect(b.y).toBeCloseTo(p3.y);
  });

  it('minDistSqToPolyline detects nearness to segment', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(minDistSqToPolyline(50, 2, pts, 25)).toBe(true);
    expect(minDistSqToPolyline(50, 50, pts, 25)).toBe(false);
  });

  it('sampleCubicBezier has segments+1 points', () => {
    const [p0, p1, p2, p3] = horizontalBezierControls(0, 0, 50, 50);
    const s = sampleCubicBezier(p0, p1, p2, p3, 8);
    expect(s.length).toBe(9);
  });
});
