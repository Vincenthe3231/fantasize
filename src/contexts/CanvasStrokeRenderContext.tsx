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

export type CanvasStrokeRenderContextValue = {
  /** In-progress stroke in flow coordinates; not persisted until pointer up. */
  previewPointsRef: MutableRefObject<[number, number][] | null>;
  registerRedraw: (fn: CanvasStrokeRedraw | null) => void;
  requestRedraw: () => void;
};

const CanvasStrokeRenderContext = createContext<CanvasStrokeRenderContextValue | null>(null);

export function CanvasStrokeRenderProvider({ children }: { children: ReactNode }) {
  const previewPointsRef = useRef<[number, number][] | null>(null);
  const redrawRef = useRef<CanvasStrokeRedraw | null>(null);

  const registerRedraw = useCallback((fn: CanvasStrokeRedraw | null) => {
    redrawRef.current = fn;
  }, []);

  const requestRedraw = useCallback(() => {
    redrawRef.current?.();
  }, []);

  const value = useMemo(
    () => ({ previewPointsRef, registerRedraw, requestRedraw }),
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
