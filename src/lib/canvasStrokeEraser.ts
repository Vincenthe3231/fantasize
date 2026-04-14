import type { CanvasStroke } from '@/lib/canvasStrokeUtils';
import { decimateByMinDistance } from '@/lib/canvasStrokeUtils';

const MIN_FLOW = 0.35;

/** Distance from point `p` to segment `ab`. */
export function pointToSegmentDist(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const bx = p[0] - a[0];
  const by = p[1] - a[1];
  const len2 = ax * ax + ay * ay;
  if (len2 < 1e-12) return Math.hypot(bx, by);
  let t = (bx * ax + by * ay) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * ax;
  const cy = a[1] + t * ay;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

/** Minimum distance between two segments in R² (sufficient for eraser proximity tests). */
export function segmentToSegmentMinDist(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number]
): number {
  return Math.min(
    pointToSegmentDist(a1, b1, b2),
    pointToSegmentDist(a2, b1, b2),
    pointToSegmentDist(b1, a1, a2),
    pointToSegmentDist(b2, a1, a2)
  );
}

function minDistSegmentToPolyline(
  a: [number, number],
  b: [number, number],
  poly: [number, number][]
): number {
  if (poly.length < 2) {
    if (poly.length === 1) return pointToSegmentDist(poly[0]!, a, b);
    return Infinity;
  }
  let m = Infinity;
  for (let j = 0; j < poly.length - 1; j++) {
    const d = segmentToSegmentMinDist(a, b, poly[j]!, poly[j + 1]!);
    if (d < m) m = d;
  }
  return m;
}

function strokeBbox(points: [number, number][], pad: number) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function bboxesOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

/**
 * Split a polyline where consecutive edges intersect the eraser tube (radius `radiusFlow` in flow space).
 */
export function splitPolylineByErasedEdges(
  points: [number, number][],
  eraserPath: [number, number][],
  radiusFlow: number
): [number, number][][] {
  const n = points.length;
  if (n < 2 || eraserPath.length < 1) return points.length >= 2 ? [points] : [];

  const r = Math.max(radiusFlow, 1e-4);
  const edgeErased: boolean[] = new Array(Math.max(0, n - 1)).fill(false);
  for (let i = 0; i < n - 1; i++) {
    const d = minDistSegmentToPolyline(points[i]!, points[i + 1]!, eraserPath);
    edgeErased[i] = d < r;
  }

  const parts: [number, number][][] = [];
  let start = 0;
  for (let i = 0; i < n - 1; i++) {
    if (edgeErased[i]) {
      const chunk = points.slice(start, i + 1);
      if (chunk.length >= 2) parts.push(chunk as [number, number][]);
      start = i + 1;
    }
  }
  const rest = points.slice(start);
  if (rest.length >= 2) parts.push(rest as [number, number][]);

  return parts;
}

function newStrokeId(): string {
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Apply segment eraser: strokes whose segments pass near `eraserPath` are split / shortened.
 * `radiusFlow` is half the eraser width in flow/world units (e.g. widthPx / (2 * zoom)).
 */
export function eraseStrokesAlongPolyline(
  strokes: CanvasStroke[],
  eraserPath: [number, number][],
  radiusFlow: number
): CanvasStroke[] {
  if (eraserPath.length < 2) return strokes;

  const eraserPad = strokeBbox(eraserPath, radiusFlow * 2);
  const out: CanvasStroke[] = [];

  for (const s of strokes) {
    const pts = s.points;
    if (pts.length < 2) continue;
    const pad = strokeBbox(pts, radiusFlow * 2);
    if (!bboxesOverlap(pad, eraserPad)) {
      out.push(s);
      continue;
    }

    const fragments = splitPolylineByErasedEdges(pts, eraserPath, radiusFlow);
    for (const frag of fragments) {
      const dec = decimateByMinDistance(frag, MIN_FLOW);
      if (dec.length < 2) continue;
      out.push({
        id: newStrokeId(),
        points: dec,
        color: s.color,
        widthPx: s.widthPx,
      });
    }
  }

  return out;
}
