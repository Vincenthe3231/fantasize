/** Cubic Bézier sampling and point-to-segment distance (edges, picking). */

export function cubicPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/** Horizontal-ish RF-style control points. */
export function horizontalBezierControls(
  sx: number,
  sy: number,
  tx: number,
  ty: number
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const dx = Math.abs(tx - sx);
  const d = Math.max(dx * 0.5, 80);
  const p0 = { x: sx, y: sy };
  const p1 = { x: sx + d, y: sy };
  const p2 = { x: tx - d, y: ty };
  const p3 = { x: tx, y: ty };
  return [p0, p1, p2, p3];
}

export function sampleCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  segments: number
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    out.push(cubicPoint(i / segments, p0, p1, p2, p3));
  }
  return out;
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Minimum squared distance from p to polyline (screen or flow space). */
export function minDistSqToPolyline(
  px: number,
  py: number,
  pts: { x: number; y: number }[],
  thresholdSq: number
): boolean {
  if (pts.length < 2) return false;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const l2 = distSq(a.x, a.y, b.x, b.y);
    if (l2 === 0) {
      if (distSq(px, py, a.x, a.y) <= thresholdSq) return true;
      continue;
    }
    let t = ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + t * (b.x - a.x);
    const qy = a.y + t * (b.y - a.y);
    if (distSq(px, py, qx, qy) <= thresholdSq) return true;
  }
  return false;
}
