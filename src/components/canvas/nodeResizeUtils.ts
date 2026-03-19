import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from 'reactflow';
import { shallow } from 'zustand/shallow';

type InternalNode = {
  width?: number | null;
  height?: number | null;
  style?: CSSProperties;
};

function readWidthHeight(n: InternalNode | undefined, defaultWidth: number): { width: number; height?: number } {
  if (!n) {
    return { width: defaultWidth };
  }
  let width = defaultWidth;
  if (typeof n.width === 'number' && n.width > 0) {
    width = n.width;
  } else {
    const sw = n.style?.width;
    if (typeof sw === 'number' && sw > 0) width = sw;
    else if (typeof sw === 'string' && sw.endsWith('px')) {
      const parsed = parseFloat(sw);
      if (!Number.isNaN(parsed) && parsed > 0) width = parsed;
    }
  }
  let height: number | undefined;
  if (typeof n.height === 'number' && n.height > 0) {
    height = n.height;
  } else {
    const sh = n.style?.height;
    if (typeof sh === 'number' && sh > 0) height = sh;
    else if (typeof sh === 'string' && sh.endsWith('px')) {
      const parsed = parseFloat(sh);
      if (!Number.isNaN(parsed) && parsed > 0) height = parsed;
    }
  }
  return { width, ...(height != null ? { height } : {}) };
}

/**
 * React Flow 11 does not pass `style` / width / height into custom node components; they are applied on the
 * outer `.react-flow__node` wrapper only. Read live dimensions from the flow store so the inner shell and
 * corner resize handles match the actual node size.
 */
export function useResizableNodeShell(id: string, defaultWidth: number): {
  shellStyle: CSSProperties;
  fillHeight: boolean;
} {
  const selector = useCallback(
    (s: { nodeInternals: Map<string, unknown> }) => {
      const n = s.nodeInternals.get(id) as InternalNode | undefined;
      return readWidthHeight(n, defaultWidth);
    },
    [id, defaultWidth]
  );
  const dims = useStore(selector, shallow);
  const shellStyle: CSSProperties =
    dims.height != null ? { width: dims.width, height: dims.height } : { width: dims.width };
  const fillHeight = typeof dims.height === 'number' && dims.height > 0;
  return { shellStyle, fillHeight };
}

/** Whether the node has an explicit height from React Flow (e.g. after corner resize). */
export function hasExplicitNodeHeight(style?: CSSProperties): boolean {
  const h = style?.height;
  return typeof h === 'number' && h > 0;
}

/** Outer shell dimensions from RF props when available (usually undefined on custom nodes in RF 11). */
export function resizableShellStyle(style: CSSProperties | undefined, defaultWidth: number): CSSProperties {
  const w = style?.width;
  const width =
    typeof w === 'number' && w > 0
      ? w
      : typeof w === 'string' && w.trim() !== ''
        ? w
        : defaultWidth;
  return {
    width,
    height: style?.height,
  };
}
