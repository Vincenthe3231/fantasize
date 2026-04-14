import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';

export type CanvasStrokeRedraw = () => void;

export type DrawPreviewMeta = {
  mode: 'pencil' | 'eraser';
  color: string;
  widthPx: number;
};

export type CanvasStrokeRenderContextValue = {
  /** In-progress stroke in flow coordinates; not persisted until pointer up. */
  previewPointsRef: MutableRefObject<[number, number][] | null>;
  /** How to render the in-progress path (pencil vs eraser preview). */
  previewMetaRef: MutableRefObject<DrawPreviewMeta | null>;
  registerRedraw: (fn: CanvasStrokeRedraw | null) => void;
  requestRedraw: () => void;
};

export const CanvasStrokeRenderContext = createContext<CanvasStrokeRenderContextValue | null>(null);

export function CanvasStrokeRenderProvider({ children }: { children: ReactNode }) {
  const previewPointsRef = useRef<[number, number][] | null>(null);
  const previewMetaRef = useRef<DrawPreviewMeta | null>(null);
  const redrawRef = useRef<CanvasStrokeRedraw | null>(null);

  const registerRedraw = useCallback((fn: CanvasStrokeRedraw | null) => {
    redrawRef.current = fn;
  }, []);

  const requestRedraw = useCallback(() => {
    redrawRef.current?.();
  }, []);

  const value = useMemo(
    () => ({ previewPointsRef, previewMetaRef, registerRedraw, requestRedraw }),
    [registerRedraw, requestRedraw]
  );

  return (
    <CanvasStrokeRenderContext.Provider value={value}>{children}</CanvasStrokeRenderContext.Provider>
  );
}

export function useCanvasStrokeRender(): CanvasStrokeRenderContextValue {
  const v = useContext(CanvasStrokeRenderContext);
  if (!v) {
    throw new Error('useCanvasStrokeRender must be used within CanvasStrokeRenderProvider');
  }
  return v;
}
