import { describe, expect, it } from 'vitest';
import {
  eraseStrokesAlongPolyline,
  pointToSegmentDist,
  segmentToSegmentMinDist,
} from '@/lib/canvasStrokeEraser';

describe('canvasStrokeEraser', () => {
  it('pointToSegmentDist: endpoint projects to segment', () => {
    const d = pointToSegmentDist([0, 0], [1, 0], [3, 0]);
    expect(d).toBeCloseTo(1);
  });

  it('segmentToSegmentMinDist: parallel segments', () => {
    const d = segmentToSegmentMinDist([0, 0], [2, 0], [0, 1], [2, 1]);
    expect(d).toBeCloseTo(1);
  });

  it('eraseStrokesAlongPolyline: trims tail when only second segment is near eraser', () => {
    const strokes = [
      {
        id: 'a',
        color: '#fff',
        widthPx: 2,
        points: [
          [0, 0],
          [30, 0],
          [60, 0],
        ] as [number, number][],
      },
    ];
    const eraser: [number, number][] = [
      [45, 0],
      [55, 0],
    ];
    const out = eraseStrokesAlongPolyline(strokes, eraser, 12);
    expect(out.length).toBe(1);
    expect(out[0]!.points.length).toBeGreaterThanOrEqual(2);
  });

  it('eraseStrokesAlongPolyline: clears stroke when fully covered', () => {
    const strokes = [
      {
        id: 'a',
        color: '#fff',
        widthPx: 2,
        points: [
          [0, 0],
          [100, 0],
        ] as [number, number][],
      },
    ];
    const eraser: [number, number][] = [
      [0, 0],
      [100, 0],
    ];
    const out = eraseStrokesAlongPolyline(strokes, eraser, 8);
    expect(out.length).toBe(0);
  });
});
