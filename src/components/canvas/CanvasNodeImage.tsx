import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type RefObject,
} from 'react';
import { canvasImagePlanForBox } from '@/lib/imageDelivery';
import { canvasPerfFlags } from '@/lib/canvasPerf';
import { useCanvasViewportGestureActive } from '@/contexts/CanvasViewportGestureContext';

type BaseProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'decoding' | 'width' | 'height'
> & {
  mediaUrl: string;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
  /** When set, skip layout observation and use a fixed CSS box (e.g. list row 56×56). */
  fixedCssWidth?: number;
  fixedCssHeight?: number;
  /**
   * Observe this element’s content box; delivery tiers follow `width`/`height` × DPR.
   * When set, `fallbackCssWidth` is used until the first observation.
   */
  measureRef?: RefObject<HTMLElement | null>;
  fallbackCssWidth?: number;
  fallbackCssHeight?: number;
};

function useDebouncedContentBox(
  measureRef: RefObject<HTMLElement | null> | undefined,
  fallbackW: number,
  fallbackH: number,
  debounceMs: number
): { w: number; h: number } {
  const [box, setBox] = useState(() => ({
    w: Math.max(1, fallbackW),
    h: Math.max(1, fallbackH),
  }));

  useEffect(() => {
    if (!measureRef) return;
    const el = measureRef.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const apply = (w: number, h: number) => {
      if (w < 1 || h < 1) return;
      setBox({ w, h });
    };

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      if (timeoutId != null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        apply(cr.width, cr.height);
      }, debounceMs);
    });

    ro.observe(el);
    apply(el.clientWidth, el.clientHeight);

    return () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, [measureRef, debounceMs]);

  if (!measureRef) {
    return { w: Math.max(1, fallbackW), h: Math.max(1, fallbackH) };
  }
  return box;
}

/**
 * Canvas node image: Supabase-aware `srcSet`/`sizes` from measured (or fixed) CSS box,
 * debounced on resize, optional freeze of URL changes during viewport/node-drag gestures,
 * and `decode()` after load to reduce janky first paint.
 */
const CanvasNodeImage = memo(function CanvasNodeImage({
  mediaUrl,
  quality,
  resize = 'cover',
  fixedCssWidth,
  fixedCssHeight,
  measureRef,
  fallbackCssWidth = 320,
  fallbackCssHeight,
  className,
  onLoad,
  loading = 'lazy',
  fetchPriority,
  ...rest
}: BaseProps) {
  const gestureActive =
    useCanvasViewportGestureActive() && canvasPerfFlags.deferCanvasImageUrlDuringViewport;
  const debounceMs = canvasPerfFlags.canvasImageResizeDebounceMs;

  const usesMeasure = measureRef != null;
  const fbW = fallbackCssWidth;
  const fbH = fallbackCssHeight ?? Math.round(fbW * 0.75);

  const fixedW = fixedCssWidth ?? fbW;
  const fixedH = fixedCssHeight ?? fbH;

  const observedBox = useDebouncedContentBox(
    usesMeasure ? measureRef : undefined,
    usesMeasure ? fbW : fixedW,
    usesMeasure ? fbH : fixedH,
    debounceMs
  );

  const cssW = observedBox.w;
  const cssH = observedBox.h;

  const desired = useMemo(
    () => canvasImagePlanForBox(mediaUrl, cssW, cssH, { quality, resize }),
    [mediaUrl, cssW, cssH, quality, resize]
  );

  const [displayed, setDisplayed] = useState(desired);

  useEffect(() => {
    if (gestureActive) return;
    setDisplayed(desired);
  }, [desired, gestureActive]);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (typeof img.decode === 'function') {
        void img.decode().catch(() => {});
      }
      onLoad?.(e);
    },
    [onLoad]
  );

  return (
    <img
      {...rest}
      src={displayed.src}
      srcSet={displayed.srcSet}
      sizes={displayed.sizes}
      decoding="async"
      loading={loading}
      fetchPriority={fetchPriority}
      className={className}
      onLoad={handleLoad}
    />
  );
});

export default CanvasNodeImage;
