export type CanvasStroke = {
  id: string;
  /** Polyline vertices in React Flow / world space. */
  points: [number, number][];
  /** CSS color string */
  color: string;
  /** Approximate stroke width in CSS pixels (scaled by zoom when rendering in flow space). */
  widthPx: number;
};

const MAX_POINTS_PER_STROKE = 400;
const MIN_DIST_FLOW = 0.35;

/** Clamp incoming JSON to a safe in-memory list. */
export function sanitizeCanvasStrokes(raw: unknown): CanvasStroke[] {
  if (!Array.isArray(raw)) return [];
  const out: CanvasStroke[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : '';
    if (!id) continue;
    const color = typeof o.color === 'string' && o.color.trim() ? o.color.trim() : '#22d3ee';
    const widthPx =
      typeof o.widthPx === 'number' && Number.isFinite(o.widthPx) && o.widthPx > 0 && o.widthPx < 64
        ? o.widthPx
        : 2.25;
    const pts: [number, number][] = [];
    if (Array.isArray(o.points)) {
      for (const p of o.points) {
        if (!Array.isArray(p) || p.length < 2) continue;
        const x = Number(p[0]);
        const y = Number(p[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        pts.push([x, y]);
        if (pts.length >= MAX_POINTS_PER_STROKE) break;
      }
    }
    if (pts.length < 2) continue;
    out.push({ id, points: decimateByMinDistance(pts, MIN_DIST_FLOW), color, widthPx });
  }
  return out;
}

/** Parse CSS hex (and limited #rrggbbaa) for Pixi stroke `color` + `alpha`. */
export function cssColorToPixiArgb(color: string): { color: number; alpha: number } {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 6) {
      const n = parseInt(hex, 16);
      if (Number.isFinite(n)) return { color: n, alpha: 1 };
    }
    if (hex.length === 8) {
      const rgb = parseInt(hex.slice(0, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      if (Number.isFinite(rgb) && Number.isFinite(a)) return { color: rgb, alpha: a };
    }
  }
  return { color: 0x22d3ee, alpha: 1 };
}

export function decimateByMinDistance(points: [number, number][], minDist: number): [number, number][] {
  if (points.length <= 2) return points;
  const out: [number, number][] = [points[0]!];
  let last = points[0]!;
  const minSq = minDist * minDist;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const dx = p[0] - last[0];
    const dy = p[1] - last[1];
    if (dx * dx + dy * dy >= minSq) {
      out.push(p);
      last = p;
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}
